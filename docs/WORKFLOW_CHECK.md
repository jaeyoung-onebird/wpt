# Work OS Platform - 워크플로우 체크

## 📋 전체 워크플로우 확인 (v2.0.0 - 2026.02.05)

### ✅ 1. 회원가입 및 로그인

#### 워크플로우
1. **회원가입** (`/register`)
   - 이메일 + 비밀번호 또는 전화번호
   - 이메일 인증 (선택)
   - 프로필 정보 입력 (이름, 생년월일, 거주지, 계좌 등)
   - Worker 레코드 생성

2. **로그인** (`/login`)
   - 이메일/전화번호 + 비밀번호
   - JWT 토큰 발급
   - AuthContext에 user/worker 정보 저장

#### API 연결
- ✅ `POST /api/auth/register` → Worker 생성
- ✅ `POST /api/auth/login` → JWT 반환
- ✅ `GET /api/auth/me` → 사용자 정보

#### 페이지 연결
- ✅ `/login` → Login.jsx
- ✅ `/register` → Register.jsx
- ✅ AuthProvider → 전역 인증 상태 관리

---

### ✅ 2. 행사 조회 및 지원

#### 워크플로우
1. **행사 목록 조회** (`/`)
   - 전체 행사 목록 표시
   - 로그인 시 AI 추천 행사 표시 (5-factor scoring)
   - 필터링: 전체/모집중/마감

2. **행사 상세** (`/events/:id`)
   - 행사 정보 상세 조회
   - 급여, 일시, 장소, 요구사항
   - GPS 위치 정보 (지도)

3. **지원하기**
   - 행사 상세 페이지에서 지원 버튼 클릭
   - 일정 충돌 체크
   - Application 레코드 생성 (PENDING 상태)

#### API 연결
- ✅ `GET /api/events` → 행사 목록
- ✅ `GET /api/events/:id` → 행사 상세
- ✅ `POST /api/applications` → 지원하기
- ✅ `POST /api/applications/check-conflict` → 일정 충돌 체크
- ✅ `GET /api/ai/recommend-events` → AI 추천 행사

#### 페이지 연결
- ✅ `/` → Home.jsx (행사 목록 + AI 추천)
- ✅ `/events/:id` → EventDetail.jsx
- ✅ AIRecommendations.jsx → 추천 컴포넌트

---

### ✅ 3. 관리자 승인 프로세스

#### 워크플로우
1. **지원자 관리** (`/admin/events/:id`)
   - 행사별 지원자 목록 조회
   - AI 추천 근무자 보기 (5-factor scoring)
   - 지원 상태: PENDING → CONFIRMED / REJECTED

2. **승인/거절**
   - CONFIRMED: 근무자로 확정
   - REJECTED: 거절 (사유 입력 가능)
   - WAITLIST: 대기 명단

3. **알림 발송**
   - 승인/거절 시 자동 알림
   - Notification 레코드 생성

#### API 연결
- ✅ `GET /api/admin/events/:id/applications` → 지원자 목록
- ✅ `PATCH /api/applications/:id/status` → 상태 변경
- ✅ `GET /api/ai/recommend-workers/:id` → AI 추천 근무자
- ✅ `POST /api/notifications` → 알림 생성 (자동)

#### 페이지 연결
- ✅ `/admin/events/:id` → AdminEventDetail.jsx
- ✅ AI 추천 모달 → 5-factor 점수 표시

---

### ✅ 4. GPS 출퇴근 (확정 근무자)

#### 워크플로우
1. **출근 방법 선택** (`/work` → List → 업무 탭)
   - GPS 출근: 위치 기반 자동 출근
   - 코드 입력: 관리자 제공 코드 입력

2. **GPS 출근**
   - GPSCheckIn 컴포넌트
   - 30초마다 자동 위치 업데이트
   - 행사장으로부터 거리 계산 (Haversine formula)
   - 범위 내(50m~500m) 확인
   - 서버에 위치 전송
   - 관리자가 수동/자동 출근 처리

3. **코드 출근**
   - 관리자 제공 코드 입력 (예: ABC123)
   - 즉시 출근 처리
   - Attendance 레코드 생성

4. **퇴근**
   - 출근 상태에서 "업무 종료" 버튼
   - 근무 시간 자동 계산
   - WPT 보상 자동 지급 (gamification)
   - 경험치 획득 (레벨업 가능)
   - 스트릭 보너스 (연속 출근)

#### API 연결
- ✅ `POST /api/attendance/location` → GPS 위치 전송
- ✅ `POST /api/attendance/check-in` → 코드 출근
- ✅ `POST /api/attendance/:id/check-out` → 퇴근
- ✅ `POST /api/gamification/checkout-reward` → WPT 보상 (자동)
- ✅ `GET /api/events/:id` → GPS 범위 정보

