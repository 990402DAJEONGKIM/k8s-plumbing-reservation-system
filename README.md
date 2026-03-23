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

## 💻 상세 구현 기능 및 핵심 설정 정보 (Detailed Features)
면접 및 아키텍처 리뷰를 위한 시스템 상세 구현 내역과 네트워크/파일 경로 정보입니다.

### 1. 애플리케이션 주요 기능 (Application Logic)
- **트래픽 기반 캐싱 및 우회 전략 (Read/Write Split & Cache Bypass)**
  - `app/backend/index.js`
  - 고객의 상태 조회(`GET /status`)는 ProxySQL에 1시간(`cache_ttl: 3600000`) 동안 캐싱되어 DB 서버(172.16.0.7/8)가 다운되더라도 무중단 조회가 가능합니다.
  - 반면, 관리자의 중요 데이터 조회 시에는 백엔드에서 쿼리 앞에 `WITH _nc AS (SELECT 1)` 더미 구문을 주입하여 강제로 캐시를 우회(Bypass)하고 마스터 DB의 최신 실시간 데이터를 보장합니다.
- **다중 파드(Multi-Pod) 환경의 무중단 서버 점검 동기화**
  - `app/frontend/app/page.tsx`
  - K8s의 다중 백엔드 파드 환경에서 점검 상태가 엇갈리는 것을 방지하기 위해, Node.js 메모리가 아닌 MySQL `system_settings` 테이블을 활용한 **글로벌 상태 동기화**를 구현했습니다.
  - 점검 활성화 시 신규 예약(POST)은 즉각 503 에러로 차단되고 직관적인 UI로 전환되며, 기존 예약 조회(GET) 기능은 정상 유지됩니다.
- **투트랙(Two-Track) 데이터베이스 백업 시스템**
  - **실시간 스냅샷 (관리자 UI):** Node.js의 `child_process.exec`와 `mysqldump`를 연동하여 버튼 클릭 즉시 DB 최신 상태를 `.sql`로 추출/다운로드합니다.
  - **영구 보관 백업 (K8s CronJob):** `app/k8s-manifests/db-backup-cronjob.yaml`에 의해 정해진 시간에 K8s가 임시 파드를 생성해 DB를 백업하고 외부 NFS 서버(`172.16.0.3`)에 안전하게 아카이빙(Archiving)합니다.
- **실시간 에러 로그 통합 뷰 (LogQL API 연동)**
  - `http://loki...:3100/loki/api/v1/query_range`를 백엔드에서 직접 호출하여, 최근 24시간 동안 ProxySQL 및 백엔드에서 발생한 `error`, `denied` 관련 실제 로그 텍스트를 파싱해 관리자 화면에 즉각 렌더링합니다.

### 2. 인프라 및 자동화 기능 (Infrastructure Configs)
- **완전 자동화된 GitOps 파이프라인 (CI/CD)**
  - `.github/workflows/docker-build.yml`
  - 브랜치에 Push가 발생하면 Self-Hosted Runner가 코드를 체크아웃하고, 프론트/백엔드 Docker 이미지를 빌드 및 K8s 클러스터에 배포합니다.
  - Helm Chart 재배포(Loki, Prometheus 등), ProxySQL의 Query Rules 초기 셋팅, `mysqldump` 백업 크론잡까지 쉘 스크립트 기반으로 멱등성을 보장하며 원클릭으로 구성됩니다.
- **Loki / Promtail 중앙 집중식 로그 수집**
  - `app/k8s-manifests/monitoring-values.yaml`
  - K8s 노드의 물리 경로(`/var/log/containers/*.log`)를 바라보는 Promtail 데몬셋이 로그를 낚아채어 Loki로 전송합니다. 수집된 거대한 로그 데이터는 외부 **NFS 서버**(`/mnt/nfs_share/monitoring-storage-loki-...`)의 `chunks` 디렉토리에 압축 저장됩니다.

