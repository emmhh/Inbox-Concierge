from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth_utils import get_current_user
from app.database import get_db
from app.models import Bucket, Email, Feedback, User
from app.schemas import FeedbackCreate, FeedbackOut

router = APIRouter()


@router.post("", response_model=FeedbackOut)
async def submit_feedback(
    data: FeedbackCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    email_result = await db.execute(
        select(Email).where(Email.id == data.email_id, Email.user_id == user.id)
    )
    if email_result.scalars().first() is None:
        raise HTTPException(status_code=404, detail="Email not found")

    bucket_result = await db.execute(
        select(Bucket).where(Bucket.id == data.bucket_id, Bucket.user_id == user.id)
    )
    if bucket_result.scalars().first() is None:
        raise HTTPException(status_code=404, detail="Bucket not found")

    # Upsert: replace existing feedback for same (user, email, bucket)
    result = await db.execute(
        select(Feedback).where(
            Feedback.user_id == user.id,
            Feedback.email_id == data.email_id,
            Feedback.bucket_id == data.bucket_id,
        )
    )
    existing = result.scalars().first()

    if existing:
        existing.is_positive = data.is_positive
        existing.correct_bucket_ids = data.correct_bucket_ids
        existing.reason = data.reason
        feedback = existing
    else:
        feedback = Feedback(
            user_id=user.id,
            email_id=data.email_id,
            bucket_id=data.bucket_id,
            is_positive=data.is_positive,
            correct_bucket_ids=data.correct_bucket_ids,
            reason=data.reason,
        )
        db.add(feedback)

    await db.commit()
    await db.refresh(feedback)
    return feedback


@router.get("", response_model=list[FeedbackOut])
async def list_feedback(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Feedback).where(Feedback.user_id == user.id).order_by(Feedback.created_at.desc())
    )
    return result.scalars().all()
