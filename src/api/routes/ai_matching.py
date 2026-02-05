"""AI Matching Engine Routes"""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from datetime import date, datetime
import json
import math

from ..dependencies import get_db, require_worker, require_admin
from db import Database

router = APIRouter()


# ============================================
# Scoring Functions
# ============================================

def get_ai_weights(db: Database):
    """AI 매칭 가중치 가져오기"""
    with db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT value FROM gamification_config WHERE key = 'ai_weights'")
        result = cursor.fetchone()
        if result:
            return json.loads(result[0])
        return {
            "distance": 0.25,
            "reliability": 0.30,
            "pay": 0.20,
            "skill": 0.15,
            "availability": 0.10
        }


def calculate_distance_score(worker_lat: float, worker_lon: float, event_lat: float, event_lon: float) -> float:
    """거리 점수 계산 (0-100)"""
    if not all([worker_lat, worker_lon, event_lat, event_lon]):
        return 50.0  # 위치 정보 없으면 중간 점수

    # Haversine formula
    R = 6371  # 지구 반지름 (km)

    lat1 = math.radians(worker_lat)
    lat2 = math.radians(event_lat)
    delta_lat = math.radians(event_lat - worker_lat)
    delta_lon = math.radians(event_lon - worker_lon)

    a = math.sin(delta_lat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(delta_lon/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

    distance_km = R * c

    # 거리를 점수로 변환 (가까울수록 높은 점수)
    # 0km = 100점, 50km+ = 0점
    if distance_km <= 5:
        return 100.0
    elif distance_km <= 10:
        return 90.0
    elif distance_km <= 20:
        return 70.0
    elif distance_km <= 30:
        return 50.0
    elif distance_km <= 50:
        return 30.0
    else:
        return 10.0


def calculate_reliability_score(worker_metrics: dict) -> float:
    """신뢰도 점수 (0-100) - 최근 성과를 더 높게 반영"""
    if not worker_metrics:
        return 50.0

    # 기존 신뢰도 점수 사용
    base_score = worker_metrics.get("reliability_score", 50.0)

    # 전체 완료율
    total = worker_metrics.get("total_events", 0)
    completed = worker_metrics.get("completed_events", 0)

    # 최근 3개월 완료율 (더 높은 가중치)
    recent_total = worker_metrics.get("recent_total", 0)
    recent_completed = worker_metrics.get("recent_completed", 0)

    # 점수 계산
    if recent_total > 5:
        # 최근 실적이 충분하면 최근 성과를 60% 반영
        recent_rate = (recent_completed / recent_total) * 100
        overall_rate = (completed / total) * 100 if total > 0 else 50.0
        score = (base_score * 0.2) + (recent_rate * 0.6) + (overall_rate * 0.2)
    elif total > 0:
        # 최근 실적이 적으면 전체 완료율 위주
        completion_rate = (completed / total) * 100
        score = (base_score * 0.4) + (completion_rate * 0.6)
    else:
        score = base_score

    # 레벨 보너스 (경험이 많을수록 신뢰도 상승)
    level = worker_metrics.get("level", 1)
    level_bonus = (level - 1) * 2  # 레벨당 +2점

    final_score = score + level_bonus

    return min(100.0, max(0.0, final_score))


def calculate_pay_score(event_pay: float, worker_avg_pay: float) -> float:
    """급여 적합도 점수 (0-100)"""
    if not event_pay:
        return 50.0

    if not worker_avg_pay or worker_avg_pay == 0:
        # 경력 없으면 모든 급여에 관심
        return 70.0

    # 근무자 평균 급여 대비 비율
    ratio = event_pay / worker_avg_pay

    if ratio >= 1.2:
        # 평소보다 20% 이상 높으면 매우 선호
        return 100.0
    elif ratio >= 1.0:
        # 평소와 비슷하거나 약간 높으면 선호
        return 85.0
    elif ratio >= 0.8:
        # 평소보다 약간 낮으면 보통
        return 60.0
    else:
        # 평소보다 많이 낮으면 낮은 점수
        return 30.0


def calculate_skill_score(event_requirements: dict, worker_skills: dict) -> float:
    """스킬 매칭 점수 (0-100) - 레벨과 경력 반영"""
    # 이벤트 자격 요건
    requires_driver = event_requirements.get("requires_driver_license", False)
    requires_security = event_requirements.get("requires_security_cert", False)

    # 근무자 자격
    has_driver = worker_skills.get("has_driver_license", False)
    has_security = worker_skills.get("has_security_cert", False)
    level = worker_skills.get("level", 1)
    completed_events = worker_skills.get("completed_events", 0)

    score = 50.0  # 기본 점수

    # 필수 요건 충족 체크
    if requires_driver:
        if has_driver:
            score += 25.0
        else:
            return 0.0  # 필수 요건 미충족 시 매칭 불가

    if requires_security:
        if has_security:
            score += 25.0
        else:
            return 0.0

    # 추가 자격증 있으면 보너스
    if has_driver and not requires_driver:
        score += 10.0
    if has_security and not requires_security:
        score += 10.0

    # 레벨 보너스 (숙련도 반영)
    level_bonus = min((level - 1) * 3, 15)  # 레벨당 +3점, 최대 +15점
    score += level_bonus

    # 경력 보너스 (완료한 행사 수)
    if completed_events >= 50:
        experience_bonus = 10.0
    elif completed_events >= 20:
        experience_bonus = 7.0
    elif completed_events >= 10:
        experience_bonus = 5.0
    elif completed_events >= 5:
        experience_bonus = 3.0
    else:
        experience_bonus = 0.0

    score += experience_bonus

    return min(100.0, score)


def calculate_availability_score(event_date: date, worker_id: int, db: Database) -> float:
    """가용성 점수 (0-100)"""
    with db.get_connection() as conn:
        from psycopg2.extras import RealDictCursor
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        # 같은 날짜에 확정된 근무가 있는지 확인
        cursor.execute("""
            SELECT COUNT(*) as conflict_count
            FROM applications a
            JOIN events e ON a.event_id = e.id
            WHERE a.worker_id = %s
            AND a.status = 'CONFIRMED'
            AND e.event_date = %s
        """, (worker_id, event_date))

        result = cursor.fetchone()
        conflict_count = result["conflict_count"] if result else 0

        if conflict_count > 0:
            return 0.0  # 일정 충돌

        return 100.0  # 가능


def calculate_match_score(
    worker_id: int,
    event_id: int,
    db: Database
) -> dict:
    """종합 매칭 점수 계산"""

    with db.get_connection() as conn:
        from psycopg2.extras import RealDictCursor
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        # Worker 정보
        cursor.execute("""
            SELECT w.*, wm.reliability_score, wm.avg_daily_income
            FROM workers w
            LEFT JOIN worker_metrics wm ON wm.worker_id = w.id
            WHERE w.id = %s
        """, (worker_id,))
        worker = cursor.fetchone()

        if not worker:
            raise HTTPException(status_code=404, detail="Worker not found")

        # Event 정보
        cursor.execute("SELECT * FROM events WHERE id = %s", (event_id,))
        event = cursor.fetchone()

        if not event:
            raise HTTPException(status_code=404, detail="Event not found")

        # Worker metrics
        cursor.execute("SELECT * FROM worker_metrics WHERE worker_id = %s", (worker_id,))
        metrics = cursor.fetchone()

    # 가중치 로드
    weights = get_ai_weights(db)

    # 각 점수 계산
    # 1. 거리 점수 (위치 정보 있으면)
    worker_lat = float(worker.get("residence_lat")) if worker.get("residence_lat") else None
    worker_lon = float(worker.get("residence_lng")) if worker.get("residence_lng") else None
    event_lat = float(event.get("location_lat")) if event.get("location_lat") else None
    event_lon = float(event.get("location_lng")) if event.get("location_lng") else None

    distance_score = calculate_distance_score(worker_lat, worker_lon, event_lat, event_lon)

    # 2. 신뢰도 점수 (최근 성과 반영)
    with db.get_connection() as conn:
        cursor = conn.cursor()
        # 최근 3개월 완료율 조회
        cursor.execute("""
            SELECT
                COUNT(*) as recent_total,
                COUNT(CASE WHEN a.check_out_time IS NOT NULL THEN 1 END) as recent_completed
            FROM applications app
            LEFT JOIN attendance a ON a.application_id = app.id
            WHERE app.worker_id = %s
            AND app.created_at >= NOW() - INTERVAL '3 months'
        """, (worker_id,))
        recent_data = cursor.fetchone()

        recent_performance = {
            "recent_total": recent_data[0] if recent_data else 0,
            "recent_completed": recent_data[1] if recent_data else 0
        }

    metrics_dict = dict(metrics) if metrics else {}
    metrics_dict.update(recent_performance)
    reliability_score = calculate_reliability_score(metrics_dict)

    # 3. 급여 점수
    event_pay = float(event["pay_amount"]) if event.get("pay_amount") else 0
    worker_avg_pay = float(metrics["avg_daily_income"]) if metrics and metrics.get("avg_daily_income") else 0
    pay_score = calculate_pay_score(event_pay, worker_avg_pay)

    # 4. 스킬 점수
    skill_score = calculate_skill_score(
        {
            "requires_driver_license": event.get("requires_driver_license", False),
            "requires_security_cert": event.get("requires_security_cert", False)
        },
        {
            "has_driver_license": worker.get("has_driver_license", False),
            "has_security_cert": worker.get("has_security_cert", False),
            "level": metrics.get("level", 1) if metrics else 1,
            "completed_events": metrics.get("completed_events", 0) if metrics else 0
        }
    )

    # 5. 가용성 점수
    availability_score = calculate_availability_score(
        event["event_date"],
        worker_id,
        db
    )

    # 종합 점수 계산
    total_score = (
        distance_score * weights["distance"] +
        reliability_score * weights["reliability"] +
        pay_score * weights["pay"] +
        skill_score * weights["skill"] +
        availability_score * weights["availability"]
    )

    return {
        "worker_id": worker_id,
        "event_id": event_id,
        "total_score": round(total_score, 2),
        "scores": {
            "distance": round(distance_score, 2),
            "reliability": round(reliability_score, 2),
            "pay": round(pay_score, 2),
            "skill": round(skill_score, 2),
            "availability": round(availability_score, 2)
        },
        "weights": weights
    }


# ============================================
# Routes
# ============================================

@router.get("/recommend-events")
async def recommend_events(
    limit: int = 10,
    min_score: float = 50.0,
    auth: dict = Depends(require_worker),
    db: Database = Depends(get_db)
):
    """근무자를 위한 행사 추천"""
    worker_id = auth["worker"]["id"]

    with db.get_connection() as conn:
        from psycopg2.extras import RealDictCursor
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        # 지원 가능한 OPEN 상태 행사들
        cursor.execute("""
            SELECT id, title, event_date, location, pay_amount,
                   requires_driver_license, requires_security_cert
            FROM events
            WHERE status = 'OPEN'
            AND event_date >= CURRENT_DATE
            ORDER BY event_date
        """)

        events = cursor.fetchall()

    recommendations = []

    for event in events:
        try:
            score_result = calculate_match_score(worker_id, event["id"], db)

            if score_result["total_score"] >= min_score:
                recommendations.append({
                    **dict(event),
                    "match_score": score_result["total_score"],
                    "score_breakdown": score_result["scores"]
                })

                # 매칭 로그 기록
                with db.get_connection() as conn:
                    cursor = conn.cursor()
                    cursor.execute("""
                        INSERT INTO ai_matching_logs (
                            initiated_by, worker_id, event_id,
                            match_score, distance_score, reliability_score,
                            pay_score, skill_score, was_recommended
                        ) VALUES ('worker', %s, %s, %s, %s, %s, %s, %s, true)
                    """, (
                        worker_id, event["id"],
                        score_result["total_score"],
                        score_result["scores"]["distance"],
                        score_result["scores"]["reliability"],
                        score_result["scores"]["pay"],
                        score_result["scores"]["skill"]
                    ))
                    conn.commit()

        except Exception as e:
            print(f"Error calculating score for event {event['id']}: {e}")
            continue

    # 점수 높은 순으로 정렬
    recommendations.sort(key=lambda x: x["match_score"], reverse=True)

    return {
        "recommendations": recommendations[:limit],
        "total_count": len(recommendations)
    }


@router.get("/recommend-workers/{event_id}")
async def recommend_workers(
    event_id: int,
    limit: int = 20,
    min_score: float = 60.0,
    admin: dict = Depends(require_admin),
    db: Database = Depends(get_db)
):
    """관리자: 행사를 위한 근무자 추천"""

    with db.get_connection() as conn:
        from psycopg2.extras import RealDictCursor
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        # 모든 활성 근무자
        cursor.execute("""
            SELECT w.id, w.name, w.phone, w.residence,
                   w.has_driver_license, w.has_security_cert,
                   wm.level, wm.reliability_score, wm.completed_events
            FROM workers w
            LEFT JOIN worker_metrics wm ON wm.worker_id = w.id
            WHERE w.is_active = true
        """)

        workers = cursor.fetchall()

    recommendations = []

    for worker in workers:
        try:
            score_result = calculate_match_score(worker["id"], event_id, db)

            if score_result["total_score"] >= min_score:
                recommendations.append({
                    **dict(worker),
                    "match_score": score_result["total_score"],
                    "score_breakdown": score_result["scores"]
                })

                # 매칭 로그 기록
                with db.get_connection() as conn:
                    cursor = conn.cursor()
                    cursor.execute("""
                        INSERT INTO ai_matching_logs (
                            initiated_by, worker_id, event_id,
                            match_score, distance_score, reliability_score,
                            pay_score, skill_score, was_recommended
                        ) VALUES ('admin', %s, %s, %s, %s, %s, %s, %s, true)
                    """, (
                        worker["id"], event_id,
                        score_result["total_score"],
                        score_result["scores"]["distance"],
                        score_result["scores"]["reliability"],
                        score_result["scores"]["pay"],
                        score_result["scores"]["skill"]
                    ))
                    conn.commit()

        except Exception as e:
            print(f"Error calculating score for worker {worker['id']}: {e}")
            continue

    # 점수 높은 순으로 정렬
    recommendations.sort(key=lambda x: x["match_score"], reverse=True)

    return {
        "event_id": event_id,
        "recommendations": recommendations[:limit],
        "total_count": len(recommendations)
    }


@router.post("/auto-fill-month")
async def auto_fill_month(
    year: int,
    month: int,
    max_events: int = 20,
    auth: dict = Depends(require_worker),
    db: Database = Depends(get_db)
):
    """이번달 자동 채우기 (AI 추천 + 일괄 지원)"""
    worker_id = auth["worker"]["id"]

    # 추천 행사 가져오기
    recommendations_response = await recommend_events(
        limit=max_events,
        min_score=70.0,
        auth=auth,
        db=db
    )

    recommendations = recommendations_response["recommendations"]

    # 날짜별로 그룹핑 (같은 날 중복 지원 방지)
    daily_events = {}
    for rec in recommendations:
        event_date = rec["event_date"]
        if event_date not in daily_events:
            daily_events[event_date] = rec
        elif rec["match_score"] > daily_events[event_date]["match_score"]:
            # 더 높은 점수로 교체
            daily_events[event_date] = rec

    # 지원 가능한 행사들
    auto_apply_events = list(daily_events.values())

    # TODO: 실제 지원 로직 추가 (사용자 확인 필요)

    return {
        "recommended_count": len(auto_apply_events),
        "events": auto_apply_events,
        "message": "자동 채우기 추천 완료. 지원하려면 확인 버튼을 눌러주세요."
    }


@router.get("/matching-stats")
async def get_matching_stats(
    days: int = 30,
    admin: dict = Depends(require_admin),
    db: Database = Depends(get_db)
):
    """매칭 통계 (Admin)"""
    with db.get_connection() as conn:
        from psycopg2.extras import RealDictCursor
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        cursor.execute("""
            SELECT
                COUNT(*) as total_matches,
                COUNT(CASE WHEN was_recommended THEN 1 END) as recommended_count,
                COUNT(CASE WHEN was_applied THEN 1 END) as applied_count,
                COUNT(CASE WHEN was_accepted THEN 1 END) as accepted_count,
                AVG(match_score) as avg_score,
                SUM(wpt_charged) as total_wpt_charged
            FROM ai_matching_logs
            WHERE created_at >= NOW() - INTERVAL '%s days'
        """, (days,))

        stats = cursor.fetchone()

        return dict(stats) if stats else {}
