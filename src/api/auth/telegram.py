"""Telegram initData 검증"""
import hmac
import hashlib
import json
import time
from urllib.parse import parse_qs, unquote


def verify_telegram_init_data(init_data: str, bot_token: str, max_age_seconds: int = 86400) -> dict | None:
    """
    Telegram WebApp initData 검증

    Args:
        init_data: Telegram에서 전달받은 initData 문자열
        bot_token: 봇 토큰
        max_age_seconds: 최대 유효 시간 (기본 24시간)

    Returns:
        검증 성공 시 사용자 정보 dict, 실패 시 None
    """
    try:
        # URL 인코딩된 데이터 파싱
        parsed = {}
        for pair in init_data.split("&"):
            if "=" in pair:
                key, value = pair.split("=", 1)
                parsed[key] = unquote(value)

        # hash 추출
        received_hash = parsed.pop("hash", None)
        if not received_hash:
            return None

        # auth_date 확인 (replay attack 방지)
        auth_date = parsed.get("auth_date")
        if auth_date:
            auth_timestamp = int(auth_date)
            current_timestamp = int(time.time())
            if current_timestamp - auth_timestamp > max_age_seconds:
                return None  # 만료된 데이터

        # data-check-string 생성 (알파벳 순 정렬)
        data_check_string = "\n".join(
            f"{k}={v}" for k, v in sorted(parsed.items())
        )

        # secret_key = HMAC_SHA256("WebAppData", bot_token)
        secret_key = hmac.new(
            b"WebAppData",
            bot_token.encode(),
            hashlib.sha256
        ).digest()

        # 해시 계산
        calculated_hash = hmac.new(
            secret_key,
            data_check_string.encode(),
            hashlib.sha256
        ).hexdigest()

        # 검증
        if not hmac.compare_digest(calculated_hash, received_hash):
            return None

        # user 정보 파싱
        user_data = parsed.get("user")
        if user_data:
            user = json.loads(user_data)
            return {
                "telegram_id": user.get("id"),
                "first_name": user.get("first_name", ""),
                "last_name": user.get("last_name", ""),
                "username": user.get("username", ""),
                "language_code": user.get("language_code", ""),
                "auth_date": auth_date,
            }

        return None

    except Exception:
        return None


def parse_user_from_init_data(init_data: str) -> dict | None:
    """
    initData에서 user 정보만 추출 (검증 없이)
    테스트/개발 용도
    """
    try:
        parsed = {}
        for pair in init_data.split("&"):
            if "=" in pair:
                key, value = pair.split("=", 1)
                parsed[key] = unquote(value)

        user_data = parsed.get("user")
        if user_data:
            user = json.loads(user_data)
            return {
                "telegram_id": user.get("id"),
                "first_name": user.get("first_name", ""),
                "last_name": user.get("last_name", ""),
                "username": user.get("username", ""),
            }
        return None
    except Exception:
        return None
