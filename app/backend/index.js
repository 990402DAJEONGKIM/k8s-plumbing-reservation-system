const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

const dbConfig = {
    host: '127.0.0.1',
    user: 'root',
    password: '8850', // 비번 확인
    database: 'plumbing_db',
    port: 3306
};
const pool = mysql.createPool(dbConfig);

// [API] 예약 관리 - 검색 및 필터링
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

// [API] 고객 관리 - 검색 및 주소/방문횟수 포함
app.get('/api/admin/customers', async (req, res) => {
    const { search } = req.query;
    try {
        let sql = `
            SELECT 
                c.customer_name, 
                c.phone_number, 
                c.address, 
                c.grade,
                (SELECT COUNT(*) FROM reservations r WHERE r.phone_number = c.phone_number) as visit_count,
                (SELECT MAX(created_at) FROM reservations r WHERE r.phone_number = c.phone_number) as last_visit
            FROM customers c
            WHERE 1=1
        `;
        const params = [];
        if (search) {
            sql += ' AND (c.customer_name LIKE ? OR c.phone_number LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }
        sql += ' ORDER BY last_visit DESC';
        const [rows] = await pool.execute(sql, params);
        res.json({ success: true, list: rows });
    } catch (err) { res.status(500).json({ success: false }); }
});

// [API] 일정 조회 - 날짜별 요약
app.get('/api/admin/calendar', async (req, res) => {
    try {
        const [rows] = await pool.execute(`
            SELECT DATE_FORMAT(created_at, "%Y-%m-%d") as date, COUNT(*) as count 
            FROM reservations GROUP BY date ORDER BY date DESC
        `);
        res.json({ success: true, list: rows });
    } catch (err) { res.status(500).json({ success: false }); }
});

// [API] 상태 업데이트 (중요: 대문자로 변환하여 저장)
app.patch('/api/admin/reservations/:id', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
        await pool.execute('UPDATE reservations SET status = ? WHERE id = ?', [status.toUpperCase(), id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
});

app.listen(4000, () => console.log('🚀 Admin Server: http://localhost:4000'));