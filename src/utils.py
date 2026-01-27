"""
유틸리티 함수들 (해시, 시간, 검증, 코드 생성 등)
"""
import hashlib
import os
import random
import string
from datetime import datetime, timezone, timedelta
from typing import Dict, Any
import logging

logger = logging.getLogger(__name__)

# 한국 시간대 (UTC+9)
KST = timezone(timedelta(hours=9))


def now_kst() -> datetime:
    """
    현재 한국 시간 반환

    Returns:
        datetime: 한국 시간대의 현재 시간
    """
    return datetime.now(KST)


def now_kst_str() -> str:
    """
    현재 한국 시간을 문자열로 반환 (YYYY-MM-DD HH:MM:SS 형식)

    Returns:
        str: 한국 시간 문자열
    """
    return now_kst().strftime("%Y-%m-%d %H:%M:%S")


def generate_worker_uid_hash(worker_id: int, salt: str) -> str:
    """
    근무자 ID를 해시화 (개인정보 보호)

    Args:
        worker_id: 근무자 ID
        salt: 솔트 값 (.env에서 가져옴)

    Returns:
        str: SHA256 해시 (hex)
    """
    data = f"{worker_id}:{salt}"
    return hashlib.sha256(data.encode()).hexdigest()


def generate_log_hash(attendance_data: Dict[str, Any]) -> str:
    """
    근무 로그 해시 생성

    Args:
        attendance_data: 출석 데이터 (event_id, worker_id, check_in, check_out, worked_minutes)

    Returns:
        str: SHA256 해시 (hex)
    """
    # 정규화된 문자열 생성 (순서 보장)
    canonical = (
        f"event_id={attendance_data['event_id']}|"
        f"worker_id={attendance_data['worker_id']}|"
        f"check_in={attendance_data['check_in_time']}|"
        f"check_out={attendance_data['check_out_time']}|"
        f"worked_minutes={attendance_data['worked_minutes']}"
    )

    return hashlib.sha256(canonical.encode()).hexdigest()


def generate_check_in_code() -> str:
    """
    6자리 출석 코드 생성 (숫자만)

    Returns:
        str: 6자리 코드 (예: 123456)
    """
    return ''.join(random.choices(string.digits, k=6))


def generate_short_code(title: str, date: str) -> str:
    """
    행사 Short Code 생성

    Args:
        title: 행사명 (예: BMW 시승행사)
        date: 날짜 (예: 1월 25일 or 2026-01-25)

    Returns:
        str: Short code (예: BMW_0125_A3F)
    """
    import random
    import string

    # 제목에서 영문/한글 첫 단어 추출
    title_words = title.split()
    title_part = title_words[0][:10] if title_words else "EVENT"

    # 날짜에서 월일 추출
    date_part = extract_mmdd(date)

    # 공백/특수문자 제거
    title_part = ''.join(c for c in title_part if c.isalnum())

    # 랜덤 suffix 추가 (충돌 방지)
    suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=3))

    return f"{title_part}_{date_part}_{suffix}".upper()


def extract_mmdd(date_str: str) -> str:
    """
    날짜 문자열에서 MMDD 추출

    Args:
        date_str: "1월 25일" or "2026-01-25" or "01-25"

    Returns:
        str: "0125"
    """
    # "1월 25일" 형식
    import re
    match = re.search(r'(\d{1,2})월\s*(\d{1,2})일', date_str)
    if match:
        month = match.group(1).zfill(2)
        day = match.group(2).zfill(2)
        return f"{month}{day}"

    # "2026-01-25" or "01-25" 형식
    match = re.search(r'(\d{1,2})-(\d{1,2})(?:-(\d{1,2}))?', date_str)
    if match:
        if match.group(3):  # YYYY-MM-DD
            month = match.group(2).zfill(2)
            day = match.group(3).zfill(2)
        else:  # MM-DD
            month = match.group(1).zfill(2)
            day = match.group(2).zfill(2)
        return f"{month}{day}"

    # 파싱 실패시 현재 날짜 사용 (한국 시간)
    return now_kst().strftime("%m%d")


def format_datetime(dt: datetime) -> str:
    """
    datetime을 한국어 형식으로 포맷

    Args:
        dt: datetime 객체

    Returns:
        str: "2026년 1월 25일 14시 30분"
    """
    return dt.strftime("%Y년 %m월 %d일 %H시 %M분")


def format_phone(phone: str) -> str:
    """
    전화번호 포맷팅

    Args:
        phone: "01012345678" or "010-1234-5678"

    Returns:
        str: "010-1234-5678"
    """
    phone = phone.replace('-', '').replace(' ', '')
    if len(phone) == 11:
        return f"{phone[:3]}-{phone[3:7]}-{phone[7:]}"
    elif len(phone) == 10:
        return f"{phone[:3]}-{phone[3:6]}-{phone[6:]}"
    return phone


def calculate_net_pay(gross_pay: int, tax_rate: float = 0.033) -> int:
    """
    실지급액 계산 (3.3% 공제)

    Args:
        gross_pay: 총 급여
        tax_rate: 공제율 (기본 3.3%)

    Returns:
        int: 실지급액
    """
    return int(gross_pay * (1 - tax_rate))


