import logging

from pydantic import BaseModel
from pydantic_ai import Agent
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import Bucket, Feedback, PromptSnapshot, User

logger = logging.getLogger(__name__)

PROMPT_TOKEN_THRESHOLD = 3000


class CompressedPrompt(BaseModel):
    compressed_text: str


_compressor_agent: Agent[None, CompressedPrompt] | None = None

COMPRESSOR_SYSTEM_PROMPT = (
    "You are a prompt optimizer. Your job is to compress a system prompt used for "
    "email classification. Rules:\n"
    "- Merge redundant or similar correction rules into general patterns\n"
    "- Preserve all bucket definitions and their descriptions exactly\n"
    "- Keep the user's importance context verbatim\n"
    "- Consolidate few-shot examples that express the same pattern\n"
    "- Never drop information, only condense\n"
    "- Return the compressed prompt as a single string"
)


def _get_compressor_agent() -> Agent[None, CompressedPrompt]:
    global _compressor_agent
    if _compressor_agent is None:
        _compressor_agent = Agent(
            "google-gla:gemini-2.5-flash",
            output_type=CompressedPrompt,
            system_prompt=COMPRESSOR_SYSTEM_PROMPT,
        )
    return _compressor_agent


async def build_system_prompt(user: User, db: AsyncSession) -> str:
    """Build the full dynamic system prompt for email classification."""
    parts: list[str] = []

    parts.append(
        "You are an email classifier. Given an email (subject, sender, date, body preview), "
        "assign it to one or more of the available buckets. An email can belong to multiple "
        "buckets. Only use bucket names from the list provided. Return the exact bucket names."
    )

    if user.importance_context:
        parts.append(
            f"\n## User Preferences\n"
            f"The user describes their email usage and priorities:\n"
            f'"{user.importance_context}"'
        )

    # Bucket definitions
    result = await db.execute(
        select(Bucket).where(Bucket.user_id == user.id).order_by(Bucket.created_at)
    )
    buckets = result.scalars().all()

    parts.append("\n## Available Buckets")
    for b in buckets:
        desc = f": {b.description}" if b.description else ""
        parts.append(f'- "{b.name}"{desc}')

    # Few-shot examples from bucket definitions
    examples_section = []
    for b in buckets:
        if b.examples:
            for ex in b.examples:
                examples_section.append(f'- Example for "{b.name}": {ex}')
    if examples_section:
        parts.append("\n## Few-Shot Examples")
        parts.extend(examples_section)

    # Feedback-derived correction rules (with email content as few-shot examples)
    fb_result = await db.execute(
        select(Feedback)
        .where(Feedback.user_id == user.id)
        .options(selectinload(Feedback.email))
        .order_by(Feedback.created_at)
    )
    all_feedback = fb_result.scalars().all()

    bucket_map = {b.id: b.name for b in buckets}

    correction_rules = []
    for fb in all_feedback:
        bucket_name = bucket_map.get(fb.bucket_id)
        if not bucket_name:
            continue

        email_ref = ""
        if fb.email:
            subj = fb.email.subject or "(no subject)"
            sender = fb.email.sender or "unknown"
            email_ref = f'Email "{subj}" from "{sender}" '

        if fb.is_positive:
            correction_rules.append(
                f"- {email_ref}is correctly classified as \"{bucket_name}\""
            )
        else:
            correct_names = [
                bucket_map[bid] for bid in (fb.correct_bucket_ids or [])
                if bid in bucket_map
            ]
            rule = f'- {email_ref}should NOT be "{bucket_name}"'
            if correct_names:
                rule += f', should be: {", ".join(f"{n!r}" for n in correct_names)}'
            if fb.reason:
                rule += f'. Reason: "{fb.reason}"'
            correction_rules.append(rule)

    if correction_rules:
        parts.append("\n## Correction Rules (learned from user feedback)")
        parts.extend(correction_rules)

    parts.append(
        "\n## Output Instructions\n"
        "Assign the email to one or more matching buckets from the list above. "
        "Return bucket names exactly as listed."
    )

    full_prompt = "\n".join(parts)

    estimated_tokens = len(full_prompt) // 4
    if estimated_tokens > PROMPT_TOKEN_THRESHOLD:
        logger.info(
            f"Prompt too long (~{estimated_tokens} tokens), compressing..."
        )
        try:
            result = await _get_compressor_agent().run(
                f"Compress this system prompt:\n\n{full_prompt}"
            )
            compressed = result.output.compressed_text

            snapshot = PromptSnapshot(
                user_id=user.id,
                full_prompt_text=full_prompt,
                compressed_prompt_text=compressed,
            )
            db.add(snapshot)
            await db.commit()

            return compressed
        except Exception as e:
            logger.warning(f"Prompt compression failed, using full prompt: {e}")

    return full_prompt
