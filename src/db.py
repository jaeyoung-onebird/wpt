"""
데이터베이스 접근 레이어 (PostgreSQL)
"""
import psycopg2
from psycopg2 import sql
from psycopg2.extras import RealDictCursor
import os
import random
import string
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta
import logging
from contextlib import contextmanager
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

# 한국 시간대 (UTC+9)
KST = timezone(timedelta(hours=9))

def now_kst():
    """현재 한국 시간 반환"""
    return datetime.now(KST)

def now_kst_naive():
    """현재 한국 시간 반환 (timezone 정보 없이)"""
    return datetime.now(KST).replace(tzinfo=None)


class Database:
    """PostgreSQL 데이터베이스 관리 클래스"""

    def __init__(self, database_url: str):
        self.database_url = database_url
        self._init_tables()

    def _parse_database_url(self) -> dict:
        """DATABASE_URL 파싱"""
        result = urlparse(self.database_url)
        return {
            'dbname': result.path[1:],
            'user': result.username,
            'password': result.password,
            'host': result.hostname,
            'port': result.port or 5432
        }

    @contextmanager
    def get_connection(self):
        """DB 연결 컨텍스트 매니저"""
        conn = psycopg2.connect(**self._parse_database_url())
        try:
            yield conn
            conn.commit()
        except Exception as e:
            conn.rollback()
            logger.error(f"Database error: {e}")
            raise
        finally:
            conn.close()

    def _init_tables(self):
        """테이블 초기화"""
        with self.get_connection() as conn:
            cursor = conn.cursor()

            # Workers 테이블
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS workers (
                    id SERIAL PRIMARY KEY,
                    telegram_id BIGINT UNIQUE NOT NULL,
                    name TEXT NOT NULL,
                    birth_date TEXT,
                    phone TEXT NOT NULL,
                    driver_license BOOLEAN DEFAULT FALSE,
                    security_cert BOOLEAN DEFAULT FALSE,
                    ssn TEXT,
                    bank_name TEXT,
                    bank_account TEXT,
                    contract_signed BOOLEAN DEFAULT FALSE,
                    contract_sent_at TIMESTAMP,
                    tokens INTEGER DEFAULT 3,
                    wallet_address TEXT,
                    gender TEXT,
                    residence TEXT,
                    face_photo_file_id TEXT,
                    email TEXT UNIQUE,
                    password_hash TEXT,
                    is_admin BOOLEAN DEFAULT FALSE,
                    region_id INTEGER,
                    home_dong TEXT,
                    career_months INTEGER DEFAULT 0,
                    work_score REAL DEFAULT 0,
                    work_score_updated_at TIMESTAMP,
                    preferred_regions TEXT,
                    preferred_job_types TEXT,
                    preferred_work_days TEXT,
                    min_pay_per_hour INTEGER,
                    previous_experience TEXT,
                    total_worked_events INTEGER DEFAULT 0,
                    total_worked_hours INTEGER DEFAULT 0,
                    first_work_date TEXT,
                    last_work_date TEXT,
                    reliability_score REAL DEFAULT 50,
                    no_show_count INTEGER DEFAULT 0,
                    same_day_cancel_count INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # Events 테이블
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS events (
                    id SERIAL PRIMARY KEY,
                    short_code TEXT UNIQUE NOT NULL,
                    title TEXT NOT NULL,
                    event_date TEXT NOT NULL,
                    event_time TEXT,
                    start_time TEXT,
                    end_time TEXT,
                    location TEXT NOT NULL,
                    pay_amount INTEGER NOT NULL,
                    pay_description TEXT,
                    headcount INTEGER,
                    meal_provided BOOLEAN DEFAULT FALSE,
                    dress_code TEXT,
                    age_requirement TEXT,
                    work_type TEXT,
                    application_method TEXT,
                    manager_name TEXT,
                    manager_phone TEXT,
                    status TEXT DEFAULT 'OPEN',
                    created_by INTEGER,
                    requires_driver_license BOOLEAN DEFAULT FALSE,
                    requires_security_cert BOOLEAN DEFAULT FALSE,
                    region_id INTEGER,
                    category_id INTEGER,
                    difficulty_level INTEGER DEFAULT 3,
                    indoor_outdoor TEXT,
                    weather_condition TEXT,
                    temperature REAL,
                    actual_headcount INTEGER,
                    event_completion_rate REAL,
                    avg_worker_rating REAL,
                    client_satisfaction REAL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # Applications 테이블
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS applications (
                    id SERIAL PRIMARY KEY,
                    event_id INTEGER NOT NULL REFERENCES events(id),
                    worker_id INTEGER NOT NULL REFERENCES workers(id),
                    status TEXT DEFAULT 'PENDING',
                    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    confirmed_at TIMESTAMP,
                    confirmed_by INTEGER,
                    rejection_reason TEXT,
                    notified BOOLEAN DEFAULT FALSE,
                    cancelled_at TIMESTAMP,
                    cancel_reason TEXT,
                    UNIQUE(event_id, worker_id)
                )
            """)

            # Attendance 테이블
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS attendance (
                    id SERIAL PRIMARY KEY,
                    application_id INTEGER UNIQUE NOT NULL REFERENCES applications(id),
                    event_id INTEGER NOT NULL REFERENCES events(id),
                    worker_id INTEGER NOT NULL REFERENCES workers(id),
                    check_in_code TEXT,
                    check_in_time TIMESTAMP,
                    check_out_time TIMESTAMP,
                    worked_minutes INTEGER,
                    status TEXT DEFAULT 'PENDING',
                    completed_by INTEGER,
                    late_minutes INTEGER DEFAULT 0,
                    scheduled_start TEXT,
                    scheduled_end TEXT,
                    cancel_type TEXT,
                    cancel_time TIMESTAMP,
                    time_compliance INTEGER DEFAULT 100,
                    check_in_lat REAL,
                    check_in_lng REAL,
                    check_out_lat REAL,
                    check_out_lng REAL,
                    distance_from_venue REAL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # Chain logs 테이블
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS chain_logs (
                    id SERIAL PRIMARY KEY,
                    attendance_id INTEGER UNIQUE NOT NULL REFERENCES attendance(id),
                    event_id INTEGER NOT NULL REFERENCES events(id),
                    worker_uid_hash TEXT NOT NULL,
                    log_hash TEXT NOT NULL,
                    tx_hash TEXT,
                    block_number INTEGER,
                    network TEXT DEFAULT 'amoy',
                    recorded_at TIMESTAMP,
                    metadata_hash TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # Payroll exports 테이블
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS payroll_exports (
                    id SERIAL PRIMARY KEY,
                    event_id INTEGER NOT NULL REFERENCES events(id),
                    file_path TEXT NOT NULL,
                    exported_by INTEGER NOT NULL,
                    worker_count INTEGER,
                    total_amount INTEGER,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # Admin users 테이블
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS admin_users (
                    id SERIAL PRIMARY KEY,
                    telegram_id BIGINT UNIQUE NOT NULL,
                    username TEXT,
                    is_active BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # Pending admin requests 테이블
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS pending_admin_requests (
                    id SERIAL PRIMARY KEY,
                    telegram_id BIGINT UNIQUE NOT NULL,
                    username TEXT,
                    first_name TEXT,
                    last_name TEXT,
                    status TEXT DEFAULT 'PENDING',
                    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    reviewed_by INTEGER,
                    reviewed_at TIMESTAMP
                )
            """)

            # Notifications 테이블
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS notifications (
                    id SERIAL PRIMARY KEY,
                    worker_id INTEGER NOT NULL REFERENCES workers(id),
                    type TEXT NOT NULL,
                    title TEXT NOT NULL,
                    message TEXT NOT NULL,
                    data TEXT,
                    is_read BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # Credit history 테이블
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS credit_history (
                    id SERIAL PRIMARY KEY,
                    worker_id INTEGER NOT NULL REFERENCES workers(id),
                    amount INTEGER NOT NULL,
                    balance_after INTEGER,
                    tx_type TEXT NOT NULL,
                    reason TEXT NOT NULL,
                    tx_hash TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # Daily check-in 테이블
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS daily_checkins (
                    id SERIAL PRIMARY KEY,
                    worker_id INTEGER NOT NULL REFERENCES workers(id),
                    check_date TEXT NOT NULL,
                    reward_amount INTEGER DEFAULT 1,
                    streak_days INTEGER DEFAULT 1,
                    tx_hash TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(worker_id, check_date)
                )
            """)

            # Monthly bonuses 테이블
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS monthly_bonuses (
                    id SERIAL PRIMARY KEY,
                    worker_id INTEGER NOT NULL REFERENCES workers(id),
                    year INTEGER NOT NULL,
                    month INTEGER NOT NULL,
                    bonus_type TEXT NOT NULL,
                    amount INTEGER NOT NULL,
                    tx_hash TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(worker_id, year, month, bonus_type)
                )
            """)

            # Email verifications 테이블
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS email_verifications (
                    id SERIAL PRIMARY KEY,
                    email TEXT NOT NULL,
                    code TEXT NOT NULL,
                    verified BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    expires_at TIMESTAMP NOT NULL
                )
            """)

            # Regions 테이블
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS regions (
                    id SERIAL PRIMARY KEY,
                    sido TEXT NOT NULL,
                    sigungu TEXT NOT NULL,
                    dong TEXT,
                    lat REAL,
                    lng REAL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # Job categories 테이블
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS job_categories (
                    id SERIAL PRIMARY KEY,
                    name TEXT NOT NULL UNIQUE,
                    parent_id INTEGER REFERENCES job_categories(id),
                    avg_pay INTEGER,
                    description TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # Skills 테이블
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS skills (
                    id SERIAL PRIMARY KEY,
                    name TEXT NOT NULL UNIQUE,
                    category TEXT,
                    description TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # Worker skills 테이블
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS worker_skills (
                    id SERIAL PRIMARY KEY,
                    worker_id INTEGER NOT NULL REFERENCES workers(id),
                    skill_id INTEGER NOT NULL REFERENCES skills(id),
                    acquired_date TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(worker_id, skill_id)
                )
            """)

            # Worker history 테이블
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS worker_history (
                    id SERIAL PRIMARY KEY,
                    worker_id INTEGER NOT NULL REFERENCES workers(id),
                    field_name TEXT NOT NULL,
                    old_value TEXT,
                    new_value TEXT,
                    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    changed_by INTEGER
                )
            """)

            # Application status history 테이블
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS application_status_history (
                    id SERIAL PRIMARY KEY,
                    application_id INTEGER NOT NULL REFERENCES applications(id),
                    old_status TEXT,
                    new_status TEXT,
                    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    changed_by INTEGER,
                    reason TEXT
                )
            """)

            # Worker monthly stats 테이블
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS worker_monthly_stats (
                    id SERIAL PRIMARY KEY,
                    worker_id INTEGER NOT NULL REFERENCES workers(id),
                    year INTEGER NOT NULL,
                    month INTEGER NOT NULL,
                    worked_events INTEGER DEFAULT 0,
                    worked_hours INTEGER DEFAULT 0,
                    total_earnings INTEGER DEFAULT 0,
                    on_time_rate REAL DEFAULT 100,
                    completion_rate REAL DEFAULT 100,
                    avg_rating REAL,
                    cancellation_count INTEGER DEFAULT 0,
                    no_show_count INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(worker_id, year, month)
                )
            """)

            # Event monthly stats 테이블
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS event_monthly_stats (
                    id SERIAL PRIMARY KEY,
                    year INTEGER NOT NULL,
                    month INTEGER NOT NULL,
                    category_id INTEGER,
                    region_id INTEGER,
                    total_events INTEGER DEFAULT 0,
                    total_workers INTEGER DEFAULT 0,
                    total_revenue INTEGER DEFAULT 0,
                    avg_pay INTEGER,
                    fill_rate REAL,
                    completion_rate REAL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(year, month, category_id, region_id)
                )
            """)

            # Regional stats 테이블
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS regional_stats (
                    id SERIAL PRIMARY KEY,
                    region_id INTEGER NOT NULL REFERENCES regions(id),
                    year INTEGER NOT NULL,
                    month INTEGER NOT NULL,
                    active_workers INTEGER DEFAULT 0,
                    total_events INTEGER DEFAULT 0,
                    avg_pay INTEGER,
                    demand_index REAL,
                    supply_index REAL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(region_id, year, month)
                )
            """)

            # Ratings 테이블
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS ratings (
                    id SERIAL PRIMARY KEY,
                    attendance_id INTEGER NOT NULL REFERENCES attendance(id),
                    rater_type TEXT NOT NULL,
                    rating INTEGER NOT NULL,
                    feedback TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(attendance_id, rater_type)
                )
            """)

            # 성과 배지 (Achievement Badges / NFT)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS worker_badges (
                    id SERIAL PRIMARY KEY,
                    worker_id INTEGER NOT NULL REFERENCES workers(id),
                    badge_type TEXT NOT NULL,
                    badge_level INTEGER DEFAULT 1,
                    title TEXT NOT NULL,
                    description TEXT,
                    icon TEXT,
                    earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    tx_hash TEXT,
                    is_nft BOOLEAN DEFAULT FALSE,
                    metadata JSONB,
                    event_id INTEGER REFERENCES events(id),
                    batch_id INTEGER,
                    template_type TEXT DEFAULT 'minimal',
                    status TEXT DEFAULT 'ACTIVE',
                    revoke_reason TEXT,
                    image_url TEXT,
                    UNIQUE(worker_id, badge_type, badge_level)
                )
            """)

            # 프로젝트 NFT 발행 배치
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS project_nft_batches (
                    id SERIAL PRIMARY KEY,
                    event_id INTEGER NOT NULL REFERENCES events(id),
                    title TEXT NOT NULL,
                    description TEXT,
                    template_type TEXT DEFAULT 'cert',
                    issued_by INTEGER REFERENCES workers(id),
                    issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    total_issued INTEGER DEFAULT 0,
                    metadata JSONB
                )
            """)

            # 감사 로그
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS audit_logs (
                    id SERIAL PRIMARY KEY,
                    action TEXT NOT NULL,
                    entity_type TEXT NOT NULL,
                    entity_id INTEGER,
                    actor_id INTEGER,
                    actor_type TEXT,
                    details JSONB,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # 인덱스 생성
            indexes = [
                "CREATE INDEX IF NOT EXISTS idx_applications_event ON applications(event_id)",
                "CREATE INDEX IF NOT EXISTS idx_applications_worker ON applications(worker_id)",
                "CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status)",
                "CREATE INDEX IF NOT EXISTS idx_attendance_event ON attendance(event_id)",
                "CREATE INDEX IF NOT EXISTS idx_events_short_code ON events(short_code)",
                "CREATE INDEX IF NOT EXISTS idx_events_status ON events(status)",
                "CREATE INDEX IF NOT EXISTS idx_credit_history_worker ON credit_history(worker_id)",
                "CREATE INDEX IF NOT EXISTS idx_email_verifications_email ON email_verifications(email)",
                "CREATE INDEX IF NOT EXISTS idx_regions_sido ON regions(sido)",
                "CREATE INDEX IF NOT EXISTS idx_regions_sigungu ON regions(sigungu)",
                "CREATE INDEX IF NOT EXISTS idx_worker_history_worker ON worker_history(worker_id)",
                "CREATE INDEX IF NOT EXISTS idx_app_status_history_app ON application_status_history(application_id)",
                "CREATE INDEX IF NOT EXISTS idx_worker_monthly_stats ON worker_monthly_stats(worker_id, year, month)",
                "CREATE INDEX IF NOT EXISTS idx_ratings_attendance ON ratings(attendance_id)",
                "CREATE INDEX IF NOT EXISTS idx_worker_badges_worker ON worker_badges(worker_id)",
                "CREATE INDEX IF NOT EXISTS idx_worker_badges_type ON worker_badges(badge_type)",
                "CREATE INDEX IF NOT EXISTS idx_worker_badges_event ON worker_badges(event_id)",
                "CREATE INDEX IF NOT EXISTS idx_worker_badges_status ON worker_badges(status)",
                "CREATE INDEX IF NOT EXISTS idx_project_nft_batches_event ON project_nft_batches(event_id)",
                "CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id)",
                "CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id)"
            ]
            for idx in indexes:
                cursor.execute(idx)

            logger.info("Database tables initialized successfully")

    # ===== Workers =====
    def create_worker(self, telegram_id: int, name: str, phone: str, **kwargs) -> int:
        """근무자 생성"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO workers (telegram_id, name, phone, birth_date, residence, face_photo_file_id, driver_license, security_cert, contract_signed, ssn, bank_name, bank_account)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
            """, (telegram_id, name, phone, kwargs.get('birth_date'), kwargs.get('residence'), kwargs.get('face_photo_file_id'),
                  kwargs.get('driver_license', False), kwargs.get('security_cert', False), kwargs.get('contract_signed', False),
                  kwargs.get('ssn'), kwargs.get('bank_name'), kwargs.get('bank_account')))
            return cursor.fetchone()[0]

    def get_worker_by_telegram_id(self, telegram_id: int) -> Optional[Dict]:
        """텔레그램 ID로 근무자 조회"""
        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("SELECT * FROM workers WHERE telegram_id = %s", (telegram_id,))
            row = cursor.fetchone()
            return dict(row) if row else None

    def get_worker_by_phone(self, phone: str) -> Optional[Dict]:
        """전화번호로 근무자 조회"""
        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            # 전화번호 형식 정규화 (하이픈 제거)
            normalized_phone = phone.replace("-", "").replace(" ", "")
            cursor.execute("SELECT * FROM workers WHERE REPLACE(phone, '-', '') = %s", (normalized_phone,))
            row = cursor.fetchone()
            return dict(row) if row else None

    def get_worker_by_user_id(self, user_id: str) -> Optional[Dict]:
        """사용자 ID로 연결된 근무자 조회"""
        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            # users 테이블의 phone과 workers 테이블의 phone 매칭
            cursor.execute("""
                SELECT w.* FROM workers w
                JOIN users u ON REPLACE(w.phone, '-', '') = REPLACE(u.phone, '-', '')
                WHERE u.id = %s
            """, (user_id,))
            row = cursor.fetchone()
            return dict(row) if row else None

    def get_worker_by_id(self, worker_id: int) -> Optional[Dict]:
        """ID로 근무자 조회"""
        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("SELECT * FROM workers WHERE id = %s", (worker_id,))
            row = cursor.fetchone()
            return dict(row) if row else None

    def list_workers(self, limit: int = 100) -> List[Dict]:
        """모든 근무자 조회"""
        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("""
                SELECT * FROM workers
                ORDER BY created_at DESC
                LIMIT %s
            """, (limit,))
            return [dict(row) for row in cursor.fetchall()]

    def update_worker(self, worker_id: int, **kwargs):
        """근무자 정보 수정"""
        allowed_fields = ['name', 'birth_date', 'phone', 'residence', 'face_photo_file_id',
                          'driver_license', 'security_cert', 'ssn', 'bank_name', 'bank_account',
                          'wallet_address', 'gender', 'region_id', 'contract_signed']
        updates = []
        values = []

        for field, value in kwargs.items():
            if field in allowed_fields and value is not None:
                updates.append(f"{field} = %s")
                values.append(value)

        if not updates:
            return

        values.append(now_kst_naive())
        values.append(worker_id)

        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(f"""
                UPDATE workers SET {', '.join(updates)}, updated_at = %s
                WHERE id = %s
            """, values)

    # ===== Events =====
    def generate_short_code(self, length: int = 6) -> str:
        """고유한 short_code 생성"""
        while True:
            code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=length))
            existing = self.get_event_by_short_code(code)
            if not existing:
                return code

    def create_event(self, short_code: str, title: str, event_date: str, location: str,
                     pay_amount: int, created_by: int, **kwargs) -> int:
        """행사 생성"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO events (
                    short_code, title, event_date, event_time, start_time, end_time,
                    location, pay_amount, pay_description, headcount, meal_provided,
                    dress_code, age_requirement, work_type, application_method,
                    manager_name, manager_phone, requires_driver_license, requires_security_cert,
                    created_by, region_id, category_id
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
            """, (
                short_code, title, event_date, kwargs.get('event_time'),
                kwargs.get('start_time'), kwargs.get('end_time'), location,
                pay_amount, kwargs.get('pay_description'), kwargs.get('headcount'),
                kwargs.get('meal_provided', False), kwargs.get('dress_code'),
                kwargs.get('age_requirement'), kwargs.get('work_type'),
                kwargs.get('application_method'), kwargs.get('manager_name'),
                kwargs.get('manager_phone'), kwargs.get('requires_driver_license', False),
                kwargs.get('requires_security_cert', False), created_by,
                kwargs.get('region_id'), kwargs.get('category_id')
            ))
            return cursor.fetchone()[0]

    def get_event(self, event_id: int) -> Optional[Dict]:
        """행사 조회"""
        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("SELECT * FROM events WHERE id = %s", (event_id,))
            row = cursor.fetchone()
            return dict(row) if row else None

    def get_event_by_short_code(self, short_code: str) -> Optional[Dict]:
        """Short code로 행사 조회"""
        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("SELECT * FROM events WHERE short_code = %s", (short_code,))
            row = cursor.fetchone()
            return dict(row) if row else None

    def list_events(self, status: Optional[str] = None, limit: int = 50) -> List[Dict]:
        """행사 목록 조회"""
        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            if status:
                cursor.execute("""
                    SELECT * FROM events WHERE status = %s
                    ORDER BY event_date DESC, created_at DESC LIMIT %s
                """, (status, limit))
            else:
                cursor.execute("""
                    SELECT * FROM events
                    ORDER BY event_date DESC, created_at DESC LIMIT %s
                """, (limit,))
            return [dict(row) for row in cursor.fetchall()]

    def update_event_status(self, event_id: int, status: str):
        """행사 상태 변경"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE events SET status = %s, updated_at = %s
                WHERE id = %s
            """, (status, now_kst_naive(), event_id))

    # ===== Applications =====
    def create_application(self, event_id: int, worker_id: int) -> Optional[int]:
        """지원 생성 (중복 방지)"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO applications (event_id, worker_id)
                    VALUES (%s, %s)
                    RETURNING id
                """, (event_id, worker_id))
                return cursor.fetchone()[0]
        except psycopg2.IntegrityError:
            logger.warning(f"Duplicate application: event_id={event_id}, worker_id={worker_id}")
            return None

    def get_application(self, app_id: int) -> Optional[Dict]:
        """지원 내역 조회"""
        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("""
                SELECT a.*,
                       w.name as worker_name,
                       w.phone as worker_phone,
                       w.telegram_id as worker_telegram_id,
                       w.birth_date as worker_birth_date,
                       w.residence as worker_residence,
                       w.driver_license as worker_driver_license,
                       w.security_cert as worker_security_cert,
                       w.contract_signed as worker_contract_signed,
                       w.face_photo_file_id as worker_face_photo_file_id,
                       w.bank_name as worker_bank_name,
                       w.bank_account as worker_bank_account,
                       e.title as event_title
                FROM applications a
                JOIN workers w ON a.worker_id = w.id
                JOIN events e ON a.event_id = e.id
                WHERE a.id = %s
            """, (app_id,))
            row = cursor.fetchone()
            return dict(row) if row else None

    def list_applications_by_event(self, event_id: int, status: Optional[str] = None) -> List[Dict]:
        """행사별 지원자 목록"""
        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            if status:
                cursor.execute("""
                    SELECT a.*, w.name, w.phone, w.telegram_id
                    FROM applications a
                    JOIN workers w ON a.worker_id = w.id
                    WHERE a.event_id = %s AND a.status = %s
                    ORDER BY a.applied_at DESC
                """, (event_id, status))
            else:
                cursor.execute("""
                    SELECT a.*, w.name, w.phone, w.telegram_id
                    FROM applications a
                    JOIN workers w ON a.worker_id = w.id
                    WHERE a.event_id = %s
                    ORDER BY a.applied_at DESC
                """, (event_id,))
            return [dict(row) for row in cursor.fetchall()]

    def list_applications_by_worker(self, worker_id: int) -> List[Dict]:
        """근무자별 지원 내역"""
        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("""
                SELECT a.*, e.title, e.event_date, e.location, e.pay_amount
                FROM applications a
                JOIN events e ON a.event_id = e.id
                WHERE a.worker_id = %s
                ORDER BY a.applied_at DESC
            """, (worker_id,))
            return [dict(row) for row in cursor.fetchall()]

    def get_application_by_worker_event(self, worker_id: int, event_id: int) -> Optional[Dict]:
        """근무자+행사로 지원 조회"""
        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("""
                SELECT * FROM applications
                WHERE worker_id = %s AND event_id = %s
            """, (worker_id, event_id))
            row = cursor.fetchone()
            return dict(row) if row else None

    def update_application_status(self, app_id: int, status: str, confirmed_by: Optional[int] = None,
                                   rejection_reason: Optional[str] = None):
        """지원 상태 변경"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            if status == 'CONFIRMED':
                cursor.execute("""
                    UPDATE applications
                    SET status = %s, confirmed_at = %s, confirmed_by = %s
                    WHERE id = %s
                """, (status, now_kst_naive(), confirmed_by, app_id))
            elif status == 'REJECTED':
                cursor.execute("""
                    UPDATE applications
                    SET status = %s, rejection_reason = %s
                    WHERE id = %s
                """, (status, rejection_reason, app_id))
            else:
                cursor.execute("""
                    UPDATE applications SET status = %s WHERE id = %s
                """, (status, app_id))

    def mark_application_notified(self, app_id: int):
        """알림 발송 완료 표시"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("UPDATE applications SET notified = TRUE WHERE id = %s", (app_id,))

    def cancel_application(self, app_id: int, event_date: str = None):
        """지원 취소 처리 (취소 유형 자동 분류)"""
        now = now_kst_naive()
        cancel_type = 'ADVANCE'

        if event_date:
            try:
                if len(event_date) <= 10:
                    event_dt = datetime.strptime(event_date, "%Y-%m-%d")
                else:
                    event_dt = datetime.fromisoformat(event_date)

                hours_until_event = (event_dt - now).total_seconds() / 3600

                if hours_until_event < 0:
                    cancel_type = 'NO_SHOW'
                elif hours_until_event < 24:
                    cancel_type = 'SAMEDAY'
                else:
                    cancel_type = 'ADVANCE'
            except:
                pass

        with self.get_connection() as conn:
            cursor = conn.cursor()

            cursor.execute("""
                UPDATE applications
                SET status = 'CANCELLED'
                WHERE id = %s
            """, (app_id,))

            cursor.execute("""
                UPDATE attendance
                SET cancel_type = %s, cancel_time = %s, status = 'CANCELLED'
                WHERE application_id = %s
            """, (cancel_type, now, app_id))

        return cancel_type

    def mark_no_show(self, attendance_id: int):
        """노쇼 처리"""
        now = now_kst_naive()
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE attendance
                SET cancel_type = 'NO_SHOW', cancel_time = %s, status = 'NO_SHOW'
                WHERE id = %s
            """, (now, attendance_id))

            cursor.execute("""
                UPDATE applications
                SET status = 'NO_SHOW'
                WHERE id = (SELECT application_id FROM attendance WHERE id = %s)
            """, (attendance_id,))

    # ===== Attendance =====
    def create_attendance(self, application_id: int, event_id: int, worker_id: int, check_in_code: str,
                          scheduled_start: str = None, scheduled_end: str = None) -> int:
        """출석 레코드 생성"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO attendance (application_id, event_id, worker_id, check_in_code, scheduled_start, scheduled_end)
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING id
            """, (application_id, event_id, worker_id, check_in_code, scheduled_start, scheduled_end))
            return cursor.fetchone()[0]

    def get_attendance_by_code(self, check_in_code: str) -> Optional[Dict]:
        """출석코드로 조회"""
        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("SELECT * FROM attendance WHERE check_in_code = %s", (check_in_code,))
            row = cursor.fetchone()
            return dict(row) if row else None

    def get_attendance_by_application(self, application_id: int) -> Optional[Dict]:
        """지원 ID로 출석 조회"""
        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("SELECT * FROM attendance WHERE application_id = %s", (application_id,))
            row = cursor.fetchone()
            return dict(row) if row else None

    def get_attendance_by_id(self, attendance_id: int) -> Optional[Dict]:
        """출석 ID로 조회"""
        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("SELECT * FROM attendance WHERE id = %s", (attendance_id,))
            row = cursor.fetchone()
            return dict(row) if row else None

    def check_in(self, attendance_id: int):
        """출석 처리 (지각 시간 자동 계산)"""
        now = now_kst_naive()
        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("SELECT scheduled_start FROM attendance WHERE id = %s", (attendance_id,))
            row = cursor.fetchone()

            late_minutes = 0
            if row and row['scheduled_start']:
                try:
                    scheduled_str = row['scheduled_start']
                    if len(scheduled_str) <= 5:
                        scheduled_time = datetime.strptime(
                            f"{now.strftime('%Y-%m-%d')} {scheduled_str}",
                            "%Y-%m-%d %H:%M"
                        )
                    else:
                        scheduled_time = datetime.fromisoformat(scheduled_str)

                    if now > scheduled_time:
                        late_minutes = int((now - scheduled_time).total_seconds() / 60)
                except:
                    pass

            cursor.execute("""
                UPDATE attendance
                SET check_in_time = %s, status = 'CHECKED_IN', late_minutes = %s
                WHERE id = %s
            """, (now, late_minutes, attendance_id))

    def check_out(self, attendance_id: int, completed_by: int):
        """퇴근 처리 (근무시간 준수율 자동 계산)"""
        check_out_time = now_kst_naive()
        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("""
                SELECT check_in_time, scheduled_start, scheduled_end
                FROM attendance WHERE id = %s
            """, (attendance_id,))
            row = cursor.fetchone()

            if row and row['check_in_time']:
                check_in = row['check_in_time']
                if isinstance(check_in, str):
                    check_in = datetime.fromisoformat(check_in)
                worked_minutes = int((check_out_time - check_in).total_seconds() / 60)

                time_compliance = 100
                if row['scheduled_start'] and row['scheduled_end']:
                    try:
                        today = check_out_time.strftime('%Y-%m-%d')
                        sched_start = row['scheduled_start']
                        sched_end = row['scheduled_end']

                        if len(sched_start) <= 5:
                            sched_start_dt = datetime.strptime(f"{today} {sched_start}", "%Y-%m-%d %H:%M")
                        else:
                            sched_start_dt = datetime.fromisoformat(sched_start)

                        if len(sched_end) <= 5:
                            sched_end_dt = datetime.strptime(f"{today} {sched_end}", "%Y-%m-%d %H:%M")
                        else:
                            sched_end_dt = datetime.fromisoformat(sched_end)

                        scheduled_minutes = int((sched_end_dt - sched_start_dt).total_seconds() / 60)
                        if scheduled_minutes > 0:
                            time_compliance = min(100, round(worked_minutes / scheduled_minutes * 100, 1))
                    except:
                        pass

                cursor.execute("""
                    UPDATE attendance
                    SET check_out_time = %s, worked_minutes = %s, time_compliance = %s,
                        status = 'COMPLETED', completed_by = %s
                    WHERE id = %s
                """, (check_out_time, worked_minutes, time_compliance, completed_by, attendance_id))

    def list_attendance_by_event(self, event_id: int) -> List[Dict]:
        """행사별 출석 현황"""
        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("""
                SELECT att.*,
                       w.name as worker_name,
                       w.phone,
                       w.birth_date,
                       w.bank_name,
                       w.bank_account,
                       w.residence,
                       w.face_photo_file_id,
                       w.driver_license,
                       w.security_cert
                FROM attendance att
                JOIN workers w ON att.worker_id = w.id
                WHERE att.event_id = %s
                ORDER BY att.check_in_time DESC
            """, (event_id,))
            return [dict(row) for row in cursor.fetchall()]

    # ===== Chain Logs =====
    def create_chain_log(self, attendance_id: int, event_id: int, worker_uid_hash: str,
                         log_hash: str, network: str = 'amoy') -> int:
        """블록체인 로그 생성"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO chain_logs (attendance_id, event_id, worker_uid_hash, log_hash, network)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id
            """, (attendance_id, event_id, worker_uid_hash, log_hash, network))
            return cursor.fetchone()[0]

    def update_chain_log_tx(self, chain_log_id: int, tx_hash: str, block_number: int):
        """블록체인 TX 정보 업데이트"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE chain_logs
                SET tx_hash = %s, block_number = %s, recorded_at = %s
                WHERE id = %s
            """, (tx_hash, block_number, now_kst_naive(), chain_log_id))

    def get_chain_logs_by_worker(self, worker_id: int) -> List[Dict]:
        """근무자별 블록체인 로그"""
        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("""
                SELECT cl.*, e.title as event_title, e.event_date,
                       e.pay_amount, e.location,
                       att.worked_minutes, att.check_in_time, att.check_out_time,
                       att.worker_id, att.status, w.name as worker_name, w.birth_date as worker_birth_date
                FROM chain_logs cl
                JOIN attendance att ON cl.attendance_id = att.id
                JOIN events e ON cl.event_id = e.id
                JOIN workers w ON att.worker_id = w.id
                WHERE att.worker_id = %s
                ORDER BY cl.recorded_at DESC
            """, (worker_id,))
            return [dict(row) for row in cursor.fetchall()]

    def get_chain_log_by_id(self, log_id: int) -> Optional[Dict]:
        """ID로 블록체인 로그 조회"""
        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("""
                SELECT cl.*, e.title as event_title, e.event_date,
                       e.pay_amount, e.location,
                       att.worked_minutes, att.check_in_time, att.check_out_time,
                       att.worker_id, att.status, w.name as worker_name, w.birth_date as worker_birth_date
                FROM chain_logs cl
                JOIN attendance att ON cl.attendance_id = att.id
                JOIN events e ON cl.event_id = e.id
                JOIN workers w ON att.worker_id = w.id
                WHERE cl.id = %s
            """, (log_id,))
            row = cursor.fetchone()
            return dict(row) if row else None

    # ===== Admin =====
    def is_admin(self, telegram_id: int) -> bool:
        """관리자 권한 확인"""
        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("""
                SELECT COUNT(*) as count FROM admin_users
                WHERE telegram_id = %s AND is_active = TRUE
            """, (telegram_id,))
            row = cursor.fetchone()
            return row['count'] > 0 if row else False

    def add_admin(self, telegram_id: int, username: Optional[str] = None):
        """관리자 추가"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO admin_users (telegram_id, username)
                    VALUES (%s, %s)
                """, (telegram_id, username))
        except psycopg2.IntegrityError:
            logger.warning(f"Admin already exists: {telegram_id}")

    def create_admin_request(self, telegram_id: int, username: Optional[str] = None,
                            first_name: Optional[str] = None, last_name: Optional[str] = None) -> bool:
        """관리자 승인 요청 생성"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO pending_admin_requests (telegram_id, username, first_name, last_name)
                    VALUES (%s, %s, %s, %s)
                """, (telegram_id, username, first_name, last_name))
                return True
        except psycopg2.IntegrityError:
            return False

    def get_pending_admin_request(self, telegram_id: int) -> Optional[Dict]:
        """대기 중인 관리자 요청 조회"""
        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("""
                SELECT * FROM pending_admin_requests
                WHERE telegram_id = %s AND status = 'PENDING'
            """, (telegram_id,))
            row = cursor.fetchone()
            return dict(row) if row else None

    def get_admin_request(self, telegram_id: int) -> Optional[Dict]:
        """관리자 요청 조회"""
        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("""
                SELECT * FROM pending_admin_requests
                WHERE telegram_id = %s
                ORDER BY requested_at DESC
                LIMIT 1
            """, (telegram_id,))
            row = cursor.fetchone()
            return dict(row) if row else None

    def approve_admin_request(self, telegram_id: int, reviewed_by: int):
        """관리자 요청 승인"""
        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)

            cursor.execute("""
                UPDATE pending_admin_requests
                SET status = 'APPROVED', reviewed_by = %s, reviewed_at = CURRENT_TIMESTAMP
                WHERE telegram_id = %s
            """, (reviewed_by, telegram_id))

            cursor.execute("""
                SELECT username FROM pending_admin_requests WHERE telegram_id = %s
            """, (telegram_id,))
            result = cursor.fetchone()
            username = result['username'] if result else None

            self.add_admin(telegram_id, username)

    def reject_admin_request(self, telegram_id: int, reviewed_by: int):
        """관리자 요청 거부"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE pending_admin_requests
                SET status = 'REJECTED', reviewed_by = %s, reviewed_at = CURRENT_TIMESTAMP
                WHERE telegram_id = %s
            """, (reviewed_by, telegram_id))

    def get_main_admin_id(self) -> Optional[int]:
        """첫 번째 관리자 ID 조회"""
        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("""
                SELECT telegram_id FROM admin_users
                WHERE is_active = TRUE
                ORDER BY id ASC
                LIMIT 1
            """)
            row = cursor.fetchone()
            return row['telegram_id'] if row else None

    # ===== Token 관리 =====
    def get_worker_tokens(self, worker_id: int) -> int:
        """근무자 토큰 조회"""
        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("SELECT tokens FROM workers WHERE id = %s", (worker_id,))
            row = cursor.fetchone()
            return row['tokens'] if row and row['tokens'] else 0

    def use_token(self, worker_id: int, amount: int = 1) -> bool:
        """토큰 사용"""
        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("SELECT tokens FROM workers WHERE id = %s", (worker_id,))
            row = cursor.fetchone()
            current = row['tokens'] if row and row['tokens'] else 0

            if current < amount:
                return False

            cursor.execute(
                "UPDATE workers SET tokens = tokens - %s WHERE id = %s",
                (amount, worker_id)
            )
            return True

    def add_tokens(self, worker_id: int, amount: int):
        """토큰 추가"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE workers SET tokens = COALESCE(tokens, 0) + %s WHERE id = %s",
                (amount, worker_id)
            )

    # ===== Credit History =====
    def create_credit_history(self, worker_id: int, amount: int, balance_after: int,
                              tx_type: str, reason: str, tx_hash: str = None) -> int:
        """크레딧 거래 내역 생성"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO credit_history (worker_id, amount, balance_after, tx_type, reason, tx_hash)
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING id
            """, (worker_id, amount, balance_after, tx_type, reason, tx_hash))
            return cursor.fetchone()[0]

    def get_credit_history(self, worker_id: int, limit: int = 50) -> List[Dict]:
        """근무자 크레딧 거래 내역"""
        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("""
                SELECT * FROM credit_history
                WHERE worker_id = %s
                ORDER BY created_at DESC
                LIMIT %s
            """, (worker_id, limit))
            return [dict(row) for row in cursor.fetchall()]

    def get_worker_wallet_address(self, worker_id: int) -> Optional[str]:
        """근무자 지갑 주소 조회"""
        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("SELECT wallet_address FROM workers WHERE id = %s", (worker_id,))
            row = cursor.fetchone()
            return row['wallet_address'] if row else None

    def set_worker_wallet_address(self, worker_id: int, wallet_address: str):
        """근무자 지갑 주소 설정"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE workers SET wallet_address = %s WHERE id = %s",
                (wallet_address, worker_id)
            )

    # ===== Daily Check-in =====
    def check_today_checkin(self, worker_id: int) -> Optional[Dict]:
        """오늘 출석체크 여부 확인"""
        today = now_kst_naive().strftime('%Y-%m-%d')
        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("""
                SELECT * FROM daily_checkins
                WHERE worker_id = %s AND check_date = %s
            """, (worker_id, today))
            row = cursor.fetchone()
            return dict(row) if row else None

    def get_streak_days(self, worker_id: int) -> int:
        """연속 출석 일수 계산"""
        from datetime import timedelta
        today = now_kst_naive().date()

        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("""
                SELECT check_date FROM daily_checkins
                WHERE worker_id = %s
                ORDER BY check_date DESC
                LIMIT 30
            """, (worker_id,))
            rows = cursor.fetchall()

            if not rows:
                return 0

            streak = 0
            expected_date = today

            for row in rows:
                check_date = datetime.strptime(row['check_date'], '%Y-%m-%d').date()
                if check_date == expected_date:
                    streak += 1
                    expected_date = expected_date - timedelta(days=1)
                elif check_date == expected_date - timedelta(days=1):
                    streak += 1
                    expected_date = check_date - timedelta(days=1)
                else:
                    break

            return streak

    def create_daily_checkin(self, worker_id: int, reward_amount: int = 1, tx_hash: str = None) -> Dict:
        """일일 출석체크 생성"""
        today = now_kst_naive().strftime('%Y-%m-%d')
        streak = self.get_streak_days(worker_id) + 1

        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO daily_checkins (worker_id, check_date, reward_amount, streak_days, tx_hash)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id
            """, (worker_id, today, reward_amount, streak, tx_hash))

            return {
                'id': cursor.fetchone()[0],
                'worker_id': worker_id,
                'check_date': today,
                'reward_amount': reward_amount,
                'streak_days': streak,
                'tx_hash': tx_hash
            }

    def get_checkin_history(self, worker_id: int, limit: int = 30) -> List[Dict]:
        """출석체크 내역 조회"""
        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("""
                SELECT * FROM daily_checkins
                WHERE worker_id = %s
                ORDER BY check_date DESC
                LIMIT %s
            """, (worker_id, limit))
            return [dict(row) for row in cursor.fetchall()]

    def get_monthly_checkins(self, worker_id: int, year: int, month: int) -> List[Dict]:
        """월별 출석체크 내역"""
        date_prefix = f"{year}-{month:02d}"
        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("""
                SELECT * FROM daily_checkins
                WHERE worker_id = %s AND check_date LIKE %s
                ORDER BY check_date ASC
            """, (worker_id, f"{date_prefix}%"))
            return [dict(row) for row in cursor.fetchall()]

    def check_perfect_attendance(self, worker_id: int, year: int, month: int) -> bool:
        """해당 월에 매일 출석했는지 확인"""
        import calendar
        days_in_month = calendar.monthrange(year, month)[1]
        checkins = self.get_monthly_checkins(worker_id, year, month)
        return len(checkins) >= days_in_month

    def get_monthly_bonus(self, worker_id: int, year: int, month: int, bonus_type: str) -> Optional[Dict]:
        """월간 보너스 지급 기록 조회"""
        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("""
                SELECT * FROM monthly_bonuses
                WHERE worker_id = %s AND year = %s AND month = %s AND bonus_type = %s
            """, (worker_id, year, month, bonus_type))
            row = cursor.fetchone()
            return dict(row) if row else None

    def create_monthly_bonus(self, worker_id: int, year: int, month: int,
                            bonus_type: str, amount: int, tx_hash: str = None) -> Dict:
        """월간 보너스 지급 기록 생성"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO monthly_bonuses (worker_id, year, month, bonus_type, amount, tx_hash)
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING id
            """, (worker_id, year, month, bonus_type, amount, tx_hash))
            return {
                'id': cursor.fetchone()[0],
                'worker_id': worker_id,
                'year': year,
                'month': month,
                'bonus_type': bonus_type,
                'amount': amount,
                'tx_hash': tx_hash
            }

    # ===== Chain Logs (Public) =====
    def get_all_chain_logs(self, limit: int = 100, offset: int = 0) -> List[Dict]:
        """모든 블록체인 로그 조회"""
        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("""
                SELECT cl.*, e.title as event_title, e.event_date,
                       e.pay_amount, e.location,
                       att.worked_minutes, att.check_in_time, att.check_out_time,
                       att.status, w.name as worker_name, w.birth_date as worker_birth_date
                FROM chain_logs cl
                JOIN attendance att ON cl.attendance_id = att.id
                JOIN events e ON cl.event_id = e.id
                JOIN workers w ON att.worker_id = w.id
                ORDER BY cl.created_at DESC
                LIMIT %s OFFSET %s
            """, (limit, offset))
            return [dict(row) for row in cursor.fetchall()]

    def count_chain_logs(self) -> int:
        """블록체인 로그 총 개수"""
        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("SELECT COUNT(*) as cnt FROM chain_logs")
            row = cursor.fetchone()
            return row['cnt'] if row else 0

    # ===== Notifications =====
    def create_notification(self, worker_id: int, notification_type: str, title: str, message: str, data: str = None) -> int:
        """알림 생성"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO notifications (worker_id, type, title, message, data)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id
            """, (worker_id, notification_type, title, message, data))
            return cursor.fetchone()[0]

    def get_notifications(self, worker_id: int, limit: int = 50) -> List[Dict]:
        """근무자 알림 목록"""
        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("""
                SELECT * FROM notifications
                WHERE worker_id = %s
                ORDER BY created_at DESC
                LIMIT %s
            """, (worker_id, limit))
            notifications = []
            for row in cursor.fetchall():
                notif = dict(row)
                if notif.get('created_at'):
                    notif['created_at'] = notif['created_at'].isoformat()
                notifications.append(notif)
            return notifications

    def get_unread_notification_count(self, worker_id: int) -> int:
        """읽지 않은 알림 수"""
        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("""
                SELECT COUNT(*) as cnt FROM notifications
                WHERE worker_id = %s AND is_read = FALSE
            """, (worker_id,))
            row = cursor.fetchone()
            return row['cnt'] if row else 0

    def mark_notification_read(self, notification_id: int):
        """알림 읽음 처리"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE notifications SET is_read = TRUE WHERE id = %s
            """, (notification_id,))

    def mark_all_notifications_read(self, worker_id: int):
        """모든 알림 읽음 처리"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE notifications SET is_read = TRUE WHERE worker_id = %s
            """, (worker_id,))

    # ===== Email Verifications =====
    def create_email_verification(self, email: str, code: str, expires_at: datetime) -> int:
        """이메일 인증 생성"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                DELETE FROM email_verifications WHERE email = %s AND verified = FALSE
            """, (email,))
            cursor.execute("""
                INSERT INTO email_verifications (email, code, expires_at)
                VALUES (%s, %s, %s)
                RETURNING id
            """, (email, code, expires_at))
            return cursor.fetchone()[0]

    def verify_email_code(self, email: str, code: str) -> bool:
        """이메일 인증 코드 검증"""
        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("""
                SELECT id, expires_at FROM email_verifications
                WHERE email = %s AND code = %s AND verified = FALSE
                ORDER BY created_at DESC LIMIT 1
            """, (email, code))
            row = cursor.fetchone()
            if not row:
                return False
            expires_at = row['expires_at']
            if isinstance(expires_at, str):
                expires_at = datetime.fromisoformat(expires_at)
            if now_kst_naive() > expires_at:
                return False
            cursor.execute("""
                UPDATE email_verifications SET verified = TRUE WHERE id = %s
            """, (row['id'],))
            return True

    def is_email_verified(self, email: str, within_minutes: int = 30) -> bool:
        """이메일이 최근에 인증되었는지 확인"""
        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("""
                SELECT id FROM email_verifications
                WHERE email = %s AND verified = TRUE
                AND created_at > NOW() - INTERVAL '%s minutes'
                ORDER BY created_at DESC LIMIT 1
            """, (email, within_minutes))
            return cursor.fetchone() is not None

    # ===== Email Login =====
    def get_worker_by_email(self, email: str) -> Optional[Dict]:
        """이메일로 근무자 조회"""
        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("SELECT * FROM workers WHERE email = %s", (email,))
            row = cursor.fetchone()
            return dict(row) if row else None

    def create_worker_with_email(
        self,
        email: str,
        password_hash: str,
        name: str,
        phone: str,
        birth_date: str = None,
        gender: str = None,
        residence: str = None,
        region_id: int = None,
        bank_name: str = None,
        bank_account: str = None
    ) -> int:
        """이메일로 근무자 생성"""
        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("SELECT MIN(telegram_id) FROM workers")
            result = cursor.fetchone()
            min_tid = result['min'] if result and result['min'] else 0
            new_tid = min(min_tid, 0) - 1
            cursor.execute("""
                INSERT INTO workers (email, password_hash, name, phone, telegram_id,
                                    birth_date, gender, residence, region_id, bank_name, bank_account)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
            """, (email, password_hash, name, phone, new_tid,
                  birth_date, gender, residence, region_id, bank_name, bank_account))
            return cursor.fetchone()['id']

    def update_worker_password(self, worker_id: int, password_hash: str):
        """비밀번호 변경"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE workers SET password_hash = %s, updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
            """, (password_hash, worker_id))

    # ===== Admin Management =====
    def set_worker_admin(self, worker_id: int, is_admin: bool):
        """관리자 권한 설정"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE workers SET is_admin = %s, updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
            """, (is_admin, worker_id))

    def is_worker_admin(self, worker_id: int) -> bool:
        """workers 테이블에서 관리자 여부 확인"""
        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("SELECT is_admin FROM workers WHERE id = %s", (worker_id,))
            row = cursor.fetchone()
            return bool(row and row['is_admin'])

    def is_email_admin(self, email: str) -> bool:
        """이메일로 관리자 여부 확인"""
        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("SELECT is_admin FROM workers WHERE email = %s", (email,))
            row = cursor.fetchone()
            return bool(row and row['is_admin'])

    def get_all_workers(self, limit: int = 100, offset: int = 0) -> List[Dict]:
        """모든 근무자 목록"""
        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("""
                SELECT * FROM workers
                ORDER BY created_at DESC
                LIMIT %s OFFSET %s
            """, (limit, offset))
            return [dict(row) for row in cursor.fetchall()]

    # ===== 빅데이터 분석용 메서드 =====

    def create_region(self, sido: str, sigungu: str, dong: str = None,
                      lat: float = None, lng: float = None) -> int:
        """지역 생성"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO regions (sido, sigungu, dong, lat, lng)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id
            """, (sido, sigungu, dong, lat, lng))
            return cursor.fetchone()[0]

    def get_regions(self, sido: str = None) -> List[Dict]:
        """지역 목록 조회"""
        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            if sido:
                cursor.execute("""
                    SELECT * FROM regions WHERE sido = %s
                    ORDER BY sigungu, dong
                """, (sido,))
            else:
                cursor.execute("SELECT * FROM regions ORDER BY sido, sigungu, dong")
            return [dict(row) for row in cursor.fetchall()]

    def get_region(self, region_id: int) -> Optional[Dict]:
        """지역 조회"""
        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("SELECT * FROM regions WHERE id = %s", (region_id,))
            row = cursor.fetchone()
            return dict(row) if row else None

    def create_job_category(self, name: str, parent_id: int = None,
                            avg_pay: int = None, description: str = None) -> int:
        """업종 생성"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO job_categories (name, parent_id, avg_pay, description)
                VALUES (%s, %s, %s, %s)
                RETURNING id
            """, (name, parent_id, avg_pay, description))
            return cursor.fetchone()[0]

    def get_job_categories(self, parent_id: int = None) -> List[Dict]:
        """업종 목록 조회"""
        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            if parent_id is not None:
                cursor.execute("""
                    SELECT * FROM job_categories WHERE parent_id = %s
                    ORDER BY name
                """, (parent_id,))
            else:
                cursor.execute("SELECT * FROM job_categories ORDER BY name")
            return [dict(row) for row in cursor.fetchall()]

    def get_job_category(self, category_id: int) -> Optional[Dict]:
        """업종 조회"""
        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("SELECT * FROM job_categories WHERE id = %s", (category_id,))
            row = cursor.fetchone()
            return dict(row) if row else None

    def create_skill(self, name: str, category: str = None, description: str = None) -> int:
        """기술/자격증 생성"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO skills (name, category, description)
                VALUES (%s, %s, %s)
                RETURNING id
            """, (name, category, description))
            return cursor.fetchone()[0]

    def get_skills(self, category: str = None) -> List[Dict]:
        """기술/자격증 목록 조회"""
        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            if category:
                cursor.execute("""
                    SELECT * FROM skills WHERE category = %s
                    ORDER BY name
                """, (category,))
            else:
                cursor.execute("SELECT * FROM skills ORDER BY category, name")
            return [dict(row) for row in cursor.fetchall()]

    def add_worker_skill(self, worker_id: int, skill_id: int, acquired_date: str = None) -> bool:
        """근무자 기술 추가"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO worker_skills (worker_id, skill_id, acquired_date)
                    VALUES (%s, %s, %s)
                """, (worker_id, skill_id, acquired_date))
                return True
        except psycopg2.IntegrityError:
            return False

    def get_worker_skills(self, worker_id: int) -> List[Dict]:
        """근무자 기술 목록"""
        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("""
                SELECT ws.*, s.name, s.category
                FROM worker_skills ws
                JOIN skills s ON ws.skill_id = s.id
                WHERE ws.worker_id = %s
            """, (worker_id,))
            return [dict(row) for row in cursor.fetchall()]

    def log_worker_change(self, worker_id: int, field_name: str,
                          old_value: str, new_value: str, changed_by: int = None):
        """근무자 정보 변경 기록"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO worker_history (worker_id, field_name, old_value, new_value, changed_by)
                VALUES (%s, %s, %s, %s, %s)
            """, (worker_id, field_name, str(old_value) if old_value else None,
                  str(new_value) if new_value else None, changed_by))

    def get_worker_history(self, worker_id: int, limit: int = 50) -> List[Dict]:
        """근무자 변경 이력 조회"""
        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("""
                SELECT * FROM worker_history
                WHERE worker_id = %s
                ORDER BY changed_at DESC
                LIMIT %s
            """, (worker_id, limit))
            return [dict(row) for row in cursor.fetchall()]

    def log_application_status_change(self, application_id: int, old_status: str,
                                       new_status: str, changed_by: int = None, reason: str = None):
        """지원 상태 변경 기록"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO application_status_history
                (application_id, old_status, new_status, changed_by, reason)
                VALUES (%s, %s, %s, %s, %s)
            """, (application_id, old_status, new_status, changed_by, reason))

    def get_application_history(self, application_id: int) -> List[Dict]:
        """지원 상태 변경 이력"""
        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("""
                SELECT * FROM application_status_history
                WHERE application_id = %s
                ORDER BY changed_at ASC
            """, (application_id,))
            return [dict(row) for row in cursor.fetchall()]

    def create_rating(self, attendance_id: int, rater_type: str,
                      rating: int, feedback: str = None) -> int:
        """평가 생성"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO ratings (attendance_id, rater_type, rating, feedback)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (attendance_id, rater_type) DO UPDATE
                SET rating = EXCLUDED.rating, feedback = EXCLUDED.feedback
                RETURNING id
            """, (attendance_id, rater_type, rating, feedback))
            return cursor.fetchone()[0]

    def get_ratings_by_attendance(self, attendance_id: int) -> List[Dict]:
        """출석별 평가 조회"""
        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("""
                SELECT * FROM ratings WHERE attendance_id = %s
            """, (attendance_id,))
            return [dict(row) for row in cursor.fetchall()]

    def get_worker_ratings(self, worker_id: int) -> Dict:
        """근무자 평가 통계"""
        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("""
                SELECT
                    COUNT(*) as total_ratings,
                    AVG(r.rating) as avg_rating,
                    SUM(CASE WHEN r.rating >= 4 THEN 1 ELSE 0 END) as good_ratings,
                    SUM(CASE WHEN r.rating <= 2 THEN 1 ELSE 0 END) as bad_ratings
                FROM ratings r
                JOIN attendance a ON r.attendance_id = a.id
                WHERE a.worker_id = %s AND r.rater_type = 'MANAGER'
            """, (worker_id,))
            row = cursor.fetchone()
            return dict(row) if row else {}

    def upsert_worker_monthly_stats(self, worker_id: int, year: int, month: int, **kwargs):
        """근무자 월별 통계 업데이트"""
        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("""
                SELECT id FROM worker_monthly_stats
                WHERE worker_id = %s AND year = %s AND month = %s
            """, (worker_id, year, month))
            existing = cursor.fetchone()

            if existing:
                updates = []
                values = []
                for key, value in kwargs.items():
                    updates.append(f"{key} = %s")
                    values.append(value)
                if updates:
                    values.extend([now_kst_naive(), existing['id']])
                    cursor.execute(f"""
                        UPDATE worker_monthly_stats
                        SET {', '.join(updates)}, updated_at = %s
                        WHERE id = %s
                    """, values)
            else:
                cols = ['worker_id', 'year', 'month'] + list(kwargs.keys())
                vals = [worker_id, year, month] + list(kwargs.values())
                placeholders = ', '.join(['%s'] * len(cols))
                cursor.execute(f"""
                    INSERT INTO worker_monthly_stats ({', '.join(cols)})
                    VALUES ({placeholders})
                """, vals)

    def get_worker_monthly_stats(self, worker_id: int, year: int = None, month: int = None) -> List[Dict]:
        """근무자 월별 통계 조회"""
        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            if year and month:
                cursor.execute("""
                    SELECT * FROM worker_monthly_stats
                    WHERE worker_id = %s AND year = %s AND month = %s
                """, (worker_id, year, month))
            elif year:
                cursor.execute("""
                    SELECT * FROM worker_monthly_stats
                    WHERE worker_id = %s AND year = %s
                    ORDER BY month
                """, (worker_id, year))
            else:
                cursor.execute("""
                    SELECT * FROM worker_monthly_stats
                    WHERE worker_id = %s
                    ORDER BY year DESC, month DESC
                    LIMIT 12
                """, (worker_id,))
            return [dict(row) for row in cursor.fetchall()]

    def calculate_worker_monthly_stats(self, worker_id: int, year: int, month: int) -> Dict:
        """근무자 월별 통계 계산"""
        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)

            cursor.execute("""
                SELECT
                    COUNT(*) as worked_events,
                    SUM(COALESCE(worked_minutes, 0)) as total_minutes,
                    SUM(CASE WHEN late_minutes = 0 THEN 1 ELSE 0 END) as on_time_count,
                    SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_count,
                    SUM(CASE WHEN cancel_type = 'NO_SHOW' THEN 1 ELSE 0 END) as no_show_count,
                    SUM(CASE WHEN cancel_type IN ('SAMEDAY', 'ADVANCE') THEN 1 ELSE 0 END) as cancel_count
                FROM attendance a
                JOIN events e ON a.event_id = e.id
                WHERE a.worker_id = %s
                  AND EXTRACT(YEAR FROM e.event_date::date) = %s
                  AND EXTRACT(MONTH FROM e.event_date::date) = %s
            """, (worker_id, year, month))
            att_stats = cursor.fetchone()

            cursor.execute("""
                SELECT SUM(e.pay_amount) as total_earnings
                FROM attendance a
                JOIN events e ON a.event_id = e.id
                WHERE a.worker_id = %s AND a.status = 'COMPLETED'
                  AND EXTRACT(YEAR FROM e.event_date::date) = %s
                  AND EXTRACT(MONTH FROM e.event_date::date) = %s
            """, (worker_id, year, month))
            earnings = cursor.fetchone()

            cursor.execute("""
                SELECT AVG(r.rating) as avg_rating
                FROM ratings r
                JOIN attendance a ON r.attendance_id = a.id
                JOIN events e ON a.event_id = e.id
                WHERE a.worker_id = %s AND r.rater_type = 'MANAGER'
                  AND EXTRACT(YEAR FROM e.event_date::date) = %s
                  AND EXTRACT(MONTH FROM e.event_date::date) = %s
            """, (worker_id, year, month))
            rating = cursor.fetchone()

            worked_events = att_stats['worked_events'] or 0
            total_minutes = att_stats['total_minutes'] or 0
            on_time_count = att_stats['on_time_count'] or 0
            completed_count = att_stats['completed_count'] or 0

            stats = {
                'worked_events': worked_events,
                'worked_hours': total_minutes // 60,
                'total_earnings': earnings['total_earnings'] or 0,
                'on_time_rate': round(on_time_count / worked_events * 100, 1) if worked_events > 0 else 100,
                'completion_rate': round(completed_count / worked_events * 100, 1) if worked_events > 0 else 100,
                'avg_rating': round(rating['avg_rating'], 1) if rating['avg_rating'] else None,
                'cancellation_count': att_stats['cancel_count'] or 0,
                'no_show_count': att_stats['no_show_count'] or 0
            }

            self.upsert_worker_monthly_stats(worker_id, year, month, **stats)
            return stats

    def update_worker_cumulative_stats(self, worker_id: int):
        """근무자 누적 통계 업데이트"""
        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)

            cursor.execute("""
                SELECT
                    COUNT(*) as total_events,
                    SUM(COALESCE(worked_minutes, 0)) / 60 as total_hours,
                    MIN(e.event_date) as first_date,
                    MAX(e.event_date) as last_date,
                    SUM(CASE WHEN cancel_type = 'NO_SHOW' THEN 1 ELSE 0 END) as no_shows,
                    SUM(CASE WHEN cancel_type = 'SAMEDAY' THEN 1 ELSE 0 END) as same_day_cancels
                FROM attendance a
                JOIN events e ON a.event_id = e.id
                WHERE a.worker_id = %s
            """, (worker_id,))
            stats = cursor.fetchone()

            total_events = stats['total_events'] or 0
            no_shows = stats['no_shows'] or 0
            same_day_cancels = stats['same_day_cancels'] or 0

            reliability = 50 + (total_events * 2)
            reliability -= no_shows * 10
            reliability -= same_day_cancels * 5
            reliability = max(0, min(100, reliability))

            cursor.execute("""
                UPDATE workers SET
                    total_worked_events = %s,
                    total_worked_hours = %s,
                    first_work_date = %s,
                    last_work_date = %s,
                    no_show_count = %s,
                    same_day_cancel_count = %s,
                    reliability_score = %s,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
            """, (total_events, stats['total_hours'] or 0, stats['first_date'],
                  stats['last_date'], no_shows, same_day_cancels, reliability, worker_id))

    def get_analytics_summary(self, year: int = None, month: int = None) -> Dict:
        """분석 요약 데이터"""
        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)

            date_condition = ""
            params = []
            if year and month:
                date_condition = "AND EXTRACT(YEAR FROM e.event_date::date) = %s AND EXTRACT(MONTH FROM e.event_date::date) = %s"
                params = [year, month]
            elif year:
                date_condition = "AND EXTRACT(YEAR FROM e.event_date::date) = %s"
                params = [year]

            cursor.execute(f"""
                SELECT
                    COUNT(DISTINCT e.id) as total_events,
                    COUNT(DISTINCT a.worker_id) as active_workers,
                    SUM(CASE WHEN a.status = 'COMPLETED' THEN e.pay_amount ELSE 0 END) as total_revenue,
                    AVG(e.pay_amount) as avg_pay,
                    COUNT(CASE WHEN a.status = 'COMPLETED' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0) as completion_rate
                FROM events e
                LEFT JOIN attendance a ON e.id = a.event_id
                WHERE 1=1 {date_condition}
            """, params)
            summary = dict(cursor.fetchone())

            cursor.execute(f"""
                SELECT
                    SPLIT_PART(e.location, ' ', 1) as region,
                    COUNT(DISTINCT e.id) as event_count,
                    COUNT(DISTINCT a.worker_id) as worker_count,
                    AVG(e.pay_amount) as avg_pay
                FROM events e
                LEFT JOIN attendance a ON e.id = a.event_id
                WHERE 1=1 {date_condition}
                GROUP BY region
                ORDER BY event_count DESC
                LIMIT 10
            """, params)
            summary['by_region'] = [dict(row) for row in cursor.fetchall()]

            cursor.execute(f"""
                SELECT
                    CASE EXTRACT(DOW FROM e.event_date::date)
                        WHEN 0 THEN '일'
                        WHEN 1 THEN '월'
                        WHEN 2 THEN '화'
                        WHEN 3 THEN '수'
                        WHEN 4 THEN '목'
                        WHEN 5 THEN '금'
                        WHEN 6 THEN '토'
                    END as day_of_week,
                    COUNT(DISTINCT e.id) as event_count
                FROM events e
                WHERE 1=1 {date_condition}
                GROUP BY EXTRACT(DOW FROM e.event_date::date)
                ORDER BY EXTRACT(DOW FROM e.event_date::date)
            """, params)
            summary['by_day_of_week'] = [dict(row) for row in cursor.fetchall()]

            return summary

    def get_worker_analytics(self, worker_id: int) -> Dict:
        """개인 근무자 분석 데이터"""
        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)

            cursor.execute("SELECT * FROM workers WHERE id = %s", (worker_id,))
            worker_row = cursor.fetchone()
            worker = dict(worker_row) if worker_row else {}

            cursor.execute("""
                SELECT * FROM worker_monthly_stats
                WHERE worker_id = %s
                ORDER BY year DESC, month DESC
                LIMIT 6
            """, (worker_id,))
            monthly_trend = [dict(row) for row in cursor.fetchall()]

            rating_stats = self.get_worker_ratings(worker_id)

            cursor.execute("""
                SELECT
                    COALESCE(jc.name, '기타') as category,
                    COUNT(*) as count
                FROM attendance a
                JOIN events e ON a.event_id = e.id
                LEFT JOIN job_categories jc ON e.category_id = jc.id
                WHERE a.worker_id = %s AND a.status = 'COMPLETED'
                GROUP BY jc.id, jc.name
                ORDER BY count DESC
            """, (worker_id,))
            by_category = [dict(row) for row in cursor.fetchall()]

            return {
                'worker': worker,
                'monthly_trend': monthly_trend,
                'rating_stats': rating_stats,
                'by_category': by_category
            }

    # ===== Worker Badges (성과 배지 / NFT) =====
    def get_worker_badges(self, worker_id: int) -> List[Dict]:
        """근무자의 모든 배지 조회"""
        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("""
                SELECT * FROM worker_badges
                WHERE worker_id = %s
                ORDER BY earned_at DESC
            """, (worker_id,))
            return [dict(row) for row in cursor.fetchall()]

    def get_badge_by_id(self, badge_id: int) -> Optional[Dict]:
        """배지 ID로 배지 조회"""
        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("""
                SELECT * FROM worker_badges WHERE id = %s
            """, (badge_id,))
            row = cursor.fetchone()
            return dict(row) if row else None

    def has_badge(self, worker_id: int, badge_type: str, badge_level: int = 1) -> bool:
        """특정 배지 보유 여부 확인"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT 1 FROM worker_badges
                WHERE worker_id = %s AND badge_type = %s AND badge_level = %s
            """, (worker_id, badge_type, badge_level))
            return cursor.fetchone() is not None

    def award_badge(self, worker_id: int, badge_type: str, title: str,
                    description: str = None, icon: str = None,
                    badge_level: int = 1, tx_hash: str = None,
                    is_nft: bool = False, metadata: dict = None) -> Optional[int]:
        """배지 발급 (이미 있으면 None 반환)"""
        if self.has_badge(worker_id, badge_type, badge_level):
            return None

        with self.get_connection() as conn:
            cursor = conn.cursor()
            import json
            cursor.execute("""
                INSERT INTO worker_badges
                (worker_id, badge_type, badge_level, title, description, icon, tx_hash, is_nft, metadata)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
            """, (worker_id, badge_type, badge_level, title, description, icon,
                  tx_hash, is_nft, json.dumps(metadata) if metadata else None))
            return cursor.fetchone()[0]

    def get_worker_badge_summary(self, worker_id: int) -> Dict:
        """근무자 배지 요약 (총 개수, 최근 배지 등)"""
        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)

            # 총 배지 수
            cursor.execute("""
                SELECT COUNT(*) as total_badges FROM worker_badges WHERE worker_id = %s
            """, (worker_id,))
            total = cursor.fetchone()["total_badges"]

            # 최근 획득 배지 3개
            cursor.execute("""
                SELECT * FROM worker_badges
                WHERE worker_id = %s
                ORDER BY earned_at DESC
                LIMIT 3
            """, (worker_id,))
            recent = [dict(row) for row in cursor.fetchall()]

            return {
                "total_badges": total,
                "recent_badges": recent
            }

    def get_worker_stats_for_badges(self, worker_id: int) -> Dict:
        """배지 발급 조건 확인용 근무자 통계"""
        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)

            # 총 근무 횟수 (완료된 출퇴근)
            cursor.execute("""
                SELECT COUNT(*) as total_work_count
                FROM attendance
                WHERE worker_id = %s AND check_out_time IS NOT NULL
            """, (worker_id,))
            total_work = cursor.fetchone()["total_work_count"]

            # 노쇼 없이 완료한 횟수
            cursor.execute("""
                SELECT COUNT(*) as perfect_attendance
                FROM applications ap
                JOIN attendance at ON ap.worker_id = at.worker_id AND ap.event_id = at.event_id
                WHERE ap.worker_id = %s AND ap.status = 'CONFIRMED' AND at.check_out_time IS NOT NULL
            """, (worker_id,))
            perfect = cursor.fetchone()["perfect_attendance"]

            # 블록체인 기록 수
            cursor.execute("""
                SELECT COUNT(*) as blockchain_records
                FROM chain_logs cl
                JOIN attendance a ON cl.attendance_id = a.id
                WHERE a.worker_id = %s
            """, (worker_id,))
            blockchain = cursor.fetchone()["blockchain_records"]

            # 평균 평점
            cursor.execute("""
                SELECT AVG(r.rating) as avg_rating, COUNT(r.id) as rating_count
                FROM ratings r
                JOIN attendance a ON r.attendance_id = a.id
                WHERE a.worker_id = %s
            """, (worker_id,))
            rating_row = cursor.fetchone()
            avg_rating = float(rating_row["avg_rating"]) if rating_row["avg_rating"] else 0
            rating_count = rating_row["rating_count"] or 0

            return {
                "total_work_count": total_work,
                "perfect_attendance": perfect,
                "blockchain_records": blockchain,
                "avg_rating": avg_rating,
                "rating_count": rating_count
            }

    # ===== Project NFT Batches =====
    def create_nft_batch(self, event_id: int, title: str, description: str = None,
                         template_type: str = 'cert', issued_by: int = None,
                         metadata: dict = None) -> int:
        """프로젝트 NFT 배치 생성"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            import json
            cursor.execute("""
                INSERT INTO project_nft_batches
                (event_id, title, description, template_type, issued_by, metadata)
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING id
            """, (event_id, title, description, template_type, issued_by,
                  json.dumps(metadata) if metadata else None))
            return cursor.fetchone()[0]

    def update_batch_count(self, batch_id: int, count: int):
        """배치 발급 수량 업데이트"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE project_nft_batches SET total_issued = %s WHERE id = %s
            """, (count, batch_id))

    def get_event_batches(self, event_id: int) -> List[Dict]:
        """이벤트의 NFT 배치 목록"""
        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("""
                SELECT * FROM project_nft_batches WHERE event_id = %s ORDER BY issued_at DESC
            """, (event_id,))
            return [dict(row) for row in cursor.fetchall()]

    def award_project_badge(self, worker_id: int, event_id: int, batch_id: int,
                            title: str, description: str = None, icon: str = None,
                            template_type: str = 'cert', image_url: str = None,
                            metadata: dict = None) -> Optional[int]:
        """프로젝트 배지 발급 (이벤트당 1개)"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            import json
            # 이미 해당 이벤트에서 배지를 받았는지 확인
            cursor.execute("""
                SELECT id FROM worker_badges
                WHERE worker_id = %s AND event_id = %s AND badge_type = 'PROJECT'
            """, (worker_id, event_id))
            if cursor.fetchone():
                return None

            cursor.execute("""
                INSERT INTO worker_badges
                (worker_id, badge_type, badge_level, title, description, icon,
                 event_id, batch_id, template_type, image_url, is_nft, metadata)
                VALUES (%s, 'PROJECT', 1, %s, %s, %s, %s, %s, %s, %s, TRUE, %s)
                RETURNING id
            """, (worker_id, title, description, icon, event_id, batch_id,
                  template_type, image_url, json.dumps(metadata) if metadata else None))
            return cursor.fetchone()[0]

    def get_completed_events(self, limit: int = 50) -> List[Dict]:
        """종료된 이벤트 목록 (배지 발급용)"""
        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("""
                SELECT e.*,
                       (SELECT COUNT(*) FROM attendance a WHERE a.event_id = e.id AND a.check_out_time IS NOT NULL) as completed_workers,
                       (SELECT COUNT(*) FROM project_nft_batches b WHERE b.event_id = e.id) as batch_count
                FROM events e
                WHERE e.status = 'COMPLETED'
                ORDER BY e.updated_at DESC
                LIMIT %s
            """, (limit,))
            return [dict(row) for row in cursor.fetchall()]

    def get_event_eligible_workers(self, event_id: int) -> List[Dict]:
        """이벤트의 배지 발급 대상 근무자 (출퇴근 완료자)"""
        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("""
                SELECT w.*, a.check_in_time, a.check_out_time, a.id as attendance_id,
                       (SELECT COUNT(*) FROM worker_badges wb WHERE wb.worker_id = w.id AND wb.event_id = %s) as has_project_badge
                FROM workers w
                JOIN attendance a ON w.id = a.worker_id
                WHERE a.event_id = %s AND a.check_out_time IS NOT NULL
                ORDER BY a.check_out_time DESC
            """, (event_id, event_id))
            return [dict(row) for row in cursor.fetchall()]

    # ===== Audit Logs =====
    def create_audit_log(self, action: str, entity_type: str, entity_id: int = None,
                         actor_id: int = None, actor_type: str = None, details: dict = None):
        """감사 로그 생성"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            import json
            cursor.execute("""
                INSERT INTO audit_logs (action, entity_type, entity_id, actor_id, actor_type, details)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (action, entity_type, entity_id, actor_id, actor_type,
                  json.dumps(details) if details else None))

    def revoke_badge(self, badge_id: int, reason: str, actor_id: int) -> bool:
        """배지 취소 (삭제가 아닌 상태 변경)"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE worker_badges SET status = 'REVOKED', revoke_reason = %s
                WHERE id = %s AND status = 'ACTIVE'
            """, (reason, badge_id))
            if cursor.rowcount > 0:
                self.create_audit_log(
                    action='BADGE_REVOKED',
                    entity_type='worker_badges',
                    entity_id=badge_id,
                    actor_id=actor_id,
                    actor_type='ADMIN',
                    details={'reason': reason}
                )
                return True
            return False

    def get_workers_with_badges_summary(self, limit: int = 100) -> List[Dict]:
        """관리자용: 근무자별 배지 요약 포함 목록"""
        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("""
                SELECT w.*,
                       COALESCE(badge_info.badge_count, 0) as badge_count,
                       badge_info.top_badges
                FROM workers w
                LEFT JOIN LATERAL (
                    SELECT
                        COUNT(*) as badge_count,
                        json_agg(json_build_object('icon', icon, 'title', title) ORDER BY earned_at DESC) FILTER (WHERE icon IS NOT NULL) as top_badges
                    FROM (
                        SELECT icon, title, earned_at
                        FROM worker_badges
                        WHERE worker_id = w.id AND status = 'ACTIVE'
                        ORDER BY earned_at DESC
                        LIMIT 3
                    ) sub
                ) badge_info ON true
                ORDER BY badge_info.badge_count DESC NULLS LAST, w.created_at DESC
                LIMIT %s
            """, (limit,))
            return [dict(row) for row in cursor.fetchall()]

    def get_next_badge_progress(self, worker_id: int) -> Optional[Dict]:
        """다음 배지까지의 진행률"""
        stats = self.get_worker_stats_for_badges(worker_id)
        badges = self.get_worker_badges(worker_id)
        earned_types = {(b['badge_type'], b['badge_level']) for b in badges}

        # 근무 횟수 배지 진행률
        work_thresholds = [(1, 1), (2, 10), (3, 50), (4, 100)]
        for level, threshold in work_thresholds:
            if ('WORK_COUNT', level) not in earned_types:
                return {
                    'badge_type': 'WORK_COUNT',
                    'badge_level': level,
                    'title': f'{threshold}회 근무 달성',
                    'current': stats['total_work_count'],
                    'target': threshold,
                    'progress': min(100, int(stats['total_work_count'] / threshold * 100))
                }

        # 신뢰도 배지 진행률
        trust_thresholds = [(1, 10), (2, 30), (3, 50)]
        for level, threshold in trust_thresholds:
            if ('TRUST', level) not in earned_types:
                return {
                    'badge_type': 'TRUST',
                    'badge_level': level,
                    'title': f'노쇼 없이 {threshold}회 근무',
                    'current': stats['perfect_attendance'],
                    'target': threshold,
                    'progress': min(100, int(stats['perfect_attendance'] / threshold * 100))
                }

        return None  # 모든 배지 획득 완료

    # ==================== Location & GPS Methods ====================

    def update_event_location(self, event_id: int, address: str, latitude: float,
                             longitude: float, radius: int = 100):
        """행사 위치 정보 업데이트"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE events
                SET location_address = %s,
                    location_lat = %s,
                    location_lng = %s,
                    location_radius = %s
                WHERE id = %s
            """, (address, latitude, longitude, radius, event_id))
            conn.commit()

    def save_worker_location(self, worker_id: int, event_id: int,
                            latitude: float, longitude: float):
        """근무자 GPS 위치 저장"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            # 최근 10분 이내 위치 정보만 유지하고 새로운 위치 추가
            cursor.execute("""
                INSERT INTO worker_locations (worker_id, event_id, latitude, longitude)
                VALUES (%s, %s, %s, %s)
            """, (worker_id, event_id, latitude, longitude))
            conn.commit()

    def get_worker_location(self, worker_id: int, event_id: int) -> Optional[Dict]:
        """근무자의 최근 위치 정보 조회"""
        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("""
                SELECT * FROM worker_locations
                WHERE worker_id = %s AND event_id = %s
                ORDER BY updated_at DESC
                LIMIT 1
            """, (worker_id, event_id))
            result = cursor.fetchone()
            return dict(result) if result else None

    def calculate_distance(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """
        두 GPS 좌표 간의 거리 계산 (Haversine formula)
        Returns: 거리 (미터)
        """
        from math import radians, cos, sin, asin, sqrt

        # 지구 반지름 (미터)
        R = 6371000

        # 라디안으로 변환
        lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])

        # Haversine formula
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
        c = 2 * asin(sqrt(a))

        return R * c

    def get_nearby_workers(self, event_id: int) -> List[Dict]:
        """
        행사 위치 근처에 있는 근무자 목록 조회
        Returns: 범위 내 근무자 정보 (거리 포함)
        """
        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)

            # 행사 위치 정보 가져오기
            cursor.execute("""
                SELECT location_lat, location_lng, location_radius
                FROM events WHERE id = %s
            """, (event_id,))
            event_location = cursor.fetchone()

            if not event_location or not event_location['location_lat']:
                return []

            event_lat = float(event_location['location_lat'])
            event_lng = float(event_location['location_lng'])
            radius = event_location['location_radius'] or 100

            # 해당 행사에 지원한 근무자들의 최근 위치 정보 가져오기
            cursor.execute("""
                SELECT
                    wl.worker_id,
                    wl.latitude,
                    wl.longitude,
                    wl.updated_at,
                    w.name as worker_name,
                    w.phone as worker_phone,
                    a.check_in_time,
                    a.check_out_time
                FROM worker_locations wl
                JOIN workers w ON wl.worker_id = w.id
                JOIN applications app ON app.worker_id = w.id AND app.event_id = %s
                LEFT JOIN attendance a ON a.worker_id = w.id AND a.event_id = %s
                WHERE wl.event_id = %s
                    AND wl.updated_at > NOW() - INTERVAL '10 minutes'
                ORDER BY wl.updated_at DESC
            """, (event_id, event_id, event_id))

            workers = []
            for row in cursor.fetchall():
                worker = dict(row)

                # 거리 계산
                distance = self.calculate_distance(
                    event_lat, event_lng,
                    float(worker['latitude']), float(worker['longitude'])
                )

                worker['distance_meters'] = int(distance)
                worker['within_range'] = distance <= radius

                workers.append(worker)

            # 거리순으로 정렬
            workers.sort(key=lambda x: x['distance_meters'])

            return workers

    def create_attendance_approval(self, worker_id: int, event_id: int,
                                   approval_type: str, distance_meters: int = None) -> int:
        """출근 승인 요청 생성"""
        with self.get_connection() as conn:
            cursor = conn.cursor()

            # 먼저 출석 기록 생성 (pending 상태)
            cursor.execute("""
                INSERT INTO attendance (worker_id, event_id, status)
                VALUES (%s, %s, 'pending')
                ON CONFLICT (worker_id, event_id)
                DO UPDATE SET status = 'pending'
                RETURNING id
            """, (worker_id, event_id))
            attendance_id = cursor.fetchone()[0]

            # 승인 요청 생성
            cursor.execute("""
                INSERT INTO attendance_approvals
                (attendance_id, worker_id, event_id, approval_type, distance_meters, status)
                VALUES (%s, %s, %s, %s, %s, 'pending')
                RETURNING id
            """, (attendance_id, worker_id, event_id, approval_type, distance_meters))

            approval_id = cursor.fetchone()[0]
            conn.commit()
            return approval_id

    def get_pending_approvals(self, event_id: int) -> List[Dict]:
        """행사의 대기 중인 승인 요청 목록"""
        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("""
                SELECT
                    aa.*,
                    w.name as worker_name,
                    w.phone as worker_phone,
                    a.check_in_time,
                    a.check_out_time
                FROM attendance_approvals aa
                JOIN workers w ON aa.worker_id = w.id
                JOIN attendance a ON aa.attendance_id = a.id
                WHERE aa.event_id = %s AND aa.status = 'pending'
                ORDER BY aa.created_at ASC
            """, (event_id,))

            results = cursor.fetchall()
            return [dict(row) for row in results]

    def approve_attendance(self, approval_id: int, admin_id: int,
                          check_in_time = None) -> bool:
        """출근 승인 처리"""
        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)

            # 승인 정보 가져오기
            cursor.execute("""
                SELECT attendance_id, worker_id, event_id
                FROM attendance_approvals
                WHERE id = %s
            """, (approval_id,))
            approval = cursor.fetchone()

            if not approval:
                return False

            # 승인 상태 업데이트
            cursor.execute("""
                UPDATE attendance_approvals
                SET status = 'approved',
                    approved_by = %s,
                    approved_at = NOW()
                WHERE id = %s
            """, (admin_id, approval_id))

            # 출석 기록 업데이트
            if check_in_time is None:
                check_in_time = now_kst_naive()

            cursor.execute("""
                UPDATE attendance
                SET check_in_time = %s,
                    status = 'present'
                WHERE id = %s
            """, (check_in_time, approval['attendance_id']))

            conn.commit()
            return True

    def batch_approve_attendances(self, approval_ids: List[int], admin_id: int) -> int:
        """일괄 출근 승인 처리"""
        approved_count = 0
        for approval_id in approval_ids:
            if self.approve_attendance(approval_id, admin_id):
                approved_count += 1
        return approved_count

    def generate_qr_code_for_event(self, event_id: int) -> str:
        """행사용 QR 코드 생성 (시간 기반 토큰)"""
        import hashlib
        import time

        # 5분마다 변경되는 토큰 생성
        timestamp = int(time.time() / 300)  # 5분 단위
        token = f"{event_id}:{timestamp}:{os.getenv('SECRET_KEY', 'default-secret')}"
        qr_code = hashlib.sha256(token.encode()).hexdigest()[:16]

        # DB에 저장
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE events
                SET qr_code = %s
                WHERE id = %s
            """, (qr_code, event_id))
            conn.commit()

        return qr_code

    def verify_qr_code(self, event_id: int, qr_code: str) -> bool:
        """QR 코드 검증 (시간 기반 토큰, 5분 유효)"""
        import hashlib
        import time

        # 현재 토큰과 이전 토큰(5분 전) 모두 허용
        current_timestamp = int(time.time() / 300)

        for offset in [0, -1]:  # 현재 시간과 5분 전
            timestamp = current_timestamp + offset
            token = f"{event_id}:{timestamp}:{os.getenv('SECRET_KEY', 'default-secret')}"
            expected_qr = hashlib.sha256(token.encode()).hexdigest()[:16]

            if qr_code == expected_qr:
                return True

        return False
