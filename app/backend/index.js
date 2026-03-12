const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

const dbConfig = {
    host: '127.0.0.1',
    user: 'root',
    password: '8850', // ★ MariaDB 비번 입력
    database: 'plumbing_db',
    port: 3306
};
const pool = mysql.createPool(dbConfig);

// [API] 예약 신청
app.post('/api/v1/reservations', async (req, res) => {
    const { name, phone, address, issueType } = req.body;
    const resNumber = `RES-${Date.now()}`;
    try {
        await pool.execute(
            'INSERT INTO reservations (res_number, customer_name, phone_number, address, issue_type, status) VALUES (?, ?, ?, ?, ?, ?)',
            [resNumber, name, phone, address, issueType, 'PENDING']
        );
        res.status(201).json({ success: true, resNumber });
    } catch (err) { res.status(500).json({ success: false }); }
});

// [API] 고객용 예약 상세 조회
app.get('/api/v1/reservations/:resNumber', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM reservations WHERE res_number = ?', [req.params.resNumber.trim()]);
        if (rows.length > 0) res.json({ success: true, data: rows[0] });
        else res.status(404).json({ success: false, message: "내역 없음" });
    } catch (err) { res.status(500).json({ success: false }); }
});

// [API] 관리자용 전체 목록 조회
app.get('/api/admin/reservations', async (req, res) => {
    const { status } = req.query;
    try {
        let sql = 'SELECT * FROM reservations';
        const params = [];
        if (status && status !== 'ALL') {
            sql += ' WHERE status = ?';
            params.push(status);
        }
        sql += ' ORDER BY created_at DESC';
        const [rows] = await pool.execute(sql, params);
        res.json({ success: true, list: rows });
    } catch (err) { res.status(500).json({ success: false }); }
});


// [관리자 전용] 상태 업데이트 API
app.patch('/api/admin/reservations/:id', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    // 데이터가 잘 들어오는지 터미널에 출력 (디버깅용)
    console.log(`[상태 변경 요청] ID: ${id}, 변경할 상태: ${status}`);

    try {
        // 혹시 모를 공백 제거 및 길이 제한 (안전장치)
        const cleanStatus = status.trim().toUpperCase().substring(0, 20);

        const [result] = await pool.execute(
            'UPDATE reservations SET status = ? WHERE id = ?',
            [cleanStatus, id]
        );

        if (result.affectedRows > 0) {
            res.json({ success: true, message: "상태 업데이트 성공" });
        } else {
            res.status(404).json({ success: false, message: "해당 예약을 찾을 수 없습니다." });
        }
    } catch (err) {
        console.error("DB 에러:", err);
        res.status(500).json({ success: false, message: "서버 오류 발생" });
    }
});

app.listen(4000, () => console.log('🚀 Backend: http://localhost:4000'));