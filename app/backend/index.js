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

// 💡 ProxySQL Admin 접속용 Pool 생성
const proxyAdminPool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    user: 'admin',
    password: 'admin',
    port: 6032
});

// 전역 시스템 상태
let errorLogs = [];
let isMaintenance = false;

// �️ [검문소] 서버 점검 모드 체크 (반드시 API 정의보다 위에 위치!)
app.use((req, res, next) => {
    // 💡 점검 모드라도 GET(조회) 요청은 허용, 쓰기/수정/삭제 요청(POST, PUT, PATCH, DELETE)만 차단
    if (isMaintenance && req.method !== 'GET' && !req.path.includes('/api/admin/settings')) {
        return res.status(503).json({ success: false, message: "현재 서버 점검 중입니다." });
    }
    next();
});

// [API] Health Check (K8s Liveness/Readiness Probe 용도)
app.get('/health', (req, res) => res.status(200).send('OK'));

// [API] 0. 로그인 (간단한 예시)
app.post('/api/admin/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        // 💡 로그인 시 캐시된 빈 데이터를 가져오지 않도록 강제 우회
        const [rows] = await pool.execute('WITH _nc AS (SELECT 1) SELECT * FROM admin_users WHERE username = ? AND password = ?', [username, password]);
        if (rows.length > 0) {
            // 실제로는 JWT 토큰 등 발급
            res.json({ success: true, message: '로그인 성공' });
        } else {
            res.status(401).json({ success: false, message: '아이디 또는 비밀번호가 일치하지 않습니다.' });
        }
    } catch (err) {
        console.error("Login Error:", err);
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
    } catch (err) { 
        // DB 쓰기 실패 (마스터/슬레이브 모두 다운 등) 시 읽기 전용 상태 안내
        console.error("DB Write Error:", err);
        res.status(503).json({ success: false, message: '현재 시스템 복구 중으로 읽기만 가능합니다. 잠시 후 다시 시도해 주세요.' }); 
    }
});

// [API] 1. 예약 관리 (조회 페이지도 이 API를 사용함)
app.get('/api/admin/reservations', async (req, res) => {
    const { status, search, admin } = req.query;
    
    // 💡 쿼리 조합 부분을 밖으로 분리하여 재사용 가능하게 구성
    let sqlBase = `SELECT * FROM reservations WHERE 1=1`;
    const params = [];
    if (status && status !== 'ALL') { sqlBase += ' AND status = ?'; params.push(status); }
    if (search) {
        sqlBase += ' AND (res_number LIKE ? OR customer_name LIKE ? OR phone_number LIKE ? OR DATE_FORMAT(DATE_ADD(reservation_datetime, INTERVAL 9 HOUR), "%Y-%m-%d") LIKE ?)';
        params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }
    sqlBase += ' ORDER BY reservation_datetime IS NULL ASC, reservation_datetime ASC, created_at DESC';

    try {
        const prefix = admin === 'true' ? 'WITH _nc AS (SELECT 1) ' : '';
        const [rows] = await pool.query(prefix + sqlBase, params);
        res.json({ success: true, list: rows });
    } catch (err) { 
        // 🛡️ 슬레이브(읽기 DB) 사망 시 마스터 DB로 0.1초 만에 강제 재시도 (Fallback)
        if (admin !== 'true') {
            try {
                console.warn("⚠️ Slave DB Down! Fallback reading from Master DB...");
                const [fallbackRows] = await pool.query('WITH _nc AS (SELECT 1) ' + sqlBase, params);
                return res.json({ success: true, list: fallbackRows });
            } catch (fallbackErr) {
                console.error("Master Fallback Error:", fallbackErr);
            }
        }
        console.error("Reservations Get Error:", err);
        res.status(500).json({ success: false, message: '조회 중 오류가 발생했습니다.' }); 
    }
});

app.patch('/api/admin/reservations/:id', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
        await pool.execute('UPDATE reservations SET status = ? WHERE id = ?', [status.toUpperCase(), id]);
        res.json({ success: true });
    } catch (err) { 
        console.error("Reservation Update Error:", err);
        res.status(500).json({ success: false, message: '상태 변경 중 오류가 발생했습니다.' }); 
    }
});

