from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

from django.conf import settings
from openai import OpenAI


@dataclass
class OpenAIWebSearchNewsResult:
    title: str
    summary: str
    content: str
    hashtags: list[str]
    keywords: list[str]
    source_urls: list[str]
    platform_specific_content: dict[str, Any]
    additional_information: dict[str, Any]
    generation_brief: dict[str, Any]
    master_article: dict[str, Any]


def generate_social_news_with_web_search(
    *,
    topic: str,
    audience: str,
    tone: str,
    metadata: dict[str, Any] | None = None,
) -> OpenAIWebSearchNewsResult:
    if not settings.OPENAI_API_KEY:
        raise ValueError("OpenAI API key is not configured for web-search news generation.")

    config = metadata.get("openaiWebSearchNews", {}) if isinstance(metadata, dict) else {}
    lookback_hours = int(config.get("lookbackHours", 24) or 24)
    search_context_size = str(config.get("searchContextSize", "high") or "high")
    model = str(config.get("model") or settings.OPENAI_WEB_SEARCH_MODEL or "gpt-5.5")

    client_kwargs: dict[str, Any] = {"api_key": settings.OPENAI_API_KEY}
    if settings.OPENAI_BASE_URL:
        client_kwargs["base_url"] = settings.OPENAI_BASE_URL
    client = OpenAI(**client_kwargs)

    raw_response = client.responses.create(
        model=model,
        input=topic,
        tools=[
            {
                "type": "web_search",
                "search_context_size": search_context_size,
            }
        ],
    )

    primary_output = (getattr(raw_response, "output_text", None) or "").strip()
    source_urls = _extract_source_urls(raw_response)

    structuring_prompt = (
        "You are preparing structured social publishing metadata from a direct web-search answer.\n"
        f"Target audience: {audience}\n"
        f"Desired tone: {tone}\n\n"
        "Use the direct answer below as the primary source of truth. Keep the same selected development focus "
        "and do not invent new facts.\n\n"
        "USER REQUEST:\n"
        f"{topic}\n\n"
        "DIRECT WEB-SEARCH ANSWER:\n"
        f"{primary_output}\n\n"
        "CITED SOURCE URLS:\n"
        + ("\n".join(f"- {url}" for url in source_urls) if source_urls else "- No source URLs extracted") +
        "\n\nReturn structured JSON for the app UI.\n"
        "PLATFORM RULES:\n"
        "- Main content is the source of truth; all platform content must be derived from it.\n"
        "- Do not introduce new facts beyond the direct answer.\n"
        "- Add platform-appropriate hooks and hashtags.\n"
        "- Respect practical character limits:\n"
        "  * LinkedIn content: 600-1100 characters, professional and executive.\n"
        "  * Instagram caption: 300-700 characters, punchy and readable with line breaks.\n"
        "  * Facebook caption: 400-900 characters, conversational and clear.\n"
        "  * YouTube description: 500-1200 characters, video-oriented summary.\n"
        "- For LinkedIn, Facebook, and Instagram, start the post body with the hook.\n"
        "- For YouTube, create a strong title, concise description, relevant tags, thumbnail text, thumbnail concept, pinned comment, and community post.\n"
        "- Optimize each platform for its native style while keeping the same core message."
    )

    structured_response = client.responses.create(
        model=model,
        input=structuring_prompt,
        text={
            "format": {
                "type": "json_schema",
                "name": "social_news_web_search_payload",
                "strict": True,
                "schema": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "title": {"type": "string"},
                        "summary": {"type": "string"},
                        "master_article": {
                            "type": "object",
                            "additionalProperties": False,
                            "properties": {
                                "headline": {"type": "string"},
                                "timeframe": {"type": "string"},
                                "overview": {"type": "string"},
                                "key_updates": {
                                    "type": "array",
                                    "items": {"type": "string"},
                                    "minItems": 2,
                                    "maxItems": 8,
                                },
                                "why_it_matters": {
                                    "type": "array",
                                    "items": {"type": "string"},
                                    "minItems": 2,
                                    "maxItems": 6,
                                },
                                "watch_next": {
                                    "type": "array",
                                    "items": {"type": "string"},
                                    "minItems": 1,
                                    "maxItems": 5,
                                },
                                "source_notes": {
                                    "type": "array",
                                    "items": {"type": "string"},
                                    "minItems": 1,
                                    "maxItems": 8,
                                },
                            },
                            "required": [
                                "headline",
                                "timeframe",
                                "overview",
                                "key_updates",
                                "why_it_matters",
                                "watch_next",
                                "source_notes",
                            ],
                        },
                        "platform_specific_content": {
                            "type": "object",
                            "additionalProperties": False,
                            "properties": {
                                "linkedin": {
                                    "type": "object",
                                    "additionalProperties": False,
                                    "properties": {
                                        "hook": {"type": "string"},
                                        "content": {"type": "string"},
                                        "hashtags": {
                                            "type": "array",
                                            "items": {"type": "string"},
                                            "minItems": 3,
                                            "maxItems": 8,
                                        },
                                    },
                                    "required": ["hook", "content", "hashtags"],
                                },
                                "instagram": {
                                    "type": "object",
                                    "additionalProperties": False,
                                    "properties": {
                                        "hook": {"type": "string"},
                                        "caption": {"type": "string"},
                                        "hashtags": {
                                            "type": "array",
                                            "items": {"type": "string"},
                                            "minItems": 5,
                                            "maxItems": 15,
                                        },
                                    },
                                    "required": ["hook", "caption", "hashtags"],
                                },
                                "facebook": {
                                    "type": "object",
                                    "additionalProperties": False,
                                    "properties": {
                                        "hook": {"type": "string"},
                                        "caption": {"type": "string"},
                                        "hashtags": {
                                            "type": "array",
                                            "items": {"type": "string"},
                                            "minItems": 3,
                                            "maxItems": 8,
                                        },
                                    },
                                    "required": ["hook", "caption", "hashtags"],
                                },
                                "youtube": {
                                    "type": "object",
                                    "additionalProperties": False,
                                    "properties": {
                                        "title": {"type": "string"},
                                        "description": {"type": "string"},
                                        "tags": {
                                            "type": "array",
                                            "items": {"type": "string"},
                                            "minItems": 3,
                                            "maxItems": 12,
                                        },
                                        "thumbnail_text": {"type": "string"},
                                        "thumbnail_concept": {"type": "string"},
                                        "pinned_comment": {"type": "string"},
                                        "community_post": {"type": "string"},
                                    },
                                    "required": [
                                        "title",
                                        "description",
                                        "tags",
                                        "thumbnail_text",
                                        "thumbnail_concept",
                                        "pinned_comment",
                                        "community_post",
                                    ],
                                },
                            },
                            "required": ["linkedin", "instagram", "facebook", "youtube"],
                        },
                        "hashtags": {
                            "type": "array",
                            "items": {"type": "string"},
                            "minItems": 3,
                            "maxItems": 12,
                        },
                        "keywords": {
                            "type": "array",
                            "items": {"type": "string"},
                            "minItems": 3,
                            "maxItems": 12,
                        },
                    },
                    "required": [
                        "title",
                        "summary",
                        "master_article",
                        "platform_specific_content",
                        "hashtags",
                        "keywords",
                    ],
                },
            },
            "verbosity": "medium",
        },
    )

    payload = json.loads(structured_response.output_text)
    master_article = payload["master_article"]
    content = _render_master_article(master_article)
    hashtags = _normalize_string_list(payload.get("hashtags"))
    platform_specific_content = _normalize_platform_specific_content(payload.get("platform_specific_content"), hashtags)

    additional_information = {
        "source_type": "openai_web_search",
        "lookback_hours": lookback_hours,
        "search_context_size": search_context_size,
        "source_urls": source_urls,
        "master_article": master_article,
        "raw_api_response": structured_response.output_text,
        "raw_main_content": primary_output,
    }
    generation_brief = {
        "provider": "openai",
        "mode": "web_search_news",
        "model": model,
        "topic": topic,
        "audience": audience,
        "tone": tone,
        "lookback_hours": lookback_hours,
    }

    return OpenAIWebSearchNewsResult(
        title=str(payload["title"]).strip(),
        summary=str(payload["summary"]).strip(),
        content=content,
        hashtags=hashtags,
        keywords=_normalize_string_list(payload.get("keywords")),
        source_urls=source_urls,
        platform_specific_content=platform_specific_content,
        additional_information=additional_information,
        generation_brief=generation_brief,
        master_article=master_article,
    )


