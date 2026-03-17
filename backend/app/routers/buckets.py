from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth_utils import get_current_user
from app.database import get_db
from app.models import Bucket, EmailBucket, User
from app.schemas import BucketCreate, BucketOut, BucketUpdate

router = APIRouter()


@router.get("", response_model=list[BucketOut])
async def list_buckets(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(
            Bucket,
            func.count(EmailBucket.email_id).label("email_count"),
        )
        .outerjoin(EmailBucket, Bucket.id == EmailBucket.bucket_id)
        .where(Bucket.user_id == user.id)
        .group_by(Bucket.id)
        .order_by(Bucket.created_at)
    )
    rows = result.all()
    return [
        BucketOut(
            id=bucket.id,
            name=bucket.name,
            description=bucket.description,
            examples=bucket.examples or [],
            email_count=count,
        )
        for bucket, count in rows
    ]


@router.post("", response_model=BucketOut)
async def create_bucket(
    data: BucketCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    bucket = Bucket(
        user_id=user.id,
        name=data.name,
        description=data.description,
        examples=data.examples,
    )
    db.add(bucket)
    await db.commit()
    await db.refresh(bucket)
    return BucketOut(
        id=bucket.id,
        name=bucket.name,
        description=bucket.description,
        examples=bucket.examples or [],
        email_count=0,
    )


@router.put("/{bucket_id}", response_model=BucketOut)
async def update_bucket(
    bucket_id: int,
    data: BucketUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Bucket).where(Bucket.id == bucket_id, Bucket.user_id == user.id)
    )
    bucket = result.scalars().first()
    if bucket is None:
        raise HTTPException(status_code=404, detail="Bucket not found")

    if data.name is not None:
        bucket.name = data.name
    if data.description is not None:
        bucket.description = data.description
    if data.examples is not None:
        bucket.examples = data.examples

    await db.commit()
    await db.refresh(bucket)
    return BucketOut(
        id=bucket.id,
        name=bucket.name,
        description=bucket.description,
        examples=bucket.examples or [],
        email_count=0,
    )


@router.delete("/{bucket_id}")
async def delete_bucket(
    bucket_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Bucket).where(Bucket.id == bucket_id, Bucket.user_id == user.id)
    )
    bucket = result.scalars().first()
    if bucket is None:
        raise HTTPException(status_code=404, detail="Bucket not found")

    await db.delete(bucket)
    await db.commit()
    return {"ok": True}