// [API] 1.5 일정 조회 (달력 데이터 집계)
app.get('/api/admin/calendar', async (req, res) => {
    const { admin } = req.query;
    try {
        const prefix = admin === 'true' ? 'WITH _nc AS (SELECT 1) ' : '';
        const sql = `
            ${prefix}SELECT DATE_FORMAT(DATE_ADD(reservation_datetime, INTERVAL 9 HOUR), '%Y-%m-%d') as date, 
                   COUNT(*) as count,
                   GROUP_CONCAT(CONCAT(DATE_FORMAT(DATE_ADD(reservation_datetime, INTERVAL 9 HOUR), '%H:%i'), ' ', customer_name, ' (', issue_type, ')') ORDER BY reservation_datetime ASC SEPARATOR '||') as details
            FROM reservations 
            WHERE reservation_datetime IS NOT NULL 
            GROUP BY DATE_FORMAT(DATE_ADD(reservation_datetime, INTERVAL 9 HOUR), '%Y-%m-%d')
            ORDER BY date ASC
        `;
        const [rows] = await pool.query(sql);
        res.json({ success: true, list: rows });
    } catch (err) { 
        console.error("Calendar Get Error:", err);
        res.status(500).json({ success: false, message: '일정 조회 중 오류가 발생했습니다.' }); 
    }
});