### 3. 중요 자산(IP/Port) 및 네트워크 명세서
**🟢 Kubernetes Cluster (App & Monitoring)**
- `k8s-m` (Master), `k8s-n1`, `k8s-n2` (Workers)
- **Frontend:** `https://www.plumbing.local` (Node.js Port: 3000)
- **Backend API:** `http://plumbing-backend:4000` (내부망)
- **Grafana Dashboard:** `https://grafana.plumbing.local` (NodePort: 30000)
- **Loki (Log Storage):** `http://loki.monitoring.svc.cluster.local:3100`
- **Prometheus (Metrics):** `http://...prometheus.monitoring.svc.cluster.local:9090`

**🔵 K8s 내부 인프라 컴포넌트**
- **ProxySQL (DB Router):** `plumbing-proxysql`
  - Admin Port: `6032` (라우팅 룰 및 서버 그룹 관리)
  - Traffic Port: `6033` (백엔드 앱이 실제 데이터를 주고받는 진입점)
- **Orchestrator (Auto-Failover):** `http://orchestrator.plumbing.local` (Port: 3000)

**🔴 K8s 외부 가상머신 (VMware Nodes)**
- **Master DB (`mysql-m`):** `172.16.0.7:3306` (Write 전용, Hostgroup 10)
- **Slave DB (`mysql-s`):** `172.16.0.8:3306` (Read 전용, Hostgroup 20)
- **NFS Server (`nfs`):** `172.16.0.3` (Loki 로그 파일 및 크론잡 SQL 백업 영구 보관소)
- **Bastion / HAProxy:** `172.16.0.2` (`bastion-m`), `172.16.0.9` (`bastion-s`)
- *※ K8s 외부의 모든 VMware 노드는 9100 포트(Node Exporter)를 개방하여 메트릭을 클러스터 내부로 공급함.*

<br>

## 📖 면접 대비 IT 핵심 용어 사전 (Glossary of IT Terms)
면접 및 아키텍처 리뷰 시 시스템 설계 의도를 논리적으로 설명하기 위한 핵심 IT 용어 정리입니다.

- **고가용성 (HA, High Availability)**
  - **의미:** 서버나 네트워크, 프로그램 등의 정보 시스템이 오랜 기간 동안 지속적으로 정상 운영 가능한 성질을 말합니다.
  - **적용:** DB를 Master-Slave로 이중화하고, ProxySQL과 Orchestrator를 통해 장애 시 즉각 우회 대처하도록 구성하여 인프라 전반의 HA를 확보했습니다.
- **ProxySQL (DB 라우터 및 캐싱)**
  - **의미:** 애플리케이션과 데이터베이스 사이에 위치하여 트래픽을 지휘하는 미들웨어입니다.
  - **적용:** 일반 조회(SELECT)는 Slave DB로 보내고 수정/삽입(INSERT/UPDATE)은 Master DB로 보내는 **Read/Write Split(부하 분산)**, 그리고 똑같은 조회 결과를 메모리에 임시 저장해두는 **Query Caching(쿼리 캐싱)** 역할을 수행하여 DB의 부하를 획기적으로 낮췄습니다.
- **Failover (장애 조치)**
  - **의미:** 시스템이나 네트워크에 이상이 생겼을 때, 예비 시스템으로 자동 전환되는 기능입니다.
  - **적용:** 마스터 DB가 죽으면 Orchestrator가 이를 감지하고, 슬레이브 DB를 새로운 마스터로 승격시켜 서비스 중단을 막는 자동 복구 구조를 띄고 있습니다.
- **단일 장애점 (SPOF, Single Point of Failure)**
  - **의미:** 시스템 구성 요소 중 동작하지 않으면 전체 시스템이 중단되는 치명적인 약점 요소입니다.
  - **적용:** 외부 오픈소스 이미지 저장소(Docker Hub)에 의존하던 배포 방식을 '자체 빌드 및 미러링'으로 변경하여 인프라 배포 과정에서의 외부 의존성 SPOF를 원천 제거했습니다.
- **GitOps (깃옵스)**
  - **의미:** Git 저장소를 인프라 및 애플리케이션 설정의 '단일 진실의 원천(SSOT)'으로 사용하는 선언적(Declarative) 인프라 관리 방식입니다.
  - **적용:** 모든 K8s 매니페스트(YAML)와 설정을 코드로 저장(IaC)하고, Push 발생 시 Github Actions가 이를 자동으로 클러스터 상태와 일치시키도록 동기화합니다.
