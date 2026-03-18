const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const os = require('os');
const fs = require('fs');
const path = require('path');
const app = express();

app.use(cors());
app.use(express.json());

const dbConfig = {
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '8850',
    database: process.env.DB_NAME || 'plumbing_db',
    port: process.env.DB_PORT || 3306
};
const pool = mysql.createPool(dbConfig);

// 전역 시스템 상태
let errorLogs = [];
let isMaintenance = false;

// 관리자 계정 정보 (원래는 DB에 저장해야 함)
let adminAccount = {
    username: 'admin',
    password: 'password' // 실제 환경에서는 해시 처리 필수
};

// 공지사항 데이터 (원래는 DB에 저장해야 함)
let announcements = [
    { id: 1, title: '새로운 기능 업데이트', content: '이제 관리자 페이지에서 직접 공지사항을 관리할 수 있습니다.', createdAt: new Date() },
    { id: 2, title: '시스템 점검 안내', content: '금일 자정부터 1시간 동안 시스템 점검이 있을 예정입니다.', createdAt: new Date() },
];
let nextAnnounceId = 3;

// 🛡️ [검문소] 서버 점검 모드 체크 (반드시 API 정의보다 위에 위치!)
app.use((req, res, next) => {
    // 설정 변경 API(/api/admin/settings)를 제외한 모든 요청은 점검 시 503 차단
    if (isMaintenance && !req.path.includes('/api/admin/settings')) {
        return res.status(503).json({ success: false, message: "현재 서버 점검 중입니다." });
    }
    next();
});

// [API] 0. 로그인 (간단한 예시)
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    if (username === adminAccount.username && password === adminAccount.password) {
        // 실제로는 JWT 토큰 등 발급
        res.json({ success: true, message: '로그인 성공' });
    } else {
        res.status(401).json({ success: false, message: '아이디 또는 비밀번호가 일치하지 않습니다.' });
    }
});

// [API] 1. 예약 관리 (조회 페이지도 이 API를 사용함)
app.get('/api/admin/reservations', async (req, res) => {
    const { status, search } = req.query;
    try {
        let sql = 'SELECT * FROM reservations WHERE 1=1';
        const params = [];
        if (status && status !== 'ALL') { sql += ' AND status = ?'; params.push(status); }
        if (search) {
            sql += ' AND (res_number LIKE ? OR customer_name LIKE ? OR phone_number LIKE ? OR DATE_FORMAT(reservation_datetime, "%Y-%m-%d") LIKE ?)';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
        }
        sql += ' ORDER BY reservation_datetime IS NULL ASC, reservation_datetime ASC, created_at DESC';
        const [rows] = await pool.execute(sql, params);
        res.json({ success: true, list: rows });
    } catch (err) { res.status(500).json({ success: false }); }
});

