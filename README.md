# VMware-3Tier-HighAvailability
VMware 가상화 기술과 Kubernetes를 활용하여, 실무 수준의 고가용성(HA) 인프라 및 관제 환경을 온프레미스(로컬) 서버에 완벽하게 구현한 상하수도 케어 서비스 플랫폼입니다.

<br>

## 🌟 핵심 요약 (Key Achievements)
- **3-Tier 하이브리드 아키텍처:** Web/WAS는 Kubernetes 클러스터로 묶어 유연한 확장을 도모하고, DB는 K8s 외부의 독립된 VMware 가상머신으로 분리하여 데이터 안정성을 극대화했습니다.
- **DB 고가용성 및 로드밸런싱:** Master-Slave 복제 구조와 **ProxySQL**을 결합하여 Read/Write 트래픽을 분리하고, 마스터 노드 장애 시 1초 이내에 트래픽을 우회하는 **Failover(장애 조치)** 환경을 구축했습니다.
- **실시간 통합 관제(Observability):** K8s 내부 파드 상태부터 K8s 외부(VMware) 레거시 서버의 물리적 하드웨어(CPU/RAM/Disk), DB의 초당 쿼리(QPS)까지 하나의 관리자 웹 대시보드와 Grafana에서 실시간(15초 단위)으로 모니터링합니다.
- **스마트 알람 파이프라인(Alerting):** 에러의 심각도(Warning/Critical)에 따라 Slack 채널과 담당자 DM으로 알람을 동적 라우팅하며, 억제 규칙(Inhibit Rules)을 통해 알람 피로도(Alert Fatigue)를 방지했습니다.
- **GitOps 기반 완벽한 CI/CD:** GitHub Actions (Self-hosted Runner)와 Helm을 결합하여, 코드 푸시 한 번에 인프라 구성, 애플리케이션 배포, 모니터링 에이전트 설정, DB 계정 생성까지 멱등성(Idempotency)을 보장하며 자동 배포됩니다.

<br>

## 🏗️ 시스템 아키텍처 및 기술 스택

### Tech Stack
- **Frontend:** Next.js, TailwindCSS, React (관리자 대시보드 및 사용자 페이지)
- **Backend:** Node.js, Express, MySQL2 (REST API 및 인프라 폴링)
- **Database & HA:** MySQL 8.0 (Master-Slave Replication), ProxySQL
- **Infrastructure:** VMware Workstation, Kubernetes (k8s-m, k8s-n1, k8s-n2), Nginx Ingress
- **Observability:** Prometheus, Grafana, Alertmanager, Node Exporter, MySQL Exporter, Kube-State-Metrics
- **CI/CD:** GitHub Actions, Docker Hub, Helm

### 인프라 구성 (Nodes)
- `k8s-m (Master)` / `k8s-n1, k8s-n2 (Worker)`: 프론트엔드, 백엔드 파드 및 모니터링 스택 실행
- `mysql-m`, `mysql-s`: K8s 외부(VMware)에 구성된 메인/서브 데이터베이스
- `bastion-m`, `bastion-s`, `nfs`: 접근 제어 및 공유 스토리지 역할을 하는 외부 유틸리티 노드

<br>

## 📊 모니터링 및 알람 시스템 (Monitoring & Alerting)
1. **3차원 데이터 수집 파이프라인**
   - **하드웨어(OS):** 각 노드에 `Node Exporter`를 systemd로 등록하여 CPU, Memory, Disk 현황 수집
   - **데이터베이스(DB):** K8s 내부에 `MySQL Exporter` 파드를 띄워 외부 DB의 QPS, Connection, Replication Lag 수집
   - **애플리케이션(K8s):** `Kube-State-Metrics`로 파드 생사 여부 및 리소스 수집
2. **관리자 대시보드 통합 연동**
   - 수집된 Prometheus 데이터를 백엔드(`index.js`)에서 PromQL로 가공하여, React 기반 자체 관리자 페이지에 직관적인 UI로 렌더링.
   - 외부 노드의 생사 여부(`up` 메트릭)를 즉각 반영하고 ProxySQL의 트래픽 라우팅 현황(`🔥 ACTIVE WRITER`)을 실시간 표시.
3. **스마트 Slack 알람 (ChatOps)**
   - 15초 단위의 민첩한 장애 감지 및 Slack Webhook API를 통한 알람 발송.
   - 알람 메시지 내 `[🛠️ 관리자 대시보드 접속]` Action Button을 배치하여 즉각적인 조치 지원.

<br>

## 🛠️ Troubleshooting & Observability (문제 해결 과정)

