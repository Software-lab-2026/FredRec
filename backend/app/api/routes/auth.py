from fastapi import APIRouter, HTTPException, status
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import CurrentUser, SessionDep
from app.core.security import create_access_token, hash_password, spend_password_check_time, verify_password
from app.models import DomainExpert, User
from app.models.base import Role
from app.schemas.auth import AuthOut, ChangePasswordIn, LoginIn, SignupIn, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])

DUPLICATE_MESSAGES = {
    "uq_users_username_lower": "That username is already taken.",
    "uq_users_email_lower": "An account with this email already exests.",
}


def account_conflict(e: IntegrityError) -> HTTPException:
    message = DUPLICATE_MESSAGES.get(e.orig.diag.constraint_name)
    if message is None:
        raise e
    return HTTPException(status.HTTP_409_CONFLICT, message)


async def _user_out(session: AsyncSession, user: User) -> UserOut:
    domain_ids = await session.scalars(select(DomainExpert.domain_id).where(DomainExpert.user_id == user.id))
    return UserOut(
        id=user.id,
        username=user.username,
        email=user.email,
        role=user.role,
        domain_ids=list(domain_ids),
        must_change_password=user.must_change_password,
    )


async def _auth_out(session: AsyncSession, user: User) -> AuthOut:
    return AuthOut(
        access_token=create_access_token(user.id, user.password_hash),
        user=await _user_out(session, user),
    )


@router.post("/signup", status_code=status.HTTP_201_CREATED)
async def signup(body: SignupIn, session: SessionDep) -> AuthOut:
    password_hash = await run_in_threadpool(hash_password, body.password)
    user = User(username=body.username, email=body.email,
                password_hash=password_hash, role=Role.ENDUSER)
    session.add(user)
    try:
        await session.commit()
    except IntegrityError as e:
        await session.rollback()
        raise account_conflict(e) from e
    return await _auth_out(session, user)


@router.post("/login")
async def login(body: LoginIn, session: SessionDep) -> AuthOut:
    user = await session.scalar(select(User).where(func.lower(User.username) == body.username.lower()))
    if user is None:
        await run_in_threadpool(spend_password_check_time, body.password)
    if user is None or not await run_in_threadpool(verify_password, user.password_hash, body.password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED,
                            "Incorrect username or password.")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN,
                            "This account has been deactivated.")
    return await _auth_out(session, user)


@router.get("/me")
async def me(user: CurrentUser, session: SessionDep) -> UserOut:
    return await _user_out(session, user)


@router.post("/change-password")
async def change_password(body: ChangePasswordIn, user: CurrentUser, session: SessionDep) -> AuthOut:
    """Returns a new token, because changing the password invalidates earlier ones."""
    if not await run_in_threadpool(verify_password, user.password_hash, body.current_password):
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            "Your current password is incorrect.")
    if body.new_password == body.current_password:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            "Choose a password different from the current one.")
    user.password_hash = await run_in_threadpool(hash_password, body.new_password)
    user.must_change_password = False
    await session.commit()
    return await _auth_out(session, user)
