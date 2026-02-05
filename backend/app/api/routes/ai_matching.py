"""
AI Matching System for Work OS
================================
5-Factor Scoring System:
1. Distance Score (25%): Haversine formula for worker-to-event distance
2. Reliability Score (30%): Based on worker metrics (completion rate, rating, streak)
3. Pay Score (20%): Compares event pay to worker's average income
4. Skill Score (15%): Matches event requirements to worker certifications
5. Availability Score (10%): Checks for schedule conflicts

Total Score = weighted sum of all 5 scores (0-100 points)
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text, and_, or_
from typing import List, Optional
from datetime import datetime, timedelta
import math
import json

from app.core.database import get_db
from app.core.auth import get_current_user

router = APIRouter(prefix="/api/ai", tags=["AI Matching"])


# ============================================================================
# SCORING FUNCTIONS
# ============================================================================

def calculate_distance_score(
    worker_lat: float,
    worker_lon: float,
    event_lat: float,
    event_lon: float
) -> dict:
    """
    Calculate distance score using Haversine formula.

    Scoring:
    - 0-5km: 100 points
    - 5-10km: 90 points
    - 10-20km: 75 points
    - 20-50km: 50 points
    - 50km+: 10-50 points (decreasing)

    Returns:
        dict: {score: float, distance_km: float, details: str}
    """
    # Haversine formula
    R = 6371  # Earth radius in kilometers

    lat1_rad = math.radians(worker_lat)
    lat2_rad = math.radians(event_lat)
    delta_lat = math.radians(event_lat - worker_lat)
    delta_lon = math.radians(event_lon - worker_lon)

    a = (math.sin(delta_lat / 2) ** 2 +
         math.cos(lat1_rad) * math.cos(lat2_rad) *
         math.sin(delta_lon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    distance_km = R * c

    # Calculate score
    if distance_km <= 5:
        score = 100
    elif distance_km <= 10:
        score = 90
    elif distance_km <= 20:
        score = 75
    elif distance_km <= 50:
        score = 50
    else:
        # Gradually decrease from 50 to 10 for distances > 50km
        score = max(10, 50 - (distance_km - 50) / 5)

    details = f"{distance_km:.1f}km"

    return {
        "score": round(score, 2),
        "distance_km": round(distance_km, 2),
        "details": details
    }


def calculate_reliability_score(
    worker_metrics: dict,
    worker_streak: Optional[dict] = None
) -> dict:
    """
    Calculate reliability score based on worker's performance history.

    Factors:
    - Completion rate (40%): percentage of completed vs total events
    - Average rating (30%): worker's average rating from employers
    - Reliability score from metrics (20%): existing reliability calculation
    - Current streak (10%): bonus for consistent attendance

    Returns:
        dict: {score: float, details: str}
    """
    # Base scores
    completion_rate = 0
    if worker_metrics.get('total_events', 0) > 0:
        completion_rate = (
            worker_metrics.get('completed_events', 0) /
            worker_metrics.get('total_events', 0)
        ) * 100

    avg_rating = worker_metrics.get('avg_rating', 0.0) * 20  # Convert 5-star to 100 scale
    reliability = worker_metrics.get('reliability_score', 0.0)

    # Streak bonus (0-10 points)
    streak_bonus = 0
    if worker_streak:
        current_streak = worker_streak.get('current_streak', 0)
        if current_streak >= 30:
            streak_bonus = 10
        elif current_streak >= 14:
            streak_bonus = 8
        elif current_streak >= 7:
            streak_bonus = 5
        elif current_streak >= 3:
            streak_bonus = 3

    # Weighted calculation
    score = (
        completion_rate * 0.40 +
        avg_rating * 0.30 +
        float(reliability) * 0.20 +
        streak_bonus
    )

    # Level bonus (higher levels get small bonus)
    level = worker_metrics.get('level', 1)
    level_bonus = min(5, (level - 1) * 1)  # +1 point per level, max +5
    score += level_bonus

    score = min(100, score)  # Cap at 100

    details = f"완료율 {completion_rate:.0f}%, 평점 {worker_metrics.get('avg_rating', 0):.1f}/5"
    if worker_streak and worker_streak.get('current_streak', 0) > 0:
        details += f", {worker_streak.get('current_streak')}일 연속"

    return {
        "score": round(score, 2),
        "details": details
    }


def calculate_pay_score(event_pay: int, worker_avg_income: float) -> dict:
    """
    Calculate pay score by comparing event pay to worker's average income.

    Scoring:
    - ≥120% of avg: 100 points (premium pay)
    - ≥100% of avg: 85 points (standard pay)
    - ≥80% of avg: 60 points (acceptable)
    - <80% of avg: 20-50 points (below average)

    If worker has no history, use baseline scoring.

    Returns:
        dict: {score: float, details: str}
    """
    if worker_avg_income <= 0:
        # No history - use baseline scoring
        # Assume average daily income is around 100,000 won
        baseline = 100000
        ratio = event_pay / baseline
    else:
        ratio = event_pay / worker_avg_income

    if ratio >= 1.2:
        score = 100
        level = "프리미엄"
    elif ratio >= 1.0:
        score = 85
        level = "적정"
    elif ratio >= 0.8:
        score = 60
        level = "보통"
    else:
        # Gradually decrease for lower pay
        score = max(20, 60 - (0.8 - ratio) * 100)
        level = "낮음"

    details = f"{level} (₩{event_pay:,})"

    return {
        "score": round(score, 2),
        "details": details
    }


def calculate_skill_score(
    event: dict,
    worker: dict,
    worker_metrics: dict
) -> dict:
    """
    Calculate skill score based on worker certifications and experience.

    Factors:
    - Required certifications (50 points max)
    - Optional certifications bonus (20 points max)
    - Level/Experience bonus (30 points max)

    Returns:
        dict: {score: float, details: str}
    """
    score = 0
    matched_skills = []

    # Check required certifications
    requires_driver = event.get('requires_driver_license', False)
    requires_security = event.get('requires_security_cert', False)

    has_driver = worker.get('driver_license', False)
    has_security = worker.get('security_cert', False)

    if requires_driver and requires_security:
        # Both required
        if has_driver and has_security:
            score += 50
            matched_skills.append("운전면허+경비")
        elif has_driver or has_security:
            score += 25  # Partial match
            matched_skills.append("운전면허" if has_driver else "경비")
        # else: score = 0, doesn't meet requirements
    elif requires_driver:
        if has_driver:
            score += 50
            matched_skills.append("운전면허")
    elif requires_security:
        if has_security:
            score += 50
            matched_skills.append("경비")
    else:
        # No specific requirements - everyone gets base score
        score += 30

    # Optional certifications bonus
    if not requires_driver and has_driver:
        score += 10
        matched_skills.append("운전면허(보너스)")
    if not requires_security and has_security:
        score += 10
        matched_skills.append("경비(보너스)")

    # Experience bonus
    level = worker_metrics.get('level', 1)
    completed_events = worker_metrics.get('completed_events', 0)

    # Level bonus (max 15 points)
    level_bonus = min(15, (level - 1) * 3)
    score += level_bonus

    # Experience bonus (max 15 points)
    exp_bonus = min(15, completed_events * 0.5)
    score += exp_bonus

    score = min(100, score)  # Cap at 100

    if matched_skills:
        details = ", ".join(matched_skills)
    else:
        details = f"Lv.{level} ({completed_events}건)"

    return {
        "score": round(score, 2),
        "details": details
    }


def calculate_availability_score(
    event_date: str,
    worker_id: int,
    db: Session
) -> dict:
    """
    Calculate availability score by checking for schedule conflicts.

    Checks:
    - Already applied to another event on the same date
    - Already approved for another event on the same date

    Returns:
        dict: {score: float, available: bool, details: str}
    """
    # Check applications for the same date
    conflict_query = text("""
        SELECT COUNT(*) as conflicts
        FROM applications a
        JOIN events e ON a.event_id = e.id
        WHERE a.worker_id = :worker_id
          AND e.event_date = :event_date
          AND a.status IN ('PENDING', 'APPROVED')
    """)

    result = db.execute(
        conflict_query,
        {"worker_id": worker_id, "event_date": event_date}
    ).fetchone()

    conflicts = result[0] if result else 0

    if conflicts > 0:
        score = 0
        available = False
        details = f"스케줄 충돌 ({conflicts}건)"
    else:
        score = 100
        available = True
        details = "가능"

    return {
        "score": score,
        "available": available,
        "details": details
    }


# ============================================================================
# MAIN MATCHING FUNCTIONS
# ============================================================================

def get_worker_home_location(worker_id: int, db: Session) -> Optional[tuple]:
    """
    Get worker's home location from recent check-in locations.
    Uses median of recent locations as home base.
    """
    query = text("""
        SELECT latitude, longitude
        FROM worker_locations
        WHERE worker_id = :worker_id
        ORDER BY created_at DESC
        LIMIT 10
    """)

    locations = db.execute(query, {"worker_id": worker_id}).fetchall()

    if not locations:
        return None

    # Calculate median location
    lats = [float(loc[0]) for loc in locations]
    lons = [float(loc[1]) for loc in locations]

    median_lat = sorted(lats)[len(lats) // 2]
    median_lon = sorted(lons)[len(lons) // 2]

    return (median_lat, median_lon)


def calculate_total_score(
    worker: dict,
    event: dict,
    distance_result: dict,
    reliability_result: dict,
    pay_result: dict,
    skill_result: dict,
    availability_result: dict,
    weights: dict
) -> dict:
    """
    Calculate weighted total score from all factors.

    Returns:
        dict: {
            total_score: float,
            breakdown: dict of individual scores,
            weights: dict of weights used
        }
    """
    total_score = (
        distance_result["score"] * weights.get("distance", 0.25) +
        reliability_result["score"] * weights.get("reliability", 0.30) +
        pay_result["score"] * weights.get("pay", 0.20) +
        skill_result["score"] * weights.get("skill", 0.15) +
        availability_result["score"] * weights.get("availability", 0.10)
    )

    return {
        "total_score": round(total_score, 2),
        "breakdown": {
            "distance": distance_result,
            "reliability": reliability_result,
            "pay": pay_result,
            "skill": skill_result,
            "availability": availability_result
        },
        "weights": weights
    }


async def log_matching_result(
    worker_id: int,
    event_id: int,
    score_data: dict,
    db: Session
):
    """Log AI matching result to ai_matching_logs table."""
    try:
        log_query = text("""
            INSERT INTO ai_matching_logs
            (worker_id, event_id, match_score, distance_score, reliability_score,
             pay_score, skill_score, availability_score, match_details)
            VALUES
            (:worker_id, :event_id, :match_score, :distance_score, :reliability_score,
             :pay_score, :skill_score, :availability_score, :match_details)
        """)

        db.execute(log_query, {
            "worker_id": worker_id,
            "event_id": event_id,
            "match_score": score_data["total_score"],
            "distance_score": score_data["breakdown"]["distance"]["score"],
            "reliability_score": score_data["breakdown"]["reliability"]["score"],
            "pay_score": score_data["breakdown"]["pay"]["score"],
            "skill_score": score_data["breakdown"]["skill"]["score"],
            "availability_score": score_data["breakdown"]["availability"]["score"],
            "match_details": json.dumps(score_data["breakdown"], ensure_ascii=False)
        })
        db.commit()
    except Exception as e:
        print(f"Error logging match result: {e}")
        db.rollback()


# ============================================================================
# API ENDPOINTS
# ============================================================================

@router.get("/recommend-events")
async def recommend_events_for_worker(
    worker_id: int = Query(..., description="Worker ID"),
    limit: int = Query(20, ge=1, le=50, description="Maximum number of recommendations"),
    db: Session = Depends(get_db)
):
    """
    Get AI-recommended events for a specific worker.
    Calculates matching scores for all open events.
    """
    # Get weights from config
    weights_query = text("SELECT value FROM gamification_config WHERE key = 'ai_weights'")
    weights_result = db.execute(weights_query).fetchone()
    weights = json.loads(weights_result[0]) if weights_result else {
        "distance": 0.25,
        "reliability": 0.30,
        "pay": 0.20,
        "skill": 0.15,
        "availability": 0.10
    }

    # Get worker data
    worker_query = text("""
        SELECT w.*, wm.*, ws.current_streak, ws.longest_streak
        FROM workers w
        LEFT JOIN worker_metrics wm ON w.id = wm.worker_id
        LEFT JOIN worker_streaks ws ON w.id = ws.worker_id
        WHERE w.id = :worker_id
    """)
    worker_data = db.execute(worker_query, {"worker_id": worker_id}).fetchone()

    if not worker_data:
        raise HTTPException(status_code=404, detail="Worker not found")

    worker = dict(worker_data._mapping)

    # Get worker home location
    worker_location = get_worker_home_location(worker_id, db)

    # Get open events
    events_query = text("""
        SELECT * FROM events
        WHERE status = 'OPEN'
          AND event_date >= CURRENT_DATE
        ORDER BY event_date
    """)
    events = db.execute(events_query).fetchall()

    recommendations = []

    for event_row in events:
        event = dict(event_row._mapping)

        # Skip if no location data
        if not event.get('location_lat') or not event.get('location_lng'):
            continue

        # Skip if worker has no location data
        if not worker_location:
            continue

        try:
            # Calculate all scores
            distance_result = calculate_distance_score(
                worker_location[0], worker_location[1],
                float(event['location_lat']), float(event['location_lng'])
            )

            reliability_result = calculate_reliability_score(
                worker,
                {"current_streak": worker.get('current_streak', 0)}
            )

            pay_result = calculate_pay_score(
                event['pay_amount'],
                float(worker.get('avg_daily_income', 0))
            )

            skill_result = calculate_skill_score(event, worker, worker)

            availability_result = calculate_availability_score(
                event['event_date'],
                worker_id,
                db
            )

            # Calculate total score
            score_data = calculate_total_score(
                worker, event,
                distance_result, reliability_result, pay_result,
                skill_result, availability_result,
                weights
            )

            # Log the matching
            await log_matching_result(worker_id, event['id'], score_data, db)

            # Add to recommendations
            recommendations.append({
                "event_id": event['id'],
                "event_title": event['title'],
                "event_date": event['event_date'],
                "location": event['location'],
                "pay_amount": event['pay_amount'],
                "score": score_data["total_score"],
                "breakdown": score_data["breakdown"],
                "available": availability_result["available"]
            })

        except Exception as e:
            print(f"Error calculating score for event {event['id']}: {e}")
            continue

    # Sort by score and limit
    recommendations.sort(key=lambda x: x['score'], reverse=True)
    recommendations = recommendations[:limit]

    return {
        "worker_id": worker_id,
        "worker_name": worker['name'],
        "recommendations": recommendations,
        "weights": weights,
        "total_found": len(recommendations)
    }


@router.get("/recommend-workers")
async def recommend_workers_for_event(
    event_id: int = Query(..., description="Event ID"),
    limit: int = Query(20, ge=1, le=50, description="Maximum number of recommendations"),
    db: Session = Depends(get_db)
):
    """
    Get AI-recommended workers for a specific event.
    Calculates matching scores for all available workers.
    """
    # Get weights from config
    weights_query = text("SELECT value FROM gamification_config WHERE key = 'ai_weights'")
    weights_result = db.execute(weights_query).fetchone()
    weights = json.loads(weights_result[0]) if weights_result else {
        "distance": 0.25,
        "reliability": 0.30,
        "pay": 0.20,
        "skill": 0.15,
        "availability": 0.10
    }

    # Get event data
    event_query = text("SELECT * FROM events WHERE id = :event_id")
    event_data = db.execute(event_query, {"event_id": event_id}).fetchone()

    if not event_data:
        raise HTTPException(status_code=404, detail="Event not found")

    event = dict(event_data._mapping)

    # Skip if no location data
    if not event.get('location_lat') or not event.get('location_lng'):
        raise HTTPException(
            status_code=400,
            detail="Event has no location data. Cannot calculate distance scores."
        )

    # Get all workers
    workers_query = text("""
        SELECT w.*, wm.*, ws.current_streak, ws.longest_streak
        FROM workers w
        LEFT JOIN worker_metrics wm ON w.id = wm.worker_id
        LEFT JOIN worker_streaks ws ON w.id = ws.worker_id
        WHERE w.is_admin = false
    """)
    workers = db.execute(workers_query).fetchall()

    recommendations = []

    for worker_row in workers:
        worker = dict(worker_row._mapping)
        worker_id = worker['id']

        # Get worker home location
        worker_location = get_worker_home_location(worker_id, db)

        if not worker_location:
            continue

        try:
            # Calculate all scores
            distance_result = calculate_distance_score(
                worker_location[0], worker_location[1],
                float(event['location_lat']), float(event['location_lng'])
            )

            reliability_result = calculate_reliability_score(
                worker,
                {"current_streak": worker.get('current_streak', 0)}
            )

            pay_result = calculate_pay_score(
                event['pay_amount'],
                float(worker.get('avg_daily_income', 0))
            )

            skill_result = calculate_skill_score(event, worker, worker)

            availability_result = calculate_availability_score(
                event['event_date'],
                worker_id,
                db
            )

            # Calculate total score
            score_data = calculate_total_score(
                worker, event,
                distance_result, reliability_result, pay_result,
                skill_result, availability_result,
                weights
            )

            # Log the matching
            await log_matching_result(worker_id, event['id'], score_data, db)

            # Add to recommendations
            recommendations.append({
                "worker_id": worker['id'],
                "worker_name": worker['name'],
                "level": worker.get('level', 1),
                "wpt_balance": worker.get('wpt_balance', 0),
                "completed_events": worker.get('completed_events', 0),
                "reliability_score": worker.get('reliability_score', 0),
                "score": score_data["total_score"],
                "breakdown": score_data["breakdown"],
                "available": availability_result["available"]
            })

        except Exception as e:
            print(f"Error calculating score for worker {worker['id']}: {e}")
            continue

    # Sort by score and limit
    recommendations.sort(key=lambda x: x['score'], reverse=True)
    recommendations = recommendations[:limit]

    return {
        "event_id": event_id,
        "event_title": event['title'],
        "event_date": event['event_date'],
        "recommendations": recommendations,
        "weights": weights,
        "total_found": len(recommendations)
    }


@router.get("/matching-logs")
async def get_matching_logs(
    worker_id: Optional[int] = Query(None, description="Filter by worker ID"),
    event_id: Optional[int] = Query(None, description="Filter by event ID"),
    limit: int = Query(50, ge=1, le=200, description="Maximum number of logs"),
    db: Session = Depends(get_db)
):
    """
    Get AI matching logs with optional filters.
    """
    query = """
        SELECT
            aml.*,
            w.name as worker_name,
            e.title as event_title,
            e.event_date
        FROM ai_matching_logs aml
        JOIN workers w ON aml.worker_id = w.id
        JOIN events e ON aml.event_id = e.id
        WHERE 1=1
    """
    params = {}

    if worker_id:
        query += " AND aml.worker_id = :worker_id"
        params["worker_id"] = worker_id

    if event_id:
        query += " AND aml.event_id = :event_id"
        params["event_id"] = event_id

    query += " ORDER BY aml.created_at DESC LIMIT :limit"
    params["limit"] = limit

    logs = db.execute(text(query), params).fetchall()

    return {
        "logs": [dict(log._mapping) for log in logs],
        "total": len(logs)
    }


@router.get("/weights")
async def get_matching_weights(db: Session = Depends(get_db)):
    """
    Get current AI matching weights configuration.
    """
    query = text("SELECT value FROM gamification_config WHERE key = 'ai_weights'")
    result = db.execute(query).fetchone()

    if not result:
        # Return default weights
        return {
            "distance": 0.25,
            "reliability": 0.30,
            "pay": 0.20,
            "skill": 0.15,
            "availability": 0.10
        }

    return json.loads(result[0])


@router.put("/weights")
async def update_matching_weights(
    weights: dict,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Update AI matching weights configuration (Admin only).

    Weights must sum to 1.0 and each be between 0.0 and 1.0.
    """
    # Verify user is admin
    if not current_user.get('is_admin'):
        raise HTTPException(status_code=403, detail="Admin access required")

    # Validate weights
    required_keys = ["distance", "reliability", "pay", "skill", "availability"]
    for key in required_keys:
        if key not in weights:
            raise HTTPException(status_code=400, detail=f"Missing weight: {key}")
        if not 0 <= weights[key] <= 1:
            raise HTTPException(status_code=400, detail=f"Weight {key} must be between 0 and 1")

    total = sum(weights[key] for key in required_keys)
    if not 0.99 <= total <= 1.01:  # Allow small floating point errors
        raise HTTPException(
            status_code=400,
            detail=f"Weights must sum to 1.0 (got {total})"
        )

    # Update in database
    update_query = text("""
        UPDATE gamification_config
        SET value = :value, updated_at = CURRENT_TIMESTAMP
        WHERE key = 'ai_weights'
    """)

    db.execute(update_query, {"value": json.dumps(weights)})
    db.commit()

    return {
        "success": True,
        "weights": weights,
        "message": "AI matching weights updated successfully"
    }