def _normalize_string_list(values: Any) -> list[str]:
    if not isinstance(values, list):
        return []
    normalized: list[str] = []
    seen: set[str] = set()
    for value in values:
        if not isinstance(value, str):
            continue
        item = value.strip()
        if not item:
            continue
        key = item.lower()
        if key in seen:
            continue
        seen.add(key)
        normalized.append(item)
    return normalized


def _extract_source_urls(response: Any) -> list[str]:
    urls: list[str] = []
    seen: set[str] = set()

    for output_item in getattr(response, "output", []) or []:
        for content_item in getattr(output_item, "content", []) or []:
            for annotation in getattr(content_item, "annotations", []) or []:
                if getattr(annotation, "type", None) != "url_citation":
                    continue
                url = getattr(annotation, "url", None)
                if not url or url in seen:
                    continue
                seen.add(url)
                urls.append(url)

    return urls


def _render_master_article(master_article: dict[str, Any]) -> str:
    sections: list[str] = []

    headline = str(master_article.get("headline", "")).strip()
    timeframe = str(master_article.get("timeframe", "")).strip()
    overview = str(master_article.get("overview", "")).strip()

    if headline:
        sections.append(f"# {headline}")
    if timeframe:
        sections.append(f"## Timeframe\n{timeframe}")
    if overview:
        sections.append(f"## Overview\n{overview}")

    def add_list_section(title: str, values: Any) -> None:
        if not isinstance(values, list):
            return
        items = [str(value).strip() for value in values if isinstance(value, str) and str(value).strip()]
        if not items:
            return
        body = "\n".join(f"- {item}" for item in items)
        sections.append(f"## {title}\n{body}")

    add_list_section("Key Updates", master_article.get("key_updates"))
    add_list_section("Why It Matters", master_article.get("why_it_matters"))
    add_list_section("Watch Next", master_article.get("watch_next"))
    add_list_section("Source Notes", master_article.get("source_notes"))

    return "\n\n".join(section.strip() for section in sections if section.strip()).strip()


