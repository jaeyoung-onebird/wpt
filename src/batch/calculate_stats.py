#!/usr/bin/env python3
"""
월별 통계 계산 배치 스크립트

사용법:
    python calculate_stats.py [--year YYYY] [--month MM]

예시:
    python calculate_stats.py                    # 현재 월 계산
    python calculate_stats.py --year 2024 --month 1  # 2024년 1월 계산
"""

import sys
import os
import argparse
from datetime import datetime

# 경로 설정
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db import Database

# DB 경로 설정
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "data", "workproof.db")


def calculate_all_worker_stats(db: Database, year: int, month: int):
    """모든 근무자의 월별 통계 계산"""
    print(f"\n{'='*50}")
    print(f"근무자 월별 통계 계산: {year}년 {month}월")
    print(f"{'='*50}")

    workers = db.list_workers(limit=10000)
    print(f"총 근무자 수: {len(workers)}명")

    success = 0
    failed = 0

    for worker in workers:
        try:
            stats = db.calculate_worker_monthly_stats(worker['id'], year, month)
            if stats['worked_events'] > 0:
                print(f"  [OK] {worker['name']}: {stats['worked_events']}건, {stats['worked_hours']}시간, {stats['total_earnings']:,}원")
                success += 1
        except Exception as e:
            print(f"  [ERROR] {worker['name']}: {e}")
            failed += 1

    print(f"\n완료: {success}명 성공, {failed}명 실패")
    return success, failed


def update_all_cumulative_stats(db: Database):
    """모든 근무자의 누적 통계 업데이트"""
    print(f"\n{'='*50}")
    print("근무자 누적 통계 업데이트")
    print(f"{'='*50}")

    workers = db.list_workers(limit=10000)
    print(f"총 근무자 수: {len(workers)}명")

    success = 0
    failed = 0

    for worker in workers:
        try:
            db.update_worker_cumulative_stats(worker['id'])
            success += 1
        except Exception as e:
            print(f"  [ERROR] {worker['name']}: {e}")
            failed += 1

    print(f"\n완료: {success}명 성공, {failed}명 실패")
    return success, failed


def calculate_event_stats(db: Database, year: int, month: int):
    """행사 월별 통계 계산"""
    print(f"\n{'='*50}")
    print(f"행사 월별 통계 계산: {year}년 {month}월")
    print(f"{'='*50}")

    with db.get_connection() as conn:
        cursor = conn.cursor()

        # 해당 월 행사 통계
        cursor.execute("""
            SELECT
                e.category_id,
                COUNT(DISTINCT e.id) as total_events,
                COUNT(DISTINCT a.worker_id) as total_workers,
                SUM(CASE WHEN a.status = 'COMPLETED' THEN e.pay_amount ELSE 0 END) as total_revenue,
                AVG(e.pay_amount) as avg_pay,
                COUNT(CASE WHEN a.status IN ('CONFIRMED', 'CHECKED_IN', 'COMPLETED') THEN 1 END) * 100.0 /
                    NULLIF(SUM(e.headcount), 0) as fill_rate,
                COUNT(CASE WHEN a.status = 'COMPLETED' THEN 1 END) * 100.0 /
                    NULLIF(COUNT(a.id), 0) as completion_rate
            FROM events e
            LEFT JOIN attendance a ON e.id = a.event_id
            WHERE strftime('%Y', e.event_date) = ?
              AND strftime('%m', e.event_date) = ?
            GROUP BY e.category_id
        """, (str(year), f'{month:02d}'))

        rows = cursor.fetchall()
        print(f"업종별 통계 {len(rows)}건 계산됨")

        for row in rows:
            row_dict = dict(row)
            # event_monthly_stats에 저장
            cursor.execute("""
                INSERT OR REPLACE INTO event_monthly_stats
                (year, month, category_id, total_events, total_workers, total_revenue, avg_pay, fill_rate, completion_rate, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            """, (year, month, row_dict['category_id'], row_dict['total_events'],
                  row_dict['total_workers'], row_dict['total_revenue'],
                  row_dict['avg_pay'], row_dict['fill_rate'], row_dict['completion_rate']))

        conn.commit()
        print("행사 월별 통계 저장 완료")


def main():
    parser = argparse.ArgumentParser(description='월별 통계 계산 배치')
    parser.add_argument('--year', type=int, default=datetime.now().year, help='연도 (기본: 현재 연도)')
    parser.add_argument('--month', type=int, default=datetime.now().month, help='월 (기본: 현재 월)')
    parser.add_argument('--cumulative', action='store_true', help='누적 통계만 업데이트')
    args = parser.parse_args()

    print(f"\n통계 계산 배치 시작")
    print(f"DB 경로: {DB_PATH}")

    db = Database(DB_PATH)

    if args.cumulative:
        # 누적 통계만 업데이트
        update_all_cumulative_stats(db)
    else:
        # 월별 통계 계산
        calculate_all_worker_stats(db, args.year, args.month)
        calculate_event_stats(db, args.year, args.month)
        update_all_cumulative_stats(db)

    print(f"\n{'='*50}")
    print("배치 완료!")
    print(f"{'='*50}\n")


if __name__ == "__main__":
    main()
