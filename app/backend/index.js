const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const os = require('os');
const app = express();

app.use(cors());
app.use(express.json());

const dbConfig = {
    host: '127.0.0.1',
    user: 'root',
    password: '8850', 
    database: 'plumbing_db',
    port: 3306
};
const pool = mysql.createPool(dbConfig);

let errorLogs = [];

// [API] 예약 리스트 (검색/필터)
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

// [API] 고객 리스트
app.get('/api/admin/customers', async (req, res) => {
    const { search } = req.query;
    try {
        let sql = `
            SELECT c.customer_name, c.phone_number, c.address, c.grade,
            (SELECT COUNT(*) FROM reservations r WHERE r.phone_number = c.phone_number) as visit_count,
            (SELECT MAX(created_at) FROM reservations r WHERE r.phone_number = c.phone_number) as last_visit
            FROM customers c WHERE 1=1
        `;
        const params = [];
        if (search) { sql += ' AND (c.customer_name LIKE ? OR c.phone_number LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
        const [rows] = await pool.execute(sql, params);
        res.json({ success: true, list: rows });
    } catch (err) { res.status(500).json({ success: false }); }
});

// [API] 시스템 모니터링
app.get('/api/admin/monitor-data', (req, res) => {
    const memUsage = ((os.totalmem() - os.freemem()) / os.totalmem() * 100).toFixed(1);
    const cpuLoad = (os.loadavg()[0] * 10).toFixed(1);
    res.json({ success: true, cpu: `${cpuLoad}%`, mem: `${memUsage}%`, errCount: errorLogs.length, logs: errorLogs });
});

// [API] 상태 업데이트 (핵심!)
app.patch('/api/admin/reservations/:id', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
        const [result] = await pool.execute('UPDATE reservations SET status = ? WHERE id = ?', [status.toUpperCase(), id]);
        if (result.affectedRows > 0) res.json({ success: true });
        else res.status(404).json({ success: false, message: "Not Found" });
    } catch (err) { res.status(500).json({ success: false }); }
});

app.get('/api/test-error', (req, res) => {
    errorLogs.unshift({ id: Date.now(), time: new Date().toLocaleTimeString(), message: "DB Connection Timeout" });
    if (errorLogs.length > 5) errorLogs.pop();
    res.send("Error logged.");
});

app.listen(4000, () => console.log('🚀 Admin Server: http://localhost:4000'));