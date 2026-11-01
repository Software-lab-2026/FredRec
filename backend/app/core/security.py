import hashlib
import hmac
import uuid
from datetime import UTC, datetime, timedelta
from functools import lru_cache
import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from app.core.config import get_settings

ACCESS_TOKEN_LIFETIME = timedelta(days=7)
JWT_ALGORITHM = "HS256"

_hasher = PasswordHasher()


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except (VerificationError, InvalidHashError):
        return False


@lru_cache
def _dummy_hash() -> str:
    return hash_password("no-such-user")


def spend_password_check_time(password: str) -> None:
    verify_password(_dummy_hash(), password)


def _password_stamp(password_hash: str) -> str:
    return hashlib.sha256(password_hash.encode()).hexdigest()[:16]


def create_access_token(user_id: uuid.UUID, password_hash: str, now: datetime | None = None) -> str:
    issued_at = now or datetime.now(UTC)
    claims = {
        "sub": str(user_id),
        "pwd": _password_stamp(password_hash),
        "iat": issued_at,
        "exp": issued_at + ACCESS_TOKEN_LIFETIME,
    }
    return jwt.encode(claims, get_settings().jwt_key, algorithm=JWT_ALGORITHM)


def read_access_token(token: str) -> tuple[uuid.UUID, str] | None:
    try:
        claims = jwt.decode(
            token,
            get_settings().jwt_key,
            algorithms=[JWT_ALGORITHM],
            options={"require": ["sub", "pwd", "iat", "exp"]},
        )
        return uuid.UUID(claims["sub"]), claims["pwd"]
    except (jwt.InvalidTokenError, ValueError):
        return None


def password_stamp_matches(stamp: str, password_hash: str) -> bool:
    return hmac.compare_digest(stamp, _password_stamp(password_hash))
