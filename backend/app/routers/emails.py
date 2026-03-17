import json
from typing import AsyncGenerator

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sse_starlette.sse import EventSourceResponse

from app.auth_utils import get_current_user
from app.database import get_db
from app.models import Bucket, Email, EmailBucket, User
from app.schemas import EmailOut
from app.services.classifier import classify_email, classify_emails, classify_emails_in_batches
from app.services.prompt_builder import build_system_prompt
from app.services.gmail import fetch_threads, sync_threads

router = APIRouter()


@router.get("", response_model=list[EmailOut])
async def list_emails(
    bucket_id: int | None = Query(None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(Email)
        .where(Email.user_id == user.id)
        .options(selectinload(Email.email_buckets).selectinload(EmailBucket.bucket))
        .options(selectinload(Email.feedback))
        .order_by(Email.date.desc().nullslast())
    )

    if bucket_id is not None:
        query = query.join(EmailBucket, Email.id == EmailBucket.email_id).where(
            EmailBucket.bucket_id == bucket_id
        )

    result = await db.execute(query)
    emails = result.scalars().unique().all()

    out: list[EmailOut] = []
    for email in emails:
        ebs = email.email_buckets
        if not ebs:
            continue

        out.append(
            EmailOut(
                id=email.id,
                thread_id=email.thread_id,
                subject=email.subject or "",
                sender=email.sender or "",
                snippet=email.snippet or "",
                date=email.date,
                bucket_ids=[eb.bucket_id for eb in ebs],
                bucket_names=[eb.bucket.name for eb in ebs],
            )
        )

    return out


async def _classification_stream(
    user: User, db: AsyncSession, fetch_new: bool = True
) -> AsyncGenerator[str, None]:
    if fetch_new:
        emails = await fetch_threads(user, db)
    else:
        result = await db.execute(
            select(Email).where(Email.user_id == user.id).order_by(Email.date.desc().nullslast())
        )
        emails = list(result.scalars().all())

    async for event in classify_emails(user, emails, db):
        yield json.dumps(event)


@router.post("/fetch-and-classify")
async def fetch_and_classify(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return EventSourceResponse(_classification_stream(user, db, fetch_new=True))


@router.post("/reclassify")
async def reclassify(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return EventSourceResponse(_classification_stream(user, db, fetch_new=False))


async def _batch_classification_stream(
    user: User, db: AsyncSession, fetch_new: bool = False
) -> AsyncGenerator[str, None]:
    if fetch_new:
        emails = await fetch_threads(user, db)
    else:
        result = await db.execute(
            select(Email).where(Email.user_id == user.id).order_by(Email.date.desc().nullslast())
        )
        emails = list(result.scalars().all())

    async for event in classify_emails_in_batches(user, emails, db):
        yield json.dumps(event)


@router.post("/batch-classify")
async def batch_classify(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return EventSourceResponse(_batch_classification_stream(user, db, fetch_new=False))


@router.post("/fetch-and-batch-classify")
async def fetch_and_batch_classify(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return EventSourceResponse(_batch_classification_stream(user, db, fetch_new=True))


async def _sync_and_classify_stream(
    user: User, db: AsyncSession
) -> AsyncGenerator[str, None]:
    new_emails, all_emails = await sync_threads(user, db)

    if not new_emails:
        yield json.dumps({
            "event": "done",
            "data": {"classified": 0, "failed": 0, "total": 0, "skipped": True},
        })
        return

    async for event in classify_emails_in_batches(user, new_emails, db):
        yield json.dumps(event)


@router.post("/sync-and-classify")
async def sync_and_classify(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return EventSourceResponse(_sync_and_classify_stream(user, db))


@router.post("/{email_id}/reclassify", response_model=EmailOut)
async def reclassify_single(
    email_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Email).where(Email.id == email_id, Email.user_id == user.id)
    )
    email = result.scalars().first()
    if email is None:
        raise HTTPException(status_code=404, detail="Email not found")

    system_prompt = await build_system_prompt(user, db)

    bucket_result = await db.execute(
        select(Bucket).where(Bucket.user_id == user.id)
    )
    buckets = bucket_result.scalars().all()
    bucket_name_to_id = {b.name: b.id for b in buckets}

    bucket_names = await classify_email(email, system_prompt, bucket_name_to_id, user=user)

    await db.execute(delete(EmailBucket).where(EmailBucket.email_id == email.id))
    for name in bucket_names:
        db.add(EmailBucket(email_id=email.id, bucket_id=bucket_name_to_id[name]))
    await db.commit()

    return EmailOut(
        id=email.id,
        thread_id=email.thread_id,
        subject=email.subject or "",
        sender=email.sender or "",
        snippet=email.snippet or "",
        date=email.date,
        bucket_ids=[bucket_name_to_id[n] for n in bucket_names],
        bucket_names=list(bucket_names),
    )
