from typing import Annotated
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.db import get_session
from app.core.security import password_stamp_matches, read_access_token
from app.models import User
from app.models.base import Role

SessionDep = Annotated[AsyncSession, Depends(get_session)]

_bearer = HTTPBearer(auto_error=False)


async def get_current_user(session: SessionDep, credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
                           ) -> User:
    token = read_access_token(credentials.credentials) if credentials else None
    user = await session.get(User, token[0]) if token else None
    if user is None or not user.is_active or not password_stamp_matches(token[1], user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Login again !", headers={
                            "WWW-Authenticate": "Bearer"})
    return user

CurrentUser = Annotated[User, Depends(get_current_user)]


async def get_ready_user(user: CurrentUser) -> User:
    if user.must_change_password:
        raise HTTPException(status.HTTP_403_FORBIDDEN,
                            "Change your initial passwd first")
    return user


def require_role(*roles: Role):
    async def check(user: Annotated[User, Depends(get_ready_user)]) -> User:
        if user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Permision deneid")
        return user
    return check


AdminUser = Annotated[User, Depends(require_role(Role.ADMIN))]
ExpertUser = Annotated[User, Depends(require_role(Role.EXPERT))]
