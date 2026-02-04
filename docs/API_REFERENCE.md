# WorkProof Work OS - API Reference

**Base URL**: `https://workproof.co.kr/api`
**버전**: v2.0
**인증**: Bearer Token

---

## 🔐 인증

모든 요청에 Authorization 헤더 필요:

```http
Authorization: Bearer {token}
```

토큰 획득:
```http
POST /api/auth/phone
{
  "phone": "01012345678",
  "code": "123456"
}
```

---

## 🎮 Gamification API

### GET /gamification/me/stats

내 게임화 통계 조회

**Request**:
```http
GET /api/gamification/me/stats
Authorization: Bearer {token}
```

**Response**:
```json
{
  "metrics": {
    "worker_id": 1,
    "total_events": 50,
    "completed_events": 48,
    "reliability_score": 95.5,
    "total_income": 5000000,
    "total_wpt_earned": 3000,
    "total_wpt_spent": 500,
    "wpt_balance": 2500,
    "level": 5,
    "experience_points": 1580
  },
  "streak": {
    "current_streak": 7,
    "longest_streak": 15,
    "last_checkin_date": "2026-02-04"
  },
  "level_info": {
    "level": 5,
    "title": "프로",
    "required_exp": 1500,
    "benefits": {
      "wpt_boost": 1.2,
      "priority": true
    }
  }
}
```

---

### POST /gamification/checkin-reward

출근 보상 지급

**Request**:
```http
POST /api/gamification/checkin-reward?attendance_id=123
Authorization: Bearer {token}
```

**Response**:
```json
{
  "wpt_reward": {
    "transaction_id": 456,
    "amount": 15,
    "balance": 2515,
    "category": "checkin"
  },
  "streak": {
    "current": 8,
    "longest": 15,
    "bonus_wpt": 5
  },
  "exp": {
    "exp_gained": 5,
    "total_exp": 1585,
    "level": 5,
    "leveled_up": false
  }
}
```

**설명**:
- `attendance_id`: 출석 레코드 ID
- `amount`: 출근 기본 10 WPT + Streak 보너스
- `streak.current`: 현재 연속 출석일
- `streak.bonus_wpt`: 연속 보너스 (3일마다 5 WPT)

---

### POST /gamification/checkout-reward

퇴근 보상 지급

**Request**:
```http
POST /api/gamification/checkout-reward?attendance_id=123
Authorization: Bearer {token}
```

**Response**:
```json
{
  "wpt_reward": {
    "transaction_id": 457,
    "amount": 50,
    "balance": 2565
  },
  "work_hours": 8.5,
  "time_bonus": 40,
  "exp": {
    "exp_gained": 17,
    "total_exp": 1602,
    "level": 5,
    "leveled_up": false
  }
}
```

**설명**:
- 퇴근 기본: 10 WPT
- 근무시간 보너스: 5 WPT × 8시간 = 40 WPT
- 총: 50 WPT

---

### GET /gamification/leaderboard

리더보드 조회

**Request**:
```http
GET /api/gamification/leaderboard?period=month&limit=50
```

**Query Parameters**:
- `period`: `all` | `month` | `week` (기본: all)
- `limit`: 1-100 (기본: 50)

**Response**:
```json
{
  "period": "month",
  "rankings": [
    {
      "worker_id": 5,
      "name": "김철수",
      "photo": "/photos/abc123.jpg",
      "level": 7,
      "experience_points": 5200,
      "reliability_score": 98.5,
      "total_wpt_earned": 12000,
      "completed_events": 120,
      "current_streak": 30,
      "longest_streak": 45
    },
    ...
  ]
}
```

---

### GET /gamification/wpt/transactions

WPT 거래 내역

**Request**:
```http
GET /api/gamification/wpt/transactions?limit=50
Authorization: Bearer {token}
```

**Response**:
```json
{
  "transactions": [
    {
      "id": 456,
      "type": "EARN",
      "category": "checkin",
      "amount": 15,
      "balance_after": 2515,
      "description": "출근 보상 (+10 WPT) + 연속 출석 보너스 (+5 WPT)",
      "reference_type": "attendance",
      "reference_id": 123,
      "created_at": "2026-02-04T09:00:00Z"
    },
    {
      "id": 455,
      "type": "SPEND",
      "category": "nft_purchase",
      "amount": -100,
      "balance_after": 2500,
      "description": "NFT 배지 구매 - Gold Tier",
      "created_at": "2026-02-03T15:30:00Z"
    }
  ]
}
```

**Type**:
- `EARN`: 획득
- `SPEND`: 사용
- `BURN`: 소각 (기업)
- `ADMIN_GRANT`: 관리자 지급

---

