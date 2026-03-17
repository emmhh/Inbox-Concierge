import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from app.config import settings

# Pydantic AI reads GOOGLE_API_KEY from the environment directly
if settings.google_api_key:
    os.environ.setdefault("GOOGLE_API_KEY", settings.google_api_key)
from app.database import engine
from app.models import Base, Bucket, User

logger = logging.getLogger(__name__)

DEFAULT_BUCKETS = [
    {"name": "Important", "description": "Emails requiring prompt attention or action"},
    {"name": "Can Wait", "description": "Non-urgent emails that can be addressed later"},
    {"name": "Auto-archive", "description": "Low-priority emails that can be archived automatically"},
    {"name": "Newsletter", "description": "Recurring informational emails, digests, and subscriptions"},
    {"name": "Promotional", "description": "Marketing, sales, and promotional emails"},
    {"name": "Social", "description": "Social media notifications and community updates"},
]


async def seed_buckets_for_user(user: User, session) -> None:
    existing = await session.execute(
        select(Bucket).where(Bucket.user_id == user.id)
    )
    if existing.scalars().first() is not None:
        return
    for b in DEFAULT_BUCKETS:
        session.add(Bucket(user_id=user.id, name=b["name"], description=b["description"]))
    await session.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables created")

    try:
        import logfire
        if settings.logfire_token:
            logfire.configure(token=settings.logfire_token)
            logfire.instrument_pydantic_ai()
            logger.info("Logfire tracing configured")
    except Exception:
        logger.warning("Logfire not configured")

    yield


app = FastAPI(title="Inbox Concierge", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.routers import auth, buckets, emails, feedback, preferences  # noqa: E402

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(emails.router, prefix="/emails", tags=["emails"])
app.include_router(buckets.router, prefix="/buckets", tags=["buckets"])
app.include_router(feedback.router, prefix="/feedback", tags=["feedback"])
app.include_router(preferences.router, prefix="/preferences", tags=["preferences"])


@app.get("/health")
async def health():
    return {"status": "ok"}
