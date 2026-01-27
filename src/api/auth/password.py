"""Password hashing utilities"""
import hashlib
import secrets


def hash_password(password: str) -> str:
    """비밀번호 해싱 (SHA256 + salt)"""
    salt = secrets.token_hex(16)
    hashed = hashlib.sha256((password + salt).encode()).hexdigest()
    return f"{salt}${hashed}"


def verify_password(password: str, password_hash: str) -> bool:
    """비밀번호 검증"""
    try:
        salt, hashed = password_hash.split('$')
        check_hash = hashlib.sha256((password + salt).encode()).hexdigest()
        return check_hash == hashed
    except (ValueError, AttributeError):
        return False