- **멱등성 (Idempotency)**
  - **의미:** 연산을 여러 번 적용하더라도 결과가 달라지지 않는 성질입니다.
  - **적용:** 파이프라인에서 쉘 스크립트 기반 `helm upgrade` 및 `kubectl apply`를 반복해서 수십 번 실행하더라도, 인프라가 꼬이지 않고 항상 의도한 최신의 '정상 상태'만을 유지하도록 스크립트를 설계했습니다.
- **캐시 우회 (Cache Bypass)**
  - **의미:** 임시 저장소(Cache)에 저장된 과거 데이터를 무시하고, 원본 데이터베이스에서 가장 최신의 실시간 데이터를 직접 읽어오는 기법입니다.
  - **적용:** 관리자가 최신 예약 상태를 조회할 때, ProxySQL의 1시간짜리 캐시를 피하기 위해 백엔드 코드에서 SQL 쿼리 앞에 `WITH _nc AS (SELECT 1)`이라는 더미 구문을 삽입하여 강제로 DB(Master)로 직행하도록 트릭을 구현했습니다.
- **CronJob (크론잡)**
  - **의미:** 쿠버네티스 환경에서 특정 시간에 일회성 파드(Job)를 띄워 백그라운드 작업을 수행하고 깔끔하게 소멸하는 스케줄링 리소스입니다.
  - **적용:** 기존 리눅스 서버의 전통적인 `crontab` 대신 K8s CronJob을 사용하여, 특정 서버가 다운되더라도 클러스터 내 다른 살아있는 노드에서 DB 백업이 100% 실행되도록 고가용성 백업 구조를 만들었습니다.

<br>

## �️ Troubleshooting & Observability (문제 해결 과정)

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

### 6. 오픈소스 외부 종속성 단절로 인한 배포 장애(ImagePullBackOff) 원천 차단
- **Symptom:** K8s에 Orchestrator 배포 중, 공식 이미지 저장소에서 컨테이너를 찾지 못해 `ErrImagePull` 및 `ImagePullBackOff` 에러가 무한 반복되며 인프라 배포가 중단됨.
- **Cause:** 공식 프로젝트가 이관되면서 기존 Docker Hub(`openark/orchestrator`)의 이미지들이 비공개/삭제 처리됨. 핵심 인프라 컴포넌트가 내가 통제할 수 없는 **외부 서드파티 레지스트리에 강하게 종속되어 발생한 단일 장애점(SPOF, Single Point of Failure)**.
- **Resolution:** CI/CD 파이프라인(`docker-build.yml`)에 **자체 빌드 및 미러링(Self-Hosted Mirroring) 아키텍처**를 도입함. 외부에서 완성된 이미지를 당겨오는 기존 방식을 버리고, 파이프라인 단계에서 오픈소스 원본(GitHub)의 소스코드를 직접 가져와(Clone) 최신 Docker 이미지로 동적 빌드한 뒤, 본인이 소유한 개인 Docker Hub 레지스트리로 푸시하여 사용하도록 개선함. 결과적으로 외부 저장소가 예고 없이 폐쇄되더라도 인프라 배포의 100% 무결성 및 독립성을 확보함.

### 7. 다중 파드(Multi-Pod) 분산 환경에서의 서버 상태 동기화 실패 (점검 모드 누수)
- **Symptom:** 관리자가 대시보드에서 '서버 점검 모드'를 활성화했음에도, 일부 사용자들은 여전히 정상적으로 사이트에 접속하여 예약을 등록하는 문제 발생.
- **Cause:** 점검 상태(`isMaintenance`)를 백엔드 Node.js의 로컬 메모리(전역 변수)에 저장함. Kubernetes 환경에서는 로드밸런싱을 위해 백엔드 파드가 여러 개 띄워져 있으므로, 1번 파드는 점검 모드로 바뀌었으나 2번 파드는 여전히 정상 상태를 유지하는 **상태 불일치(State Inconsistency)**가 발생.
- **Resolution:** 상태 저장소를 앱의 메모리에서 완전히 분리하여 MySQL DB(`system_settings` 테이블)로 이관. 모든 파드가 DB라는 **단일 진실의 원천(SSOT, Single Source of Truth)**을 바라보게 함으로써, 수십 개의 파드가 떠 있더라도 즉시 100% 동일한 점검 상태를 유지하도록 무결성을 확보함.

