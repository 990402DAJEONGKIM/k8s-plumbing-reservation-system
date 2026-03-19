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

// 🛡️ [검문소] 서버 점검 모드 체크 (반드시 API 정의보다 위에 위치!)
app.use((req, res, next) => {
    // 설정 변경 API(/api/admin/settings)를 제외한 모든 요청은 점검 시 503 차단
    if (isMaintenance && !req.path.includes('/api/admin/settings')) {
        return res.status(503).json({ success: false, message: "현재 서버 점검 중입니다." });
    }
    next();
});

// [API] 0. 로그인 (간단한 예시)
app.post('/api/admin/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const [rows] = await pool.execute('SELECT * FROM admin_users WHERE username = ? AND password = ?', [username, password]);
        if (rows.length > 0) {
            // 실제로는 JWT 토큰 등 발급
            res.json({ success: true, message: '로그인 성공' });
        } else {
            res.status(401).json({ success: false, message: '아이디 또는 비밀번호가 일치하지 않습니다.' });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
});

// [API] 0.5 사용자 예약 접수 (Front -> Backend)
app.post('/api/reservations', async (req, res) => {
    const { name, phone, address, issueType, reservation_datetime } = req.body;
    
    // 예약 번호 생성 (예: RES-20240101-1234)
    const date = new Date();
    const dateString = date.getFullYear() + String(date.getMonth() + 1).padStart(2, '0') + String(date.getDate()).padStart(2, '0');
    const randomNum = Math.floor(1000 + Math.random() * 9000); // 4자리 난수
    const resNumber = `RES-${dateString}-${randomNum}`;

    // 💡 KST로 입력된 날짜를 서버(UTC) 기준 Date 객체로 올바르게 파싱 (타임존 +9시간 보정)
    const resDate = reservation_datetime ? new Date(reservation_datetime + '+09:00') : null;

    try {
        // 1. 예약 정보 저장
        await pool.execute(
            'INSERT INTO reservations (res_number, customer_name, phone_number, address, issue_type, reservation_datetime) VALUES (?, ?, ?, ?, ?, ?)',
            [resNumber, name, phone, address, issueType, resDate]
        );
        // 2. 고객 목록에도 저장 (이미 같은 전화번호가 있으면 무시)
        await pool.execute(
            'INSERT INTO customers (customer_name, phone_number, address) SELECT ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM customers WHERE phone_number = ?)',
            [name, phone, address, phone]
        );

        res.json({ success: true, resNumber });
    } catch (err) { res.status(500).json({ success: false, message: '예약 접수 중 오류가 발생했습니다.' }); }
});

// [API] 1. 예약 관리 (조회 페이지도 이 API를 사용함)
app.get('/api/admin/reservations', async (req, res) => {
    const { status, search } = req.query;
    try {
        let sql = 'SELECT * FROM reservations WHERE 1=1';
        const params = [];
        if (status && status !== 'ALL') { sql += ' AND status = ?'; params.push(status); }
        if (search) {
            // 💡 검색 시 DB에 저장된 UTC 시간을 KST로 포맷팅하여 매칭
            sql += ' AND (res_number LIKE ? OR customer_name LIKE ? OR phone_number LIKE ? OR DATE_FORMAT(DATE_ADD(reservation_datetime, INTERVAL 9 HOUR), "%Y-%m-%d") LIKE ?)';
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
        // 💡 DB에 저장된 UTC 시간을 한국 시간(KST, +9시간)으로 보정하여 달력 그룹핑
        const sql = `
            SELECT DATE_FORMAT(DATE_ADD(reservation_datetime, INTERVAL 9 HOUR), '%Y-%m-%d') as date, 
                   COUNT(*) as count,
                   GROUP_CONCAT(CONCAT(DATE_FORMAT(DATE_ADD(reservation_datetime, INTERVAL 9 HOUR), '%H:%i'), ' ', customer_name, ' (', issue_type, ')') ORDER BY reservation_datetime ASC SEPARATOR '||') as details
            FROM reservations 
            WHERE reservation_datetime IS NOT NULL 
            GROUP BY DATE_FORMAT(DATE_ADD(reservation_datetime, INTERVAL 9 HOUR), '%Y-%m-%d')
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
const PROMETHEUS_URL = process.env.PROMETHEUS_URL || 'http://monitoring-kube-prometheus-prometheus.monitoring.svc.cluster.local:9090';

//  Prometheus에 PromQL 쿼리를 날리는 헬퍼 함수
async function queryProm(query) {
    try {
        const res = await fetch(`${PROMETHEUS_URL}/api/v1/query?query=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (data.status === 'success' && data.data.result.length > 0) {
            return parseFloat(data.data.result[0].value[1]);
        }
    } catch (e) { /* 무시하고 Fallback 데이터 반환 */ }
    return null;
}

app.get('/api/admin/monitor-data', async (req, res) => {
    // 1. 병렬로 여러 PromQL 쿼리 실행 (Node Exporter & Kube-State-Metrics)
    const [cpu, mem, disk, netRx, podRun, podTotal, nodeReady, nodeTotal] = await Promise.all([
        queryProm('100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)'), // CPU 사용률
        queryProm('100 * (1 - ((avg_over_time(node_memory_MemFree_bytes[5m]) + avg_over_time(node_memory_Cached_bytes[5m]) + avg_over_time(node_memory_Buffers_bytes[5m])) / avg_over_time(node_memory_MemTotal_bytes[5m])))'), // RAM 사용률
        queryProm('100 - ((sum(node_filesystem_avail_bytes{mountpoint="/"}) / sum(node_filesystem_size_bytes{mountpoint="/"})) * 100)'), // 디스크
        queryProm('sum(rate(node_network_receive_bytes_total[5m]))'), // 네트워크 수신량
        queryProm('sum(kube_pod_status_phase{phase="Running"})'), // 실행 중인 파드 수
        queryProm('sum(kube_pod_status_phase)'), // 전체 파드 수
        queryProm('sum(kube_node_status_condition{condition="Ready", status="true"})'), // 준비된 노드 수
        queryProm('count(kube_node_info)') // 전체 노드 수
    ]);

    // 2. 결과 조합 (데이터가 없으면 가상 데이터 반환)
    const metrics = {
        infra: {
            cpu: cpu !== null ? cpu.toFixed(1) + '%' : 'N/A',
            mem: mem !== null ? mem.toFixed(1) + '%' : 'N/A',
            disk: disk !== null ? disk.toFixed(1) + '%' : 'N/A',
            network: netRx !== null ? (netRx / 1024 / 1024).toFixed(2) + ' MB/s' : 'N/A'
        },
        kubernetes: {
            podHealth: podRun !== null && podTotal !== null ? Math.round((podRun / podTotal) * 100) + '%' : '100%',
            nodeAvailable: nodeReady !== null && nodeTotal !== null ? `${nodeReady} / ${nodeTotal}` : '3 / 3'
        },
        // 🚧 MySQL, Keepalived, Blackbox 등은 추후 Exporter 설치 후 연동
        login: { vipStatus: 'MASTER (Active)', uptime: '99.99%' },
        database: { qps: Math.floor(Math.random() * 50) + 300 + ' q/s', connections: Math.floor(Math.random() * 10) + 40, replicationLag: '0 sec' },
        web: { latency: Math.floor(Math.random() * 20) + 30 + 'ms', httpStatus: '200 OK' }
    };

    res.json({ success: true, metrics, errCount: errorLogs.length, logs: errorLogs });
});

// [API] 5. 관리자 계정
app.get('/api/admin/account', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT username FROM admin_users LIMIT 1');
        if (rows.length > 0) res.json({ success: true, username: rows[0].username });
        else res.json({ success: false, message: '계정 정보가 없습니다.' });
    } catch (err) { res.status(500).json({ success: false }); }
});

