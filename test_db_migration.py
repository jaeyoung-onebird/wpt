#!/usr/bin/env python3
"""
PostgreSQL 마이그레이션 테스트 스크립트
"""
import sys
import os

# 프로젝트 경로 추가
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.db import Database
from datetime import datetime

DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/workproof"

def test_connection():
    """연결 테스트"""
    print("\n=== 1. 연결 테스트 ===")
    try:
        db = Database(DATABASE_URL)
        print("✅ 데이터베이스 연결 성공")
        print("✅ 테이블 초기화 완료")
        return db
    except Exception as e:
        print(f"❌ 연결 실패: {e}")
        return None

def test_worker_crud(db):
    """근로자 CRUD 테스트"""
    print("\n=== 2. 근로자 CRUD 테스트 ===")

    # Create
    print("\n[CREATE] 근로자 생성...")
    test_telegram_id = 999999999

    # 기존 테스트 데이터 삭제
    try:
        with db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM workers WHERE telegram_id = %s", (test_telegram_id,))
    except:
        pass

    worker_id = db.create_worker(
        telegram_id=test_telegram_id,
        name="테스트 근로자",
        phone="010-1234-5678",
        birth_date="1990-01-01",
        residence="서울시 강남구"
    )
    print(f"✅ 근로자 생성 완료 (ID: {worker_id})")

    # Read
    print("\n[READ] 근로자 조회...")
    worker = db.get_worker_by_telegram_id(test_telegram_id)
    if worker:
        print(f"✅ 근로자 조회 성공")
        print(f"   - ID: {worker['id']}")
        print(f"   - 이름: {worker['name']}")
        print(f"   - 연락처: {worker['phone']}")
        print(f"   - 토큰: {worker['tokens']}")
    else:
        print("❌ 근로자 조회 실패")
        return False

    # Update
    print("\n[UPDATE] 근로자 정보 수정...")
    db.update_worker(worker_id, name="수정된 이름", phone="010-9999-8888")
    updated_worker = db.get_worker_by_telegram_id(test_telegram_id)
    if updated_worker['name'] == "수정된 이름":
        print(f"✅ 근로자 수정 성공 (이름: {updated_worker['name']})")
    else:
        print("❌ 근로자 수정 실패")
        return False

    # Token operations
    print("\n[TOKEN] 토큰 작업 테스트...")
    initial_tokens = db.get_worker_tokens(worker_id)
    print(f"   - 초기 토큰: {initial_tokens}")

    db.add_tokens(worker_id, 5)
    after_add = db.get_worker_tokens(worker_id)
    print(f"   - 5 토큰 추가 후: {after_add}")

    success = db.use_token(worker_id, 2)
    after_use = db.get_worker_tokens(worker_id)
    print(f"   - 2 토큰 사용 후: {after_use} (성공: {success})")

    if after_add == initial_tokens + 5 and after_use == after_add - 2:
        print("✅ 토큰 작업 성공")
    else:
        print("❌ 토큰 작업 실패")
        return False

    return worker_id

def test_event_crud(db, created_by):
    """이벤트 CRUD 테스트"""
    print("\n=== 3. 이벤트 CRUD 테스트 ===")

    # Create
    print("\n[CREATE] 이벤트 생성...")
    short_code = db.generate_short_code()
    event_id = db.create_event(
        short_code=short_code,
        title="테스트 행사",
        event_date="2026-02-01",
        location="서울시 강남구 테헤란로 123",
        pay_amount=150000,
        created_by=created_by,
        start_time="09:00",
        end_time="18:00",
        headcount=10,
        work_type="일반"
    )
    print(f"✅ 이벤트 생성 완료 (ID: {event_id}, 코드: {short_code})")

    # Read
    print("\n[READ] 이벤트 조회...")
    event = db.get_event(event_id)
    if event:
        print(f"✅ 이벤트 조회 성공")
        print(f"   - 제목: {event['title']}")
        print(f"   - 일자: {event['event_date']}")
        print(f"   - 장소: {event['location']}")
        print(f"   - 급여: {event['pay_amount']:,}원")
    else:
        print("❌ 이벤트 조회 실패")
        return None

    # By short code
    event_by_code = db.get_event_by_short_code(short_code)
    if event_by_code:
        print(f"✅ Short code로 조회 성공")
    else:
        print("❌ Short code로 조회 실패")
        return None

    # List
    events = db.list_events(limit=5)
    print(f"✅ 이벤트 목록 조회 ({len(events)}개)")

    return event_id

