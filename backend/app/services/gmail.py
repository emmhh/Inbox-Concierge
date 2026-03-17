import base64
import logging
import re
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

from google.auth.transport.requests import Request as GoogleRequest
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth_utils import decrypt_token, encrypt_token
from app.config import settings
from app.models import Email, EmailBucket, Feedback, User

logger = logging.getLogger(__name__)

MAX_THREADS = 200


def _build_gmail_service(user: User):
    access_token = decrypt_token(user.google_access_token or "")
    refresh_token = decrypt_token(user.google_refresh_token or "")

    creds = Credentials(
        token=access_token,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
    )

    if creds.expired and creds.refresh_token:
        creds.refresh(GoogleRequest())

    return build("gmail", "v1", credentials=creds), creds


def _get_header(headers: list[dict], name: str) -> str:
    for h in headers:
        if h.get("name", "").lower() == name.lower():
            return h.get("value", "")
    return ""


def _parse_date_naive(date_str: str) -> datetime | None:
    """Parse an email date string and strip timezone to get a naive UTC datetime."""
    if not date_str:
        return None
    try:
        dt = parsedate_to_datetime(date_str)
        if dt.tzinfo is not None:
            dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
        return dt
    except Exception:
        return None


def _extract_body(payload: dict) -> str:
    """Extract plain text body from message payload, handling multipart."""
    if payload.get("mimeType", "").startswith("text/plain"):
        data = payload.get("body", {}).get("data", "")
        if data:
            return base64.urlsafe_b64decode(data).decode("utf-8", errors="replace")

    parts = payload.get("parts", [])
    for part in parts:
        if part.get("mimeType") == "text/plain":
            data = part.get("body", {}).get("data", "")
            if data:
                return base64.urlsafe_b64decode(data).decode("utf-8", errors="replace")
        if part.get("mimeType", "").startswith("multipart/"):
            result = _extract_body(part)
            if result:
                return result

    for part in parts:
        if part.get("mimeType") == "text/html":
            data = part.get("body", {}).get("data", "")
            if data:
                html = base64.urlsafe_b64decode(data).decode("utf-8", errors="replace")
                return re.sub(r"<[^>]+>", "", html)[:500]

    return ""


def _collect_thread_ids(service, max_threads: int) -> list[str]:
    """Paginate through threads.list to collect up to max_threads thread IDs."""
    thread_ids: list[str] = []
    page_token = None

    while len(thread_ids) < max_threads:
        batch_size = min(100, max_threads - len(thread_ids))
        resp = service.users().threads().list(
            userId="me", maxResults=batch_size, pageToken=page_token,
        ).execute()

        for t in resp.get("threads", []):
            thread_ids.append(t["id"])
            if len(thread_ids) >= max_threads:
                break

        page_token = resp.get("nextPageToken")
        if not page_token:
            break

    return thread_ids


def _refresh_credentials(user: User, creds: Credentials) -> bool:
    """Update stored credentials if they were refreshed. Returns True if changed."""
    if creds.token != decrypt_token(user.google_access_token or ""):
        user.google_access_token = encrypt_token(creds.token)
        if creds.expiry:
            user.token_expiry = creds.expiry.replace(tzinfo=None) if creds.expiry.tzinfo else creds.expiry
        return True
    return False


def _parse_thread(service, tid: str) -> dict | None:
    """Fetch a single thread from Gmail and extract its fields."""
    try:
        thread_data = service.users().threads().get(
            userId="me", id=tid, format="full"
        ).execute()
    except Exception as e:
        logger.warning(f"Failed to fetch thread {tid}: {e}")
        return None

    messages = thread_data.get("messages", [])
    if not messages:
        return None

    msg = messages[0]
    headers = msg.get("payload", {}).get("headers", [])
    return {
        "thread_id": tid,
        "message_id": msg.get("id", ""),
        "subject": _get_header(headers, "Subject"),
        "sender": _get_header(headers, "From"),
        "date": _parse_date_naive(_get_header(headers, "Date")),
        "snippet": msg.get("snippet", ""),
        "body_preview": _extract_body(msg.get("payload", {}))[:500],
    }


