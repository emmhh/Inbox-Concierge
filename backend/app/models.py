from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    email = Column(Text, unique=True, nullable=False)
    google_access_token = Column(Text, nullable=True)
    google_refresh_token = Column(Text, nullable=True)
    token_expiry = Column(DateTime, nullable=True)
    importance_context = Column(Text, nullable=True, default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    buckets = relationship("Bucket", back_populates="user", cascade="all, delete-orphan")
    emails = relationship("Email", back_populates="user", cascade="all, delete-orphan")
    feedback = relationship("Feedback", back_populates="user", cascade="all, delete-orphan")


class Bucket(Base):
    __tablename__ = "buckets"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(Text, nullable=False)
    description = Column(Text, nullable=True, default="")
    examples = Column(JSONB, nullable=True, default=list)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="buckets")
    email_buckets = relationship("EmailBucket", back_populates="bucket", cascade="all, delete-orphan")
    feedback = relationship("Feedback", back_populates="bucket", cascade="all, delete-orphan")


class Email(Base):
    __tablename__ = "emails"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    thread_id = Column(Text, nullable=False)
    message_id = Column(Text, nullable=True)
    subject = Column(Text, nullable=True, default="")
    sender = Column(Text, nullable=True, default="")
    snippet = Column(Text, nullable=True, default="")
    body_preview = Column(Text, nullable=True, default="")
    date = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="emails")
    email_buckets = relationship("EmailBucket", back_populates="email", cascade="all, delete-orphan")
    feedback = relationship("Feedback", back_populates="email", cascade="all, delete-orphan")

    __table_args__ = (UniqueConstraint("user_id", "thread_id", name="uq_user_thread"),)


class EmailBucket(Base):
    __tablename__ = "email_buckets"

    email_id = Column(Integer, ForeignKey("emails.id", ondelete="CASCADE"), primary_key=True)
    bucket_id = Column(Integer, ForeignKey("buckets.id", ondelete="CASCADE"), primary_key=True)

    email = relationship("Email", back_populates="email_buckets")
    bucket = relationship("Bucket", back_populates="email_buckets")


class Feedback(Base):
    __tablename__ = "feedback"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    email_id = Column(Integer, ForeignKey("emails.id", ondelete="CASCADE"), nullable=False)
    bucket_id = Column(Integer, ForeignKey("buckets.id", ondelete="CASCADE"), nullable=False)
    is_positive = Column(Boolean, nullable=False)
    correct_bucket_ids = Column(JSONB, nullable=True, default=list)
    reason = Column(Text, nullable=True, default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="feedback")
    email = relationship("Email", back_populates="feedback")
    bucket = relationship("Bucket", back_populates="feedback")

    __table_args__ = (
        UniqueConstraint("user_id", "email_id", "bucket_id", name="uq_user_email_bucket"),
    )


class PromptSnapshot(Base):
    __tablename__ = "prompt_snapshots"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    full_prompt_text = Column(Text, nullable=True)
    compressed_prompt_text = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
