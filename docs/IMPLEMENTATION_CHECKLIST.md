# WorkProof Work OS - 구현 체크리스트

**시작일**: 2026-02-04
**목표 완료일**: 2026-04-01 (8주)

---

## ✅ 완료된 작업

### 설계 단계 (2026-02-04)

- [x] 전체 아키텍처 설계
- [x] DB 스키마 설계 (8개 테이블)
- [x] Gamification API 개발 (10개 엔드포인트)
- [x] AI Matching API 개발 (5개 엔드포인트)
- [x] API 라우터 등록
- [x] 10단계 로드맵 작성
- [x] Tokenomics 문서 작성
- [x] API 레퍼런스 작성
- [x] README 업데이트

**파일 생성**:
- ✓ `migrations/create_gamification_bigdata.sql`
- ✓ `src/api/routes/gamification.py`
- ✓ `src/api/routes/ai_matching.py`
- ✓ `docs/WORK_OS_ROADMAP.md`
- ✓ `docs/TOKENOMICS.md`
- ✓ `docs/API_REFERENCE.md`
- ✓ `README_WORK_OS.md`

---

## 🚀 Phase 1: DB 마이그레이션 및 백엔드 기반 구축

**목표**: BigData & Gamification DB 배포
**기간**: 1주 (2/5 - 2/11)
**담당**: Backend

### 작업 목록

- [ ] **DB 마이그레이션 실행**
  - [ ] 로컬 환경에서 마이그레이션 테스트
  - [ ] 프로덕션 DB 백업
  - [ ] 프로덕션에 마이그레이션 실행
  - [ ] Rollback 스크립트 준비

- [ ] **테이블 확인**
  - [ ] `worker_metrics` 테이블 생성 확인
  - [ ] `worker_streaks` 테이블 생성 확인
  - [ ] `wpt_transactions` 테이블 생성 확인
  - [ ] `attendance_stats` 테이블 생성 확인
  - [ ] `ai_matching_logs` 테이블 생성 확인
  - [ ] `worker_levels` 테이블 + 초기 데이터 확인
  - [ ] `event_analytics` 테이블 생성 확인
  - [ ] `gamification_config` 테이블 + 초기 설정 확인

- [ ] **Trigger/Function 확인**
  - [ ] `update_worker_metrics()` 트리거 동작 테스트
  - [ ] `update_wpt_balance()` 트리거 동작 테스트
  - [ ] 기존 workers → metrics 초기화 확인

- [ ] **백엔드 API 테스트**
  - [ ] `/api/gamification/me/stats` 호출 테스트
  - [ ] `/api/ai/recommend-events` 호출 테스트
  - [ ] Swagger 문서 확인 (`/docs`)

- [ ] **배포**
  - [ ] 백엔드 재시작 (`sudo systemctl restart workproof-backend`)
  - [ ] 헬스체크 (`curl /api/health`)
  - [ ] 로그 확인

### 명령어

```bash
# 1. DB 백업
pg_dump workproof_v2 > backup_$(date +%Y%m%d).sql

# 2. 마이그레이션 실행
psql -U postgres -d workproof_v2 -f migrations/create_gamification_bigdata.sql

# 3. 테이블 확인
psql -U postgres -d workproof_v2 -c "\dt"

# 4. 백엔드 재시작
sudo systemctl restart workproof-backend

# 5. 헬스체크
curl https://workproof.co.kr/api/health
```

### 테스트 시나리오

1. **Metrics 자동 생성 테스트**
   - 새 근무자 생성
   - `worker_metrics`, `worker_streaks` 자동 생성 확인

2. **WPT 트랜잭션 테스트**
   - API로 WPT 지급
   - `wpt_transactions` 기록 확인
   - `worker_metrics.wpt_balance` 업데이트 확인

3. **AI 추천 테스트**
   - `/api/ai/recommend-events` 호출
   - 점수 계산 로직 확인
   - `ai_matching_logs` 저장 확인

### 완료 기준

- [ ] 모든 테이블 생성 완료
- [ ] Trigger 정상 동작
- [ ] API 200 응답
- [ ] Swagger 문서 확인 가능

---

## 🎮 Phase 2: Gamification - 출석 보상 시스템

**목표**: 출퇴근 시 WPT 자동 지급
**기간**: 1주 (2/12 - 2/18)
**담당**: Backend + Frontend

### 작업 목록

