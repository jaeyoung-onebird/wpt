"""Gamification & WPT Rewards Routes"""
from fastapi import APIRouter, Depends, HTTPException
from datetime import date, datetime, timedelta
from typing import Optional
import json

from ..dependencies import get_db, require_worker, require_admin
from db import Database

router = APIRouter()


# ============================================
# Helper Functions
# ============================================

def get_config(db: Database, key: str):
    """설정 값 가져오기"""
    with db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT value FROM gamification_config WHERE key = %s", (key,))
        result = cursor.fetchone()
        if result:
            return json.loads(result[0])
        return {}


def award_wpt(db: Database, worker_id: int, amount: int, category: str, description: str, reference_type: str = None, reference_id: int = None):
    """WPT 지급"""
    with db.get_connection() as conn:
        cursor = conn.cursor()

        # 현재 잔액 조회
        cursor.execute("SELECT COALESCE(wpt_balance, 0) FROM worker_metrics WHERE worker_id = %s", (worker_id,))
        result = cursor.fetchone()
        balance = result[0] if result else 0
        new_balance = balance + amount

        # 트랜잭션 기록
        cursor.execute("""
            INSERT INTO wpt_transactions (worker_id, type, category, amount, balance_after, reference_type, reference_id, description)
            VALUES (%s, 'EARN', %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (worker_id, category, amount, new_balance, reference_type, reference_id, description))

        transaction_id = cursor.fetchone()[0]
        conn.commit()

        return {
            "transaction_id": transaction_id,
            "amount": amount,
            "balance": new_balance,
            "category": category
        }


def spend_wpt(db: Database, worker_id: int, amount: int, category: str, description: str):
    """WPT 차감"""
    with db.get_connection() as conn:
        cursor = conn.cursor()

        # 잔액 확인
        cursor.execute("SELECT COALESCE(wpt_balance, 0) FROM worker_metrics WHERE worker_id = %s", (worker_id,))
        result = cursor.fetchone()
        balance = result[0] if result else 0

        if balance < amount:
            raise HTTPException(status_code=400, detail="WPT 잔액이 부족합니다")

        new_balance = balance - amount

        # 트랜잭션 기록
        cursor.execute("""
            INSERT INTO wpt_transactions (worker_id, type, category, amount, balance_after, description)
            VALUES (%s, 'SPEND', %s, %s, %s, %s)
            RETURNING id
        """, (worker_id, category, -amount, new_balance, description))

        transaction_id = cursor.fetchone()[0]
        conn.commit()

        return {
            "transaction_id": transaction_id,
            "amount": -amount,
            "balance": new_balance
        }


def add_experience(db: Database, worker_id: int, exp: int, reason: str):
    """경험치 추가 및 레벨업 체크"""
    with db.get_connection() as conn:
        cursor = conn.cursor()

        # 현재 레벨/경험치 조회
        cursor.execute("""
            SELECT level, experience_points FROM worker_metrics WHERE worker_id = %s
        """, (worker_id,))
        result = cursor.fetchone()

        if not result:
            current_level = 1
            current_exp = 0
        else:
            current_level, current_exp = result

        new_exp = current_exp + exp

        # 레벨업 체크
        cursor.execute("""
            SELECT level, required_exp FROM worker_levels
            WHERE required_exp <= %s
            ORDER BY level DESC
            LIMIT 1
        """, (new_exp,))
        level_info = cursor.fetchone()

        new_level = level_info[0] if level_info else current_level
        leveled_up = new_level > current_level

        # 업데이트
        cursor.execute("""
            UPDATE worker_metrics
            SET level = %s, experience_points = %s
            WHERE worker_id = %s
        """, (new_level, new_exp, worker_id))

        conn.commit()

        return {
            "exp_gained": exp,
            "total_exp": new_exp,
            "level": new_level,
            "leveled_up": leveled_up,
            "reason": reason
        }


# ============================================
# Routes
# ============================================

@router.get("/me/stats")
async def get_my_stats(
    auth: dict = Depends(require_worker),
    db: Database = Depends(get_db)
):
    """내 게임화 통계 조회"""
    worker_id = auth["worker"]["id"]

    with db.get_connection() as conn:
        from psycopg2.extras import RealDictCursor
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        # Metrics
        cursor.execute("SELECT * FROM worker_metrics WHERE worker_id = %s", (worker_id,))
        metrics = cursor.fetchone()

        # Streak
        cursor.execute("SELECT * FROM worker_streaks WHERE worker_id = %s", (worker_id,))
        streak = cursor.fetchone()

        # Level Info
        if metrics:
            cursor.execute("SELECT * FROM worker_levels WHERE level = %s", (metrics["level"],))
            level_info = cursor.fetchone()
        else:
            level_info = None

        return {
            "metrics": dict(metrics) if metrics else None,
            "streak": dict(streak) if streak else None,
            "level_info": dict(level_info) if level_info else None
        }


@router.post("/checkin-reward")
async def checkin_reward(
    attendance_id: int,
    auth: dict = Depends(require_worker),
    db: Database = Depends(get_db)
):
    """출근 보상 지급"""
    worker_id = auth["worker"]["id"]

    # 출석 확인
    with db.get_connection() as conn:
        from psycopg2.extras import RealDictCursor
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        cursor.execute("""
            SELECT * FROM attendance
            WHERE id = %s AND worker_id = %s
        """, (attendance_id, worker_id))
        attendance = cursor.fetchone()

        if not attendance:
            raise HTTPException(status_code=404, detail="출석 기록을 찾을 수 없습니다")

        if not attendance["check_in_time"]:
            raise HTTPException(status_code=400, detail="출근 처리가 완료되지 않았습니다")

        # 이미 보상 받았는지 확인
        cursor.execute("""
            SELECT id FROM wpt_transactions
            WHERE worker_id = %s
            AND category = 'checkin'
            AND reference_type = 'attendance'
            AND reference_id = %s
        """, (worker_id, attendance_id))

        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="이미 출근 보상을 받았습니다")

    # 설정 로드
    rewards = get_config(db, "wpt_rewards")
    checkin_wpt = rewards.get("checkin", 10)

    # Streak 업데이트
    with db.get_connection() as conn:
        cursor = conn.cursor()

        today = date.today()

        cursor.execute("""
            SELECT current_streak, last_checkin_date, longest_streak
            FROM worker_streaks
            WHERE worker_id = %s
        """, (worker_id,))
        streak_data = cursor.fetchone()

        if not streak_data:
            # 첫 출석
            new_streak = 1
            longest = 1
        else:
            current_streak, last_date, longest = streak_data

            if last_date:
                days_diff = (today - last_date).days

                if days_diff == 1:
                    # 연속 출석
                    new_streak = current_streak + 1
                elif days_diff == 0:
                    # 오늘 이미 출석 (중복 방지)
                    new_streak = current_streak
                else:
                    # 끊김
                    new_streak = 1
            else:
                new_streak = 1

            longest = max(longest or 0, new_streak)

        # Streak 업데이트
        cursor.execute("""
            INSERT INTO worker_streaks (worker_id, current_streak, longest_streak, last_checkin_date)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (worker_id)
            DO UPDATE SET
                current_streak = EXCLUDED.current_streak,
                longest_streak = EXCLUDED.longest_streak,
                last_checkin_date = EXCLUDED.last_checkin_date,
                updated_at = CURRENT_TIMESTAMP
        """, (worker_id, new_streak, longest, today))

        conn.commit()

    # Streak 보너스 계산
    streak_bonus = 0
    if new_streak >= 3:
        streak_bonus = rewards.get("streak_bonus", 5) * (new_streak // 3)

    total_wpt = checkin_wpt + streak_bonus

    # WPT 지급
    transaction = award_wpt(
        db, worker_id, total_wpt, "checkin",
        f"출근 보상 (+{checkin_wpt} WPT) + 연속 출석 보너스 (+{streak_bonus} WPT)",
        "attendance", attendance_id
    )

    # 경험치 지급
    exp_result = add_experience(db, worker_id, 5, "출근 완료")

    return {
        "wpt_reward": transaction,
        "streak": {
            "current": new_streak,
            "longest": longest,
            "bonus_wpt": streak_bonus
        },
        "exp": exp_result
    }


@router.post("/checkout-reward")
async def checkout_reward(
    attendance_id: int,
    auth: dict = Depends(require_worker),
    db: Database = Depends(get_db)
):
    """퇴근 보상 지급"""
    worker_id = auth["worker"]["id"]

    # 출석 확인
    with db.get_connection() as conn:
        from psycopg2.extras import RealDictCursor
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        cursor.execute("""
            SELECT * FROM attendance
            WHERE id = %s AND worker_id = %s
        """, (attendance_id, worker_id))
        attendance = cursor.fetchone()

        if not attendance:
            raise HTTPException(status_code=404, detail="출석 기록을 찾을 수 없습니다")

        if not attendance["check_out_time"]:
            raise HTTPException(status_code=400, detail="퇴근 처리가 완료되지 않았습니다")

        # 이미 보상 받았는지 확인
        cursor.execute("""
            SELECT id FROM wpt_transactions
            WHERE worker_id = %s
            AND category = 'checkout'
            AND reference_type = 'attendance'
            AND reference_id = %s
        """, (worker_id, attendance_id))

        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="이미 퇴근 보상을 받았습니다")

        # 근무 시간 계산
        check_in = attendance["check_in_time"]
        check_out = attendance["check_out_time"]

        if isinstance(check_in, str):
            check_in = datetime.fromisoformat(check_in)
        if isinstance(check_out, str):
            check_out = datetime.fromisoformat(check_out)

        work_hours = (check_out - check_in).total_seconds() / 3600

    # 설정 로드
    rewards = get_config(db, "wpt_rewards")
    checkout_wpt = rewards.get("checkout", 10)

    # 근무 시간 보너스 (시간당 5 WPT)
    time_bonus = int(work_hours * 5)

    total_wpt = checkout_wpt + time_bonus

    # WPT 지급
    transaction = award_wpt(
        db, worker_id, total_wpt, "checkout",
        f"퇴근 보상 (+{checkout_wpt} WPT) + 근무시간 보너스 (+{time_bonus} WPT, {work_hours:.1f}h)",
        "attendance", attendance_id
    )

    # 경험치 지급
    exp_bonus = int(work_hours * 2)
    exp_result = add_experience(db, worker_id, exp_bonus, f"근무 완료 ({work_hours:.1f}시간)")

    return {
        "wpt_reward": transaction,
        "work_hours": round(work_hours, 1),
        "time_bonus": time_bonus,
        "exp": exp_result
    }


@router.get("/leaderboard")
async def get_leaderboard(
    period: str = "all",  # all, month, week
    limit: int = 50,
    db: Database = Depends(get_db)
):
    """리더보드 조회"""
    with db.get_connection() as conn:
        from psycopg2.extras import RealDictCursor
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        # 전체 랭킹
        cursor.execute("""
            SELECT
                wm.worker_id,
                w.name,
                w.photo,
                wm.level,
                wm.experience_points,
                wm.reliability_score,
                wm.total_wpt_earned,
                wm.completed_events,
                ws.current_streak,
                ws.longest_streak
            FROM worker_metrics wm
            JOIN workers w ON w.id = wm.worker_id
            LEFT JOIN worker_streaks ws ON ws.worker_id = wm.worker_id
            ORDER BY wm.level DESC, wm.experience_points DESC
            LIMIT %s
        """, (limit,))

        leaderboard = cursor.fetchall()

        return {
            "period": period,
            "rankings": [dict(row) for row in leaderboard]
        }


@router.get("/wpt/transactions")
async def get_wpt_transactions(
    limit: int = 50,
    auth: dict = Depends(require_worker),
    db: Database = Depends(get_db)
):
    """WPT 거래 내역"""
    worker_id = auth["worker"]["id"]

    with db.get_connection() as conn:
        from psycopg2.extras import RealDictCursor
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        cursor.execute("""
            SELECT * FROM wpt_transactions
            WHERE worker_id = %s
            ORDER BY created_at DESC
            LIMIT %s
        """, (worker_id, limit))

        transactions = cursor.fetchall()

        return {
            "transactions": [dict(t) for t in transactions]
        }


# ============================================
# Admin Routes
# ============================================

@router.post("/admin/grant-wpt")
async def admin_grant_wpt(
    worker_id: int,
    amount: int,
    reason: str,
    admin: dict = Depends(require_admin),
    db: Database = Depends(get_db)
):
    """관리자: WPT 지급"""
    with db.get_connection() as conn:
        cursor = conn.cursor()

        # 현재 잔액 조회
        cursor.execute("SELECT COALESCE(wpt_balance, 0) FROM worker_metrics WHERE worker_id = %s", (worker_id,))
        result = cursor.fetchone()
        balance = result[0] if result else 0
        new_balance = balance + amount

        # 트랜잭션 기록
        cursor.execute("""
            INSERT INTO wpt_transactions (worker_id, type, category, amount, balance_after, description)
            VALUES (%s, 'ADMIN_GRANT', 'admin', %s, %s, %s)
            RETURNING id
        """, (worker_id, amount, new_balance, reason))

        transaction_id = cursor.fetchone()[0]
        conn.commit()

        return {
            "transaction_id": transaction_id,
            "amount": amount,
            "balance": new_balance
        }


@router.get("/admin/analytics")
async def admin_analytics(
    admin: dict = Depends(require_admin),
    db: Database = Depends(get_db)
):
    """관리자: 게임화 분석"""
    with db.get_connection() as conn:
        from psycopg2.extras import RealDictCursor
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        # WPT 통계
        cursor.execute("""
            SELECT
                SUM(CASE WHEN type = 'EARN' THEN amount ELSE 0 END) as total_earned,
                SUM(CASE WHEN type = 'SPEND' THEN ABS(amount) ELSE 0 END) as total_spent,
                SUM(CASE WHEN type = 'BURN' THEN ABS(amount) ELSE 0 END) as total_burned,
                COUNT(DISTINCT worker_id) as active_users
            FROM wpt_transactions
            WHERE created_at >= NOW() - INTERVAL '30 days'
        """)
        wpt_stats = cursor.fetchone()

        # 레벨 분포
        cursor.execute("""
            SELECT level, COUNT(*) as count
            FROM worker_metrics
            GROUP BY level
            ORDER BY level
        """)
        level_distribution = cursor.fetchall()

        # 상위 근무자
        cursor.execute("""
            SELECT
                w.id, w.name,
                wm.level, wm.experience_points,
                wm.reliability_score, wm.completed_events
            FROM worker_metrics wm
            JOIN workers w ON w.id = wm.worker_id
            ORDER BY wm.level DESC, wm.experience_points DESC
            LIMIT 10
        """)
        top_workers = cursor.fetchall()

        return {
            "wpt_economy": dict(wpt_stats) if wpt_stats else {},
            "level_distribution": [dict(l) for l in level_distribution],
            "top_workers": [dict(w) for w in top_workers]
        }