// [API] 2. 고객 관리
app.get('/api/admin/customers', async (req, res) => {
    const { search, admin } = req.query;
    try {
        const prefix = admin === 'true' ? 'WITH _nc AS (SELECT 1) ' : '';
        let sql = `${prefix}SELECT c.*, 
                   (SELECT COUNT(*) FROM reservations r WHERE REPLACE(r.phone_number, '-', '') = REPLACE(c.phone_number, '-', '') OR REPLACE(r.customer_name, ' ', '') = REPLACE(c.customer_name, ' ', '')) as visit_count,
                   (SELECT MAX(reservation_datetime) FROM reservations r WHERE REPLACE(r.phone_number, '-', '') = REPLACE(c.phone_number, '-', '') OR REPLACE(r.customer_name, ' ', '') = REPLACE(c.customer_name, ' ', '')) as last_visit_date
                   FROM customers c WHERE 1=1`;
        const params = [];
        if (search) { sql += ' AND (customer_name LIKE ? OR phone_number LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
        const [rows] = await pool.query(sql, params);
        res.json({ success: true, list: rows });
    } catch (err) { 
        console.error("Customers Get Error:", err);
        res.status(500).json({ success: false, message: '조회 중 오류가 발생했습니다.' }); 
    }
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

//  Prometheus에 배열 형태의 결과(Vector)를 가져오는 헬퍼 함수
async function queryPromVector(query) {
    try {
        const res = await fetch(`${PROMETHEUS_URL}/api/v1/query?query=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (data.status === 'success' && data.data.result) return data.data.result;
    } catch (e) { /* 무시하고 빈 배열 반환 */ }
    return [];
}

app.get('/api/admin/monitor-data', async (req, res) => {
    // 💡 HA (고가용성) 상태 실시간 수집
    let haStatus = [];
    try {
        // 1. ProxySQL 라우팅 상태 가져오기
        const [servers] = await proxyAdminPool.query("SELECT hostgroup_id, hostname, status, weight FROM runtime_mysql_servers");
        
        // 💡 ProxySQL 라우팅 통계 (Grafana 메트릭) 가져오기
        const [stats] = await proxyAdminPool.query("SELECT hostgroup, srv_host, ConnUsed, Queries FROM stats_mysql_connection_pool");
        
        // 2. 각 서버별 상세 상태 조회 (직접 접속)
        for (const srv of servers) {
            let role = srv.hostgroup_id === 10 ? 'Writer (Master)' : 'Reader (Slave)';
            let readOnly = 'Unknown';
            let replStatus = 'N/A';
            
            const st = stats.find(s => s.hostgroup === srv.hostgroup_id && s.srv_host === srv.hostname) || { ConnUsed: 0, Queries: 0 };
            
            try {
                const tmpPool = mysql.createPool({ host: srv.hostname, user: 'root', password: '8850', connectTimeout: 1000 });
                const [roRows] = await tmpPool.query("SHOW VARIABLES LIKE 'read_only'");
                if (roRows.length > 0) readOnly = roRows[0].Value;
                
                const [replRows] = await tmpPool.query("SHOW REPLICA STATUS");
                if (replRows.length > 0) {
                    const r = replRows[0];
                    replStatus = `IO: ${r.Replica_IO_Running}, SQL: ${r.Replica_SQL_Running}, Lag: ${r.Seconds_Behind_Source}s`;
                }
                await tmpPool.end();
            } catch(e) {
                readOnly = 'Unreachable';
                replStatus = 'Unreachable';
            }
            haStatus.push({ group: srv.hostgroup_id, role, ip: srv.hostname, status: srv.status, weight: srv.weight, readOnly, replStatus, connUsed: st.ConnUsed, queries: st.Queries });
        }
    } catch(err) {
        console.error("HA Monitor Error:", err);
    }

    // 1. 병렬로 여러 PromQL 쿼리 실행 (전체 요약 + 노드별 상세 데이터 한 번에 조회)
    const [
        cpu, mem, disk, netRx, podRun, podTotal, nodeReady, nodeTotal, 
        cpuVec, memVec, diskVec, nodeStatusVec, nodeInfoVec, upVec,
        mysqlQps, mysqlConn, mysqlSlow, mysqlReplLag
    ] = await Promise.all([
        queryProm('100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)'), // CPU 사용률
        queryProm('100 - (avg(node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) * 100)'), // RAM 사용률 (전체 노드 평균으로 수정)
        queryProm('100 - ((sum(node_filesystem_avail_bytes{mountpoint="/"}) / sum(node_filesystem_size_bytes{mountpoint="/"})) * 100)'), // 디스크
        queryProm('sum(rate(node_network_receive_bytes_total[5m]))'), // 네트워크 수신량
        queryProm('sum(kube_pod_status_phase{phase="Running"})'), // 실행 중인 파드 수
        queryProm('sum(kube_pod_status_phase)'), // 전체 파드 수
        queryProm('sum(kube_node_status_condition{condition="Ready", status="true"})'), // 준비된 노드 수
        queryProm('count(kube_node_info)'), // 전체 노드 수
        // 💡 노드별 상세 데이터를 위한 그룹화(by) 쿼리
        queryPromVector('100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[5m])) by (instance, node) * 100)'),
        queryPromVector('100 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes * 100)'),
        queryPromVector('100 - (node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"} * 100)'),
        queryPromVector('kube_node_status_condition{condition="Ready", status="true"}'),
        queryPromVector('kube_node_info'), // 💡 [추가] IP와 노드 이름 번역을 위한 메타데이터
        queryPromVector('up'), // 💡 [추가] 가장 빠르고 정확한 노드 생존 여부(15초 갱신) 파악용
        
        // 💡 [복구] Prometheus MySQL Exporter 메트릭 호출 쿼리 추가
        queryProm('sum(rate(mysql_global_status_queries[1m]))'),
        queryProm('sum(mysql_global_status_threads_connected)'),
        queryProm('sum(rate(mysql_global_status_slow_queries[1m]))'),
        queryProm('max(mysql_slave_status_seconds_behind_master)')
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
        database: { 
            qps: mysqlQps != null ? Math.round(mysqlQps).toString() + ' q/s' : Math.floor(Math.random() * 50) + 300 + ' q/s (Mock)',
            connections: mysqlConn != null ? mysqlConn.toString() : Math.floor(Math.random() * 10) + 40 + ' (Mock)',
            slowQueries: mysqlSlow != null ? mysqlSlow.toFixed(2).toString() + ' /s' : '0.00 /s (Mock)',
            replicationLag: mysqlReplLag != null ? mysqlReplLag.toString() + ' sec' : '0 sec (Mock)'
        },
        web: { latency: Math.floor(Math.random() * 20) + 30 + 'ms', httpStatus: '200 OK' }
    };

    // 💡 IP와 노드 이름 상호 번역을 위한 사전(Map) 만들기
    // K8s 외부의 VMware 노드들을 예쁘게 표시하기 위해 수동 매핑 추가
    const ipToNodeName = {
        '172.16.0.7': 'mysql-m',
        '172.16.0.8': 'mysql-s',
        '172.16.0.2': 'bastion-m', // 💡 실제 bastion-m IP로 변경
        '172.16.0.9': 'bastion-s', // 💡 실제 bastion-s IP로 변경
        '172.16.0.3': 'nfs'        // 💡 실제 nfs IP로 변경
    };
    const nodeNameToIp = {
        'mysql-m': '172.16.0.7',
        'mysql-s': '172.16.0.8',
        'bastion-m': '172.16.0.2', // 💡 실제 bastion-m IP로 변경
        'bastion-s': '172.16.0.9', // 💡 실제 bastion-s IP로 변경
        'nfs': '172.16.0.3'        // 💡 실제 nfs IP로 변경
    };
    if (nodeInfoVec) {
        nodeInfoVec.forEach(res => {
            if (res.metric.internal_ip && res.metric.node) {
                ipToNodeName[res.metric.internal_ip] = res.metric.node;
                nodeNameToIp[res.metric.node] = res.metric.internal_ip;
            }
        });
    }

    // 3. 노드별 상세 데이터(Node Details) 병합
    const nodeMap = {};
    // Kube-State-Metrics 기반으로 노드 이름 먼저 등록
    if (nodeStatusVec) {
        nodeStatusVec.forEach(res => {
            const nodeName = res.metric.node;
            if(nodeName) nodeMap[nodeName] = { name: nodeName, ip: nodeNameToIp[nodeName] || '', status: '🟢 Ready', cpu: 'N/A', mem: 'N/A', disk: 'N/A', isExternal: false };
        });
    }

    // 💡 외부 노드(VMware)들이 꺼져도 목록에서 사라지지 않도록 사전 등록 (기본값: Down)
    Object.keys(ipToNodeName).forEach(ip => {
        const name = ipToNodeName[ip];
        nodeMap[name] = { name: name, ip: ip, status: '🔴 Down', cpu: 'N/A', mem: 'N/A', disk: 'N/A', isExternal: true };
    });

    // Node Exporter 데이터를 기존 노드 리스트에 병합하는 헬퍼
    const mergeVec = (vec, key) => {
        if (!vec) return;
        vec.forEach(res => {
            let targetNode = res.metric.node || res.metric.instance || 'Unknown';
            if (targetNode.includes(':')) targetNode = targetNode.split(':')[0]; // IP:PORT 인 경우 IP만 추출
            
            // 💡 IP 주소 형태라면 진짜 K8s 노드 이름으로 변경하여 매칭
            if (ipToNodeName[targetNode]) {
                targetNode = ipToNodeName[targetNode];
            }

            const val = res.value ? parseFloat(res.value[1]).toFixed(1) + '%' : 'N/A';
            
            // 일치하는 노드 찾아 값 넣기
            const matchKey = Object.keys(nodeMap).find(k => k === targetNode || k.includes(targetNode) || targetNode.includes(k));
            if (matchKey) {
                nodeMap[matchKey][key] = val;
            } else {
                // 💡 K8s 클러스터 외부의 노드(VMware)일 경우
                const displayIp = nodeNameToIp[targetNode] || (targetNode.match(/^[0-9.]+$/) ? targetNode : '');
                const displayName = targetNode.match(/^[0-9.]+$/) && !nodeNameToIp[targetNode] ? `External Node` : targetNode;
                nodeMap[targetNode] = nodeMap[targetNode] || { name: displayName, ip: displayIp, status: '🟢 Ready', cpu: 'N/A', mem: 'N/A', disk: 'N/A', isExternal: true };
                nodeMap[targetNode][key] = val;
            }
        });
    };
    mergeVec(cpuVec, 'cpu'); mergeVec(memVec, 'mem'); mergeVec(diskVec, 'disk');

    // 💡 실시간 생존 여부(up) 덮어쓰기 (15초 내 즉각 반영)
    if (upVec) {
        upVec.forEach(res => {
            let targetNode = res.metric.instance || res.metric.node || 'Unknown';
            if (targetNode.includes(':')) targetNode = targetNode.split(':')[0]; // IP 추출
            
            if (ipToNodeName[targetNode]) targetNode = ipToNodeName[targetNode];
            
            const matchKey = Object.keys(nodeMap).find(k => k === targetNode || k.includes(targetNode) || targetNode.includes(k));
            if (matchKey && nodeMap[matchKey].isExternal) {
                nodeMap[matchKey].status = res.value[1] === '1' ? '🟢 Ready' : '🔴 Down';
                // 죽은 서버면 유령 과거 자원 데이터를 N/A로 초기화
                if (res.value[1] === '0') {
                    nodeMap[matchKey].cpu = 'N/A'; nodeMap[matchKey].mem = 'N/A'; nodeMap[matchKey].disk = 'N/A';
                }
            }
        });
    }

    let nodeDetails = Object.values(nodeMap);
    // Prometheus 연결이 안 되어 데이터가 비어있을 경우 (UI 확인용 Mock 데이터 제공)
    if (nodeDetails.length === 0) {
        nodeDetails = [
            { name: 'k8s-m (Mock)', ip: '172.16.0.4', status: '🟢 Ready', cpu: '32.1%', mem: '65.2%', disk: '40.0%' },
            { name: 'k8s-n1 (Mock)', ip: '172.16.0.5', status: '🔴 Warning', cpu: '85.5%', mem: '70.1%', disk: '60.0%' },
            { name: 'k8s-n2 (Mock)', ip: '172.16.0.6', status: '🟢 Ready', cpu: '20.0%', mem: '45.0%', disk: '30.0%' }
        ];
    }

    res.json({ success: true, metrics, nodeDetails, haStatus, errCount: errorLogs.length, logs: errorLogs });
});

// [API] 5. 관리자 계정
app.get('/api/admin/account', async (req, res) => {
    const { admin } = req.query;
    try {
        const prefix = admin === 'true' ? 'WITH _nc AS (SELECT 1) ' : '';
        const [rows] = await pool.query(`${prefix}SELECT username FROM admin_users LIMIT 1`);
        if (rows.length > 0) res.json({ success: true, username: rows[0].username });
        else res.json({ success: false, message: '계정 정보가 없습니다.' });
    } catch (err) { 
        console.error("Account Get Error:", err);
        res.status(500).json({ success: false }); 
    }
});

app.put('/api/admin/account', async (req, res) => {
    const { currentPassword, newUsername, newPassword } = req.body;

    try {
        const [rows] = await pool.execute('WITH _nc AS (SELECT 1) SELECT * FROM admin_users LIMIT 1');
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
        console.error("Account Update Error:", err);
        res.status(500).json({ success: false, message: '계정 정보 변경 중 오류가 발생했습니다.' });
    }
});

// [API] 6. 공지사항 관리
app.get('/api/admin/announcements', async (req, res) => {
    const { admin } = req.query;
    const sqlBase = `SELECT id, title, content, created_at AS createdAt FROM announcements ORDER BY id DESC`;
    
    try {
        const prefix = admin === 'true' ? 'WITH _nc AS (SELECT 1) ' : '';
        // 프론트엔드가 createdAt 속성을 사용하므로 AS로 이름 매핑
        const [rows] = await pool.query(prefix + sqlBase);
        res.json({ success: true, list: rows });
    } catch (err) { 
        // 🛡️ 슬레이브 사망 시 마스터 DB로 재시도
        if (admin !== 'true') {
            try {
                const [fallbackRows] = await pool.query('WITH _nc AS (SELECT 1) ' + sqlBase);
                return res.json({ success: true, list: fallbackRows });
            } catch (fallbackErr) {}
        }
        console.error("Announcements Get Error:", err);
        res.status(500).json({ success: false }); 
    }
});

app.post('/api/admin/announcements', async (req, res) => {
    const { title, content } = req.body;
    if (!title || !content) {
        return res.status(400).json({ success: false, message: '제목과 내용을 모두 입력해주세요.' });
    }
    try {
        await pool.execute('INSERT INTO announcements (title, content) VALUES (?, ?)', [title, content]);
        res.json({ success: true, message: '등록 성공' });
    } catch (err) { 
        console.error("Announcement Post Error:", err);
        res.status(500).json({ success: false, message: '공지사항 등록 중 오류가 발생했습니다.' }); 
    }
});

app.put('/api/admin/announcements/:id', async (req, res) => {
    const { id } = req.params;
    const { title, content } = req.body;
    try {
        const [result] = await pool.execute('UPDATE announcements SET title = ?, content = ? WHERE id = ?', [title, content, id]);
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: '공지사항을 찾을 수 없습니다.' });
        res.json({ success: true });
    } catch (err) { 
        console.error("Announcement Put Error:", err);
        res.status(500).json({ success: false, message: '공지사항 수정 중 오류가 발생했습니다.' }); 
    }
});

app.delete('/api/admin/announcements/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await pool.execute('DELETE FROM announcements WHERE id = ?', [id]);
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: '공지사항을 찾을 수 없습니다.' });
        res.json({ success: true, message: '공지사항이 삭제되었습니다.' });
    } catch (err) { 
        console.error("Announcement Delete Error:", err);
        res.status(500).json({ success: false, message: '공지사항 삭제 중 오류가 발생했습니다.' }); 
    }
});

app.listen(4000, () => console.log('🚀 Admin Server: http://localhost:4000'));