### 8. ProxySQL 캐시(Cache) 도입에 따른 실시간 데이터 조회 지연 문제 방어
- **Symptom:** DB 부하를 줄이기 위해 ProxySQL에 `SELECT` 쿼리 캐싱(TTL 1시간)을 적용하자, 관리자 페이지에서 방금 접수된 예약이나 상태 변경 내역이 즉시 조회되지 않을 우려 발생.
- **Cause:** ProxySQL의 Query Rule이 정규식 `(?i)^\s*SELECT` (SELECT로 시작하는 모든 쿼리)를 가로채어 DB로 가지 않고 자신의 메모리에 저장된 과거 데이터를 반환하기 때문.
- **Resolution:** 백엔드 소스코드의 관리자 전용 API 호출부에 **캐시 우회(Cache Bypass)** 트릭을 구현함. 쿼리 맨 앞에 `WITH _nc AS (SELECT 1)` 이라는 무의미한 더미 구문을 몰래 삽입하여, 쿼리가 `SELECT`가 아닌 `WITH`로 시작하게 만듦. 이로써 일반 사용자의 막대한 트래픽은 캐시로 방어하면서도, 관리자는 항상 마스터 DB의 최신 실시간 데이터를 보장받을 수 있는 정교한 투트랙(Two-track) 조회 시스템을 완성함.

### 9. 브라우저/프록시 캐시로 인한 프론트엔드 최신화 지연 (공지사항 갱신 장애)
- **Symptom:** 관리자가 공지사항 내용을 수정/삭제했음에도, 사용자 페이지 접속 시 과거의 공지사항 팝업이 계속 노출됨.
- **Cause:** Next.js 및 브라우저의 강력한 Fetch 캐싱 정책으로 인해 동일한 URL(`GET /api/announcements`) 호출 시 서버로 재요청을 보내지 않고 로컬에 저장된 과거 응답 값을 재사용함.
- **Resolution:** 클라이언트에서 API를 호출할 때 쿼리 파라미터로 현재 시간의 타임스탬프(`_t=${Date.now()}`)를 주입하는 **Cache Busting(캐시 무효화)** 기법 적용. 매번 고유한 URL로 인식되게 만들어 브라우저 캐시를 강제로 뚫고 항상 최신 DB 상태를 가져오도록 렌더링 파이프라인을 개선함.

### 10. Loki 분산 로그 수집 시 스캔 범위 누락 및 타임스탬프 파싱 오류
- **Symptom:** 인프라 통합 모니터링 화면(Recent Error Messages)에서 분명 에러가 발생했음에도 로그가 빈 배열로 나오거나, 발생 시각이 알아보기 힘든 난해한 숫자로 표기됨.
- **Cause:** 
  1. Loki의 단순 `/query` API를 사용하여 찰나의 순간(Instant)만 스캔하고 종료해버림.
  2. Loki가 반환하는 10억 분의 1초(Nano-second) 단위의 유닉스 타임스탬프를 프론트엔드가 제대로 해석하지 못함.
- **Resolution:** 기간 조회가 가능한 `/query_range` 엔드포인트로 변경하고, 쿼리 파라미터에 과거 24시간을 뜻하는 나노초를 계산하여 명시적으로 주입. 반환받은 나노초를 밀리초로 자른(`substring`) 뒤 JS `Date` 객체로 파싱하여 한국 시간(월/일 시:분:초) 형태로 가공해 직관적인 UI를 제공함.