async def _prune_stale_emails(
    user_id: int, keep_thread_ids: set[str], db: AsyncSession
) -> int:
    """Delete emails not in keep_thread_ids. Returns count pruned."""
    stale_result = await db.execute(
        select(Email).where(
            Email.user_id == user_id,
            Email.thread_id.notin_(keep_thread_ids),
        )
    )
    stale_emails = stale_result.scalars().all()
    if not stale_emails:
        return 0
    stale_ids = [e.id for e in stale_emails]
    await db.execute(delete(Feedback).where(Feedback.email_id.in_(stale_ids)))
    await db.execute(delete(EmailBucket).where(EmailBucket.email_id.in_(stale_ids)))
    await db.execute(delete(Email).where(Email.id.in_(stale_ids)))
    return len(stale_ids)


async def sync_threads(
    user: User, db: AsyncSession, max_results: int = MAX_THREADS
) -> tuple[list[Email], list[Email]]:
    """
    Smart sync: compare Gmail thread IDs with DB, only fetch new threads.
    Returns (new_emails, all_emails).
    - new_emails: only the newly fetched emails (need classification)
    - all_emails: complete list of all 200 emails in DB after sync
    """
    service, creds = _build_gmail_service(user)

    if _refresh_credentials(user, creds):
        await db.commit()

    # Step 1: get latest thread IDs from Gmail (lightweight, no content)
    thread_ids = _collect_thread_ids(service, max_results)
    fetched_set = set(thread_ids)
    logger.info(f"Fetched {len(thread_ids)} thread IDs from Gmail")

    # Step 2: compare with existing thread IDs in DB
    existing_result = await db.execute(
        select(Email.thread_id).where(Email.user_id == user.id)
    )
    existing_thread_ids = {row.thread_id for row in existing_result.all()}
    new_thread_ids = [tid for tid in thread_ids if tid not in existing_thread_ids]

    logger.info(
        f"Sync: {len(existing_thread_ids)} in DB, "
        f"{len(new_thread_ids)} new, "
        f"{len(existing_thread_ids - fetched_set)} stale"
    )

    # Step 3: fetch full content only for new threads
    new_emails: list[Email] = []
    for tid in new_thread_ids:
        parsed = _parse_thread(service, tid)
        if not parsed:
            continue
        email = Email(
            user_id=user.id,
            thread_id=parsed["thread_id"],
            message_id=parsed["message_id"],
            subject=parsed["subject"],
            sender=parsed["sender"],
            snippet=parsed["snippet"],
            body_preview=parsed["body_preview"],
            date=parsed["date"],
        )
        db.add(email)
        new_emails.append(email)

    # Step 4: prune stale emails that fell out of the latest 200
    pruned = await _prune_stale_emails(user.id, fetched_set, db)
    if pruned:
        logger.info(f"Pruned {pruned} stale emails")

    await db.commit()
    for e in new_emails:
        await db.refresh(e)

    # Step 5: return all emails in DB (for full list display)
    all_result = await db.execute(
        select(Email).where(Email.user_id == user.id).order_by(Email.date.desc().nullslast())
    )
    all_emails = list(all_result.scalars().all())

    return new_emails, all_emails


async def fetch_threads(user: User, db: AsyncSession, max_results: int = MAX_THREADS) -> list[Email]:
    """Fetch all threads from Gmail (full re-fetch), upsert into DB, return Email records."""
    service, creds = _build_gmail_service(user)

    if _refresh_credentials(user, creds):
        await db.commit()

    thread_ids = _collect_thread_ids(service, max_results)
    logger.info(f"Fetched {len(thread_ids)} thread IDs from Gmail")

    emails: list[Email] = []
    for tid in thread_ids:
        parsed = _parse_thread(service, tid)
        if not parsed:
            continue

        result = await db.execute(
            select(Email).where(Email.user_id == user.id, Email.thread_id == tid)
        )
        existing = result.scalars().first()

        if existing:
            existing.subject = parsed["subject"]
            existing.sender = parsed["sender"]
            existing.snippet = parsed["snippet"]
            existing.body_preview = parsed["body_preview"]
            existing.date = parsed["date"]
            existing.message_id = parsed["message_id"]
            emails.append(existing)
        else:
            email = Email(
                user_id=user.id,
                thread_id=parsed["thread_id"],
                message_id=parsed["message_id"],
                subject=parsed["subject"],
                sender=parsed["sender"],
                snippet=parsed["snippet"],
                body_preview=parsed["body_preview"],
                date=parsed["date"],
            )
            db.add(email)
            emails.append(email)

    pruned = await _prune_stale_emails(user.id, set(thread_ids), db)
    if pruned:
        logger.info(f"Pruned {pruned} stale emails")

    await db.commit()
    for e in emails:
        await db.refresh(e)

    return emails