- [ ] **Backend: Attendance API 수정**
  - [ ] `src/api/routes/attendance.py` 수정
  - [ ] 출근 성공 후 `/api/gamification/checkin-reward` 호출
  - [ ] 퇴근 성공 후 `/api/gamification/checkout-reward` 호출
  - [ ] 에러 처리 (이미 보상 받은 경우)

- [ ] **Frontend: WPT 애니메이션**
  - [ ] `web/src/components/WPTRewardAnimation.jsx` 생성
  - [ ] Lottie 또는 React-Spring 사용
  - [ ] "+15 WPT!" 팝업 표시
  - [ ] 2초 후 자동 닫힘

- [ ] **Frontend: Attendance 페이지 수정**
  - [ ] `web/src/pages/Attendance.jsx` 수정
  - [ ] 출근 성공 시 애니메이션 표시
  - [ ] WPT 잔액 실시간 업데이트

- [ ] **API 클라이언트 추가**
  - [ ] `web/src/api/client.js`에 gamification API 추가
  - [ ] `gamificationAPI.checkinReward(attendanceId)`
  - [ ] `gamificationAPI.checkoutReward(attendanceId)`

### 테스트 시나리오

1. **출근 보상**
   - 출근 처리
   - WPT +10 지급 확인
   - 애니메이션 표시 확인

2. **퇴근 보상**
   - 퇴근 처리 (8시간 근무)
   - WPT +10 (기본) + 40 (시간) = 50 지급 확인
   - 애니메이션 표시 확인

3. **중복 방지**
   - 같은 attendance_id로 재시도
   - "이미 보상 받음" 에러 확인

### 완료 기준

- [ ] 출근 시 WPT 자동 지급
- [ ] 퇴근 시 WPT 자동 지급
- [ ] 애니메이션 정상 표시
- [ ] 중복 지급 방지

---

## 🔥 Phase 3: Gamification - Streak & 레벨 시스템

**목표**: 연속 출석, 레벨업 구현
**기간**: 1주 (2/19 - 2/25)
**담당**: Frontend + Backend

### 작업 목록

- [ ] **Backend: Streak 로직 완성**
  - [ ] `gamification.py`의 streak 계산 검증
  - [ ] 3일, 5일, 7일 보너스 확인
  - [ ] Longest streak 업데이트

- [ ] **Frontend: Streak 컴포넌트**
  - [ ] `web/src/components/StreakCounter.jsx` 생성
  - [ ] 현재 streak / 최장 streak 표시
  - [ ] Progress bar (다음 보너스까지)
  - [ ] 불 아이콘 애니메이션

- [ ] **Frontend: 레벨 시스템**
  - [ ] `web/src/components/LevelBadge.jsx` 생성
  - [ ] `web/src/components/ExperienceBar.jsx` 생성
  - [ ] 레벨 표시 + 타이틀
  - [ ] 경험치 바 (다음 레벨까지)
  - [ ] 레벨업 애니메이션

- [ ] **Frontend: Leaderboard 페이지**
  - [ ] `web/src/pages/Leaderboard.jsx` 생성
  - [ ] 전체 랭킹 표시
  - [ ] 내 순위 하이라이트
  - [ ] 필터 (월간/전체)

### 테스트 시나리오

1. **Streak 보너스**
   - 3일 연속 출석
   - +5 WPT 보너스 확인
   - UI에 "3일 연속!" 표시

2. **레벨업**
   - 경험치 100 획득
   - Lv.1 → Lv.2 확인
   - "+20 WPT!" 보상 확인
   - 레벨업 애니메이션

3. **Leaderboard**
   - 상위 50명 표시
   - 내 순위 표시
   - 레벨/WPT 기준 정렬

### 완료 기준

- [ ] Streak 정상 계산
- [ ] 레벨업 동작
- [ ] 리더보드 표시
- [ ] 애니메이션 완성

---

## 🤖 Phase 4: AI 매칭 - 기본 점수 계산

**목표**: Worker-Event 매칭 점수 계산
**기간**: 1주 (2/26 - 3/4)
**담당**: Backend

### 작업 목록

- [ ] **점수 계산 함수 개선**
  - [ ] `calculate_distance_score()` - 실제 GPS 좌표 사용
  - [ ] `calculate_reliability_score()` - 완료율 + 평점
  - [ ] `calculate_pay_score()` - 급여 적합도
  - [ ] `calculate_skill_score()` - 자격 요건 매칭
  - [ ] `calculate_availability_score()` - 일정 충돌 체크

