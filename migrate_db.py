"""
데이터베이스 마이그레이션 스크립트
workers 테이블에 새로운 컬럼 추가
"""
import sqlite3
import os

db_path = 'data/workproof.db'

def migrate():
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # 기존 테이블 구조 확인
    cursor.execute("PRAGMA table_info(workers)")
    columns = [row[1] for row in cursor.fetchall()]
    print(f"현재 컬럼: {columns}")

    # 추가할 컬럼들
    migrations = [
        ("birth_date", "ALTER TABLE workers ADD COLUMN birth_date TEXT"),
        ("driver_license", "ALTER TABLE workers ADD COLUMN driver_license BOOLEAN DEFAULT 0"),
        ("security_cert", "ALTER TABLE workers ADD COLUMN security_cert BOOLEAN DEFAULT 0"),
        ("ssn", "ALTER TABLE workers ADD COLUMN ssn TEXT"),
        ("residence", "ALTER TABLE workers ADD COLUMN residence TEXT"),
        ("face_photo_file_id", "ALTER TABLE workers ADD COLUMN face_photo_file_id TEXT"),
    ]

    for col_name, sql in migrations:
        if col_name not in columns:
            try:
                cursor.execute(sql)
                print(f"✅ {col_name} 컬럼 추가 완료")
            except Exception as e:
                print(f"❌ {col_name} 컬럼 추가 실패: {e}")
        else:
            print(f"ℹ️ {col_name} 컬럼은 이미 존재합니다")

    # 삭제할 컬럼 (SQLite는 컬럼 삭제 불가능하므로 무시)
    old_columns = ['age', 'residence', 'driving_experience', 'face_photo_file_id']
    for col in old_columns:
        if col in columns:
            print(f"⚠️ {col} 컬럼은 수동으로 삭제해야 합니다 (SQLite는 컬럼 삭제 불가)")

    conn.commit()
    conn.close()
    print("\n✅ 마이그레이션 완료!")

if __name__ == '__main__':
    migrate()
