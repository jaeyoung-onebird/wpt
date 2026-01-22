"""
데이터베이스 접근 레이어
"""
import sqlite3
import os
from typing import Optional, List, Dict, Any
from datetime import datetime
import logging
from contextlib import contextmanager

logger = logging.getLogger(__name__)


class Database:
    """SQLite 데이터베이스 관리 클래스"""

    def __init__(self, db_path: str):
        self.db_path = db_path
        self._ensure_db_exists()
        self._init_tables()

    def _ensure_db_exists(self):
        """DB 파일 및 디렉토리 생성"""
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)

    @contextmanager
    def get_connection(self):
        """DB 연결 컨텍스트 매니저"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
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
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    telegram_id INTEGER UNIQUE NOT NULL,
                    name TEXT NOT NULL,
                    birth_date TEXT,
                    phone TEXT NOT NULL,
                    driver_license BOOLEAN DEFAULT 0,
                    security_cert BOOLEAN DEFAULT 0,
                    ssn TEXT,
                    bank_name TEXT,
                    bank_account TEXT,
                    contract_signed BOOLEAN DEFAULT 0,
                    contract_sent_at TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # Events 테이블
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    short_code TEXT UNIQUE NOT NULL,
                    title TEXT NOT NULL,
                    event_date TEXT NOT NULL,
                    event_time TEXT,
                    location TEXT NOT NULL,
                    pay_amount INTEGER NOT NULL,
                    pay_description TEXT,
                    meal_provided BOOLEAN DEFAULT 0,
                    dress_code TEXT,
                    age_requirement TEXT,
                    application_method TEXT,
                    manager_name TEXT,
                    manager_phone TEXT,
                    status TEXT DEFAULT 'OPEN',
                    created_by INTEGER,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # Applications 테이블
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS applications (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    event_id INTEGER NOT NULL,
                    worker_id INTEGER NOT NULL,
                    status TEXT DEFAULT 'PENDING',
                    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    confirmed_at TIMESTAMP,
                    confirmed_by INTEGER,
                    rejection_reason TEXT,
                    notified BOOLEAN DEFAULT 0,
                    UNIQUE(event_id, worker_id),
                    FOREIGN KEY(event_id) REFERENCES events(id),
                    FOREIGN KEY(worker_id) REFERENCES workers(id)
                )
            """)

            # Attendance 테이블
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS attendance (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    application_id INTEGER UNIQUE NOT NULL,
                    event_id INTEGER NOT NULL,
                    worker_id INTEGER NOT NULL,
                    check_in_code TEXT,
                    check_in_time TIMESTAMP,
                    check_out_time TIMESTAMP,
                    worked_minutes INTEGER,
                    status TEXT DEFAULT 'PENDING',
                    completed_by INTEGER,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(application_id) REFERENCES applications(id),
                    FOREIGN KEY(event_id) REFERENCES events(id),
                    FOREIGN KEY(worker_id) REFERENCES workers(id)
                )
            """)

            # Chain logs 테이블
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS chain_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    attendance_id INTEGER UNIQUE NOT NULL,
                    event_id INTEGER NOT NULL,
                    worker_uid_hash TEXT NOT NULL,
                    log_hash TEXT NOT NULL,
                    tx_hash TEXT,
                    block_number INTEGER,
                    network TEXT DEFAULT 'amoy',
                    recorded_at TIMESTAMP,
                    metadata_hash TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(attendance_id) REFERENCES attendance(id),
                    FOREIGN KEY(event_id) REFERENCES events(id)
                )
            """)

            # Payroll exports 테이블
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS payroll_exports (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    event_id INTEGER NOT NULL,
                    file_path TEXT NOT NULL,
                    exported_by INTEGER NOT NULL,
                    worker_count INTEGER,
                    total_amount INTEGER,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(event_id) REFERENCES events(id)
                )
            """)

            # Admin users 테이블
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS admin_users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    telegram_id INTEGER UNIQUE NOT NULL,
                    username TEXT,
                    is_active BOOLEAN DEFAULT 1,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # Pending admin requests 테이블
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS pending_admin_requests (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    telegram_id INTEGER UNIQUE NOT NULL,
                    username TEXT,
                    first_name TEXT,
                    last_name TEXT,
                    status TEXT DEFAULT 'PENDING',
                    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    reviewed_by INTEGER,
                    reviewed_at TIMESTAMP
                )
            """)

            # 인덱스 생성
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_applications_event ON applications(event_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_applications_worker ON applications(worker_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_attendance_event ON attendance(event_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_events_short_code ON events(short_code)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_events_status ON events(status)")

            logger.info("Database tables initialized successfully")

    # ===== Workers =====
    def create_worker(self, telegram_id: int, name: str, phone: str, **kwargs) -> int:
        """근무자 생성"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO workers (telegram_id, name, phone, birth_date, residence, face_photo_file_id, driver_license, security_cert, contract_signed, ssn, bank_name, bank_account)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (telegram_id, name, phone, kwargs.get('birth_date'), kwargs.get('residence'), kwargs.get('face_photo_file_id'),
                  kwargs.get('driver_license', False), kwargs.get('security_cert', False), kwargs.get('contract_signed', False),
                  kwargs.get('ssn'), kwargs.get('bank_name'), kwargs.get('bank_account')))
            return cursor.lastrowid

    def get_worker_by_telegram_id(self, telegram_id: int) -> Optional[Dict]:
        """텔레그램 ID로 근무자 조회"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM workers WHERE telegram_id = ?", (telegram_id,))
            row = cursor.fetchone()
            return dict(row) if row else None

    def list_workers(self, limit: int = 100) -> List[Dict]:
        """모든 근무자 조회"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT * FROM workers
                ORDER BY created_at DESC
                LIMIT ?
            """, (limit,))
            return [dict(row) for row in cursor.fetchall()]

    def update_worker(self, worker_id: int, **kwargs):
        """근무자 정보 수정"""
        allowed_fields = ['name', 'birth_date', 'phone', 'residence', 'face_photo_file_id',
                          'driver_license', 'security_cert', 'ssn', 'bank_name', 'bank_account']
        updates = []
        values = []

        for field, value in kwargs.items():
            if field in allowed_fields and value is not None:
                updates.append(f"{field} = ?")
                values.append(value)

        if not updates:
            return

        values.append(datetime.now())
        values.append(worker_id)

        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(f"""
                UPDATE workers SET {', '.join(updates)}, updated_at = ?
                WHERE id = ?
            """, values)

    # ===== Events =====
    def create_event(self, short_code: str, title: str, event_date: str, location: str,
                     pay_amount: int, created_by: int, **kwargs) -> int:
        """행사 생성"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO events (
                    short_code, title, event_date, event_time, location,
                    pay_amount, pay_description, meal_provided, dress_code,
                    age_requirement, application_method, manager_name, manager_phone,
                    work_type, created_by
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                short_code, title, event_date, kwargs.get('event_time'), location,
                pay_amount, kwargs.get('pay_description'), kwargs.get('meal_provided', False),
                kwargs.get('dress_code'), kwargs.get('age_requirement'),
                kwargs.get('application_method'), kwargs.get('manager_name'),
                kwargs.get('manager_phone'), kwargs.get('work_type'), created_by
            ))
            return cursor.lastrowid

    def get_event(self, event_id: int) -> Optional[Dict]:
        """행사 조회"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM events WHERE id = ?", (event_id,))
            row = cursor.fetchone()
            return dict(row) if row else None

    def get_event_by_short_code(self, short_code: str) -> Optional[Dict]:
        """Short code로 행사 조회"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM events WHERE short_code = ?", (short_code,))
            row = cursor.fetchone()
            return dict(row) if row else None

    def list_events(self, status: Optional[str] = None, limit: int = 50) -> List[Dict]:
        """행사 목록 조회"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            if status:
                cursor.execute("""
                    SELECT * FROM events WHERE status = ?
                    ORDER BY event_date DESC, created_at DESC LIMIT ?
                """, (status, limit))
            else:
                cursor.execute("""
                    SELECT * FROM events
                    ORDER BY event_date DESC, created_at DESC LIMIT ?
                """, (limit,))
            return [dict(row) for row in cursor.fetchall()]

    def update_event_status(self, event_id: int, status: str):
        """행사 상태 변경"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE events SET status = ?, updated_at = ?
                WHERE id = ?
            """, (status, datetime.now(), event_id))

    # ===== Applications =====
    def create_application(self, event_id: int, worker_id: int) -> Optional[int]:
        """지원 생성 (중복 방지)"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO applications (event_id, worker_id)
                    VALUES (?, ?)
                """, (event_id, worker_id))
                return cursor.lastrowid
        except sqlite3.IntegrityError:
            logger.warning(f"Duplicate application: event_id={event_id}, worker_id={worker_id}")
            return None

    def get_application(self, app_id: int) -> Optional[Dict]:
        """지원 내역 조회"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
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
                WHERE a.id = ?
            """, (app_id,))
            row = cursor.fetchone()
            return dict(row) if row else None

    def list_applications_by_event(self, event_id: int, status: Optional[str] = None) -> List[Dict]:
        """행사별 지원자 목록"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            if status:
                cursor.execute("""
                    SELECT a.*, w.name, w.phone, w.telegram_id
                    FROM applications a
                    JOIN workers w ON a.worker_id = w.id
                    WHERE a.event_id = ? AND a.status = ?
                    ORDER BY a.applied_at DESC
                """, (event_id, status))
            else:
                cursor.execute("""
                    SELECT a.*, w.name, w.phone, w.telegram_id
                    FROM applications a
                    JOIN workers w ON a.worker_id = w.id
                    WHERE a.event_id = ?
                    ORDER BY a.applied_at DESC
                """, (event_id,))
            return [dict(row) for row in cursor.fetchall()]

    def list_applications_by_worker(self, worker_id: int) -> List[Dict]:
        """근무자별 지원 내역"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT a.*, e.title, e.event_date, e.location, e.pay_amount
                FROM applications a
                JOIN events e ON a.event_id = e.id
                WHERE a.worker_id = ?
                ORDER BY a.applied_at DESC
            """, (worker_id,))
            return [dict(row) for row in cursor.fetchall()]

    def update_application_status(self, app_id: int, status: str, confirmed_by: Optional[int] = None,
                                   rejection_reason: Optional[str] = None):
        """지원 상태 변경"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            if status == 'CONFIRMED':
                cursor.execute("""
                    UPDATE applications
                    SET status = ?, confirmed_at = ?, confirmed_by = ?
                    WHERE id = ?
                """, (status, datetime.now(), confirmed_by, app_id))
            elif status == 'REJECTED':
                cursor.execute("""
                    UPDATE applications
                    SET status = ?, rejection_reason = ?
                    WHERE id = ?
                """, (status, rejection_reason, app_id))
            else:
                cursor.execute("""
                    UPDATE applications SET status = ? WHERE id = ?
                """, (status, app_id))

    def mark_application_notified(self, app_id: int):
        """알림 발송 완료 표시"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("UPDATE applications SET notified = 1 WHERE id = ?", (app_id,))

    # ===== Attendance =====
    def create_attendance(self, application_id: int, event_id: int, worker_id: int, check_in_code: str) -> int:
        """출석 레코드 생성"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO attendance (application_id, event_id, worker_id, check_in_code)
                VALUES (?, ?, ?, ?)
            """, (application_id, event_id, worker_id, check_in_code))
            return cursor.lastrowid

    def get_attendance_by_code(self, check_in_code: str) -> Optional[Dict]:
        """출석코드로 조회"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM attendance WHERE check_in_code = ?", (check_in_code,))
            row = cursor.fetchone()
            return dict(row) if row else None

    def get_attendance_by_application(self, application_id: int) -> Optional[Dict]:
        """지원 ID로 출석 조회"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM attendance WHERE application_id = ?", (application_id,))
            row = cursor.fetchone()
            return dict(row) if row else None

    def check_in(self, attendance_id: int):
        """출석 처리"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE attendance
                SET check_in_time = ?, status = 'CHECKED_IN'
                WHERE id = ?
            """, (datetime.now(), attendance_id))

    def check_out(self, attendance_id: int, completed_by: int):
        """퇴근 처리"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            # 근무 시간 계산
            cursor.execute("SELECT check_in_time FROM attendance WHERE id = ?", (attendance_id,))
            row = cursor.fetchone()
            if row and row['check_in_time']:
                check_in = datetime.fromisoformat(row['check_in_time'])
                check_out = datetime.now()
                worked_minutes = int((check_out - check_in).total_seconds() / 60)

                cursor.execute("""
                    UPDATE attendance
                    SET check_out_time = ?, worked_minutes = ?, status = 'COMPLETED', completed_by = ?
                    WHERE id = ?
                """, (check_out, worked_minutes, completed_by, attendance_id))

    def list_attendance_by_event(self, event_id: int) -> List[Dict]:
        """행사별 출석 현황"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
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
                WHERE att.event_id = ?
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
                VALUES (?, ?, ?, ?, ?)
            """, (attendance_id, event_id, worker_uid_hash, log_hash, network))
            return cursor.lastrowid

    def update_chain_log_tx(self, chain_log_id: int, tx_hash: str, block_number: int):
        """블록체인 TX 정보 업데이트"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE chain_logs
                SET tx_hash = ?, block_number = ?, recorded_at = ?
                WHERE id = ?
            """, (tx_hash, block_number, datetime.now(), chain_log_id))

    def get_chain_logs_by_worker(self, worker_id: int) -> List[Dict]:
        """근무자별 블록체인 로그"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT cl.*, e.title as event_title, e.event_date, att.worked_minutes
                FROM chain_logs cl
                JOIN attendance att ON cl.attendance_id = att.id
                JOIN events e ON cl.event_id = e.id
                WHERE att.worker_id = ?
                ORDER BY cl.recorded_at DESC
            """, (worker_id,))
            return [dict(row) for row in cursor.fetchall()]

    # ===== Admin =====
    def is_admin(self, telegram_id: int) -> bool:
        """관리자 권한 확인"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT COUNT(*) as count FROM admin_users
                WHERE telegram_id = ? AND is_active = 1
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
                    VALUES (?, ?)
                """, (telegram_id, username))
        except sqlite3.IntegrityError:
            logger.warning(f"Admin already exists: {telegram_id}")

    def create_admin_request(self, telegram_id: int, username: Optional[str] = None,
                            first_name: Optional[str] = None, last_name: Optional[str] = None) -> bool:
        """관리자 승인 요청 생성"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO pending_admin_requests (telegram_id, username, first_name, last_name)
                    VALUES (?, ?, ?, ?)
                """, (telegram_id, username, first_name, last_name))
                return True
        except sqlite3.IntegrityError:
            # 이미 요청이 존재함
            return False

    def get_pending_admin_request(self, telegram_id: int) -> Optional[Dict]:
        """대기 중인 관리자 요청 조회 (PENDING 상태만)"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT * FROM pending_admin_requests
                WHERE telegram_id = ? AND status = 'PENDING'
            """, (telegram_id,))
            row = cursor.fetchone()
            return dict(row) if row else None

    def get_admin_request(self, telegram_id: int) -> Optional[Dict]:
        """관리자 요청 조회 (모든 상태)"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT * FROM pending_admin_requests
                WHERE telegram_id = ?
                ORDER BY requested_at DESC
                LIMIT 1
            """, (telegram_id,))
            row = cursor.fetchone()
            return dict(row) if row else None

    def approve_admin_request(self, telegram_id: int, reviewed_by: int):
        """관리자 요청 승인"""
        with self.get_connection() as conn:
            cursor = conn.cursor()

            # 요청 상태 업데이트
            cursor.execute("""
                UPDATE pending_admin_requests
                SET status = 'APPROVED', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP
                WHERE telegram_id = ?
            """, (reviewed_by, telegram_id))

            # admin_users에 추가
            cursor.execute("""
                SELECT username FROM pending_admin_requests WHERE telegram_id = ?
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
                SET status = 'REJECTED', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP
                WHERE telegram_id = ?
            """, (reviewed_by, telegram_id))

    def get_main_admin_id(self) -> Optional[int]:
        """첫 번째 관리자 ID 조회 (메인 관리자)"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT telegram_id FROM admin_users
                WHERE is_active = 1
                ORDER BY id ASC
                LIMIT 1
            """)
            row = cursor.fetchone()
            return row['telegram_id'] if row else None
