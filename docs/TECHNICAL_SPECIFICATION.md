# WorkProof Chain v2 기술 명세서

**버전**: 2.0
**작성일**: 2026-01-26
**프로젝트명**: WorkProof Chain (워크프루프 체인)

---

## 1. 개요

### 1.1 프로젝트 소개

WorkProof Chain은 블록체인 기반 근로 이력 증명 시스템입니다. 근로자의 출퇴근 기록을 블록체인에 불변으로 기록하여 신뢰할 수 있는 근로 이력을 제공하고, 토큰 보상 시스템을 통해 근로자 참여를 유도합니다.

### 1.2 핵심 가치

| 항목 | 설명 |
|------|------|
| **불변성** | 블록체인에 기록된 근로 이력은 위변조가 불가능 |
| **프라이버시** | 개인정보는 오프체인에 저장, 온체인에는 해시값만 기록 |
| **투명성** | 누구나 블록체인 익스플로러에서 기록 검증 가능 |
| **인센티브** | WPT 토큰을 통한 근로자 보상 체계 |

### 1.3 기술 스택

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
│                   React + Vite + TypeScript                  │
├─────────────────────────────────────────────────────────────┤
│                         Bots                                 │
│              Python Telegram Bot (Admin / Worker)            │
├─────────────────────────────────────────────────────────────┤
│                        Backend                               │
│                   FastAPI + Python 3.11                      │
├──────────────────────────┬──────────────────────────────────┤
│        Database          │           Blockchain              │
│       PostgreSQL         │      Polygon (Amoy/Mainnet)       │
└──────────────────────────┴──────────────────────────────────┘
```

---

## 2. 시스템 아키텍처

### 2.1 전체 구조

```
                                    ┌──────────────────┐
                                    │   Polygon Chain  │
                                    │  ┌────────────┐  │
                                    │  │WorkLogReg. │  │
                                    │  └────────────┘  │
                                    │  ┌────────────┐  │
                                    │  │  WPT Token │  │
                                    │  └────────────┘  │
                                    └────────┬─────────┘
                                             │
┌───────────────┐     ┌───────────────┐     │
│  Admin Bot    │────▶│               │     │
│  (Telegram)   │     │   FastAPI     │◀────┘
└───────────────┘     │   Backend     │
                      │               │◀────┐
┌───────────────┐     │  :8000        │     │
│  Worker Bot   │────▶│               │     │
│  (Telegram)   │     └───────┬───────┘     │
└───────────────┘             │             │
                              │             │
┌───────────────┐             │      ┌──────┴──────┐
│  React Web    │─────────────┘      │ PostgreSQL  │
│  Frontend     │                    │   Database  │
└───────────────┘                    └─────────────┘
```

### 2.2 컴포넌트 설명

| 컴포넌트 | 역할 |
|----------|------|
| **Admin Bot** | 관리자용 텔레그램 봇. 이벤트 등록, 근로자 관리, 출석 코드 생성, 급여 내보내기 |
| **Worker Bot** | 근로자용 텔레그램 봇. 회원가입, 이벤트 지원, 출퇴근 체크 |
| **FastAPI Backend** | REST API 서버. 인증, 데이터 처리, 블록체인 연동 |
| **React Frontend** | 웹 인터페이스. 근로자/관리자 대시보드, 블록체인 익스플로러 |
| **PostgreSQL** | 관계형 데이터베이스. 개인정보, 이벤트, 출석 기록 저장 |
| **Polygon Chain** | 블록체인 네트워크. 근로 기록 해시 및 토큰 관리 |

---

## 3. 스마트 컨트랙트

### 3.1 WorkLogRegistry.sol

근로 기록을 블록체인에 불변으로 저장하는 컨트랙트입니다.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract WorkLogRegistry {
    struct WorkLog {
        bytes32 logHash;           // 근로 기록 해시
        uint256 eventId;           // 이벤트 ID
        bytes32 workerUidHash;     // 근로자 UID 해시 (익명화)
        address anchoredBy;        // 기록자 주소
        uint256 timestamp;         // 기록 시간
    }

    mapping(bytes32 => WorkLog) public workLogs;

    event WorkLogRecorded(
        bytes32 indexed logHash,
        uint256 indexed eventId,
        bytes32 indexed workerUidHash,
        address anchoredBy,
        uint256 timestamp
    );

    function recordWorkLog(
        bytes32 _logHash,
        uint256 _eventId,
        bytes32 _workerUidHash
    ) external;

    function getWorkLog(bytes32 _logHash) external view returns (WorkLog memory);
    function logExists(bytes32 _logHash) external view returns (bool);
}
```