- [ ] **매칭 로그**
  - [ ] `ai_matching_logs` 저장 확인
  - [ ] 추천 여부, 지원 여부 추적

- [ ] **Admin: 가중치 설정**
  - [ ] `web/src/pages/admin/MatchingSettings.jsx` 생성
  - [ ] 거리/신뢰도/급여 비중 조절 UI
  - [ ] 가중치 변경 API

### 테스트 시나리오

1. **점수 계산**
   - Worker ID=1, Event ID=100
   - 각 점수 계산 확인
   - 총점 70점 이상 확인

2. **가중치 변경**
   - 신뢰도 가중치 0.3 → 0.5
   - 점수 재계산
   - 순위 변동 확인

3. **매칭 로그**
   - 추천 실행
   - `ai_matching_logs` 저장 확인

### 완료 기준

- [ ] 점수 계산 정확도 90%+
- [ ] 가중치 변경 가능
- [ ] 매칭 로그 저장

---

## 🎯 Phase 5: AI 매칭 - 추천 시스템

**목표**: AI 기반 행사/근무자 추천
**기간**: 1주 (3/5 - 3/11)
**담당**: Frontend + Backend

### 작업 목록

- [ ] **Worker: 추천 행사**
  - [ ] `web/src/pages/Home.jsx` 수정
  - [ ] "나에게 맞는 행사" 섹션 추가
  - [ ] 점수 70점+ 자동 표시
  - [ ] 매칭 점수 표시

- [ ] **Admin: 추천 근무자**
  - [ ] `web/src/pages/admin/EventDetail.jsx` 수정
  - [ ] "AI 추천 근무자" 버튼 추가
  - [ ] 추천 리스트 모달 표시
  - [ ] 신뢰도 점수 표시

- [ ] **자동 채우기**
  - [ ] `web/src/pages/WorkOS.jsx`에 버튼 추가
  - [ ] "이번달 자동 채우기" 클릭
  - [ ] AI 추천 행사 리스트 표시
  - [ ] 일괄 지원 확인 모달

### 테스트 시나리오

1. **Worker 추천**
   - 홈 화면 접속
   - "나에게 맞는 행사" 표시
   - 점수 순 정렬 확인

2. **Admin 추천**
   - 행사 상세 페이지
   - "AI 추천" 버튼 클릭
   - 상위 20명 표시
   - WPT 차감 (20 WPT)

3. **자동 채우기**
   - Work 페이지
   - "자동 채우기" 클릭
   - 15개 행사 추천
   - 일괄 지원 확인

### 완료 기준

- [ ] 추천 행사 표시
- [ ] 추천 근무자 표시
- [ ] 자동 채우기 동작
- [ ] WPT 차감 확인

---

## 📅 Phase 6: 프론트엔드 - Work 페이지 통합

**목표**: Work = List + Calendar 통합
**기간**: 1주 (3/12 - 3/18)
**담당**: Frontend

### 작업 목록

- [ ] **WorkOS 페이지 생성**
  - [ ] `web/src/pages/WorkOS.jsx` 생성
  - [ ] 탭: List / Calendar
  - [ ] List 뷰: 기존 Work 페이지 기능
  - [ ] Calendar 뷰: 월간 캘린더

- [ ] **월간 캘린더 컴포넌트**
  - [ ] `web/src/components/WorkCalendar.jsx` 생성
  - [ ] FullCalendar 또는 react-big-calendar 사용
  - [ ] 확정 근무 표시 (파란색)
  - [ ] 추천 근무 표시 (점선, 회색)
  - [ ] 날짜 클릭 → 상세 모달

- [ ] **월 목표 설정**
  - [ ] `web/src/components/MonthlyGoal.jsx` 생성
  - [ ] 목표 수입 입력
  - [ ] 목표 근무일수 입력
  - [ ] 달성률 Progress bar

- [ ] **라우팅 변경**
  - [ ] `/work` → WorkOS 연결
  - [ ] `/calendar` → `/work?tab=calendar` 리다이렉트

### 테스트 시나리오

1. **List 뷰**
   - 내 지원 목록
   - 확정 근무 목록
   - 급여 내역

2. **Calendar 뷰**
   - 월간 스케줄 표시
   - 확정/추천 구분 표시
   - 날짜 클릭 → 상세