### POST /gamification/admin/grant-wpt

관리자: WPT 지급

**Request**:
```http
POST /api/gamification/admin/grant-wpt
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "worker_id": 10,
  "amount": 500,
  "reason": "이벤트 참여 보상"
}
```

**Response**:
```json
{
  "transaction_id": 789,
  "amount": 500,
  "balance": 3000
}
```

---

### GET /gamification/admin/analytics

관리자: 게임화 분석

**Request**:
```http
GET /api/gamification/admin/analytics
Authorization: Bearer {admin_token}
```

**Response**:
```json
{
  "wpt_economy": {
    "total_earned": 1500000,
    "total_spent": 300000,
    "total_burned": 800000,
    "active_users": 1200
  },
  "level_distribution": [
    {"level": 1, "count": 300},
    {"level": 2, "count": 250},
    {"level": 3, "count": 200},
    {"level": 4, "count": 150},
    {"level": 5, "count": 200},
    {"level": 6, "count": 80},
    {"level": 7, "count": 20}
  ],
  "top_workers": [
    {
      "id": 5,
      "name": "김철수",
      "level": 7,
      "experience_points": 5200,
      "reliability_score": 98.5,
      "completed_events": 120
    },
    ...
  ]
}
```

---

## 🤖 AI Matching API

### GET /ai/recommend-events

근무자를 위한 행사 추천

**Request**:
```http
GET /api/ai/recommend-events?limit=10&min_score=50
Authorization: Bearer {token}
```

**Query Parameters**:
- `limit`: 추천 개수 (기본: 10)
- `min_score`: 최소 점수 (기본: 50)

**Response**:
```json
{
  "recommendations": [
    {
      "id": 101,
      "title": "컨벤션 안내 스태프",
      "event_date": "2026-02-10",
      "location": "코엑스",
      "pay_amount": 150000,
      "requires_driver_license": false,
      "requires_security_cert": false,
      "match_score": 92.5,
      "score_breakdown": {
        "distance": 95.0,
        "reliability": 95.5,
        "pay": 85.0,
        "skill": 100.0,
        "availability": 100.0
      }
    },
    ...
  ],
  "total_count": 15
}
```

**점수 계산**:
```
total_score =
  distance_score × 0.25 +
  reliability_score × 0.30 +
  pay_score × 0.20 +
  skill_score × 0.15 +
  availability_score × 0.10
```

---

### GET /ai/recommend-workers/{event_id}

관리자: 행사를 위한 근무자 추천

**Request**:
```http
GET /api/ai/recommend-workers/101?limit=20&min_score=60
Authorization: Bearer {admin_token}
```

**Response**:
```json
{
  "event_id": 101,
  "recommendations": [
    {
      "id": 5,
      "name": "김철수",
      "phone": "010-1234-5678",
      "residence": "서울 강남구",
      "has_driver_license": true,
      "has_security_cert": true,
      "level": 7,
      "reliability_score": 98.5,
      "completed_events": 120,
      "match_score": 95.2,
      "score_breakdown": {
        "distance": 90.0,
        "reliability": 98.5,
        "pay": 92.0,
        "skill": 100.0,
        "availability": 100.0
      }
    },
    ...
  ],
  "total_count": 45
}
```

---

### POST /ai/auto-fill-month

이번달 자동 채우기

**Request**:
```http
POST /api/ai/auto-fill-month?year=2026&month=2&max_events=20
Authorization: Bearer {token}
```

**Query Parameters**:
- `year`: 연도
- `month`: 월
- `max_events`: 최대 추천 수 (기본: 20)

**Response**:
```json
{
  "recommended_count": 15,
  "events": [
    {
      "id": 101,
      "title": "컨벤션 안내",
      "event_date": "2026-02-05",
      "match_score": 92.5,
      "pay_amount": 150000
    },
    {
      "id": 102,
      "title": "행사 진행",
      "event_date": "2026-02-08",
      "match_score": 88.0,
      "pay_amount": 120000
    },
    ...
  ],
  "message": "자동 채우기 추천 완료. 지원하려면 확인 버튼을 눌러주세요."
}
```

**설명**:
- 같은 날 중복 지원 방지
- 점수 높은 순으로 추천
- 실제 지원은 사용자 확인 필요

---

### GET /ai/matching-stats

매칭 통계 (Admin)

**Request**:
```http
GET /api/ai/matching-stats?days=30
Authorization: Bearer {admin_token}
```

**Response**:
```json
{
  "total_matches": 5000,
  "recommended_count": 4500,
  "applied_count": 3200,
  "accepted_count": 2800,
  "avg_score": 78.5,
  "total_wpt_charged": 50000
}
```

---

