"""Admin Routes"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from datetime import datetime, timedelta
from urllib.parse import quote
import os

from ..dependencies import get_db, require_auth, require_admin
from ..config import get_settings, Settings
from ..schemas.event import EventListResponse, EventResponse
from ..schemas.attendance import AttendanceListResponse, AttendanceResponse
from db import Database

router = APIRouter()


@router.get("/check")
async def check_admin(
    user: dict = Depends(require_auth),
    db: Database = Depends(get_db),
    settings: Settings = Depends(get_settings)
):
    """관리자 여부 확인"""
    telegram_id = user.get("telegram_id")
    is_admin = db.is_admin(telegram_id) or telegram_id in settings.admin_ids

    return {
        "telegram_id": telegram_id,
        "is_admin": is_admin
    }


@router.get("/dashboard")
async def admin_dashboard(
    admin: dict = Depends(require_admin),
    db: Database = Depends(get_db)
):
    """관리자 대시보드 데이터"""
    with db.get_connection() as conn:
        cursor = conn.cursor()
        # 통계
        cursor.execute("SELECT COUNT(*) as cnt FROM workers")
        total_workers = cursor.fetchone()["cnt"]

        # 모집중 행사 (OPEN 상태이고 날짜가 지나지 않은 것)
        cursor.execute("""
            SELECT COUNT(*) as cnt FROM events
            WHERE status = 'OPEN' AND event_date >= CURRENT_DATE
        """)
        open_events = cursor.fetchone()["cnt"]

        # OPEN 상태 행사의 대기중 지원만 카운트
        cursor.execute("""
            SELECT COUNT(*) as cnt FROM applications a
            JOIN events e ON a.event_id = e.id
            WHERE a.status = 'PENDING' AND e.status = 'OPEN'
        """)
        pending_apps = cursor.fetchone()["cnt"]

        cursor.execute("SELECT COUNT(*) as cnt FROM attendance WHERE status = 'CHECKED_IN'")
        checked_in = cursor.fetchone()["cnt"]

        # 오늘 행사
        cursor.execute(
            "SELECT * FROM events WHERE event_date = CURRENT_DATE ORDER BY start_time"
        )
        today_events = [dict(row) for row in cursor.fetchall()]

    return {
        "stats": {
            "total_workers": total_workers,
            "open_events": open_events,
            "pending_applications": pending_apps,
            "checked_in_now": checked_in
        },
        "today_events": today_events
    }


@router.get("/events/{event_id}/applications")
async def get_event_applications(
    event_id: int,
    status: str | None = None,
    admin: dict = Depends(require_admin),
    db: Database = Depends(get_db)
):
    """행사별 지원자 목록"""
    event = db.get_event(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="행사를 찾을 수 없습니다")

    apps = db.list_applications_by_event(event_id, status=status)

    # 근무자 정보 추가
    enriched = []
    for app in apps:
        with db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT name, phone, residence, face_photo_file_id FROM workers WHERE id = %s",
                (app.get("worker_id"),)
            )
            worker = cursor.fetchone()
            if worker:
                app["worker_name"] = worker["name"]
                app["worker_phone"] = worker["phone"]
                app["worker_residence"] = worker["residence"]
                app["worker_photo"] = worker["face_photo_file_id"]
        enriched.append(app)

    return {
        "event": event,
        "total": len(enriched),
        "applications": enriched
    }


@router.get("/events/{event_id}/attendance")
async def get_event_attendance(
    event_id: int,
    admin: dict = Depends(require_admin),
    db: Database = Depends(get_db)
):
    """행사별 출석 현황"""
    event = db.get_event(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="행사를 찾을 수 없습니다")

    attendance_list = db.list_attendance_by_event(event_id)

    # 근무자 정보 추가
    enriched = []
    for att in attendance_list:
        with db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT name, phone FROM workers WHERE id = %s",
                (att.get("worker_id"),)
            )
            worker = cursor.fetchone()
            if worker:
                att["worker_name"] = worker["name"]
                att["worker_phone"] = worker["phone"]
        enriched.append(att)

    # 통계
    total = len(enriched)
    checked_in = len([a for a in enriched if a.get("check_in_time")])
    completed = len([a for a in enriched if a.get("check_out_time")])

    return {
        "event": event,
        "stats": {
            "total": total,
            "checked_in": checked_in,
            "completed": completed,
            "pending": total - checked_in
        },
        "attendance": enriched
    }


@router.post("/attendance/{attendance_id}/manual-checkin")
async def manual_checkin(
    attendance_id: int,
    admin: dict = Depends(require_admin),
    db: Database = Depends(get_db)
):
    """수동 출근 처리"""
    with db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM attendance WHERE id = %s", (attendance_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="출석 정보를 찾을 수 없습니다")

    db.check_in(attendance_id)

    return {"message": "출근 처리 완료", "attendance_id": attendance_id}


@router.post("/attendance/{attendance_id}/manual-checkout")
async def manual_checkout(
    attendance_id: int,
    admin: dict = Depends(require_admin),
    db: Database = Depends(get_db)
):
    """수동 퇴근 처리"""
    with db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM attendance WHERE id = %s", (attendance_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="출석 정보를 찾을 수 없습니다")
        attendance = dict(row)

    if not attendance.get("check_in_time"):
        raise HTTPException(status_code=400, detail="먼저 출근 처리가 필요합니다")

    admin_id = admin.get("telegram_id")
    db.check_out(attendance_id, completed_by=admin_id)

    return {"message": "퇴근 처리 완료", "attendance_id": attendance_id}


# ==================== Settings ====================

@router.get("/settings")
async def get_settings_data(
    admin: dict = Depends(require_admin),
    db: Database = Depends(get_db),
    settings: Settings = Depends(get_settings)
):
    """관리자 설정 조회"""
    # .env 파일에서 관리자 ID 목록 가져오기
    admin_ids = settings.admin_ids

    # 전화번호로 변환 (telegram_id가 전화번호인 경우)
    admin_phones = []
    for aid in admin_ids:
        # 전화번호 형식인 경우 (01로 시작하는 10-11자리)
        aid_str = str(aid)
        if aid_str.startswith("1") and len(aid_str) == 10:
            # 010 형식으로 변환
            admin_phones.append("0" + aid_str)
        elif aid_str.startswith("01") and len(aid_str) == 11:
            admin_phones.append(aid_str)

    return {
        "admin_phones": admin_phones,
        "admin_telegram_ids": [str(x) for x in admin_ids]
    }


@router.post("/settings/admin-phones")
async def add_admin_phone(
    data: dict,
    admin: dict = Depends(require_admin),
    settings: Settings = Depends(get_settings)
):
    """관리자 전화번호 추가"""
    import os

    phone = data.get("phone", "").replace("-", "")
    if not phone or len(phone) != 11:
        raise HTTPException(status_code=400, detail="올바른 전화번호를 입력하세요")

    # 010 -> 10 변환 (telegram_id 형식)
    telegram_id = phone[1:] if phone.startswith("0") else phone

    # 현재 admin IDs
    current_ids = list(settings.admin_ids)
    new_id = int(telegram_id)

    if new_id in current_ids:
        raise HTTPException(status_code=400, detail="이미 등록된 번호입니다")

    current_ids.append(new_id)

    # .env 파일 업데이트
    env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))), "config/.env")

    with open(env_path, "r") as f:
        lines = f.readlines()

    new_lines = []
    for line in lines:
        if line.startswith("ADMIN_TELEGRAM_IDS="):
            new_lines.append(f"ADMIN_TELEGRAM_IDS={','.join(str(x) for x in current_ids)}\n")
        else:
            new_lines.append(line)

    with open(env_path, "w") as f:
        f.writelines(new_lines)

    # 설정 캐시 클리어
    get_settings.cache_clear()

    return {"message": "추가되었습니다", "phone": phone}


@router.delete("/settings/admin-phones/{phone}")
async def remove_admin_phone(
    phone: str,
    admin: dict = Depends(require_admin),
    settings: Settings = Depends(get_settings)
):
    """관리자 전화번호 삭제"""
    import os

    phone = phone.replace("-", "")

    # 010 -> 10 변환 (telegram_id 형식)
    telegram_id = phone[1:] if phone.startswith("0") else phone

    current_ids = list(settings.admin_ids)
    target_id = int(telegram_id)

    if target_id not in current_ids:
        raise HTTPException(status_code=404, detail="등록되지 않은 번호입니다")

    if len(current_ids) <= 1:
        raise HTTPException(status_code=400, detail="최소 1명의 관리자가 필요합니다")

    current_ids.remove(target_id)

    # .env 파일 업데이트
    env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))), "config/.env")

    with open(env_path, "r") as f:
        lines = f.readlines()

    new_lines = []
    for line in lines:
        if line.startswith("ADMIN_TELEGRAM_IDS="):
            new_lines.append(f"ADMIN_TELEGRAM_IDS={','.join(str(x) for x in current_ids)}\n")
        else:
            new_lines.append(line)

    with open(env_path, "w") as f:
        f.writelines(new_lines)

    # 설정 캐시 클리어
    get_settings.cache_clear()

    return {"message": "삭제되었습니다", "phone": phone}


# ==================== Excel Export ====================

@router.get("/events/{event_id}/export")
async def export_event_payroll(
    event_id: int,
    admin: dict = Depends(require_admin),
    db: Database = Depends(get_db)
):
    """행사 급여 엑셀 다운로드"""
    event = db.get_event(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="행사를 찾을 수 없습니다")

    # 출석 기록 조회
    attendance_list = db.list_attendance_by_event(event_id)
    if not attendance_list:
        raise HTTPException(status_code=400, detail="출석 기록이 없습니다")

    # 근무자 정보 조회
    workers = {}
    for att in attendance_list:
        worker_id = att.get("worker_id")
        if worker_id:
            with db.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "SELECT * FROM workers WHERE id = %s",
                    (worker_id,)
                )
                worker = cursor.fetchone()
                if worker:
                    workers[worker_id] = dict(worker)

    # 엑셀 생성
    from payroll import PayrollExporter

    export_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))), "exports")
    exporter = PayrollExporter(export_dir)
    filepath = exporter.generate_event_payroll(event, attendance_list, workers)

    # 파일 다운로드
    filename = os.path.basename(filepath)
    encoded_filename = quote(filename)
    headers = {
        "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}",
        "Access-Control-Expose-Headers": "Content-Disposition"
    }
    return FileResponse(
        filepath,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers
    )


@router.get("/events/{event_id}/report")
async def export_event_report(
    event_id: int,
    admin: dict = Depends(require_admin),
    db: Database = Depends(get_db)
):
    """행사 보고서 엑셀 다운로드 (LK PRIVATE 형식)"""
    event = db.get_event(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="행사를 찾을 수 없습니다")

    # 출석 기록 조회
    attendance_list = db.list_attendance_by_event(event_id)

    # 근무자 정보 조회
    workers = {}
    for att in attendance_list:
        worker_id = att.get("worker_id")
        if worker_id:
            with db.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "SELECT * FROM workers WHERE id = %s",
                    (worker_id,)
                )
                worker = cursor.fetchone()
                if worker:
                    workers[worker_id] = dict(worker)

    # 청구 내역 (빈 데이터 - 추후 입력 가능)
    billing_items = []

    # 경비 내역 (빈 데이터 - 추후 입력 가능)
    expense_items = []

    # 보고서 추가 정보
    report_info = {
        "client_name": "",  # 발주 업체명
        "manager": "",      # 담당자
        "notes": "- 특이사항 없이 행사는 잘 마무리 되었습니다."
    }

    # 엑셀 생성
    from payroll import PayrollExporter

    export_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))), "exports")
    exporter = PayrollExporter(export_dir)
    filepath = exporter.generate_event_report(event, attendance_list, workers, billing_items, expense_items, report_info)

    # 파일 다운로드
    filename = os.path.basename(filepath)
    encoded_filename = quote(filename)
    headers = {
        "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}",
        "Access-Control-Expose-Headers": "Content-Disposition"
    }
    return FileResponse(
        filepath,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers
    )


# ==================== Analytics ====================

@router.get("/analytics")
async def get_analytics(
    period: str = "30",  # 기간 (7, 30, 90, all)
    admin: dict = Depends(require_admin),
    db: Database = Depends(get_db)
):
    """분석 데이터 조회"""
    with db.get_connection() as conn:
        cursor = conn.cursor()
        # 기간 필터
        if period == "all":
            date_filter = ""
            date_filter_att = ""
        else:
            days = int(period)
            date_filter = f"AND created_at >= CURRENT_DATE - INTERVAL '{days} days'"
            date_filter_att = f"AND a.check_in_time >= CURRENT_DATE - INTERVAL '{days} days'"

        # === 1. 전체 요약 ===
        cursor.execute("SELECT COUNT(*) as cnt FROM workers")
        total_workers = cursor.fetchone()["cnt"]

        cursor.execute("SELECT COUNT(*) as cnt FROM events")
        total_events = cursor.fetchone()["cnt"]

        cursor.execute("SELECT COUNT(*) as cnt FROM applications")
        total_applications = cursor.fetchone()["cnt"]

        cursor.execute("SELECT COUNT(*) as cnt FROM attendance WHERE check_out_time IS NOT NULL")
        total_completed = cursor.fetchone()["cnt"]

        cursor.execute("SELECT COALESCE(SUM(worked_minutes), 0) as total FROM attendance WHERE check_out_time IS NOT NULL")
        total_worked_hours = round(cursor.fetchone()["total"] / 60, 1)

        # === 2. 근무자 통계 ===
        # 출석률 TOP 10
        cursor.execute("""
            SELECT w.id, w.name, w.phone, w.residence,
                   COUNT(DISTINCT app.id) as total_apps,
                   COUNT(DISTINCT CASE WHEN att.check_out_time IS NOT NULL THEN att.id END) as completed,
                   ROUND(AVG(CASE WHEN att.worked_minutes > 0 THEN att.worked_minutes END), 0) as avg_minutes
            FROM workers w
            LEFT JOIN applications app ON w.id = app.worker_id AND app.status = 'CONFIRMED'
            LEFT JOIN attendance att ON w.id = att.worker_id
            GROUP BY w.id, w.name, w.phone, w.residence
            HAVING COUNT(DISTINCT CASE WHEN att.check_out_time IS NOT NULL THEN att.id END) > 0
            ORDER BY completed DESC
            LIMIT 10
        """)
        top_workers = [dict(r) for r in cursor.fetchall()]

        # 지역별 근무자 수
        cursor.execute("""
            SELECT COALESCE(residence, '미지정') as region, COUNT(*) as count
            FROM workers
            GROUP BY residence
            ORDER BY count DESC
            LIMIT 10
        """)
        workers_by_region = [dict(r) for r in cursor.fetchall()]

        # 자격증 보유 현황
        cursor.execute("""
            SELECT
                SUM(CASE WHEN driver_license = true THEN 1 ELSE 0 END) as driver_license,
                SUM(CASE WHEN security_cert = true THEN 1 ELSE 0 END) as security_cert,
                COUNT(*) as total
            FROM workers
        """)
        cert_stats = dict(cursor.fetchone())

        # === 3. 행사 통계 ===
        # 지역별 행사 수
        cursor.execute("""
            SELECT COALESCE(location, '미지정') as location, COUNT(*) as count,
                   SUM(COALESCE(headcount, 0)) as total_headcount
            FROM events
            GROUP BY location
            ORDER BY count DESC
            LIMIT 10
        """)
        events_by_location = [dict(r) for r in cursor.fetchall()]

        # 평균 급여
        cursor.execute("""
            SELECT
                ROUND(AVG(pay_amount), 0) as avg_pay,
                MIN(pay_amount) as min_pay,
                MAX(pay_amount) as max_pay
            FROM events
            WHERE pay_amount > 0
        """)
        pay_stats = dict(cursor.fetchone())

        # 행사 타입별 통계
        cursor.execute("""
            SELECT COALESCE(work_type, '미지정') as work_type, COUNT(*) as count
            FROM events
            GROUP BY work_type
            ORDER BY count DESC
        """)
        events_by_type = [dict(r) for r in cursor.fetchall()]

        # === 4. 지원 통계 ===
        # 지원 상태별
        cursor.execute("""
            SELECT status, COUNT(*) as count
            FROM applications
            GROUP BY status
        """)
        apps_by_status = {r["status"]: r["count"] for r in cursor.fetchall()}

        # 승인율
        total_apps_count = sum(apps_by_status.values()) if apps_by_status else 0
        confirmed_count = apps_by_status.get("CONFIRMED", 0)
        approval_rate = round(confirmed_count / total_apps_count * 100, 1) if total_apps_count > 0 else 0

        # === 5. 일별 추이 (최근 30일) ===
        cursor.execute("""
            SELECT created_at::date as date, COUNT(*) as count
            FROM workers
            WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
            GROUP BY created_at::date
            ORDER BY date
        """)
        daily_registrations = [dict(r) for r in cursor.fetchall()]

        cursor.execute("""
            SELECT applied_at::date as date, COUNT(*) as count
            FROM applications
            WHERE applied_at >= CURRENT_DATE - INTERVAL '30 days'
            GROUP BY applied_at::date
            ORDER BY date
        """)
        daily_applications = [dict(r) for r in cursor.fetchall()]

        cursor.execute("""
            SELECT check_in_time::date as date, COUNT(*) as count
            FROM attendance
            WHERE check_in_time >= CURRENT_DATE - INTERVAL '30 days'
            GROUP BY check_in_time::date
            ORDER BY date
        """)
        daily_attendance = [dict(r) for r in cursor.fetchall()]

        # === 6. 시간대별 출근 현황 ===
        cursor.execute("""
            SELECT to_char(check_in_time, 'HH24') as hour, COUNT(*) as count
            FROM attendance
            WHERE check_in_time IS NOT NULL
            GROUP BY to_char(check_in_time, 'HH24')
            ORDER BY hour
        """)
        checkin_by_hour = [dict(r) for r in cursor.fetchall()]

        # === 7. 월별 통계 ===
        cursor.execute("""
            SELECT to_char(event_date, 'YYYY-MM') as month, COUNT(*) as events,
                   SUM(COALESCE(headcount, 0)) as total_workers
            FROM events
            GROUP BY to_char(event_date, 'YYYY-MM')
            ORDER BY month DESC
            LIMIT 12
        """)
        monthly_events = [dict(r) for r in cursor.fetchall()]

        # === 8. 평균 근무 시간 ===
        cursor.execute("""
            SELECT ROUND(AVG(worked_minutes), 0) as avg_minutes,
                   MIN(worked_minutes) as min_minutes,
                   MAX(worked_minutes) as max_minutes
            FROM attendance
            WHERE worked_minutes > 0
        """)
        work_time_stats = dict(cursor.fetchone())

    return {
        "generated_at": datetime.now().isoformat(),
        "period": period,
        "summary": {
            "total_workers": total_workers,
            "total_events": total_events,
            "total_applications": total_applications,
            "total_completed_work": total_completed,
            "total_worked_hours": total_worked_hours,
            "approval_rate": approval_rate
        },
        "workers": {
            "top_performers": top_workers,
            "by_region": workers_by_region,
            "certifications": cert_stats
        },
        "events": {
            "by_location": events_by_location,
            "by_type": events_by_type,
            "pay_stats": pay_stats,
            "monthly": monthly_events
        },
        "applications": {
            "by_status": apps_by_status
        },
        "trends": {
            "daily_registrations": daily_registrations,
            "daily_applications": daily_applications,
            "daily_attendance": daily_attendance,
            "checkin_by_hour": checkin_by_hour
        },
        "work_time": work_time_stats
    }


@router.get("/analytics/workers")
async def get_worker_analytics(
    admin: dict = Depends(require_admin),
    db: Database = Depends(get_db)
):
    """근무자 WorkScore 및 상세 분석"""
    with db.get_connection() as conn:
        cursor = conn.cursor()
        # 근무자별 상세 통계
        cursor.execute("""
            SELECT
                w.id,
                w.name,
                w.phone,
                w.residence,
                w.driver_license,
                w.security_cert,
                w.created_at as registered_at,
                COUNT(DISTINCT app.id) as total_applications,
                COUNT(DISTINCT CASE WHEN app.status = 'CONFIRMED' THEN app.id END) as confirmed_apps,
                COUNT(DISTINCT CASE WHEN app.status = 'CANCELLED' THEN app.id END) as cancelled_apps,
                COUNT(DISTINCT att.id) as total_attendance,
                COUNT(DISTINCT CASE WHEN att.check_in_time IS NOT NULL THEN att.id END) as checked_in,
                COUNT(DISTINCT CASE WHEN att.check_out_time IS NOT NULL THEN att.id END) as completed,
                COUNT(DISTINCT CASE WHEN att.late_minutes > 0 THEN att.id END) as late_count,
                COALESCE(SUM(att.worked_minutes), 0) as total_worked_minutes,
                ROUND(AVG(CASE WHEN att.worked_minutes > 0 THEN att.worked_minutes END), 0) as avg_work_minutes,
                ROUND(AVG(COALESCE(att.late_minutes, 0)), 1) as avg_late_minutes
            FROM workers w
            LEFT JOIN applications app ON w.id = app.worker_id
            LEFT JOIN attendance att ON w.id = att.worker_id
            GROUP BY w.id, w.name, w.phone, w.residence, w.driver_license, w.security_cert, w.created_at
            ORDER BY completed DESC, checked_in DESC
        """)
        workers_data = [dict(r) for r in cursor.fetchall()]

        # WorkScore 계산
        for w in workers_data:
            total_att = w['total_attendance'] or 0
            checked_in = w['checked_in'] or 0
            completed = w['completed'] or 0
            late_count = w['late_count'] or 0

            # 1. 출근율 (50%)
            attendance_rate = round(checked_in / total_att * 100, 1) if total_att > 0 else 100
            attendance_score = attendance_rate * 0.5

            # 2. 지각률 (20%)
            on_time_rate = round((checked_in - late_count) / checked_in * 100, 1) if checked_in > 0 else 100
            punctuality_score = on_time_rate * 0.2

            # 3. 완료율 (30%)
            completion_rate = round(completed / checked_in * 100, 1) if checked_in > 0 else 100
            completion_score = completion_rate * 0.3

            # 종합 WorkScore
            work_score = round(attendance_score + punctuality_score + completion_score, 1)

            w['attendance_rate'] = attendance_rate
            w['on_time_rate'] = on_time_rate
            w['completion_rate'] = completion_rate
            w['work_score'] = work_score
            w['total_worked_hours'] = round((w['total_worked_minutes'] or 0) / 60, 1)

            # 등급 부여
            if work_score >= 90 and completed >= 5:
                w['grade'] = 'S'
                w['grade_label'] = '최우수'
            elif work_score >= 80 and completed >= 3:
                w['grade'] = 'A'
                w['grade_label'] = '우수'
            elif work_score >= 70 and completed >= 1:
                w['grade'] = 'B'
                w['grade_label'] = '양호'
            elif work_score >= 50:
                w['grade'] = 'C'
                w['grade_label'] = '보통'
            elif total_att > 0:
                w['grade'] = 'D'
                w['grade_label'] = '주의'
            else:
                w['grade'] = 'N'
                w['grade_label'] = '신규'

        # 등급별 분류
        grade_counts = {'S': 0, 'A': 0, 'B': 0, 'C': 0, 'D': 0, 'N': 0}
        for w in workers_data:
            grade_counts[w['grade']] = grade_counts.get(w['grade'], 0) + 1

        # 전체 평균
        scored_workers = [w for w in workers_data if w['total_attendance'] > 0]
        avg_work_score = round(sum(w['work_score'] for w in scored_workers) / len(scored_workers), 1) if scored_workers else 0
        avg_attendance = round(sum(w['attendance_rate'] for w in scored_workers) / len(scored_workers), 1) if scored_workers else 0

    return {
        "generated_at": datetime.now().isoformat(),
        "total_workers": len(workers_data),
        "averages": {
            "work_score": avg_work_score,
            "attendance_rate": avg_attendance
        },
        "grade_summary": grade_counts,
        "workers": sorted(workers_data, key=lambda x: (x['work_score'], x['completed']), reverse=True)
    }


@router.get("/analytics/revenue")
async def get_revenue_analytics(
    period: str = "30",
    admin: dict = Depends(require_admin),
    db: Database = Depends(get_db)
):
    """매출/수익 통계"""
    with db.get_connection() as conn:
        cursor = conn.cursor()
        # 기간 필터
        if period == "all":
            date_filter = ""
        else:
            days = int(period)
            date_filter = f"WHERE e.event_date >= CURRENT_DATE - INTERVAL '{days} days'"

        # 일별 매출
        cursor.execute(f"""
            SELECT
                e.event_date as date,
                COUNT(DISTINCT e.id) as events,
                COUNT(DISTINCT att.id) as workers,
                SUM(e.pay_amount) as total_pay
            FROM events e
            LEFT JOIN attendance att ON e.id = att.event_id AND att.check_out_time IS NOT NULL
            {date_filter}
            GROUP BY e.event_date
            ORDER BY e.event_date DESC
            LIMIT 90
        """)
        daily_revenue = [dict(r) for r in cursor.fetchall()]

        # 월별 매출
        cursor.execute(f"""
            SELECT
                to_char(e.event_date, 'YYYY-MM') as month,
                COUNT(DISTINCT e.id) as events,
                COUNT(DISTINCT att.id) as total_workers,
                SUM(CASE WHEN att.check_out_time IS NOT NULL THEN e.pay_amount ELSE 0 END) as completed_pay,
                SUM(e.pay_amount * COALESCE(e.headcount, 1)) as estimated_revenue
            FROM events e
            LEFT JOIN attendance att ON e.id = att.event_id
            GROUP BY to_char(e.event_date, 'YYYY-MM')
            ORDER BY month DESC
            LIMIT 12
        """)
        monthly_revenue = [dict(r) for r in cursor.fetchall()]

        # 전체 요약
        cursor.execute("""
            SELECT
                COUNT(DISTINCT e.id) as total_events,
                SUM(COALESCE(e.headcount, 0)) as total_positions,
                SUM(e.pay_amount * COALESCE(e.headcount, 1)) as total_estimated_revenue,
                COUNT(DISTINCT att.id) as completed_workers,
                SUM(CASE WHEN att.check_out_time IS NOT NULL THEN e.pay_amount ELSE 0 END) as completed_revenue
            FROM events e
            LEFT JOIN attendance att ON e.id = att.event_id
        """)
        summary = dict(cursor.fetchone())

        # 오늘/이번주/이번달 매출
        cursor.execute("""
            SELECT
                SUM(CASE WHEN e.event_date = CURRENT_DATE THEN e.pay_amount * COALESCE(e.headcount, 1) ELSE 0 END) as today,
                SUM(CASE WHEN e.event_date >= CURRENT_DATE - INTERVAL '7 days' THEN e.pay_amount * COALESCE(e.headcount, 1) ELSE 0 END) as this_week,
                SUM(CASE WHEN e.event_date >= date_trunc('month', CURRENT_DATE) THEN e.pay_amount * COALESCE(e.headcount, 1) ELSE 0 END) as this_month
            FROM events e
        """)
        period_summary = dict(cursor.fetchone())

    return {
        "generated_at": datetime.now().isoformat(),
        "period": period,
        "summary": {
            "total_events": summary['total_events'] or 0,
            "total_positions": summary['total_positions'] or 0,
            "total_estimated_revenue": summary['total_estimated_revenue'] or 0,
            "completed_workers": summary['completed_workers'] or 0,
            "completed_revenue": summary['completed_revenue'] or 0,
            "today_revenue": period_summary['today'] or 0,
            "this_week_revenue": period_summary['this_week'] or 0,
            "this_month_revenue": period_summary['this_month'] or 0
        },
        "daily": daily_revenue,
        "monthly": monthly_revenue
    }


@router.get("/analytics/events")
async def get_event_analytics(
    admin: dict = Depends(require_admin),
    db: Database = Depends(get_db)
):
    """행사 통계 분석"""
    with db.get_connection() as conn:
        cursor = conn.cursor()
        # 행사별 상세 통계
        cursor.execute("""
            SELECT
                e.id,
                e.short_code,
                e.title,
                e.event_date,
                e.location,
                e.pay_amount,
                e.headcount,
                e.work_type,
                e.status,
                COUNT(DISTINCT app.id) as total_applications,
                COUNT(DISTINCT CASE WHEN app.status = 'CONFIRMED' THEN app.id END) as confirmed,
                COUNT(DISTINCT CASE WHEN app.status = 'REJECTED' THEN app.id END) as rejected,
                COUNT(DISTINCT att.id) as attendance_created,
                COUNT(DISTINCT CASE WHEN att.check_in_time IS NOT NULL THEN att.id END) as checked_in,
                COUNT(DISTINCT CASE WHEN att.check_out_time IS NOT NULL THEN att.id END) as completed
            FROM events e
            LEFT JOIN applications app ON e.id = app.event_id
            LEFT JOIN attendance att ON e.id = att.event_id
            GROUP BY e.id, e.short_code, e.title, e.event_date, e.location, e.pay_amount, e.headcount, e.work_type, e.status
            ORDER BY e.event_date DESC
            LIMIT 100
        """)
        events_data = [dict(r) for r in cursor.fetchall()]

        # 행사별 충족률 계산
        for ev in events_data:
            headcount = ev['headcount'] or 0
            confirmed = ev['confirmed'] or 0
            checked_in = ev['checked_in'] or 0
            completed = ev['completed'] or 0

            fulfillment_rate = round(confirmed / headcount * 100, 1) if headcount > 0 else 0
            attendance_rate = round(checked_in / confirmed * 100, 1) if confirmed > 0 else 0
            completion_rate = round(completed / checked_in * 100, 1) if checked_in > 0 else 0

            ev['fulfillment_rate'] = fulfillment_rate
            ev['attendance_rate'] = attendance_rate
            ev['completion_rate'] = completion_rate

        # 전체 평균
        total_events = len(events_data)
        if total_events > 0:
            avg_fulfillment = round(sum(e['fulfillment_rate'] for e in events_data) / total_events, 1)
            avg_attendance = round(sum(e['attendance_rate'] for e in events_data if e['confirmed'] > 0) / max(1, len([e for e in events_data if e['confirmed'] > 0])), 1)
            avg_completion = round(sum(e['completion_rate'] for e in events_data if e['checked_in'] > 0) / max(1, len([e for e in events_data if e['checked_in'] > 0])), 1)
        else:
            avg_fulfillment = avg_attendance = avg_completion = 0

        # 요일별 행사 분포
        cursor.execute("""
            SELECT
                CASE EXTRACT(DOW FROM event_date)
                    WHEN 0 THEN '일'
                    WHEN 1 THEN '월'
                    WHEN 2 THEN '화'
                    WHEN 3 THEN '수'
                    WHEN 4 THEN '목'
                    WHEN 5 THEN '금'
                    WHEN 6 THEN '토'
                END as day_name,
                EXTRACT(DOW FROM event_date) as day_num,
                COUNT(*) as count
            FROM events
            GROUP BY EXTRACT(DOW FROM event_date)
            ORDER BY day_num
        """)
        events_by_day = [dict(r) for r in cursor.fetchall()]

        # 시간대별 행사 분포
        cursor.execute("""
            SELECT
                COALESCE(substring(start_time::text, 1, 2), '00') as hour,
                COUNT(*) as count
            FROM events
            WHERE start_time IS NOT NULL
            GROUP BY substring(start_time::text, 1, 2)
            ORDER BY hour
        """)
        events_by_hour = [dict(r) for r in cursor.fetchall()]

    return {
        "generated_at": datetime.now().isoformat(),
        "total_events": total_events,
        "averages": {
            "fulfillment_rate": avg_fulfillment,
            "attendance_rate": avg_attendance,
            "completion_rate": avg_completion
        },
        "distribution": {
            "by_day": events_by_day,
            "by_hour": events_by_hour
        },
        "events": events_data
    }


# ==================== AI Matching v1 ====================

@router.get("/events/{event_id}/recommend")
async def get_recommended_workers(
    event_id: int,
    limit: int = 20,
    admin: dict = Depends(require_admin),
    db: Database = Depends(get_db)
):
    """AI 매칭 v1: 행사에 적합한 근무자 추천"""
    event = db.get_event(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="행사를 찾을 수 없습니다")

    event_location = event.get('location', '')
    event_work_type = event.get('work_type', '')

    with db.get_connection() as conn:
        cursor = conn.cursor()
        # 이미 지원한 근무자 ID 목록
        cursor.execute("""
            SELECT worker_id FROM applications WHERE event_id = %s
        """, (event_id,))
        applied_worker_ids = set(r['worker_id'] for r in cursor.fetchall())

        # 모든 근무자 + 통계 조회
        cursor.execute("""
            SELECT
                w.id,
                w.name,
                w.phone,
                w.residence,
                w.driver_license,
                w.security_cert,
                COUNT(DISTINCT att.id) as total_attendance,
                COUNT(DISTINCT CASE WHEN att.check_in_time IS NOT NULL THEN att.id END) as checked_in,
                COUNT(DISTINCT CASE WHEN att.check_out_time IS NOT NULL THEN att.id END) as completed,
                COUNT(DISTINCT CASE WHEN att.late_minutes > 0 THEN att.id END) as late_count
            FROM workers w
            LEFT JOIN attendance att ON w.id = att.worker_id
            GROUP BY w.id, w.name, w.phone, w.residence, w.driver_license, w.security_cert
        """)
        workers_data = [dict(r) for r in cursor.fetchall()]

        recommendations = []

        for w in workers_data:
            already_applied = w['id'] in applied_worker_ids

            total_att = w['total_attendance'] or 0
            checked_in = w['checked_in'] or 0
            completed = w['completed'] or 0
            late_count = w['late_count'] or 0

            # WorkScore 계산 (40%)
            if total_att > 0:
                attendance_rate = checked_in / total_att * 100
                on_time_rate = (checked_in - late_count) / checked_in * 100 if checked_in > 0 else 100
                work_score = (attendance_rate * 0.6 + on_time_rate * 0.4)
            else:
                work_score = 50

            work_score_weighted = work_score * 0.4

            # 거리 점수 (30%)
            distance_score = 50
            residence = w.get('residence', '') or ''

            if event_location:
                if residence and (residence in event_location or event_location in residence):
                    distance_score = 100
                elif '서울' in residence and '서울' in event_location:
                    distance_score = 70
                elif '경기' in residence and '경기' in event_location:
                    distance_score = 70

            distance_score_weighted = distance_score * 0.3

            # 경력 점수 (20%)
            career_score = min(100, completed * 10)
            career_score_weighted = career_score * 0.2

            # 가용성 점수 (10%)
            availability_score = 0 if already_applied else 100
            availability_score_weighted = availability_score * 0.1

            total_score = round(
                work_score_weighted + distance_score_weighted + career_score_weighted + availability_score_weighted,
                1
            )

            if total_score >= 80 and completed >= 3:
                grade = 'S'
            elif total_score >= 70 and completed >= 1:
                grade = 'A'
            elif total_score >= 60:
                grade = 'B'
            elif total_score >= 50:
                grade = 'C'
            else:
                grade = 'D'

            recommendations.append({
                'worker_id': w['id'],
                'name': w['name'],
                'phone': w['phone'],
                'residence': residence,
                'driver_license': w['driver_license'],
                'security_cert': w['security_cert'],
                'completed_works': completed,
                'work_score': round(work_score, 1),
                'distance_score': round(distance_score, 1),
                'career_score': round(career_score, 1),
                'availability_score': availability_score,
                'total_score': total_score,
                'grade': grade,
                'already_applied': already_applied
            })

        # 점수 순으로 정렬
        recommendations.sort(key=lambda x: (not x['already_applied'], x['total_score']), reverse=True)
        top_recommendations = recommendations[:limit]

    return {
        "generated_at": datetime.now().isoformat(),
        "event": {
            "id": event.get('id'),
            "title": event.get('title'),
            "location": event_location,
            "work_type": event_work_type,
            "event_date": event.get('event_date'),
            "headcount": event.get('headcount')
        },
        "total_workers": len(workers_data),
        "already_applied": len(applied_worker_ids),
        "recommendations": top_recommendations
    }