app.patch('/api/admin/reservations/:id', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
        await pool.execute('UPDATE reservations SET status = ? WHERE id = ?', [status.toUpperCase(), id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
});

// [API] 1.5 일정 조회 (달력 데이터 집계)
app.get('/api/admin/calendar', async (req, res) => {
    try {
        const sql = `
            SELECT DATE_FORMAT(reservation_datetime, '%Y-%m-%d') as date, 
                   COUNT(*) as count,
                   GROUP_CONCAT(CONCAT(DATE_FORMAT(reservation_datetime, '%H:%i'), ' ', customer_name, ' (', issue_type, ')') ORDER BY reservation_datetime ASC SEPARATOR '||') as details
            FROM reservations 
            WHERE reservation_datetime IS NOT NULL 
            GROUP BY DATE_FORMAT(reservation_datetime, '%Y-%m-%d')
            ORDER BY date ASC
        `;
        const [rows] = await pool.execute(sql);
        res.json({ success: true, list: rows });
    } catch (err) { res.status(500).json({ success: false }); }
});

// [API] 2. 고객 관리
app.get('/api/admin/customers', async (req, res) => {
    const { search } = req.query;
    try {
        let sql = `SELECT c.*, 
                   (SELECT COUNT(*) FROM reservations r WHERE REPLACE(r.phone_number, '-', '') = REPLACE(c.phone_number, '-', '') OR REPLACE(r.customer_name, ' ', '') = REPLACE(c.customer_name, ' ', '')) as visit_count,
                   (SELECT MAX(reservation_datetime) FROM reservations r WHERE REPLACE(r.phone_number, '-', '') = REPLACE(c.phone_number, '-', '') OR REPLACE(r.customer_name, ' ', '') = REPLACE(c.customer_name, ' ', '')) as last_visit_date
                   FROM customers c WHERE 1=1`;
        const params = [];
        if (search) { sql += ' AND (customer_name LIKE ? OR phone_number LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
        const [rows] = await pool.execute(sql, params);
        res.json({ success: true, list: rows });
    } catch (err) { res.status(500).json({ success: false }); }
});

// [API] 3. 설정 및 백업
app.get('/api/admin/settings', (req, res) => res.json({ isMaintenance }));
app.post('/api/admin/settings/toggle', (req, res) => {
    isMaintenance = !isMaintenance;
    res.json({ success: true, isMaintenance });
});

app.get('/api/admin/backup/download', (req, res) => {
    const fileName = `plumbing_db_backup.sql`;
    const filePath = path.join(__dirname, fileName);
    fs.writeFileSync(filePath, `-- Backup Date: ${new Date().toLocaleString()}\nUSE plumbing_db;`);
    res.download(filePath, fileName, () => fs.unlinkSync(filePath));
});

// [API] 4. 모니터링
app.get('/api/admin/monitor-data', (req, res) => {
    const memUsage = ((os.totalmem() - os.freemem()) / os.totalmem() * 100).toFixed(1);
    const cpuLoad = (os.loadavg()[0] * 10).toFixed(1);
    res.json({ success: true, cpu: `${cpuLoad}%`, mem: `${memUsage}%`, errCount: errorLogs.length, logs: errorLogs });
});

// [API] 5. 관리자 계정
app.get('/api/admin/account', (req, res) => {
    // 비밀번호는 제외하고 아이디만 전송
    res.json({ success: true, username: adminAccount.username });
});

app.put('/api/admin/account', (req, res) => {
    const { currentPassword, newUsername, newPassword } = req.body;

    // 현재 비밀번호 확인
    if (currentPassword !== adminAccount.password) {
        return res.status(403).json({ success: false, message: '현재 비밀번호가 일치하지 않습니다.' });
    }

    // 새 정보로 업데이트
    adminAccount.username = newUsername || adminAccount.username;
    adminAccount.password = newPassword || adminAccount.password;

    res.json({ success: true, message: '계정 정보가 성공적으로 변경되었습니다.' });
});

// [API] 6. 공지사항 관리
app.get('/api/admin/announcements', (req, res) => {
    res.json({ success: true, list: announcements.sort((a, b) => b.id - a.id) });
});

app.post('/api/admin/announcements', (req, res) => {
    const { title, content } = req.body;
    if (!title || !content) {
        return res.status(400).json({ success: false, message: '제목과 내용을 모두 입력해주세요.' });
    }
    const newAnnounce = { id: nextAnnounceId++, title, content, createdAt: new Date() };
    announcements.push(newAnnounce);
    res.json({ success: true, item: newAnnounce });
});

app.put('/api/admin/announcements/:id', (req, res) => {
    const { id } = req.params;
    const { title, content } = req.body;
    const index = announcements.findIndex(a => a.id == id);

    if (index === -1) {
        return res.status(404).json({ success: false, message: '공지사항을 찾을 수 없습니다.' });
    }

    announcements[index] = { ...announcements[index], title, content };
    res.json({ success: true, item: announcements[index] });
});

app.delete('/api/admin/announcements/:id', (req, res) => {
    const { id } = req.params;
    const index = announcements.findIndex(a => a.id == id);

    if (index === -1) {
        return res.status(404).json({ success: false, message: '공지사항을 찾을 수 없습니다.' });
    }

    announcements.splice(index, 1);
    res.json({ success: true, message: '공지사항이 삭제되었습니다.' });
});

app.listen(4000, () => console.log('🚀 Admin Server: http://localhost:4000'));