### 11. 인프라 미들웨어(ProxySQL) 캐시로 인한 Feature Flag(점검 모드) 동기화 지연 문제 돌파
- **Symptom:** 관리자가 서버 점검 모드를 활성화했음에도, 사용자 메인 페이지에서 즉시 차단되지 않고 간헐적으로 예약이 정상 접수되어버리는 치명적인 동기화 누수 발생.
- **Cause:** DB 부하를 줄이기 위해 도입한 ProxySQL의 1시간짜리 `SELECT` 쿼리 캐싱 룰이 원인. 백엔드 앱(미들웨어)이 DB의 `system_settings` 테이블을 조회하여 점검 상태를 판단할 때, ProxySQL이 DB로 직행하지 않고 자신의 메모리에 캐싱되어 있던 과거의 정상 상태(`false`)를 즉시 반환해버림.
- **Resolution:** 시스템 핵심 제어 변수(Feature Flag)를 조회하는 API 로직에도 **캐시 우회(Cache Bypass)** 기법(`WITH _nc AS (SELECT 1)`)을 전면 도입. 일반 서비스 트래픽(예약 조회 등)은 ProxySQL 캐시로 완벽히 방어하면서도, 시스템 점검 상태 쿼리만큼은 미들웨어의 캐싱 룰을 뚫고 100% 실시간(Master DB)으로 동기화되도록 아키텍처적 예외 처리를 완성함.

<br>

## 🎯 예상 면접 질문 및 모범 답변 (Interview Q&A)

**Q1. 데이터베이스 앞에 ProxySQL을 두셨는데, 단순히 앱에서 직접 DB로 연결하는 것과 비교해서 어떤 이점이 있었나요?**
> **A.** 트래픽 분산과 데이터베이스 부하 감소라는 두 가지 큰 이점을 얻었습니다. 일반적인 단순 조회(SELECT)는 Slave DB로, 쓰기(INSERT/UPDATE)는 Master DB로 라우팅하는 Read/Write Split을 구현했습니다. 특히 ProxySQL의 Query Caching 기능을 활용해 빈번한 조회 결과는 1시간 동안 메모리에 캐싱하여 DB 서버로 가는 트래픽 자체를 차단할 수 있었습니다.

**Q2. ProxySQL에 1시간짜리 캐시를 걸어두셨다고 했는데, 그럼 관리자가 최신 예약 상태를 확인해야 할 때는 옛날 데이터(Stale Data)가 보이지 않나요? 이 문제는 어떻게 해결했습니까?**
> **A.** 그 부분이 제가 이 프로젝트에서 가장 고민했던 포인트입니다. 저는 이 문제를 백엔드 로직에서의 **'캐시 우회(Cache Bypass)'** 기법으로 해결했습니다. 관리자가 요청하는 특정 API의 SQL 쿼리 맨 앞에 `WITH _nc AS (SELECT 1)` 이라는 더미 구문을 주입했습니다. ProxySQL은 정확히 `SELECT`로 시작하는 쿼리만 캐싱하도록 정규식이 설정되어 있기 때문에, 이 더미 구문이 붙은 쿼리는 캐시를 무시하고 항상 Master DB의 최신 실시간 데이터를 읽어오게 됩니다.

**Q3. 쿠버네티스(K8s) 환경에 백엔드를 배포하셨는데, 파드가 여러 개 떠 있는 다중 파드 환경에서 겪은 상태 불일치 문제는 없었나요?**
> **A.** 서버 점검 모드를 구현할 때 그 문제를 겪었습니다. 처음에는 점검 상태를 Node.js의 메모리(전역 변수)에 저장했는데, 로드밸런싱 환경이다 보니 1번 파드는 점검 모드인데 2번 파드는 여전히 예약을 받는 **상태 불일치(State Inconsistency)** 누수가 발생했습니다. 이를 해결하기 위해 상태 저장소를 앱 메모리에서 완전히 분리하여 MySQL의 `system_settings` 테이블로 이관했습니다. 모든 파드가 DB를 단일 진실의 원천(SSOT)으로 바라보게 만들어 완벽한 상태 동기화를 이뤄냈습니다.