3. **월 목표**
   - 목표 설정 (200만원, 15일)
   - 달성률 표시 (80%)

### 완료 기준

- [ ] List/Calendar 토글 동작
- [ ] 캘린더 표시 정상
- [ ] 월 목표 설정 가능

---

## 📊 Phase 7: 프론트엔드 - History 페이지

**목표**: WPT + NFT + 이력 통합
**기간**: 1주 (3/19 - 3/25)
**담당**: Frontend

### 작업 목록

- [ ] **History 페이지 생성**
  - [ ] `web/src/pages/History.jsx` 생성
  - [ ] 섹션 1: WPT 잔액 & 거래 내역
  - [ ] 섹션 2: NFT 배지 컬렉션
  - [ ] 섹션 3: 근무 이력 & 통계
  - [ ] 섹션 4: 레벨 & 경험치

- [ ] **WPT 거래 내역**
  - [ ] `web/src/components/WPTTransactionList.jsx` 생성
  - [ ] Earn/Spend/Burn 구분 표시
  - [ ] 카테고리별 필터
  - [ ] 월별 통계 차트

- [ ] **통계 대시보드**
  - [ ] `web/src/components/WorkerStatsCard.jsx` 생성
  - [ ] 출석률, 평균 수입, 완료율, 신뢰도
  - [ ] Chart.js 또는 Recharts

- [ ] **리다이렉트 설정**
  - [ ] `/wallet` → `/history`
  - [ ] `/collection` → `/history`
  - [ ] `/badges` → `/history`

### 테스트 시나리오

1. **WPT 내역**
   - 거래 목록 표시
   - 필터링 (Earn only)
   - 차트 표시

2. **NFT 컬렉션**
   - 보유 배지 표시
   - 클릭 → 상세 모달

3. **통계**
   - 출석률 95%
   - 평균 수입 150만원
   - 차트 표시

### 완료 기준

- [ ] History 페이지 완성
- [ ] 모든 섹션 표시
- [ ] 리다이렉트 동작

---

## ⏰ Phase 8: 프론트엔드 - Attendance GPS 연동

**목표**: 출퇴근 시 WPT 보상 UI 완성
**기간**: 1주 (3/26 - 4/1)
**담당**: Frontend

### 작업 목록

- [ ] **Attendance 페이지 수정**
  - [ ] `web/src/pages/Attendance.jsx` 수정
  - [ ] 출근 성공 시 WPT 애니메이션 호출
  - [ ] Streak 카운터 표시
  - [ ] 레벨업 체크

- [ ] **WPT 애니메이션**
  - [ ] `web/src/components/WPTRewardAnimation.jsx` 개선
  - [ ] 코인 떨어지는 효과
  - [ ] "+15 WPT!" 텍스트 애니메이션

- [ ] **레벨업 애니메이션**
  - [ ] `web/src/components/LevelUpAnimation.jsx` 생성
  - [ ] "레벨업!" 모달
  - [ ] "Lv.3 → Lv.4" 표시
  - [ ] "+40 WPT 보상!" 표시

### 테스트 시나리오

1. **출근 흐름**
   - GPS 인증
   - 출근 성공
   - WPT 애니메이션
   - Streak 카운터 증가

2. **레벨업 흐름**
   - 경험치 100 달성
   - 레벨업 모달 표시
   - WPT 보상 애니메이션

### 완료 기준

- [ ] WPT 애니메이션 완성
- [ ] Streak 표시
- [ ] 레벨업 애니메이션

---

## 💰 Phase 9: Admin - Finance 대시보드

**목표**: WPT 경제 관리
**기간**: 1주 (4/2 - 4/8)
**담당**: Frontend

### 작업 목록

- [ ] **Finance 페이지 생성**
  - [ ] `web/src/pages/admin/Finance.jsx` 생성
  - [ ] WPT 통계 카드
  - [ ] 토크노믹스 차트
  - [ ] 근무자별 WPT 잔액

- [ ] **WPT 관리**
  - [ ] Admin WPT 지급 폼
  - [ ] 보상 금액 설정
  - [ ] 정책 변경

- [ ] **차트**
  - [ ] 발행/소각 추이 (Line chart)
  - [ ] 레벨 분포 (Pie chart)
  - [ ] 월간 통계 (Bar chart)

### 테스트 시나리오

1. **통계 표시**
   - 총 발행, 소각, 유통량
   - 차트 표시

