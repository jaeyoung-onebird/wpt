# WorkProof Work OS 🚀

> 단순 근태 앱을 넘어선 노동 데이터 플랫폼 (Work Operating System)

[![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)](https://github.com/yourusername/workproof)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

---

## 🎯 비전

**프리랜서가 월급제처럼 일할 수 있는 세상**

- 📅 월간 스케줄 관리 (캘린더)
- 🎮 근무하면 WPT 보상 (게임화)
- 🏆 NFT/등급/혜택 (동기부여)
- 🤖 AI 매칭 (최적 일정 추천)
- 📊 빅데이터 (활동 기록 & 통계)
- 💰 기업은 WPT로 기능 사용

---

## ✨ 주요 기능

### Worker App (근무자)

```
🏠 Home          - AI 추천 행사, 긴급 채용
📋 Work          - 내 근무 (리스트 + 캘린더 통합)
⏰ Attendance    - GPS 출퇴근, WPT 보상
📊 History       - WPT 내역, NFT 컬렉션, 이력
👤 My            - 프로필, 설정
```

### Admin App (관리자)

```
📊 Dashboard     - 실시간 통계, KPI
📅 Events        - 행사 관리, AI 근무자 추천
👥 Workers       - HR 관리, 신뢰도 점수
💰 Finance       - WPT 경제, 급여 정산
⚙️  Settings     - 시스템 설정
```

---

## 🏗️ 아키텍처

```
┌─────────────────────────────────────────┐
│          WorkProof Work OS               │
├─────────────────────────────────────────┤
│  Frontend (React + Vite)                 │
│  ├─ Worker App                           │
│  └─ Admin App                            │
├─────────────────────────────────────────┤
│  Backend (FastAPI)                       │
│  ├─ REST API                             │
│  ├─ Gamification Engine                  │
│  ├─ AI Matching Engine                   │
│  └─ BigData Analytics                    │
├─────────────────────────────────────────┤
│  Database (PostgreSQL)                   │
│  ├─ Core Tables (workers, events, etc)  │
│  ├─ Gamification Tables (WPT, levels)   │
│  └─ Analytics Tables (stats, logs)      │
├─────────────────────────────────────────┤
│  Blockchain (Ethereum)                   │
│  └─ Work Proof NFT                       │
└─────────────────────────────────────────┘
```

---

## 🚀 빠른 시작

### 1. 요구사항

- Node.js 18+
- Python 3.10+
- PostgreSQL 14+
- Git

### 2. 설치

```bash
# 레포 클론
git clone https://github.com/yourusername/workproof-chain-v2.git
cd workproof-chain-v2

# 백엔드 설정
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# 프론트엔드 설정
cd web
npm install
```

### 3. DB 마이그레이션

```bash
# DB 생성
createdb workproof_v2

# 기본 스키마
psql -U postgres -d workproof_v2 -f migrations/init_schema.sql

# 게임화 & 빅데이터 스키마
psql -U postgres -d workproof_v2 -f migrations/create_gamification_bigdata.sql
```

### 4. 환경 변수

```bash
# config/.env 파일 생성
cp config/.env.example config/.env
```

```env
# Database
DATABASE_URL=postgresql://postgres:password@localhost/workproof_v2

# JWT
JWT_SECRET=your-secret-key-here
JWT_ALGORITHM=HS256

# Blockchain
ETHEREUM_RPC_URL=https://your-rpc-url
PRIVATE_KEY=your-private-key

# Frontend
VITE_API_URL=http://localhost:8000
```

### 5. 실행

```bash
# 백엔드 (터미널 1)
cd /path/to/workproof-chain-v2
source venv/bin/activate
uvicorn src.api.main:app --reload --port 8000

# 프론트엔드 (터미널 2)
cd web
npm run dev
```

브라우저에서 `http://localhost:5173` 접속

---

## 📚 문서

- [📋 10단계 로드맵](docs/WORK_OS_ROADMAP.md) - 구현 계획
- [💰 Tokenomics](docs/TOKENOMICS.md) - WPT 경제 설계
- [🔧 API 레퍼런스](docs/API_REFERENCE.md) - API 명세서

---

## 🎮 게임화 시스템

### WPT (WorkProof Token)

**획득**:
- 출근: +10 WPT
- 퇴근: +10 WPT
- 근무시간: +5 WPT/시간
- Streak 보너스: +5 WPT (3일마다)
- 행사 완료: +50 WPT

**사용**:
- NFT 배지: 100-2,000 WPT
- 프로필 부스트: 30-100 WPT
- 편의 기능: 5-20 WPT

### 레벨 시스템

| 레벨 | 타이틀 | WPT 배율 | 혜택 |
|------|--------|----------|------|
| 1 | 신입 | 1.0x | - |
| 2 | 일꾼 | 1.05x | - |
| 3 | 숙련공 | 1.1x | - |
| 4 | 베테랑 | 1.15x | 우선 추천 |
| 5 | 프로 | 1.2x | 배지 20% 할인 |
| 6 | 마스터 | 1.3x | Featured |
| 7 | 레전드 | 1.5x | VIP |

### Streak (연속 출석)

- 3일: +5 WPT
- 5일: +15 WPT
- 7일: +30 WPT
- 30일: +200 WPT

---

## 🤖 AI 매칭 시스템

### 점수 계산

```python
match_score = (
  distance_score × 0.25 +      # 거리
  reliability_score × 0.30 +   # 신뢰도
  pay_score × 0.20 +           # 급여
  skill_score × 0.15 +         # 스킬
  availability_score × 0.10    # 가용성
)
```

### 기능

- **Worker**: 나에게 맞는 행사 추천
- **Admin**: 행사에 맞는 근무자 추천
- **자동 채우기**: AI가 월간 최적 일정 제안

---

## 📊 빅데이터

### 수집 데이터

**Worker**:
- 출근/퇴근 기록
- 평점/리뷰
- 수입/WPT
- 스킬/업종
- Streak/레벨

**Event**:
- 지원/확정률
- 출석률
- 비용/성과
- AI 사용량

### 활용

- 신뢰도 점수 계산
- AI 매칭 정확도 향상
- 근무자 랭킹
- 통계 리포트
- 정부 제출 자료

---

## 🔄 개발 워크플로우

### 1. 이슈 생성
```bash
# GitHub Issues에서 작업 생성
```

### 2. 브랜치 생성
```bash
git checkout -b feature/phase-2-streak-system
```

### 3. 개발
```bash
# 코드 작성
# 테스트 실행
pytest tests/
```

### 4. 커밋
```bash
git add .
git commit -m "Add streak bonus system

- Streak 계산 로직 추가
- 3일마다 5 WPT 보너스
- worker_streaks 테이블 연동
"
```

### 5. PR
```bash
git push origin feature/phase-2-streak-system
# GitHub에서 PR 생성
```

---

## 🧪 테스트

```bash
# 백엔드 테스트
pytest tests/ -v

# 프론트엔드 테스트
cd web
npm run test

# E2E 테스트
npm run test:e2e
```

---

## 📦 배포

### 프로덕션 빌드

```bash
# 프론트엔드
cd web
npm run build

# 백엔드는 uvicorn으로 실행
uvicorn src.api.main:app --host 0.0.0.0 --port 8000
```

### Docker (향후 지원)

```bash
docker-compose up -d
```

---

## 🛠️ 기술 스택

### Backend
- **Framework**: FastAPI
- **Database**: PostgreSQL 14
- **ORM**: psycopg2 (Raw SQL)
- **Auth**: JWT
- **Blockchain**: Web3.py

### Frontend
- **Framework**: React 18
- **Build**: Vite
- **Routing**: React Router v6
- **State**: Context API + Hooks
- **Styling**: TailwindCSS
- **HTTP**: Axios

### DevOps
- **Server**: Ubuntu 22.04
- **Web Server**: Nginx
- **Process**: systemd
- **SSL**: Let's Encrypt

---

## 📈 로드맵

### ✅ Completed (v1.0)

- [x] 기본 근태 관리
- [x] 행사 지원/확정
- [x] GPS 출퇴근
- [x] 블록체인 증명
- [x] NFT 배지

### 🚧 In Progress (v2.0)

- [ ] **Phase 1**: DB 마이그레이션 ← 현재
- [ ] **Phase 2**: 출석 보상 시스템
- [ ] **Phase 3**: Streak & 레벨
- [ ] **Phase 4**: AI 매칭 기본
- [ ] **Phase 5**: AI 추천 시스템

### 🔮 Planned (v3.0)

- [ ] ML 기반 수요 예측
- [ ] 음성 명령 (Siri/Bixby)
- [ ] 다국어 지원
- [ ] 모바일 앱 (React Native)
- [ ] 기업용 대시보드 Pro

---

## 🤝 기여

1. Fork
2. Feature Branch (`git checkout -b feature/amazing-feature`)
3. Commit (`git commit -m 'Add amazing feature'`)
4. Push (`git push origin feature/amazing-feature`)
5. Pull Request

**코딩 스타일**:
- Backend: PEP 8
- Frontend: ESLint + Prettier

---

## 📄 라이선스

MIT License - 자유롭게 사용/수정 가능

---

## 👥 팀

- **대표**: 대표님
- **Backend**: Claude Sonnet 4.5
- **Frontend**: Claude Sonnet 4.5
- **AI**: Claude Sonnet 4.5

---

## 📞 문의

- **Email**: contact@workproof.co.kr
- **Website**: https://workproof.co.kr
- **GitHub**: https://github.com/yourusername/workproof

---

## 🙏 감사

- FastAPI 팀
- React 팀
- PostgreSQL 팀
- Anthropic (Claude)

---

**Made with ❤️ by WorkProof Team**

**Last Updated**: 2026-02-04