**Q4. 프로메테우스(Prometheus)로 서버 상태를 모니터링할 때 "유령 데이터" 현상을 겪었다고 하셨는데, 정확히 어떤 문제였고 어떻게 해결하셨나요?**
> **A.** 프로메테우스로 CPU와 메모리 사용량을 시각화할 때, 노이즈를 줄이기 위해 최근 5분 평균(`[5m]`)을 구하는 쿼리를 사용했습니다. 그런데 대상 서버가 갑자기 다운되었을 때, 프로메테우스가 남은 과거 데이터를 가지고 계속 평균을 내어 즉시 'Down'으로 판단하지 못하는 지연 현상이 있었습니다. 이를 해결하기 위해 백엔드에서 15초 단위로 갱신되는 `up` 메트릭을 추가로 병렬 조회하고, `up == 0`인 경우 즉시 과거 자원 지표를 무시(Overriding)하고 에러 화면을 띄우도록 로직을 개선해 장애 인지 시간을 5분에서 15초로 단축했습니다.

**Q5. 데이터베이스 고가용성(HA)을 구축하셨는데, Master DB가 실제로 장애가 나면 시스템은 어떻게 반응하나요?**
> **A.** 3단계에 걸쳐 자동으로 복구됩니다. 첫째로 장애가 발생하면 **Orchestrator**가 즉시 이를 감지하여 Slave DB를 새로운 Master DB로 승격시킵니다. 둘째, **ProxySQL**이 변경된 DB 토폴로지를 인식하고 쓰기 트래픽을 승격된 새 Master로 자동 우회(Failover) 시킵니다. 마지막으로 **Alertmanager**가 장애 발생 사실을 제 Slack과 개인 DM으로 발송합니다. 이 모든 과정이 관리자의 개입 없이 자동화되어 있어 서비스 중단을 최소화할 수 있습니다.

**Q6. GitHub Actions를 사용하시면서 GitHub에서 제공하는 러너(Hosted Runner) 대신 굳이 Self-Hosted Runner를 구성하신 이유가 있나요?**
> **A.** 인프라 보안과 네트워크 토폴로지 때문입니다. 현재 구성된 Kubernetes 클러스터와 인프라는 온프레미스(로컬) 망에 위치해 있어 외부망(GitHub)에서 내부 K8s API로 직접 접근하는 것이 보안상 불가능했습니다. 따라서 온프레미스 망 내부에 Self-Hosted Runner를 구축하여, 외부에서 코드 푸시(이벤트)만 받아오고 실제 빌드와 배포 명령(kubectl, helm)은 내부망에서 안전하게 실행되도록 아키텍처를 설계했습니다.

<br>

## 📄 포트폴리오(PDF) 작성 가이드 (Portfolio Structure)
면접관의 시선을 사로잡고 프로젝트의 기술적 깊이를 100% 어필하기 위한 포트폴리오 페이지 구성 추천안입니다. 단순한 기능 나열이 아닌, 문제 해결(Troubleshooting)과 아키텍처 설계 의도 중심으로 전개합니다.

- **[Page 1] 표지 및 프로젝트 요약 (The Hook)**
  - 프로젝트명: K8s & VMware 하이브리드 고가용성(HA) 인프라 구축 및 관제 시스템
  - 한 줄 소개: "단일 장애점(SPOF)을 제거하고 무중단 서비스를 보장하는 클라우드 네이티브 아키텍처 설계"
  - 핵심 기술 스택 아이콘 시각화

- **[Page 2] 시스템 아키텍처 도해도 (The Big Picture)**
  - 인프라 구성도: 트래픽 흐름 (Ingress ➡️ K8s Pods ➡️ ProxySQL ➡️ VMware Master/Slave DB)
  - GitOps 파이프라인: GitHub Push부터 Helm Upgrade까지의 자동화 흐름

- **[Page 3] 핵심 엔지니어링 1: 트래픽 분산과 고가용성 (HA)**
  - ProxySQL의 Read/Write Split 및 Query Caching 전략
  - 🔥 **문제 해결:** `WITH _nc AS (SELECT 1)` 더미 구문을 활용한 캐시 우회(Cache Bypass) 기법 소개
  - Orchestrator 기반의 마스터 DB 자동 Failover 과정

- **[Page 4] 핵심 엔지니어링 2: 다중 파드 환경의 상태 동기화**
  - 🔥 **문제 해결:** 분산 환경(Multi-Pod)에서 Node.js 로컬 메모리 의존 시 발생하는 상태 불일치(State Inconsistency) 누수를 DB(`system_settings`) 기반 글로벌 동기화로 완벽히 제어한 사례