**주요 특징:**
- 근로자 개인정보 대신 해시값만 저장하여 프라이버시 보호
- 한번 기록된 데이터는 수정/삭제 불가
- 이벤트 로그를 통해 효율적인 조회 가능

### 3.2 WorkProofToken.sol (WPT)

ERC20 기반 보상 토큰 컨트랙트입니다.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract WorkProofToken is ERC20Upgradeable, UUPSUpgradeable {
    // 토큰 정보
    string public constant NAME = "WorkProof Token";
    string public constant SYMBOL = "WPT";
    uint8 public constant DECIMALS = 0;  // 정수 단위

    // 전송 제한
    bool public transfersEnabled;
    mapping(address => bool) public whitelist;

    // 관리 함수
    function mint(address to, uint256 amount) external onlyOwner;
    function burn(address from, uint256 amount) external onlyOwner;
    function batchMint(address[] calldata recipients, uint256[] calldata amounts) external onlyOwner;
    function toggleTransfers(bool enabled) external onlyOwner;
    function updateWhitelist(address account, bool status) external onlyOwner;
}
```

**주요 특징:**
- UUPS 프록시 패턴으로 업그레이드 가능
- 소수점 없는 정수 단위 (1 WPT = 1 크레딧)
- 초기에는 전송 제한, 화이트리스트 기반 전송 허용
- 일괄 발행(batchMint)으로 가스비 절감

### 3.3 컨트랙트 배포 현황

| 네트워크 | 컨트랙트 | 주소 |
|----------|----------|------|
| Polygon Amoy (Testnet) | WorkLogRegistry | 환경변수 참조 |
| Polygon Amoy (Testnet) | WorkProofToken | 환경변수 참조 |

---

## 4. 데이터베이스 스키마

### 4.1 ERD 개요

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   workers   │────▶│applications │◀────│   events    │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │
       │            ┌──────┴──────┐
       │            │             │
       ▼            ▼             ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│credit_history│ │ attendance  │ │ chain_logs  │
└─────────────┘ └─────────────┘ └─────────────┘
```

### 4.2 주요 테이블

#### workers (근로자)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER | PK, 자동증가 |
| telegram_id | TEXT | 텔레그램 고유 ID |
| name | TEXT | 이름 |
| birthdate | TEXT | 생년월일 |
| phone | TEXT | 연락처 |
| residence | TEXT | 거주지 |
| bank_name | TEXT | 은행명 |
| account_number | TEXT | 계좌번호 |
| tokens | INTEGER | 보유 토큰 수 |
| wallet_address | TEXT | 지갑 주소 |
| email | TEXT | 이메일 |
| is_admin | BOOLEAN | 관리자 여부 |
| created_at | TIMESTAMP | 가입일시 |

#### events (이벤트/행사)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER | PK |
| title | TEXT | 행사명 |
| date | TEXT | 날짜 |
| start_time | TEXT | 시작 시간 |
| end_time | TEXT | 종료 시간 |
| location | TEXT | 장소 |
| pay | INTEGER | 급여 |
| headcount | INTEGER | 모집 인원 |
| work_type | TEXT | 업무 유형 |
| dress_code | TEXT | 복장 규정 |
| status | TEXT | 상태 (OPEN/CLOSED/COMPLETED) |
| short_code | TEXT | 딥링크용 코드 |

#### applications (지원)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER | PK |
| event_id | INTEGER | FK → events |
| worker_id | INTEGER | FK → workers |
| status | TEXT | PENDING/CONFIRMED/REJECTED/WAITLIST |
| applied_at | TIMESTAMP | 지원일시 |

#### attendance (출석)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER | PK |
| application_id | INTEGER | FK → applications |
| event_id | INTEGER | FK → events |
| worker_id | INTEGER | FK → workers |
| check_in_time | TIMESTAMP | 출근 시간 |
| check_out_time | TIMESTAMP | 퇴근 시간 |
| worked_minutes | INTEGER | 근무 시간(분) |
| status | TEXT | CHECKED_IN/CHECKED_OUT/NO_SHOW |
| late_minutes | INTEGER | 지각 시간(분) |

#### chain_logs (블록체인 기록)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER | PK |
| attendance_id | INTEGER | FK → attendance |
| event_id | INTEGER | 이벤트 ID |
| worker_uid_hash | TEXT | 근로자 UID 해시 |
| log_hash | TEXT | 근로 기록 해시 |
| tx_hash | TEXT | 트랜잭션 해시 |
| block_number | INTEGER | 블록 번호 |
| network | TEXT | 네트워크 (amoy/mainnet) |
| created_at | TIMESTAMP | 기록일시 |

