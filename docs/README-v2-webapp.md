# WorkProof Chain v2 - Web Platform

이벤트/행사 인력 매칭 웹 플랫폼

## 개요

WorkProof Chain v2는 이벤트 업체와 근무자를 연결하는 B2B SaaS 웹 플랫폼입니다.
기존 텔레그램 봇 시스템을 웹 기반으로 확장한 버전입니다.

### 주요 기능

- **팔로우 시스템**: 업체-근무자 간 양방향 팔로우 (맞팔 = 우선 매칭)
- **AI 매칭**: 선호도/이력 기반 스마트 일자리 추천
- **신뢰 점수**: 근무 이력 기반 신뢰도 자동 관리
- **실시간 출퇴근**: GPS 기반 출퇴근 체크
- **자동 정산**: 근무 시간 기반 급여 자동 계산
- **플랫폼 관리**: 업체 인증, 유저 관리, 통계 대시보드

## 기술 스택

### Backend
- FastAPI (Python 3.11)
- PostgreSQL 15
- Redis (캐시, 세션)
- Celery (백그라운드 작업)
- SQLAlchemy (Async ORM)

### Frontend
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- shadcn/ui
- Zustand (상태관리)

## 프로젝트 구조

```
workproof-chain-v2/
├── backend/
│   ├── app/
│   │   ├── api/          # API 라우터 (auth, worker, org, admin)
│   │   ├── core/         # 설정, DB, 보안
│   │   ├── models/       # SQLAlchemy 모델 (10개)
│   │   └── schemas/      # Pydantic 스키마 (7개)
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── app/              # Next.js 페이지 (22개)
│   │   ├── admin/        # 관리자 대시보드
│   │   ├── auth/         # 인증 (로그인/회원가입)
│   │   ├── org/          # 업체 대시보드
│   │   └── worker/       # 근무자 앱
│   ├── components/       # React 컴포넌트
│   ├── lib/              # API, 유틸리티
│   ├── stores/           # Zustand 스토어
│   └── types/            # TypeScript 타입
├── database/
│   └── schema.sql        # DB 스키마 (25 테이블)
├── docker-compose.yml
└── docker-compose.dev.yml
```

## 시작하기

### 1. 환경 변수 설정

```bash
cp .env.example .env
# .env 파일에서 필요한 값 수정
```

### 2. 개발 환경 (로컬)

```bash
# DB, Redis 실행
docker-compose -f docker-compose.dev.yml up -d

# Backend 실행
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend 실행 (새 터미널)
cd frontend
npm install
npm run dev
```

**접속 URL**
- Frontend: http://localhost:3000
- Backend: http://localhost:8000
- API Docs: http://localhost:8000/docs

### 3. Docker로 전체 실행 (프로덕션)

```bash
docker-compose up -d
```

## 사용자 역할

### Platform Roles (플랫폼 전체)
| 역할 | 설명 |
|------|------|
| `user` | 일반 사용자 |
| `admin` | 플랫폼 관리자 (업체 인증, 유저 관리) |
| `super_admin` | 최고 관리자 (권한 변경, 신뢰점수 조정) |

### Organization Roles (업체 내)
| 역할 | 설명 |
|------|------|
| `owner` | 업체 소유자 (전체 권한) |
| `admin` | 업체 관리자 (멤버 관리 가능) |
| `manager` | 매니저 (이벤트 관리) |
| `viewer` | 조회만 가능 |

## 주요 API 목록

### 인증 API (`/api/auth`)
- `POST /signup` - 회원가입
- `POST /login` - 로그인
- `POST /refresh` - 토큰 갱신
- `GET /me` - 내 정보

### 근무자 API (`/api/worker`)
- `GET/PATCH /profile` - 프로필 관리
- `GET /events` - 일자리 검색
- `POST /apply` - 지원하기
- `GET /schedule` - 스케줄 조회
- `GET /payroll` - 급여 내역
- `GET/POST /following` - 팔로잉 관리

### 업체 API (`/api/org`)
- `POST /` - 업체 등록
- `GET /{id}/events` - 이벤트 목록
- `POST /{id}/events` - 이벤트 생성
- `GET /{id}/followers` - 팔로워 목록
- `POST /{id}/invite` - 초대 링크 생성

### 관리자 API (`/api/admin`)
- `GET /stats` - 플랫폼 통계
- `GET /organizations` - 업체 목록
- `PATCH /organizations/{id}/verify` - 업체 인증
- `GET /users` - 유저 목록
- `PATCH /users/{id}/role` - 권한 변경 (super_admin)
- `GET /workers` - 근무자 목록
- `PATCH /workers/{id}/trust-score` - 신뢰점수 조정 (super_admin)

## DB 테이블 (25개)

| 카테고리 | 테이블 |
|----------|--------|
| 계정 | users, organizations, org_members, invites |
| 근무자 | workers_public, workers_private, worker_preferences, worker_unavailable_dates |
| 팔로우 | org_worker_follows, worker_org_follows, org_worker_blocks, worker_org_blocks |
| 근무이력 | work_history |
| 이벤트 | events, event_positions, applications |
| 출결/급여 | attendance, payroll_records |
| 알림/AI | notifications, ai_recommendations |
| 분석 | behavior_logs, matching_outcomes, market_trends_daily, worker_metrics_monthly, org_metrics_monthly |

## 라이선스

Private - All Rights Reserved

---

**WorkProof Chain v2** - 이벤트 인력 매칭의 새로운 기준
