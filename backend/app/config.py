from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8000/auth/callback"
    google_api_key: str = ""

    database_url: str = "postgresql+asyncpg://inbox:inbox@localhost:5433/inbox_concierge"

    logfire_token: str = ""

    jwt_secret: str = "change-me-to-a-random-secret"
    encryption_key: str = ""
    frontend_url: str = "http://localhost:5173"

    model_config = {"env_file": "../.env", "extra": "ignore"}


settings = Settings()
