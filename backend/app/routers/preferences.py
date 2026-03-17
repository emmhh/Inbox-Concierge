from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth_utils import get_current_user
from app.database import get_db
from app.models import User
from app.schemas import PreferencesUpdate, UserOut

router = APIRouter()


@router.get("", response_model=UserOut)
async def get_preferences(user: User = Depends(get_current_user)):
    return user


@router.put("", response_model=UserOut)
async def update_preferences(
    data: PreferencesUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user.importance_context = data.importance_context
    await db.commit()
    await db.refresh(user)
    return user