#### credit_history (크레딧 이력)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER | PK |
| worker_id | INTEGER | FK → workers |
| amount | INTEGER | 변동량 (+/-) |
| balance_after | INTEGER | 변동 후 잔액 |
| tx_type | TEXT | 거래 유형 |
| description | TEXT | 설명 |
| tx_hash | TEXT | 트랜잭션 해시 |
| created_at | TIMESTAMP | 발생일시 |

**tx_type 종류:**
- `SIGNUP_BONUS`: 가입 보너스
- `PROFILE_BONUS`: 프로필 완성 보너스
- `WORK_COMPLETION`: 근무 완료 보상
- `PERFECT_ATTENDANCE`: 개근 보너스
- `DAILY_CHECKIN`: 일일 출석

---

## 5. API 명세

### 5.1 인증 (Auth)

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/auth/register` | 이메일 회원가입 |
| POST | `/api/auth/login` | 이메일 로그인 |
| POST | `/api/auth/telegram-auth` | 텔레그램 인증 |
| POST | `/api/auth/refresh-token` | 토큰 갱신 |

### 5.2 근로자 (Workers)

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/workers/me` | 내 프로필 조회 |
| PUT | `/api/workers/me` | 프로필 수정 |
| GET | `/api/workers/list` | 근로자 목록 |
| GET | `/api/workers/tokens` | 토큰 잔액 조회 |
| POST | `/api/workers/complete-profile` | 프로필 완성 보너스 |

### 5.3 이벤트 (Events)

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/events` | 이벤트 목록 |
| GET | `/api/events/{id}` | 이벤트 상세 |
| POST | `/api/events` | 이벤트 생성 (관리자) |
| PUT | `/api/events/{id}` | 이벤트 수정 (관리자) |
| DELETE | `/api/events/{id}` | 이벤트 삭제 (관리자) |

### 5.4 지원 (Applications)

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/applications` | 이벤트 지원 |
| GET | `/api/applications/me` | 내 지원 내역 |
| GET | `/api/applications/event/{id}` | 이벤트별 지원자 (관리자) |
| PATCH | `/api/applications/{id}/status` | 지원 상태 변경 (관리자) |

### 5.5 출석 (Attendance)

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/attendance/check-in` | 출근 체크 |
| POST | `/api/attendance/check-out` | 퇴근 체크 |
| GET | `/api/attendance/me` | 내 출석 이력 |
| GET | `/api/attendance/event/{id}` | 이벤트 출석 현황 (관리자) |
| GET | `/api/attendance/export` | 급여 엑셀 내보내기 (관리자) |

### 5.6 블록체인 (Chain)

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/chain/logs` | 전체 블록체인 기록 |
| GET | `/api/chain/logs/me` | 내 근로 기록 |
| GET | `/api/chain/tokens` | 내 크레딧 잔액 |
| GET | `/api/chain/verify/{hash}` | 기록 검증 |

### 5.7 크레딧 (Credits)

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/credits/history` | 크레딧 거래 이력 |
| POST | `/api/credits/check-bonus` | 월간 보너스 확인 |
| GET | `/api/credits/balance` | 현재 잔액 |

---

## 6. 인증 및 보안

### 6.1 인증 체계

```
┌─────────────────────────────────────────────────────────┐
│                    인증 플로우                           │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐         │
│  │ Telegram │───▶│  검증    │───▶│   JWT    │         │
│  │ initData │    │          │    │  발급    │         │
│  └──────────┘    └──────────┘    └──────────┘         │
│                                                         │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐         │
│  │  Email   │───▶│ Password │───▶│   JWT    │         │
│  │  Login   │    │  Verify  │    │  발급    │         │
│  └──────────┘    └──────────┘    └──────────┘         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 6.2 JWT 토큰

```python
# 토큰 구조
{
    "telegram_id": "123456789",
    "username": "worker_name",
    "role": "worker",  # worker | admin
    "exp": 1706300000  # 만료 시간 (7일)
}

# 알고리즘: HS256
# 서명 키: JWT_SECRET (환경변수)
```

### 6.3 역할 기반 접근 제어

| 역할 | 접근 가능 영역 |
|------|---------------|
| **Public** | 이벤트 목록, 블록체인 로그 (익명화) |
| **Worker** | 프로필, 지원, 출석, 크레딧 |
| **Admin** | 전체 관리, 대시보드, 급여 내보내기 |

