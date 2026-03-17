from datetime import datetime, timedelta, timezone

from cryptography.fernet import Fernet
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models import User

security = HTTPBearer()

JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = 24


def _get_fernet() -> Fernet | None:
    if settings.encryption_key:
        return Fernet(settings.encryption_key.encode())
    return None


def encrypt_token(token: str) -> str:
    f = _get_fernet()
    if f:
        return f.encrypt(token.encode()).decode()
    return token


def decrypt_token(token: str) -> str:
    f = _get_fernet()
    if f:
        try:
            return f.decrypt(token.encode()).decode()
        except Exception:
            return token
    return token


def create_jwt(user_id: int, email: str) -> str:
    payload = {
        "sub": str(user_id),
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=JWT_ALGORITHM)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    token = credentials.credentials
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[JWT_ALGORITHM])
        user_id = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user
