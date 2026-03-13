const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const os = require('os');
const fs = require('fs');
const path = require('path');
const app = express();

app.use(cors());
app.use(express.json());

const dbConfig = { host: '127.0.0.1', user: 'root', password: '8850', database: 'plumbing_db', port: 3306 };
const pool = mysql.createPool(dbConfig);

// 전역 시스템 상태
let errorLogs = [];
let isMaintenance = false;

// 🛡️ [검문소] 서버 점검 모드 체크 (반드시 API 정의보다 위에 위치!)
app.use((req, res, next) => {
    // 설정 변경 API(/api/admin/settings)를 제외한 모든 요청은 점검 시 503 차단
    if (isMaintenance && !req.path.includes('/api/admin/settings')) {
        return res.status(503).json({ success: false, message: "현재 서버 점검 중입니다." });
    }
    next();
});

// [API] 1. 예약 관리 (조회 페이지도 이 API를 사용함)
app.get('/api/admin/reservations', async (req, res) => {
    const { status, search } = req.query;
    try {
        let sql = 'SELECT * FROM reservations WHERE 1=1';
        const params = [];
        if (status && status !== 'ALL') { sql += ' AND status = ?'; params.push(status); }
        if (search) {
            sql += ' AND (res_number LIKE ? OR customer_name LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }
        sql += ' ORDER BY created_at DESC';
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

// [API] 2. 고객 관리
app.get('/api/admin/customers', async (req, res) => {
    const { search } = req.query;
    try {
        let sql = `SELECT c.*, (SELECT COUNT(*) FROM reservations r WHERE r.phone_number = c.phone_number) as visit_count FROM customers c WHERE 1=1`;
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

app.listen(4000, () => console.log('🚀 Admin Server: http://localhost:4000'));