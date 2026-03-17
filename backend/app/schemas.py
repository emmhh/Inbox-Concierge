from datetime import datetime, timezone

from pydantic import BaseModel, field_serializer


class UserOut(BaseModel):
    id: int
    email: str
    importance_context: str | None = ""

    model_config = {"from_attributes": True}


class BucketCreate(BaseModel):
    name: str
    description: str = ""
    examples: list[str] = []


class BucketUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    examples: list[str] | None = None


class BucketOut(BaseModel):
    id: int
    name: str
    description: str | None = ""
    examples: list[str] | None = []
    email_count: int = 0

    model_config = {"from_attributes": True}


class EmailOut(BaseModel):
    id: int
    thread_id: str
    subject: str | None = ""
    sender: str | None = ""
    snippet: str | None = ""
    date: datetime | None = None
    bucket_ids: list[int] = []
    bucket_names: list[str] = []

    model_config = {"from_attributes": True}

    @field_serializer("date")
    def serialize_date_utc(self, v: datetime | None) -> str | None:
        if v is None:
            return None
        return v.replace(tzinfo=timezone.utc).isoformat()


class FeedbackCreate(BaseModel):
    email_id: int
    bucket_id: int
    is_positive: bool
    correct_bucket_ids: list[int] = []
    reason: str = ""


class FeedbackOut(BaseModel):
    id: int
    email_id: int
    bucket_id: int
    is_positive: bool
    correct_bucket_ids: list[int] = []
    reason: str = ""
    created_at: datetime

    model_config = {"from_attributes": True}


class PreferencesUpdate(BaseModel):
    importance_context: str


class AuthURL(BaseModel):
    url: str
