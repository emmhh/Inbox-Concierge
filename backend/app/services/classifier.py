import asyncio
import logging
from datetime import timezone

from pydantic import BaseModel
from pydantic_ai import Agent
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Bucket, Email, EmailBucket, User
from app.services.prompt_builder import build_system_prompt

logger = logging.getLogger(__name__)


def _utc_iso(dt) -> str | None:
    if dt is None:
        return None
    return dt.replace(tzinfo=timezone.utc).isoformat()


MAX_RETRIES = 2
RETRY_BASE_DELAY = 1.0


BATCH_SIZE = 50


class EmailClassification(BaseModel):
    bucket_names: list[str]


class SingleEmailResult(BaseModel):
    email_id: int
    bucket_names: list[str]


class BatchEmailClassification(BaseModel):
    results: list[SingleEmailResult]


_classifier_agent: Agent[None, EmailClassification] | None = None
_batch_classifier_agent: Agent[None, BatchEmailClassification] | None = None


def _get_classifier_agent() -> Agent[None, EmailClassification]:
    global _classifier_agent
    if _classifier_agent is None:
        _classifier_agent = Agent(
            "google-gla:gemini-2.5-flash",
            output_type=EmailClassification,
        )
    return _classifier_agent


def _get_batch_classifier_agent() -> Agent[None, BatchEmailClassification]:
    global _batch_classifier_agent
    if _batch_classifier_agent is None:
        _batch_classifier_agent = Agent(
            "google-gla:gemini-2.5-flash",
            output_type=BatchEmailClassification,
        )
    return _batch_classifier_agent


async def classify_email(
    email: Email,
    system_prompt: str,
    bucket_name_to_id: dict[str, int],
) -> list[str]:
    """Classify a single email. Returns list of matched bucket names."""
    user_prompt = (
        f"Subject: {email.subject or '(no subject)'}\n"
        f"From: {email.sender or 'unknown'}\n"
        f"Date: {email.date or 'unknown'}\n"
        f"Body: {email.body_preview or '(empty)'}"
    )

    for attempt in range(MAX_RETRIES + 1):
        try:
            result = await _get_classifier_agent().run(
                user_prompt,
                instructions=system_prompt,
            )
            valid_names = [
                name for name in result.output.bucket_names
                if name in bucket_name_to_id
            ]
            return valid_names
        except Exception as e:
            if attempt < MAX_RETRIES:
                delay = RETRY_BASE_DELAY * (2 ** attempt)
                logger.warning(
                    f"Classification retry {attempt + 1} for email {email.id}: {e}"
                )
                await asyncio.sleep(delay)
            else:
                logger.error(f"Classification failed for email {email.id}: {e}")
                raise


async def classify_emails(
    user: User,
    emails: list[Email],
    db: AsyncSession,
):
    """
    Classify a list of emails. Yields SSE event dicts as progress updates.
    """
    system_prompt = await build_system_prompt(user, db)

    result = await db.execute(
        select(Bucket).where(Bucket.user_id == user.id)
    )
    buckets = result.scalars().all()
    bucket_name_to_id = {b.name: b.id for b in buckets}

    total = len(emails)
    classified = 0
    failed = 0

    for i, email in enumerate(emails):
        try:
            bucket_names = await classify_email(email, system_prompt, bucket_name_to_id)

            await db.execute(
                delete(EmailBucket).where(EmailBucket.email_id == email.id)
            )
            for name in bucket_names:
                bid = bucket_name_to_id[name]
                db.add(EmailBucket(email_id=email.id, bucket_id=bid))

            await db.commit()
            classified += 1

            yield {
                "event": "classified",
                "data": {
                    "email_id": email.id,
                    "thread_id": email.thread_id,
                    "subject": email.subject,
                    "sender": email.sender,
                    "snippet": email.snippet,
                    "date": _utc_iso(email.date),
                    "bucket_names": bucket_names,
                    "bucket_ids": [bucket_name_to_id[n] for n in bucket_names],
                    "progress": i + 1,
                    "total": total,
                },
            }
        except Exception as e:
            failed += 1
            logger.error(f"Skipping email {email.id}: {e}")
            yield {
                "event": "error",
                "data": {
                    "email_id": email.id,
                    "subject": email.subject,
                    "error": str(e),
                    "progress": i + 1,
                    "total": total,
                },
            }

    yield {
        "event": "done",
        "data": {
            "classified": classified,
            "failed": failed,
            "total": total,
        },
    }


