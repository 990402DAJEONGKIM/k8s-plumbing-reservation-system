const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const os = require('os');
const app = express();

app.use(cors());
app.use(express.json());

const dbConfig = { host: '127.0.0.1', user: 'root', password: '8850', database: 'plumbing_db', port: 3306 };
const pool = mysql.createPool(dbConfig);

// 에러 로그 저장소 (테스트용)
let errorLogs = [];

// [API] 모니터링 데이터 (CPU, MEM, 에러 개수)
app.get('/api/admin/monitor-data', (req, res) => {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const memUsage = ((totalMem - freeMem) / totalMem * 100).toFixed(1);
    const cpuLoad = (os.loadavg()[0] * 10).toFixed(1);

    res.json({
        success: true,
        cpu: `${cpuLoad}%`,
        mem: `${memUsage}%`,
        errCount: errorLogs.length,
        logs: errorLogs // 에러 목록도 함께 전달
    });
});

// [API] 강제 에러 발생 테스트용
app.get('/api/test-error', (req, res) => {
    const newError = {
        id: Date.now(),
        time: new Date().toLocaleTimeString(),
        message: "DB Connection Timeout - Slave Server #1"
    };
    errorLogs.unshift(newError); // 최신 에러를 맨 앞으로
    if (errorLogs.length > 5) errorLogs.pop(); // 최대 5개 유지
    res.send("에러가 기록되었습니다. 관리자 페이지를 확인하세요.");
});

// [기존 API들: reservations, customers, calendar 등 그대로 유지]
app.get('/api/admin/reservations', async (req, res) => { /* 생략(이전과 동일) */ });
app.get('/api/admin/customers', async (req, res) => { /* 생략(이전과 동일) */ });
app.patch('/api/admin/reservations/:id', async (req, res) => { /* 생략(이전과 동일) */ });

app.listen(4000, () => console.log('🚀 Admin Server: http://localhost:4000'));