### 1. K8s 외부 노드(VMware) 모니터링 시 "유령 데이터(Ghost Data)" 지연 문제
- **Symptom:** K8s 외부에 위치한 DB 서버(VMware) 다운 시, 관리자 대시보드에 즉각 반영되지 않고 약 5분 뒤에야 `Down` 처리되는 현상 발생
- **Cause:** PromQL에서 CPU/Mem 수치를 계산할 때 노이즈 방지를 위해 `[5m]`(최근 5분 평균) 기준을 사용함. 서버가 죽더라도 프로메테우스는 과거 데이터를 바탕으로 5분간 평균값을 계속 반환하여 백엔드가 서버가 살아있다고 오판함.
- **Resolution:** 15초 주기로 스크랩되는 프로메테우스의 `up` 메트릭을 백엔드에서 추가로 조회(Vector 쿼리). `up == 0`일 경우 5분 평균값 데이터를 무시하고 즉시 상태를 `🔴 Down` 및 `N/A`로 덮어쓰도록(Overriding) 로직을 개선하여 **장애 인지 시간을 5분에서 15초 이내로 단축**함.

### 2. CI/CD 파이프라인 외부 종속성 에러(504 / 404 Timeout) 방어
- **Symptom:** GitHub Actions 배포 중 `helm repo update` 및 차트 다운로드 과정에서 GitHub CDN 서버의 일시적 장애로 인한 504/404 에러가 간헐적으로 발생하여 파이프라인 전체가 실패함.
- **Cause:** 배포 환경이 외부망(GitHub, Helm Registry)에 강하게 결합(Coupled)되어 있어 업스트림 서버의 불안정성이 내부 배포 실패로 직결됨.
- **Resolution:** 쉘 스크립트 기반의 **자동 재시도(Retry) 매커니즘** 도입. 실패 시 즉각 종료(`set -e`)되는 대신, `for` 루프와 `sleep`을 활용해 최대 3회까지 자가 복구를 시도하도록 설계하여 파이프라인의 회복 탄력성(Resilience)을 확보함.

### 3. 알람 폭풍(Alert Storm) 및 False Positive 억제 (Alertmanager)
- **Symptom:** 서버(Node)가 다운되었을 때 `InstanceDown` 알람뿐만 아니라, 데이터 수집 단절로 인한 `DiskSpaceFull` 복구(Resolved) 알람 등 연쇄적이고 부정확한 가짜 알람이 다수 발생함.
- **Cause:** 서버 단절 시 하위 지표 수집이 불가능해지면서 프로메테우스가 이를 '상태 호전'으로 오해하는 종특 현상 발생.
- **Resolution:** Alertmanager 설정에 **`inhibit_rules`(억제 규칙)**을 도입. `InstanceDown` 이벤트 발생 시 동일한 `instance` 라벨을 가진 하위 경고(CPU, Disk 등)가 슬랙으로 발송되는 것을 원천 차단하여 엔지니어의 알람 피로도(Alert Fatigue)를 방지함.

### 4. MySQL Exporter 통신 실패 (TLS 및 암호화 플러그인 호환성)
- **Symptom:** K8s 내부에 띄운 MySQL Exporter 파드가 외부 VMware의 MySQL 서버 접속에 계속해서 실패(`Access denied` 및 `TLS handshake error`).
- **Cause:** 
  1. MySQL 8.0의 기본 암호화(`caching_sha2_password`)를 Exporter(Go 클라이언트)가 지원하지 않음.
  2. DB 서버의 자체 서명 인증서(Self-signed Cert)를 Exporter가 검증하지 못해 연결을 거부함.
- **Resolution:** ProxySQL 터널링을 통해 DB 계정 생성 시 `IDENTIFIED WITH mysql_native_password`로 명시적 하향 호환을 적용하고, Helm Chart 설정 시 DSN에 `?tls=false` 쿼리 파라미터를 강제 주입하여 인증서 검증 단계를 우회 처리함.

### 5. Slack 비상 알람의 동적 라우팅(Routing) 설계
- **Symptom:** 모든 시스템 알람이 하나의 채널로만 전송되어, 심각한 장애(Critical)와 일반 경고(Warning)의 구분이 어려움.
- **Cause:** 단일 Webhook URL에 의존하는 기본 Alertmanager `global` 설정의 한계.
- **Resolution:** Alertmanager의 `routes` 및 `matchers`를 활용한 다중 트랙 라우팅 구축. 
  - **Warning (예: 트래픽 폭주):** 지정된 `#monitoring` 채널로만 조용히 전송.
  - **Critical (예: DB 다운, 디스크 풀):** 채널 전송과 동시에 담당 엔지니어의 개인 DM으로 동시 전송(`continue: true`). 추가로 알람 템플릿에 `[ 🛠️ 관리자 대시보드 접속 ]` Action Button을 추가하여 모바일 환경에서도 즉각적인 조치(ChatOps)가 가능하도록 UX를 개선함.