#### 페이지/컴포넌트 연결
- ✅ `/work` → WorkOS.jsx (List 탭 → 업무)
- ✅ GPSCheckIn.jsx → GPS 추적 컴포넌트
- ✅ AdminEventForm → GPS 범위 설정 (50m/100m/200m/500m)

---

### ✅ 5. WPT 보상 시스템

#### 워크플로우
1. **자동 보상**
   - 출근 시: 기본 보상 (10 WPT)
   - 퇴근 시: 근무 시간 기반 보상 (시간당 50 WPT)
   - 연속 출근: 스트릭 보너스 (최대 50%)

2. **레벨 시스템**
   - 경험치 획득 → 레벨업
   - 7단계: 신입 → 숙련 → 전문 → 베테랑 → 마스터 → 에이스 → 레전드
   - 레벨업 시 WPT 보너스

3. **WPT 사용**
   - 소각 (BURN) - 미사용
   - 향후 상점 기능 예정

#### API 연결
- ✅ `GET /api/gamification/me/stats` → 내 통계
- ✅ `GET /api/gamification/me/wpt-transactions` → WPT 거래 내역
- ✅ `GET /api/gamification/me/level` → 내 레벨
- ✅ `POST /api/gamification/checkin-reward` → 출근 보상 (자동)
- ✅ `POST /api/gamification/checkout-reward` → 퇴근 보상 (자동)

#### 페이지 연결
- ✅ `/wallet` → Wallet.jsx (WPT 잔액, 거래 내역)
- ✅ `/history` → History.jsx (WPT 타임라인)
- ✅ `/leaderboard` → Leaderboard.jsx (순위표)

---

### ✅ 6. NFT 배지 시스템

#### 워크플로우
1. **배지 획득 조건**
   - 근무 완료 횟수 (5회, 10회, 50회, 100회)
   - 연속 출근 (7일, 30일, 100일)
   - 리뷰 평점 (4.5 이상 10회, 20회)
   - 특별 프로젝트 완료

2. **배지 발급**
   - 관리자가 수동 발급 (`/admin/events/:id/nft-issue`)
   - 조건 충족 시 자동 체크
   - NFT 메타데이터 생성 (SVG 이미지)
   - 블록체인 기록 (선택)

3. **배지 조회**
   - 내 배지 컬렉션 (`/collection`)
   - 배지 상세 정보
   - 등급: BRONZE, SILVER, GOLD, PLATINUM, DIAMOND

#### API 연결
- ✅ `GET /api/badges/me` → 내 배지 목록
- ✅ `GET /api/nft/worker/me/badges` → NFT 배지 상세
- ✅ `GET /api/nft/render/:id` → 배지 이미지 (SVG)
- ✅ `POST /api/nft/admin/events/:id/nft-issue` → 배지 발급 (관리자)

#### 페이지 연결
- ✅ `/collection` → Collection.jsx (NFT 목록)
- ✅ `/badges` → Badges.jsx (배지 정의)
- ✅ `/badges/:id` → BadgeDetail.jsx (상세)
- ✅ `/history` → History.jsx (배지 타임라인)
- ✅ `/admin/events/:id/nft-issue` → AdminNftIssue.jsx

---

### ✅ 7. Work OS 통합 뷰

#### 워크플로우
1. **List 탭** (`/work`)
   - 업무: GPS/코드 출퇴근
   - 지원현황: 내 지원 목록 (심사중/확정/불합격)
   - 근무내역: 완료된 근무 기록 (지급명세서 다운로드)

2. **Calendar 탭** (`/work?tab=calendar`)
   - 월간 목표: 근무 일수, 수입 목표 달성률
   - 월간 캘린더: 확정 행사 (파란색), AI 추천 (보라색)
   - 날짜 클릭: 해당 일의 행사 상세

#### API 연결
- ✅ `GET /api/attendance/me` → 내 출퇴근 기록
- ✅ `GET /api/applications/me` → 내 지원 내역
- ✅ `GET /api/ai/recommend-events` → AI 추천 (캘린더용)
- ✅ `GET /api/attendance/:id/payment-statement` → 지급명세서 다운로드

#### 페이지/컴포넌트 연결
- ✅ `/work` → WorkOS.jsx
- ✅ WorkCalendar.jsx → 월간 캘린더
- ✅ MonthlyGoal.jsx → 월간 목표

---

### ✅ 8. History 통합 타임라인

#### 워크플로우
1. **통합 뷰** (`/history`)
   - WPT 거래 내역 (발행/소각/보상)
   - NFT 배지 획득
   - 근무 완료 이력
   - 날짜순 자동 정렬