- **[Page 5] 모니터링 체계와 스마트 알람 (Observability & ChatOps)**
  - 3차원 수집(Node, K8s, DB, Log) 체계 및 스마트 라우팅/Action Button을 활용한 Slack 알람
  - 🔥 **문제 해결:** 5분 평균 쿼리로 인한 유령 데이터를 `up` 메트릭 병렬 조회로 15초 만에 즉각 감지하도록 개선한 로직

- **[Page 6] 외부 종속성 제거 (Self-hosted & GitOps)**
  - 🔥 **문제 해결:** Docker Hub 등 서드파티 저장소 장애(SPOF)로 인한 배포 중단을 막기 위해, GitHub Actions(Self-hosted) 파이프라인에서 직접 소스를 받아 빌드/미러링하는 아키텍처로 인프라 독립성 확보

- **[Page 7] 시연 화면 및 맺음말 (Conclusion)**
  - 주요 관리자 대시보드 화면(모니터링, 점검 모드, 에러 로그 통합 뷰 등) 스크린샷
  - 프로젝트 성과, 느낀 점, GitHub 및 블로그 링크

<br>

## 🚀 최종 배포 및 테스트 시나리오 (Runbook)
전체 시스템을 클러스터에 최종 배포하고 주요 기능을 검증하는 시나리오입니다.

### 1단계: GitOps 기반 최종 배포
1. **코드 푸시:** 수정된 코드를 GitHub `main` 브랜치에 Push합니다.
2. **파이프라인 모니터링:** GitHub Actions에서 `Build and Push Docker Images` 파이프라인(빌드, Helm 배포 등)이 정상 작동하는지 확인합니다.
3. **배포 확인:** 마스터 노드 터미널에서 `kubectl get pods -A` 명령어로 모든 파드가 `Running` 상태인지 점검합니다.

### 2단계: 서비스 기능 및 캐싱 테스트 (사용자 관점)
1. **예약 등록:** `https://www.plumbing.local` 접속 후 폼에 데이터를 입력하고 예약 번호를 발급받습니다.
2. **캐싱 및 조회:** 'Track Service' 메뉴에서 방금 발급받은 번호를 조회합니다. (이때 ProxySQL 메모리에 1시간 동안 캐싱됨)
3. **에러 수집 테스트:** 메인 페이지 하단의 `[DB 글자 수 초과 에러 유발하기]` 버튼을 클릭해 의도적으로 DB 에러를 발생시킵니다.

### 3단계: 관리자 대시보드 및 동기화 테스트 (관리자 관점)
1. **통합 관제 확인:** `/admin` 페이지 접속 후 [시스템 모니터링] 탭에서 노드 생사 여부(Ready)와 직전 발생시킨 에러 로그가 즉시 렌더링되는지 확인합니다.
2. **서버 점검 모드 동기화:** [설정] 탭에서 `Server Maintenance Mode`를 켭니다. 새 창에서 사용자 페이지 접속 시 다중 파드 환경임에도 완벽하게 예약 폼이 차단되고 점검 화면이 뜨는지 확인합니다. (확인 후 다시 해제)
3. **실시간 스냅샷:** `Download SQL` 버튼을 눌러 실제 DB 데이터가 파일로 즉시 추출되어 다운로드되는지 확인합니다.

### 4단계: 고가용성 및 자동 복구 (Chaos Test)
1. **장애 유발:** K8s 외부(VMware)의 Master DB 서버(`172.16.0.7`)를 강제 종료하거나 MySQL 서비스를 중지시킵니다.
2. **자동 복구(Failover) 관전:** `http://orchestrator.plumbing.local`에 접속하여 Slave(`172.16.0.8`)가 장애를 딛고 새 Master로 승격되는 과정을 확인합니다.
3. **무중단 서비스 확인:** DB가 복구되는 찰나의 순간에도 사용자 페이지에서 기존 예약을 조회하면 ProxySQL 캐시에 의해 0.1초 만에 정상 응답(렌더링)하는 것을 확인합니다.
4. **스마트 알람 확인:** Slack 채널 및 DM으로 `InstanceDown` 또는 `DatabaseNodeDown` 비상 알람이 즉시 도착했는지 점검합니다.