### 6.4 데이터 보안

**개인정보 보호:**
```
온체인 데이터:
- worker_uid_hash = SHA256(worker_id + SALT_SECRET)
- log_hash = SHA256(event_id|worker_id|check_in|check_out|minutes)

오프체인 데이터 (PostgreSQL):
- 이름, 연락처, 주민등록번호, 계좌정보
```

**해시 검증 예시:**
```python
def generate_log_hash(event_id, worker_id, check_in, check_out, minutes):
    data = f"{event_id}|{worker_id}|{check_in}|{check_out}|{minutes}"
    return hashlib.sha256(data.encode()).hexdigest()
```

---

## 7. 토큰 이코노미

### 7.1 WPT 토큰 보상 체계

| 활동 | 보상 (WPT) | 조건 |
|------|-----------|------|
| 회원가입 | 3 | 최초 가입 시 |
| 프로필 완성 | 3 | 모든 필드 입력 시 |
| 근무 완료 | 2 | 정상 퇴근 체크 시 |
| 일일 출석 | 1 | 앱 출석 체크 시 |
| 개근 보너스 | 10 | 월간 무결근 시 |

### 7.2 토큰 흐름

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│   ┌──────────┐                      ┌──────────┐       │
│   │  Minting │─────────────────────▶│  Worker  │       │
│   │ (Admin)  │                      │  Wallet  │       │
│   └──────────┘                      └────┬─────┘       │
│                                          │             │
│                                          ▼             │
│                                    ┌──────────┐       │
│                                    │  Burning │       │
│                                    │ (서비스) │       │
│                                    └──────────┘       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 7.3 커스터디얼 지갑

- 플랫폼이 모든 지갑의 개인키를 관리
- 근로자는 지갑 주소만 확인 가능
- 결정론적 주소 생성: `SHA256(worker_id + secret)`

---

## 8. 주요 워크플로우

### 8.1 근로자 등록 플로우

```
1. 딥링크 클릭 (t.me/worker_bot?start=apply_xxx)
        │
        ▼
2. 텔레그램 봇 실행
        │
        ▼
3. 9단계 정보 입력
   - 이름, 생년월일, 연락처
   - 거주지, 운전면허, 경비자격
   - 은행, 계좌번호, 근로계약서
        │
        ▼
4. DB 저장 + 지갑 생성
        │
        ▼
5. 가입 보너스 3 WPT 지급
        │
        ▼
6. 전자근로계약서 링크 발송
```

### 8.2 근무 완료 플로우

```
1. 관리자: 6자리 출석 코드 생성
        │
        ▼
2. 근로자: /출석 123456 입력
        │
        ▼
3. 서버: check_in_time 기록
        │
        ▼
4. 근로자: /퇴근 123456 입력
        │
        ▼
5. 서버: check_out_time 기록
   - worked_minutes 계산
        │
        ▼
6. 해시 생성
   - worker_uid_hash
   - log_hash
        │
        ▼
7. 블록체인 기록
   - recordWorkLog() 호출
   - tx_hash 저장
        │
        ▼
8. 보상 지급
   - 2 WPT 발행
   - credit_history 기록
```

### 8.3 급여 내보내기 플로우

```
1. 관리자: "엑셀 다운로드" 클릭
        │
        ▼
2. 이벤트 출석 데이터 조회
        │
        ▼
3. 급여 계산
   - 총액 = 시급 × 근무시간
   - 세금 = 총액 × 3.3%
   - 실수령액 = 총액 - 세금
        │
        ▼
4. Excel 파일 생성
   - 근로자 정보
   - 근무 내역
   - 급여 상세
        │
        ▼
5. data/exports/ 저장
```

---

## 9. 배포 및 운영

### 9.1 서버 구성

```
┌─────────────────────────────────────────────────────────┐
│                      Nginx                               │
│                   (Reverse Proxy)                        │
│                   workproof.co.kr                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  /api/* ──────────▶ localhost:8000 (FastAPI)           │
│                                                         │
│  /* ──────────────▶ /web/dist (React Static)           │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 9.2 시스템 서비스

| 서비스 | 포트 | 설명 |
|--------|------|------|
| workproof-api | 8000 | FastAPI 백엔드 |
| workproof-admin-bot | - | 관리자 텔레그램 봇 |
| workproof-worker-bot | - | 근로자 텔레그램 봇 |
| nginx | 80/443 | 리버스 프록시 |

### 9.3 환경 변수

```bash
# Telegram
ADMIN_BOT_TOKEN=<admin-bot-token>
WORKER_BOT_TOKEN=<worker-bot-token>
WORKER_BOT_USERNAME=<worker-bot-username>
ADMIN_TELEGRAM_IDS=<comma-separated-ids>