def test_application_crud(db, worker_id, event_id):
    """지원 CRUD 테스트"""
    print("\n=== 4. 지원 CRUD 테스트 ===")

    # Create
    print("\n[CREATE] 지원 생성...")
    app_id = db.create_application(event_id, worker_id)
    if app_id:
        print(f"✅ 지원 생성 완료 (ID: {app_id})")
    else:
        print("❌ 지원 생성 실패")
        return None

    # Duplicate test
    dup_app_id = db.create_application(event_id, worker_id)
    if dup_app_id is None:
        print("✅ 중복 지원 방지 동작 확인")
    else:
        print("❌ 중복 지원이 허용됨")

    # Read
    print("\n[READ] 지원 조회...")
    app = db.get_application(app_id)
    if app:
        print(f"✅ 지원 조회 성공")
        print(f"   - 상태: {app['status']}")
        print(f"   - 근로자: {app['worker_name']}")
        print(f"   - 행사: {app['event_title']}")

    # Update status
    print("\n[UPDATE] 지원 상태 변경...")
    db.update_application_status(app_id, 'CONFIRMED', confirmed_by=worker_id)
    updated_app = db.get_application(app_id)
    if updated_app['status'] == 'CONFIRMED':
        print(f"✅ 상태 변경 성공 ({updated_app['status']})")
    else:
        print("❌ 상태 변경 실패")

    return app_id

def test_attendance_crud(db, app_id, event_id, worker_id):
    """출석 CRUD 테스트"""
    print("\n=== 5. 출석 CRUD 테스트 ===")

    # Create
    print("\n[CREATE] 출석 레코드 생성...")
    check_in_code = "TEST01"

    # 기존 테스트 데이터 삭제
    try:
        with db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM attendance WHERE application_id = %s", (app_id,))
    except:
        pass

    att_id = db.create_attendance(
        application_id=app_id,
        event_id=event_id,
        worker_id=worker_id,
        check_in_code=check_in_code,
        scheduled_start="09:00",
        scheduled_end="18:00"
    )
    print(f"✅ 출석 레코드 생성 완료 (ID: {att_id})")

    # Check in
    print("\n[CHECK-IN] 출근 처리...")
    db.check_in(att_id)
    att = db.get_attendance_by_code(check_in_code)
    if att and att['status'] == 'CHECKED_IN':
        print(f"✅ 출근 처리 성공")
        print(f"   - 상태: {att['status']}")
        print(f"   - 출근시간: {att['check_in_time']}")
    else:
        print("❌ 출근 처리 실패")

    # Check out
    print("\n[CHECK-OUT] 퇴근 처리...")
    db.check_out(att_id, completed_by=worker_id)
    att = db.get_attendance_by_application(app_id)
    if att and att['status'] == 'COMPLETED':
        print(f"✅ 퇴근 처리 성공")
        print(f"   - 상태: {att['status']}")
        print(f"   - 근무시간: {att['worked_minutes']}분")
        print(f"   - 시간준수율: {att['time_compliance']}%")
    else:
        print("❌ 퇴근 처리 실패")

    return att_id

def test_chain_log(db, att_id, event_id):
    """블록체인 로그 테스트"""
    print("\n=== 6. 블록체인 로그 테스트 ===")

    # 기존 테스트 데이터 삭제
    try:
        with db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM chain_logs WHERE attendance_id = %s", (att_id,))
    except:
        pass

    # Create
    print("\n[CREATE] 체인 로그 생성...")
    log_id = db.create_chain_log(
        attendance_id=att_id,
        event_id=event_id,
        worker_uid_hash="0xabc123def456",
        log_hash="0x789xyz000111"
    )
    print(f"✅ 체인 로그 생성 완료 (ID: {log_id})")

    # Update TX
    print("\n[UPDATE] TX 정보 업데이트...")
    db.update_chain_log_tx(log_id, "0xtx_hash_test_12345", 1234567)

    # Count
    count = db.count_chain_logs()
    print(f"✅ 체인 로그 총 {count}개")

    # List
    logs = db.get_all_chain_logs(limit=5)
    if logs:
        print(f"✅ 체인 로그 조회 성공 ({len(logs)}개)")

    return True

def test_notifications(db, worker_id):
    """알림 테스트"""
    print("\n=== 7. 알림 테스트 ===")

    # Create
    print("\n[CREATE] 알림 생성...")
    noti_id = db.create_notification(
        worker_id=worker_id,
        notification_type="TEST",
        title="테스트 알림",
        message="PostgreSQL 마이그레이션 테스트입니다."
    )
    print(f"✅ 알림 생성 완료 (ID: {noti_id})")

    # Unread count
    unread = db.get_unread_notification_count(worker_id)
    print(f"✅ 읽지 않은 알림: {unread}개")

    # Mark read
    db.mark_notification_read(noti_id)
    unread_after = db.get_unread_notification_count(worker_id)
    print(f"✅ 읽음 처리 후: {unread_after}개")

    return True

def test_credit_history(db, worker_id):
    """크레딧 이력 테스트"""
    print("\n=== 8. 크레딧 이력 테스트 ===")

    # Create
    print("\n[CREATE] 크레딧 이력 생성...")
    credit_id = db.create_credit_history(
        worker_id=worker_id,
        amount=10,
        balance_after=10,
        tx_type="SIGNUP_BONUS",
        reason="테스트 보너스"
    )
    print(f"✅ 크레딧 이력 생성 완료 (ID: {credit_id})")

    # History
    history = db.get_credit_history(worker_id)
    print(f"✅ 크레딧 이력 조회 ({len(history)}개)")

    return True

