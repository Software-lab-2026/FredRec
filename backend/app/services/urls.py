import hashlib
from urllib.parse import parse_qsl, urlencode, urlsplit

INVALID_URL = "Enter a valid link starting with http:// or https://."
MAX_URL_LENGTH = 200


def normalize_url(raw: str) -> tuple[str, str]:
    raw = raw.strip()
    if len(raw) > MAX_URL_LENGTH:
        raise ValueError(INVALID_URL)
    try:
        parts = urlsplit(raw)
        port = parts.port
    except ValueError as e:
        raise ValueError(INVALID_URL) from e
    if parts.scheme not in ("http", "https") or not parts.hostname:
        raise ValueError(INVALID_URL)
    host = parts.hostname.lower().removeprefix("www.")
    if port and port not in (80, 443):
        host = f"{host}:{port}"
    query = [(k, v) for k, v in parse_qsl(
        parts.query, keep_blank_values=True) if not k.startswith("utm_")]
    normalized = host + \
        parts.path.rstrip("/") + (f"?{urlencode(query)}" if query else "")
    return normalized, hashlib.sha256(normalized.encode()).hexdigest()


def source_name(url: str) -> str:
    return (urlsplit(url).hostname or "").lower().removeprefix("www.")