# Polygon
POLYGON_NETWORK=amoy
POLYGON_RPC_URL=https://rpc-amoy.polygon.technology
POLYGON_PRIVATE_KEY=<private-key>
CONTRACT_ADDRESS=<worklog-registry-address>
WPT_CONTRACT_ADDRESS=<wpt-token-address>
CHAIN_ID=80002

# Database (PostgreSQL)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/workproof

# Security
SALT_SECRET=<salt-for-hashing>
JWT_SECRET=<jwt-signing-key>

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_USER=<email>
SMTP_PASSWORD=<app-password>
```

### 9.4 디렉토리 구조

```
workproof-chain-v2/
├── src/
│   ├── admin_bot.py          # 관리자 봇
│   ├── worker_bot.py         # 근로자 봇
│   ├── db.py                 # 데이터베이스 레이어
│   ├── chain.py              # 블록체인 연동
│   ├── wpt_service.py        # 토큰 서비스
│   ├── parser.py             # 이벤트 파서
│   ├── payroll.py            # 급여 생성기
│   ├── utils.py              # 유틸리티
│   ├── models.py             # 데이터 모델
│   └── api/
│       ├── main.py           # FastAPI 앱
│       ├── config.py         # 설정
│       ├── auth/             # 인증 모듈
│       ├── routes/           # API 라우트
│       └── schemas/          # Pydantic 스키마
├── contracts/
│   ├── contracts/
│   │   ├── WorkLogRegistry.sol
│   │   └── WorkProofToken.sol
│   └── hardhat.config.js
├── web/
│   ├── src/
│   │   ├── pages/            # React 페이지
│   │   ├── components/       # UI 컴포넌트
│   │   └── context/          # 상태 관리
│   └── vite.config.js
├── config/
│   └── .env
├── data/
│   ├── exports/              # 급여 파일
│   └── photos/               # 근로자 사진
├── logs/                     # 로그 파일
└── nginx/
    └── workproof.conf        # Nginx 설정
```

---

## 10. 기술적 특징

### 10.1 프라이버시 보존 블록체인 기록

- 개인정보는 오프체인(PostgreSQL)에만 저장
- 블록체인에는 해시값만 기록
- 해시 역산 불가능으로 신원 보호

### 10.2 업그레이드 가능한 스마트 컨트랙트

- UUPS 프록시 패턴 적용
- 컨트랙트 로직 업그레이드 가능
- 데이터 보존하며 기능 개선

### 10.3 커스터디얼 지갑 시스템

- 사용자 UX 단순화
- 가스비 플랫폼 부담
- 향후 비커스터디얼 전환 가능

### 10.4 다중 인증 지원

- 텔레그램 인증 (봇 연동)
- 이메일/비밀번호 인증 (웹)
- JWT 기반 세션 관리

### 10.5 실시간 급여 계산

- 근무 시간 자동 계산
- 3.3% 원천징수 적용
- Excel 내보내기 지원

---

## 11. 향후 계획

### Phase 1: 안정화
- [ ] 메인넷 배포
- [ ] 부하 테스트 및 최적화
- [ ] 백업/복구 체계 구축

### Phase 2: 기능 확장
- [ ] 근로자 평점 시스템
- [ ] 다중 언어 지원
- [ ] 모바일 앱 개발

### Phase 3: 확장성
- [ ] 다중 테넌트 지원
- [ ] API 외부 공개
- [ ] 타 플랫폼 연동

---

## 12. 부록

### A. API 응답 코드

| 코드 | 설명 |
|------|------|
| 200 | 성공 |
| 201 | 생성 성공 |
| 400 | 잘못된 요청 |
| 401 | 인증 필요 |
| 403 | 권한 없음 |
| 404 | 리소스 없음 |
| 500 | 서버 오류 |

### B. 이벤트 상태

| 상태 | 설명 |
|------|------|
| OPEN | 모집 중 |
| CLOSED | 모집 마감 |
| COMPLETED | 완료 |

### C. 지원 상태

| 상태 | 설명 |
|------|------|
| PENDING | 대기 중 |
| CONFIRMED | 확정 |
| REJECTED | 거절 |
| WAITLIST | 대기명단 |

### D. 출석 상태

| 상태 | 설명 |
|------|------|
| CHECKED_IN | 출근 완료 |
| CHECKED_OUT | 퇴근 완료 |
| NO_SHOW | 미출근 |

---

**문서 끝**
