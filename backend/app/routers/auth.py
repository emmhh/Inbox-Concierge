from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth_utils import create_jwt, encrypt_token, get_current_user
from app.config import settings
from app.database import get_db
from app.main import seed_buckets_for_user
from app.models import User
from app.schemas import AuthURL, UserOut

router = APIRouter()

SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
]

# In-memory store for PKCE code verifiers, keyed by OAuth state
_pending_states: dict[str, str] = {}


def _build_flow() -> Flow:
    client_config = {
        "web": {
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [settings.google_redirect_uri],
        }
    }
    flow = Flow.from_client_config(client_config, scopes=SCOPES)
    flow.redirect_uri = settings.google_redirect_uri
    return flow


@router.get("/login", response_model=AuthURL)
async def login():
    flow = _build_flow()
    auth_url, state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
    )
    # Store the code verifier so we can use it in the callback
    _pending_states[state] = flow.code_verifier
    return AuthURL(url=auth_url)


@router.get("/callback")
async def callback(code: str, state: str, db: AsyncSession = Depends(get_db)):
    flow = _build_flow()

    # Restore the PKCE code verifier from the login step
    code_verifier = _pending_states.pop(state, None)
    flow.fetch_token(code=code, code_verifier=code_verifier)
    credentials: Credentials = flow.credentials

    from google.oauth2 import id_token
    from google.auth.transport.requests import Request as GoogleRequest

    id_info = id_token.verify_oauth2_token(
        credentials.id_token, GoogleRequest(), settings.google_client_id
    )
    email = id_info.get("email", "")

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalars().first()

    if user is None:
        user = User(email=email)
        db.add(user)
        await db.flush()

    user.google_access_token = encrypt_token(credentials.token)
    if credentials.refresh_token:
        user.google_refresh_token = encrypt_token(credentials.refresh_token)
    if credentials.expiry:
        expiry = credentials.expiry
        if expiry.tzinfo is not None:
            expiry = expiry.replace(tzinfo=None)
        user.token_expiry = expiry
    else:
        user.token_expiry = datetime.utcnow()

    await db.commit()
    await db.refresh(user)

    await seed_buckets_for_user(user, db)

    token = create_jwt(user.id, user.email)
    return RedirectResponse(url=f"{settings.frontend_url}?token={token}")


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)):
    return user