async def classify_emails_batch(
    emails: list[Email],
    system_prompt: str,
    bucket_name_to_id: dict[str, int],
) -> dict[int, list[str]]:
    """Classify up to BATCH_SIZE emails in a single LLM call. Returns {email_id: [bucket_names]}."""
    lines = []
    for email in emails:
        lines.append(
            f"[EMAIL_ID={email.id}]\n"
            f"Subject: {email.subject or '(no subject)'}\n"
            f"From: {email.sender or 'unknown'}\n"
            f"Date: {email.date or 'unknown'}\n"
            f"Body: {email.body_preview or '(empty)'}\n"
        )

    user_prompt = (
        "Classify each of the following emails. Return a result for every EMAIL_ID.\n\n"
        + "\n---\n".join(lines)
    )

    for attempt in range(MAX_RETRIES + 1):
        try:
            result = await _get_batch_classifier_agent().run(
                user_prompt,
                instructions=system_prompt,
            )
            mapping: dict[int, list[str]] = {}
            for item in result.output.results:
                valid = [n for n in item.bucket_names if n in bucket_name_to_id]
                mapping[item.email_id] = valid
            return mapping
        except Exception as e:
            if attempt < MAX_RETRIES:
                delay = RETRY_BASE_DELAY * (2 ** attempt)
                logger.warning(f"Batch classification retry {attempt + 1}: {e}")
                await asyncio.sleep(delay)
            else:
                logger.error(f"Batch classification failed: {e}")
                raise


async def classify_emails_in_batches(
    user: User,
    emails: list[Email],
    db: AsyncSession,
):
    """Classify emails in batches of BATCH_SIZE. Yields SSE event dicts."""
    system_prompt = await build_system_prompt(user, db)

    result = await db.execute(
        select(Bucket).where(Bucket.user_id == user.id)
    )
    buckets = result.scalars().all()
    bucket_name_to_id = {b.name: b.id for b in buckets}

    total = len(emails)
    classified = 0
    failed = 0
    processed = 0

    for batch_start in range(0, total, BATCH_SIZE):
        batch = emails[batch_start : batch_start + BATCH_SIZE]
        try:
            mapping = await classify_emails_batch(batch, system_prompt, bucket_name_to_id)

            for email in batch:
                processed += 1
                bucket_names = mapping.get(email.id, [])

                await db.execute(
                    delete(EmailBucket).where(EmailBucket.email_id == email.id)
                )
                for name in bucket_names:
                    db.add(EmailBucket(email_id=email.id, bucket_id=bucket_name_to_id[name]))

                await db.commit()
                classified += 1

                yield {
                    "event": "classified",
                    "data": {
                        "email_id": email.id,
                        "thread_id": email.thread_id,
                        "subject": email.subject,
                        "sender": email.sender,
                        "snippet": email.snippet,
                        "date": _utc_iso(email.date),
                        "bucket_names": bucket_names,
                        "bucket_ids": [bucket_name_to_id[n] for n in bucket_names],
                        "progress": processed,
                        "total": total,
                    },
                }
        except Exception as e:
            for email in batch:
                processed += 1
                failed += 1
                logger.error(f"Batch failed, skipping email {email.id}: {e}")
                yield {
                    "event": "error",
                    "data": {
                        "email_id": email.id,
                        "subject": email.subject,
                        "error": str(e),
                        "progress": processed,
                        "total": total,
                    },
                }

    yield {
        "event": "done",
        "data": {
            "classified": classified,
            "failed": failed,
            "total": total,
        },
    }