2. **필터링**
   - 전체: 모든 항목
   - WPT: WPT 거래만
   - 배지: 배지 획득만
   - 근무: 근무 완료만

#### API 연결
- ✅ `GET /api/gamification/me/wpt-transactions` → WPT 거래
- ✅ `GET /api/badges/me` → 배지 목록
- ✅ `GET /api/attendance/me` → 근무 이력

#### 페이지 연결
- ✅ `/history` → History.jsx

---

### ✅ 9. Admin Finance 대시보드

#### 워크플로우
1. **재무 통계** (`/admin/finance`)
   - 기간별 급여 지출 (월/분기/년)
   - WPT 발행/소각 내역
   - 현재 유통량
   - 활성 사용자 수

2. **거래 내역**
   - 전체/발행/소각 필터
   - 근무자별 거래 상세
   - 잔액 추적

#### API 연결
- ✅ `GET /api/credits/admin/stats` → WPT 통계
- ✅ `GET /api/credits/admin/history` → WPT 거래 내역
- ✅ `GET /api/admin/analytics` → 급여 통계

#### 페이지 연결
- ✅ `/admin/finance` → Finance.jsx

---

### ✅ 10. AI 매칭 시스템

#### 워크플로우
1. **근무자 추천** (행사 → 근무자)
   - 거리 점수 (0-100점)
   - 신뢰도 점수 (0-100점)
   - 급여 점수 (0-100점)
   - 기술 점수 (0-100점)
   - 일정 가능성 (0-100점)
   - 총점: 0-500점

2. **행사 추천** (근무자 → 행사)
   - 동일한 5-factor scoring
   - 최소 점수 기준 (60점)
   - 상위 N개 추천

#### API 연결
- ✅ `GET /api/ai/recommend-events` → 추천 행사 (근무자용)
- ✅ `GET /api/ai/recommend-workers/:id` → 추천 근무자 (관리자용)
- ✅ `GET /api/ai/matching-stats` → 매칭 통계

#### 페이지/컴포넌트 연결
- ✅ Home → AIRecommendations 컴포넌트
- ✅ AdminEventDetail → AI 추천 모달
- ✅ WorkCalendar → AI 추천 표시 (보라색)

---

## 🔄 전체 플로우 요약

```
1. 회원가입/로그인
   ↓
2. 행사 조회 (AI 추천 포함)
   ↓
3. 행사 지원
   ↓
4. 관리자 승인 (AI 추천 근무자 참고)
   ↓
5. GPS/코드 출근
   ↓
6. 근무 진행
   ↓
7. 퇴근 (WPT 보상 + 경험치)
   ↓
8. 지급명세서 다운로드
   ↓
9. WPT/배지 확인 (History)
   ↓
10. 다음 행사 지원 (반복)
```

---

## ✅ 연결 확인 완료

### Frontend 페이지 (21개)
- ✅ Worker: Home, Work, History, Wallet, Collection, Badges, My, Leaderboard, Notifications (9개)
- ✅ Admin: Dashboard, Events, EventDetail, Workers, Attendance, Finance, WPT, Analytics, Settings (12개)

### API Endpoints (50+ 개)
- ✅ Auth: 로그인, 회원가입, 인증
- ✅ Events: 조회, 생성, 수정, 삭제
- ✅ Applications: 지원, 승인, 거절
- ✅ Attendance: 출퇴근, GPS, 코드
- ✅ Gamification: WPT, 레벨, 스트릭
- ✅ Badges: NFT, 발급, 조회
- ✅ AI Matching: 추천 행사, 추천 근무자
- ✅ Credits: WPT 관리, 거래 내역
- ✅ Admin: 통계, 분석, 재무

### 컴포넌트 (20+개)
- ✅ GPSCheckIn: GPS 출근
- ✅ AIRecommendations: AI 추천
- ✅ WorkCalendar: 월간 캘린더
- ✅ MonthlyGoal: 월간 목표
- ✅ LocationPicker: 지도 선택
- ✅ Layout: 공통 레이아웃

---

## 🎯 버전 정보

- **버전**: 2.0.0
- **최종 업데이트**: 2026.02.05
- **블록체인**: Polygon Amoy
- **배포 URL**: https://workproof.co.kr

---

## ✅ 워크플로우 상태

**모든 워크플로우가 정상적으로 연결되어 있습니다!**

- ✅ 회원가입 → 로그인
- ✅ 행사 조회 → 지원
- ✅ 관리자 승인 → GPS 출퇴근
- ✅ WPT 보상 → 레벨업
- ✅ NFT 배지 → 컬렉션
- ✅ AI 매칭 → 추천 시스템
- ✅ Work OS → 통합 뷰
- ✅ History → 타임라인
- ✅ Admin Finance → 재무 분석