def _normalize_platform_specific_content(value: Any, fallback_hashtags: list[str]) -> dict[str, Any]:
    if not isinstance(value, dict):
        return {}

    normalized: dict[str, Any] = {}

    linkedin = value.get("linkedin")
    if isinstance(linkedin, dict):
        hook = _clean_text(linkedin.get("hook"))
        body = _clean_text(linkedin.get("content"))
        normalized["linkedin"] = {
            "content": _merge_hook_and_body(hook, body, 1100),
            "hashtags": _normalize_string_list(linkedin.get("hashtags")) or fallback_hashtags[:6],
        }

    instagram = value.get("instagram")
    if isinstance(instagram, dict):
        hook = _clean_text(instagram.get("hook"))
        body = _clean_text(instagram.get("caption"))
        normalized["instagram"] = {
            "caption": _merge_hook_and_body(hook, body, 700),
            "hashtags": _normalize_string_list(instagram.get("hashtags")) or fallback_hashtags[:10],
        }

    facebook = value.get("facebook")
    if isinstance(facebook, dict):
        hook = _clean_text(facebook.get("hook"))
        body = _clean_text(facebook.get("caption"))
        normalized["facebook"] = {
            "caption": _merge_hook_and_body(hook, body, 900),
            "hashtags": _normalize_string_list(facebook.get("hashtags")) or fallback_hashtags[:6],
        }

    youtube = value.get("youtube")
    if isinstance(youtube, dict):
        normalized["youtube"] = {
            "title": _truncate(_clean_text(youtube.get("title")), 100),
            "description": _truncate(_clean_text(youtube.get("description")), 1200),
            "tags": _normalize_string_list(youtube.get("tags")) or fallback_hashtags[:8],
            "thumbnail_text": _truncate(_clean_text(youtube.get("thumbnail_text")), 80),
            "thumbnail_concept": _truncate(_clean_text(youtube.get("thumbnail_concept")), 280),
            "pinned_comment": _truncate(_clean_text(youtube.get("pinned_comment")), 280),
            "community_post": _truncate(_clean_text(youtube.get("community_post")), 400),
        }

    return normalized


def _clean_text(value: Any) -> str:
    return str(value).strip() if isinstance(value, str) else ""


def _merge_hook_and_body(hook: str, body: str, max_length: int) -> str:
    if hook and body:
        text = body if body.lower().startswith(hook.lower()) else f"{hook}\n\n{body}"
    else:
        text = hook or body
    return _truncate(text, max_length)


def _truncate(value: str, max_length: int) -> str:
    if len(value) <= max_length:
        return value
    shortened = value[: max_length - 1].rstrip()
    return f"{shortened}…"