def validate_phone(phone: str) -> bool:
    """
    전화번호 유효성 검증

    Args:
        phone: 전화번호

    Returns:
        bool: 유효 여부
    """
    import re
    phone = phone.replace('-', '').replace(' ', '')
    return bool(re.match(r'^01[0-9]{8,9}$', phone))


def generate_deep_link(bot_username: str, event_id: int) -> str:
    """
    근무자봇 Deep Link 생성

    Args:
        bot_username: 봇 유저네임 (예: workproof_worker_bot)
        event_id: 행사 ID

    Returns:
        str: Deep link (예: https://t.me/workproof_worker_bot?start=apply_123)
    """
    return f"https://t.me/{bot_username}?start=apply_{event_id}"


def parse_deep_link_payload(payload: str) -> Dict[str, Any]:
    """
    Deep link payload 파싱

    Args:
        payload: "apply_123"

    Returns:
        dict: {"action": "apply", "event_id": 123}
    """
    if not payload:
        return {}

    parts = payload.split('_')
    if len(parts) >= 2:
        action = parts[0]
        try:
            event_id = int(parts[1])
            return {"action": action, "event_id": event_id}
        except ValueError:
            pass

    return {}


def truncate_text(text: str, max_length: int = 100) -> str:
    """
    텍스트 길이 제한 (텔레그램 메시지용)

    Args:
        text: 원본 텍스트
        max_length: 최대 길이

    Returns:
        str: 잘린 텍스트
    """
    if len(text) <= max_length:
        return text
    return text[:max_length - 3] + "..."


def safe_int(value: Any, default: int = 0) -> int:
    """
    안전한 int 변환

    Args:
        value: 변환할 값
        default: 기본값

    Returns:
        int: 변환된 값 or 기본값
    """
    try:
        return int(value)
    except (ValueError, TypeError):
        return default


def is_future_date(date_str: str) -> bool:
    """
    미래 날짜인지 확인

    Args:
        date_str: "2026-01-25"

    Returns:
        bool: 미래 날짜 여부
    """
    try:
        date = datetime.strptime(date_str, "%Y-%m-%d")
        # 시간대 정보를 추가하여 비교 (한국 시간)
        date = date.replace(tzinfo=KST)
        return date > now_kst()
    except ValueError:
        return False


def get_bank_code(bank_name: str) -> str:
    """
    은행명에서 은행코드 추출

    Args:
        bank_name: 은행명 (예: "국민은행", "신한은행")

    Returns:
        str: 은행코드 (예: "004", "088")
    """
    # 주요 은행 코드 매핑
    bank_codes = {
        "한국은행": "001",
        "산업은행": "002",
        "기업은행": "003",
        "국민은행": "004",
        "외환은행": "005",
        "수협": "007",
        "수협은행": "007",
        "농협": "011",
        "NH농협은행": "011",
        "농협은행": "011",
        "우리은행": "020",
        "SC제일은행": "023",
        "한국씨티은행": "027",
        "씨티은행": "027",
        "대구은행": "031",
        "부산은행": "032",
        "광주은행": "034",
        "제주은행": "035",
        "전북은행": "037",
        "경남은행": "039",
        "새마을금고": "045",
        "신협": "048",
        "신용협동조합": "048",
        "상호저축은행": "050",
        "외국은행": "055",
        "HSBC": "054",
        "중국공상은행": "062",
        "중국건설은행": "067",
        "중국은행": "071",
        "JP모간체이스은행": "076",
        "BNP파리바은행": "061",
        "신한은행": "088",
        "케이뱅크": "089",
        "카카오뱅크": "090",
        "토스뱅크": "092",
    }

    # 은행명에서 불필요한 문자 제거 후 매칭
    bank_name = bank_name.strip()

    # 정확한 매칭 시도
    if bank_name in bank_codes:
        return bank_codes[bank_name]

    # 부분 매칭 시도 (예: "국민" -> "국민은행")
    for key, code in bank_codes.items():
        if bank_name in key or key in bank_name:
            return code

    # 매칭 실패시 빈 문자열 반환
    return ""


def extract_yymmdd(date_str: str) -> str:
    """
    날짜 문자열에서 YYMMDD 추출

    Args:
        date_str: "1월 25일" or "2026-01-25" or "01월 25일"

    Returns:
        str: "260125"
    """
    import re

    # 현재 년도 (YY 형식, 한국 시간)
    current_year = now_kst().strftime("%y")

    # "1월 25일" 형식
    match = re.search(r'(\d{1,2})월\s*(\d{1,2})일', date_str)
    if match:
        month = match.group(1).zfill(2)
        day = match.group(2).zfill(2)
        return f"{current_year}{month}{day}"

    # "2026-01-25" 형식
    match = re.search(r'(\d{2,4})-(\d{1,2})-(\d{1,2})', date_str)
    if match:
        year = match.group(1)
        if len(year) == 4:
            year = year[2:]  # 2026 -> 26
        month = match.group(2).zfill(2)
        day = match.group(3).zfill(2)
        return f"{year}{month}{day}"

    # 파싱 실패시 현재 날짜 사용 (한국 시간)
    return now_kst().strftime("%y%m%d")