def test_daily_checkin(db, worker_id):
    """일일 출석체크 테스트"""
    print("\n=== 9. 일일 출석체크 테스트 ===")

    # Check if already checked in
    today_checkin = db.check_today_checkin(worker_id)
    if today_checkin:
        print(f"✅ 오늘 이미 출석체크 완료 (streak: {today_checkin['streak_days']}일)")
    else:
        # Create checkin
        checkin = db.create_daily_checkin(worker_id)
        print(f"✅ 출석체크 완료 (streak: {checkin['streak_days']}일)")

    # Streak
    streak = db.get_streak_days(worker_id)
    print(f"✅ 현재 연속 출석: {streak}일")

    return True

def test_bigdata_features(db):
    """빅데이터 기능 테스트"""
    print("\n=== 10. 빅데이터 기능 테스트 ===")

    # Regions
    print("\n[REGIONS] 지역 마스터...")
    try:
        region_id = db.create_region("서울특별시", "강남구", "역삼동", 37.5, 127.0)
        print(f"✅ 지역 생성 완료 (ID: {region_id})")
    except:
        print("✅ 지역 이미 존재")

    regions = db.get_regions()
    print(f"✅ 지역 목록 조회 ({len(regions)}개)")

    # Job categories
    print("\n[CATEGORIES] 업종 마스터...")
    try:
        cat_id = db.create_job_category("행사 스탭", avg_pay=12000)
        print(f"✅ 업종 생성 완료 (ID: {cat_id})")
    except:
        print("✅ 업종 이미 존재")

    categories = db.get_job_categories()
    print(f"✅ 업종 목록 조회 ({len(categories)}개)")

    # Analytics
    print("\n[ANALYTICS] 분석 데이터...")
    summary = db.get_analytics_summary()
    print(f"✅ 분석 요약 조회")
    print(f"   - 총 이벤트: {summary.get('total_events', 0)}개")
    print(f"   - 활성 근로자: {summary.get('active_workers', 0)}명")

    return True

def cleanup(db, worker_id, event_id, app_id, att_id):
    """테스트 데이터 정리"""
    print("\n=== 테스트 데이터 정리 ===")

    try:
        with db.get_connection() as conn:
            cursor = conn.cursor()
            # 순서대로 삭제 (FK 제약조건 때문)
            cursor.execute("DELETE FROM chain_logs WHERE attendance_id = %s", (att_id,))
            cursor.execute("DELETE FROM credit_history WHERE worker_id = %s", (worker_id,))
            cursor.execute("DELETE FROM daily_checkins WHERE worker_id = %s", (worker_id,))
            cursor.execute("DELETE FROM notifications WHERE worker_id = %s", (worker_id,))
            cursor.execute("DELETE FROM attendance WHERE id = %s", (att_id,))
            cursor.execute("DELETE FROM applications WHERE id = %s", (app_id,))
            cursor.execute("DELETE FROM events WHERE id = %s", (event_id,))
            cursor.execute("DELETE FROM workers WHERE id = %s", (worker_id,))
        print("✅ 테스트 데이터 정리 완료")
    except Exception as e:
        print(f"⚠️ 정리 중 오류 (무시됨): {e}")

def main():
    print("=" * 60)
    print("  PostgreSQL 마이그레이션 테스트")
    print("=" * 60)
    print(f"\n연결 URL: {DATABASE_URL}")

    # 1. 연결 테스트
    db = test_connection()
    if not db:
        print("\n❌ 테스트 실패: 데이터베이스 연결 불가")
        return 1

    worker_id = None
    event_id = None
    app_id = None
    att_id = None

    try:
        # 2. Worker CRUD
        worker_id = test_worker_crud(db)
        if not worker_id:
            raise Exception("Worker CRUD 실패")

        # 3. Event CRUD
        event_id = test_event_crud(db, worker_id)
        if not event_id:
            raise Exception("Event CRUD 실패")

        # 4. Application CRUD
        app_id = test_application_crud(db, worker_id, event_id)
        if not app_id:
            raise Exception("Application CRUD 실패")

        # 5. Attendance CRUD
        att_id = test_attendance_crud(db, app_id, event_id, worker_id)
        if not att_id:
            raise Exception("Attendance CRUD 실패")

        # 6. Chain Log
        test_chain_log(db, att_id, event_id)

        # 7. Notifications
        test_notifications(db, worker_id)

        # 8. Credit History
        test_credit_history(db, worker_id)

        # 9. Daily Checkin
        test_daily_checkin(db, worker_id)

        # 10. BigData Features
        test_bigdata_features(db)

        print("\n" + "=" * 60)
        print("  모든 테스트 통과! ✅")
        print("=" * 60)

    except Exception as e:
        print(f"\n❌ 테스트 실패: {e}")
        import traceback
        traceback.print_exc()
        return 1

    finally:
        # 정리
        if worker_id and event_id and app_id and att_id:
            cleanup(db, worker_id, event_id, app_id, att_id)

    return 0

if __name__ == "__main__":
    sys.exit(main())
