import re
from email_validator import EmailNotValidError, validate_email

USERNAME_PATTERN = re.compile(r"[A-Za-z0-9_]{3,20}")
MIN_PASSWORD_LENGTH = 8
MAX_PASSWORD_LENGTH = 16
MAX_NAME_LENGTH = 10


def clean_username(username: str) -> str:
    if not USERNAME_PATTERN.fullmatch(username):
        raise ValueError(
            "Username must be 3–10 characters: letters, numbers or underscores.")
    return username


def clean_email(email: str) -> str:
    try:
        return validate_email(email, check_deliverability=False).normalized
    except EmailNotValidError as e:
        raise ValueError("Enter a valid email address.") from e


def clean_password(password: str) -> str:
    if len(password) < MIN_PASSWORD_LENGTH:
        raise ValueError(f"Password must be at least {
                         MIN_PASSWORD_LENGTH} characters.")
    if len(password) > MAX_PASSWORD_LENGTH:
        raise ValueError(f"Password must be at most {
                         MAX_PASSWORD_LENGTH} characters.")
    return password


def clean_name(name: str) -> str:
    name = name.strip()
    if not name:
        raise ValueError("Enter a name.")
    if len(name) > MAX_NAME_LENGTH:
        raise ValueError(f"Names must be at most {
                         MAX_NAME_LENGTH} characters.")
    return name
