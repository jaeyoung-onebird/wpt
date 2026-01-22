# ⛓️ WorkProof Chain by LK

**블록체인 기반 근무이력 증명 시스템 v2.0**

텔레그램 봇 2개(관리자/근무자) + SQLite + Polygon 블록체인으로 구현된 근무 관리 및 급여 정산 시스템

---

## 🎯 핵심 기능

### 관리자 봇
- ✅ **스마트 행사 등록**: 자유 형식 입력 → 자동 파싱 → 표준 모집글 생성
- ✅ **Deep Link 생성**: 근무자봇 지원 링크 자동 생성
- ✅ **지원자 관리**: 확정/대기/불합격 처리 + 자동 알림
- ✅ **출석 관리**: 6자리 코드 생성 + 출석/퇴근 처리
- ✅ **엑셀 다운로드**: 급여 명세서 자동 생성 (3.3% 공제 자동 계산)

### 근무자 봇
- ✅ **최초 1회 정보 입력**: 이름/연락처/거주지/운전경력/사진
- ✅ **전자근로계약서**: 등록 직후 자동 발송
- ✅ **원클릭 지원**: Deep Link로 간편 지원
- ✅ **출석/퇴근**: 코드 입력으로 간단 처리
- ✅ **근무 로그 조회**: 본인 근무 이력 + 블록체인 TX 확인

### 블록체인
- ✅ **Polygon 연동**: 근무 완료 시 자동 온체인 기록
- ✅ **개인정보 보호**: 해시만 온체인, 원본은 오프체인
- ✅ **위변조 방지**: 불변 기록으로 분쟁 해결

---

## 🏗️ 아키텍처

```
관리자 봇 (Telegram)
     ↓
  Parser (입력 정규화)
     ↓
  DB (SQLite)
     ↓
근무자 봇 (Telegram) → 지원/출석/퇴근
     ↓
  Polygon Blockchain (근무 완료 시 자동 기록)
     ↓
  엑셀 급여명세서 생성
```

---

## 🚀 빠른 시작

### 1. 설치

```bash
# 클론
git clone <repository> workproof-chain-v2
cd workproof-chain-v2

# 의존성 설치
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 환경변수 설정
cp config/.env.example config/.env
nano config/.env  # 실제 값 입력

# 디렉토리 생성
mkdir -p data/exports logs
```

### 2. 텔레그램 봇 생성

1. [@BotFather](https://t.me/BotFather)에게 `/newbot` 명령으로 2개 봇 생성
2. Admin Bot Token과 Worker Bot Token을 `.env`에 입력
3. Worker Bot의 username을 `.env`의 `WORKER_BOT_USERNAME`에 입력

### 3. 관리자 등록

```bash
python3 << EOF
from src.db import Database
db = Database('data/workproof.db')
db.add_admin(YOUR_TELEGRAM_ID, 'your_username')
print('Admin registered!')
EOF
```

### 4. 실행

```bash
# 로컬 테스트
python3 src/admin_bot.py &
python3 src/worker_bot.py &

# 또는 Systemd 서비스로 실행
sudo cp systemd/*.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now workproof-admin.service workproof-worker.service
```

---

## 📖 사용 방법

### 관리자 플로우

1. 텔레그램에서 Admin Bot 시작 (`/start`)
2. "➕ 행사 등록" 버튼 클릭
3. 행사 정보를 자유 형식으로 붙여넣기:
   ```
   ●bmw 시승행사
   ●날짜: 1월 25일 일요일
   ●시간: 09:00~21:00
   ●장소: 안양 BMW 전시장
   ●페이: 15만원
   ...
   ```
4. 자동 생성된 모집글 확인 후 "✅ 등록하기"
5. 생성된 Deep Link를 복사하여 근무자들에게 전달
6. 지원자가 들어오면 "👥 지원자 관리"에서 확정/대기/불합격 처리
7. 행사 당일 "📊 출석 관리"에서 출석 코드 생성
8. 근무 완료 후 "💰 엑셀 다운로드"로 급여 명세서 생성

### 근무자 플로우

1. Deep Link 클릭 또는 Worker Bot 시작
2. 최초 1회 정보 입력 (이름/연락처/거주지/사진)
3. 전자근로계약서 링크 수신 → 서명
4. 행사 정보 확인 후 "✅ 지원하기"
5. 관리자 확정 대기
6. 확정 알림 수신
7. 행사 당일 `/출석 <6자리코드>` 입력
8. 근무 종료 후 `/퇴근 <6자리코드>` 입력
9. 블록체인 기록 완료 → `/내근무로그`로 확인

---

## 🔧 설정

### .env 주요 항목

```bash
# 봇 토큰
ADMIN_BOT_TOKEN=your_admin_bot_token
WORKER_BOT_TOKEN=your_worker_bot_token
WORKER_BOT_USERNAME=your_worker_bot_username

# 관리자 ID (콤마로 구분)
ADMIN_TELEGRAM_IDS=123456789,987654321

# Polygon 설정
POLYGON_NETWORK=amoy  # 테스트넷
POLYGON_RPC_URL=https://rpc-amoy.polygon.technology
POLYGON_PRIVATE_KEY=0xYOUR_PRIVATE_KEY
CONTRACT_ADDRESS=0xYOUR_CONTRACT_ADDRESS
CHAIN_ID=80002

# 보안
SALT_SECRET=your_random_salt_string
```

---

## 📦 DB 스키마

- `workers`: 근무자 정보
- `events`: 행사 정보
- `applications`: 지원 내역 (중복 방지)
- `attendance`: 출석 기록 (check_in, check_out, worked_minutes)
- `chain_logs`: 블록체인 기록 (tx_hash, block_number)
- `payroll_exports`: 엑셀 다운로드 기록
- `admin_users`: 관리자 권한

---

## 🔐 보안

- ✅ 개인정보는 오프체인 (DB)
- ✅ 온체인에는 해시만 기록
- ✅ .env 파일은 절대 git에 추가 금지
- ✅ DB 백업 암호화 권장

---

## 📊 운영

자세한 운영 가이드는 [OPERATIONS.md](OPERATIONS.md) 참조

- 로그: `logs/admin_bot.log`, `logs/worker_bot.log`
- 백업: `sqlite3 data/workproof.db ".backup backup.db"`
- 재시작: `sudo systemctl restart workproof-*`

---

## 🛠️ 개발

### 테스트

```bash
# 로컬 실행
python3 src/admin_bot.py
python3 src/worker_bot.py

# DB 초기화
rm data/workproof.db
python3 -c "from src.db import Database; Database('data/workproof.db')"
```

### 구조

```
src/
├── admin_bot.py        # 관리자 봇 메인
├── worker_bot.py       # 근무자 봇 메인
├── db.py               # DB 레이어
├── parser.py           # 행사 입력 파싱
├── chain.py            # Polygon 연동
├── payroll.py          # 엑셀 생성
├── utils.py            # 유틸리티
├── models.py           # 데이터 모델
└── contract_sender.py  # 계약서 발송
```

---

## 📝 라이선스

MIT License

---

## 👤 제작자

**LK**

⛓️ **WorkProof Chain** - 블록체인으로 증명하는 근무이력

Made with ❤️ in Korea