2. **WPT 지급**
   - Worker에게 500 WPT 지급
   - 잔액 업데이트 확인

3. **정책 변경**
   - 출근 보상 10 → 15 WPT
   - 저장 확인

### 완료 기준

- [ ] Finance 대시보드 완성
- [ ] WPT 관리 기능 동작
- [ ] 차트 표시

---

## ✅ Phase 10: 최종 통합 및 테스트

**목표**: 전체 시스템 QA
**기간**: 1주 (4/9 - 4/15)
**담당**: 전체

### 작업 목록

- [ ] **전체 플로우 테스트**
  - [ ] Worker: 회원가입 → 지원 → 출근 → WPT 획득
  - [ ] Admin: 행사 생성 → 추천 → 확정 → 출퇴근 관리

- [ ] **성능 테스트**
  - [ ] DB 인덱스 최적화
  - [ ] API 응답 속도 (<200ms)
  - [ ] 프론트엔드 번들 크기

- [ ] **문서 작성**
  - [ ] API 문서 업데이트
  - [ ] 사용자 가이드
  - [ ] Admin 가이드

- [ ] **배포 준비**
  - [ ] 프로덕션 빌드
  - [ ] 환경변수 점검
  - [ ] 백업 스크립트

### 테스트 체크리스트

#### Worker 플로우
- [ ] 회원가입
- [ ] 행사 검색
- [ ] AI 추천 확인
- [ ] 지원
- [ ] 확정 알림
- [ ] GPS 출근
- [ ] WPT 획득 (+10)
- [ ] Streak 증가
- [ ] 퇴근
- [ ] WPT 획득 (+50)
- [ ] 레벨업 (경험치 100)
- [ ] NFT 배지 구매
- [ ] 리더보드 확인

#### Admin 플로우
- [ ] 행사 생성
- [ ] AI 추천 근무자
- [ ] 지원자 확정
- [ ] 출퇴근 관리
- [ ] 급여명세서 다운로드
- [ ] WPT 통계 확인
- [ ] Finance 대시보드

### 성능 기준

- [ ] API 응답: < 200ms
- [ ] DB 쿼리: < 100ms
- [ ] 프론트엔드 로딩: < 2초
- [ ] 번들 크기: < 500KB

### 배포 명령어

```bash
# 1. DB 백업
pg_dump workproof_v2 > backup_final_$(date +%Y%m%d).sql

# 2. 프론트엔드 빌드
cd web
npm run build

# 3. 백엔드 재시작
sudo systemctl restart workproof-backend

# 4. Nginx 재시작
sudo systemctl restart nginx

# 5. 헬스체크
curl https://workproof.co.kr/api/health
curl https://workproof.co.kr
```

### 완료 기준

- [ ] 모든 플로우 정상 동작
- [ ] 성능 기준 충족
- [ ] 문서 완성
- [ ] 배포 성공

---

## 📈 진행 상황

| Phase | 상태 | 시작일 | 종료일 | 진행률 |
|-------|------|--------|--------|--------|
| 1. DB 마이그레이션 | 🟡 진행중 | 2/5 | 2/11 | 10% |
| 2. 출석 보상 | ⚪ 대기 | 2/12 | 2/18 | 0% |
| 3. Streak & 레벨 | ⚪ 대기 | 2/19 | 2/25 | 0% |
| 4. AI 점수 계산 | ⚪ 대기 | 2/26 | 3/4 | 0% |
| 5. AI 추천 | ⚪ 대기 | 3/5 | 3/11 | 0% |
| 6. Work 통합 | ⚪ 대기 | 3/12 | 3/18 | 0% |
| 7. History 페이지 | ⚪ 대기 | 3/19 | 3/25 | 0% |
| 8. Attendance UI | ⚪ 대기 | 3/26 | 4/1 | 0% |
| 9. Finance 대시보드 | ⚪ 대기 | 4/2 | 4/8 | 0% |
| 10. 최종 QA | ⚪ 대기 | 4/9 | 4/15 | 0% |

**전체 진행률**: 5% (설계 완료)

---

## 🎯 다음 단계

1. **즉시**: Phase 1 DB 마이그레이션 실행
2. **이번주**: Phase 2 출석 보상 시스템 개발
3. **다음주**: Phase 3 Streak & 레벨 시스템

---

**마지막 업데이트**: 2026-02-04
**작성자**: Claude Sonnet 4.5