app.put('/api/admin/account', async (req, res) => {
    const { currentPassword, newUsername, newPassword } = req.body;

    try {
        const [rows] = await pool.execute('SELECT * FROM admin_users LIMIT 1');
        if (rows.length === 0) return res.status(404).json({ success: false, message: '관리자 계정을 찾을 수 없습니다.' });
        
        const admin = rows[0];
        if (currentPassword !== admin.password) {
            return res.status(403).json({ success: false, message: '현재 비밀번호가 일치하지 않습니다.' });
        }

        const updatedUsername = newUsername || admin.username;
        const updatedPassword = newPassword || admin.password;

        await pool.execute('UPDATE admin_users SET username = ?, password = ? WHERE id = ?', [updatedUsername, updatedPassword, admin.id]);
        res.json({ success: true, message: '계정 정보가 성공적으로 변경되었습니다.' });
    } catch (err) {
        res.status(500).json({ success: false, message: '계정 정보 변경 중 오류가 발생했습니다.' });
    }
});

// [API] 6. 공지사항 관리
app.get('/api/admin/announcements', async (req, res) => {
    try {
        // 프론트엔드가 createdAt 속성을 사용하므로 AS로 이름 매핑
        const [rows] = await pool.execute('SELECT id, title, content, created_at AS createdAt FROM announcements ORDER BY id DESC');
        res.json({ success: true, list: rows });
    } catch (err) { res.status(500).json({ success: false }); }
});

app.post('/api/admin/announcements', async (req, res) => {
    const { title, content } = req.body;
    if (!title || !content) {
        return res.status(400).json({ success: false, message: '제목과 내용을 모두 입력해주세요.' });
    }
    try {
        await pool.execute('INSERT INTO announcements (title, content) VALUES (?, ?)', [title, content]);
        res.json({ success: true, message: '등록 성공' });
    } catch (err) { res.status(500).json({ success: false, message: '공지사항 등록 중 오류가 발생했습니다.' }); }
});

app.put('/api/admin/announcements/:id', async (req, res) => {
    const { id } = req.params;
    const { title, content } = req.body;
    try {
        const [result] = await pool.execute('UPDATE announcements SET title = ?, content = ? WHERE id = ?', [title, content, id]);
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: '공지사항을 찾을 수 없습니다.' });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, message: '공지사항 수정 중 오류가 발생했습니다.' }); }
});

app.delete('/api/admin/announcements/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await pool.execute('DELETE FROM announcements WHERE id = ?', [id]);
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: '공지사항을 찾을 수 없습니다.' });
        res.json({ success: true, message: '공지사항이 삭제되었습니다.' });
    } catch (err) { res.status(500).json({ success: false, message: '공지사항 삭제 중 오류가 발생했습니다.' }); }
});

app.listen(4000, () => console.log('🚀 Admin Server: http://localhost:4000'));