## 📊 BigData Analytics API

### GET /bigdata/workers/{worker_id}/history

근무자 이력 조회

**Request**:
```http
GET /api/bigdata/workers/5/history?limit=50
Authorization: Bearer {admin_token}
```

**Response**:
```json
{
  "worker_id": 5,
  "history": [
    {
      "event_id": 100,
      "event_title": "컨벤션 스태프",
      "event_date": "2026-02-01",
      "status": "completed",
      "check_in_time": "2026-02-01T09:00:00Z",
      "check_out_time": "2026-02-01T18:00:00Z",
      "work_hours": 8.0,
      "pay_amount": 150000,
      "rating": 5.0,
      "wpt_earned": 75
    },
    ...
  ]
}
```

---

### GET /bigdata/workers/{worker_id}/monthly-stats

월간 통계

**Request**:
```http
GET /api/bigdata/workers/5/monthly-stats?year=2026&month=1
```

**Response**:
```json
{
  "worker_id": 5,
  "year": 2026,
  "month": 1,
  "total_days": 20,
  "present_days": 19,
  "late_days": 1,
  "absent_days": 0,
  "total_work_hours": 152.0,
  "avg_work_hours": 8.0,
  "total_income": 3000000,
  "total_wpt_earned": 1200,
  "avg_rating": 4.8
}
```

---

### GET /bigdata/analytics/summary

전체 분석 요약

**Request**:
```http
GET /api/bigdata/analytics/summary?year=2026&month=1
Authorization: Bearer {admin_token}
```

**Response**:
```json
{
  "period": "2026-01",
  "total_workers": 1200,
  "active_workers": 950,
  "total_events": 500,
  "completed_events": 480,
  "total_work_hours": 76000,
  "total_income": 150000000,
  "avg_worker_income": 157895,
  "avg_attendance_rate": 94.5,
  "avg_reliability_score": 92.3
}
```

---

## 🔔 Notifications API

### GET /notifications

알림 목록

**Request**:
```http
GET /api/notifications?limit=50
Authorization: Bearer {token}
```

**Response**:
```json
{
  "notifications": [
    {
      "id": 1,
      "type": "wpt_earned",
      "title": "WPT 획득!",
      "message": "출근 보상으로 15 WPT를 받았습니다",
      "is_read": false,
      "data": "{\"amount\": 15, \"type\": \"checkin\"}",
      "created_at": "2026-02-04T09:00:00Z"
    },
    ...
  ]
}
```

---

## 🔧 Admin Config API

### GET /admin/config/wpt-rewards

WPT 보상 설정 조회

**Request**:
```http
GET /api/admin/config/wpt-rewards
Authorization: Bearer {admin_token}
```

**Response**:
```json
{
  "checkin": 10,
  "checkout": 10,
  "streak_bonus": 5,
  "complete_event": 50,
  "perfect_attendance": 100
}
```

---

### PATCH /admin/config/wpt-rewards

WPT 보상 설정 변경

**Request**:
```http
PATCH /api/admin/config/wpt-rewards
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "checkin": 15,
  "checkout": 15,
  "streak_bonus": 10
}
```

**Response**:
```json
{
  "message": "WPT 보상 설정이 업데이트되었습니다",
  "updated_config": {
    "checkin": 15,
    "checkout": 15,
    "streak_bonus": 10,
    "complete_event": 50,
    "perfect_attendance": 100
  }
}
```

---

## ❌ 에러 코드

| Status | Code | Message |
|--------|------|---------|
| 400 | INSUFFICIENT_WPT | WPT 잔액이 부족합니다 |
| 400 | ALREADY_REWARDED | 이미 보상을 받았습니다 |
| 400 | INVALID_ATTENDANCE | 출석 기록이 유효하지 않습니다 |
| 401 | UNAUTHORIZED | 인증이 필요합니다 |
| 403 | FORBIDDEN | 권한이 없습니다 |
| 404 | NOT_FOUND | 리소스를 찾을 수 없습니다 |
| 500 | INTERNAL_ERROR | 서버 오류가 발생했습니다 |

**에러 응답 형식**:
```json
{
  "detail": "WPT 잔액이 부족합니다",
  "code": "INSUFFICIENT_WPT",
  "data": {
    "required": 100,
    "current": 50
  }
}
```

---

## 📝 Rate Limiting

- 일반 API: 100 req/min
- AI 추천: 20 req/min
- Admin API: 500 req/min

**헤더**:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1654321200
```

---

## 🔄 Webhooks

향후 지원 예정:
- WPT 획득 시
- 레벨업 시
- 추천 매칭 시

---

**마지막 업데이트**: 2026-02-04
**문의**: dev@workproof.co.kr
