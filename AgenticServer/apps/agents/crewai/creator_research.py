from __future__ import annotations

import re
import json
from datetime import datetime, timedelta, timezone
from typing import Any


RESEARCH_ACTIONS = (
    "research", "find what", "find today", "find the top", "top discussions",
    "people are talking", "people are discussing", "comments", "public sources",
    "cluster", "trend", "last 24", "last 30", "last 48", "last 7 days",
)
SOURCE_NAMES = {
    "reddit": ("reddit",),
    "twitter": ("twitter", "x.com", "twitter/x"),
    "youtube_comments": ("youtube comment", "youtube"),
    "substack": ("substack",),
    "web": ("public source", "other source", "web", "website"),
}


def _first_match(pattern: str, text: str) -> str | None:
    match = re.search(pattern, text, flags=re.IGNORECASE | re.MULTILINE)
    return match.group(1).strip(" \t\n.,;:\"") if match else None


def is_creator_research_prompt(topic: str) -> bool:
    lowered = topic.lower()
    action_count = sum(1 for signal in RESEARCH_ACTIONS if signal in lowered)
    source_count = sum(1 for aliases in SOURCE_NAMES.values() if any(alias in lowered for alias in aliases))
    has_recency = bool(re.search(r"\b(?:last|past|latest|today|recent)\b", lowered))
    return action_count >= 2 or (action_count >= 1 and (source_count >= 1 or has_recency))


def parse_creator_research_brief(topic: str, fallback_audience: str = "") -> dict[str, Any] | None:
    if not is_creator_research_prompt(topic):
        return None

    lowered = topic.lower()
    hours_match = re.search(r"(?:last|past)\s+(\d+)\s*hours?", lowered)
    days_match = re.search(r"(?:last|past)\s+(\d+)\s*days?", lowered)
    lookback_hours = int(hours_match.group(1)) if hours_match else int(days_match.group(1)) * 24 if days_match else 24
    lookback_hours = min(max(lookback_hours, 1), 24 * 30)

    limit_match = re.search(r"top\s+(\d+)", lowered)
    topic_limit = min(max(int(limit_match.group(1)), 1), 25) if limit_match else 10

    requested_sources = [
        name for name, aliases in SOURCE_NAMES.items()
        if any(alias in lowered for alias in aliases)
    ]
    if not requested_sources:
        requested_sources = ["reddit", "youtube_comments", "substack", "web"]

    audience = _first_match(
        r"my audience is\s+(.+?)(?=(?:\n|\.\s+|open\s+reddit|search\s+reddit|find\s+what))",
        topic,
    ) or fallback_audience.strip()
    if not audience or audience.lower() == "business and linkedin readers":
        audience = "Business decision-makers interested in this topic"

    theme = (
        _first_match(r"(?:cluster(?:\s+everything)?\s+(?:into|under)\s+(?:the\s+)?theme\s*:?\s*)([^\n.]+)", topic)
        or _first_match(r"theme\s*:\s*([^\n.]+)", topic)
        or "Key audience discussions"
    )

    now = datetime.now(timezone.utc)
    start = now - timedelta(hours=lookback_hours)
    return {
        "type": "creator_research",
        "audience": audience,
        "lookback_hours": lookback_hours,
        "topic_limit": topic_limit,
        "requested_sources": requested_sources,
        "themes": [theme],
        "research_window": {
            "hours": lookback_hours,
            "from": start.isoformat(),
            "to": now.isoformat(),
        },
    }


def creator_research_output_instruction(brief: dict[str, Any] | None) -> str:
    if not brief:
        return (
            "CREATOR RESEARCH OUTPUT: This is not a creator-research request. "
            "Set the top-level additional_information field to null."
        )

    return f"""
CREATOR RESEARCH OUTPUT: This request requires an additional creator research report.
Do not alter or remove any existing output field. Populate top-level additional_information using this exact shape:
{{
  "type": "creator_research",
  "audience": "{brief['audience']}",
  "research_window": {json.dumps(brief['research_window'])},
  "source_coverage": {{"source": "searched|partial|unavailable"}},
  "themes": [{{"name": "theme", "discussion_count": 0}}],
  "top_discussions": [{{
    "rank": 1,
    "headline": "evidence-based headline",
    "why_people_are_talking": "reason grounded in collected research",
    "emotional_hook": "specific emotional motivation",
    "debate_or_tension": "the competing views or tradeoff",
    "why_audience_cares": "practical relevance to the requested audience",
    "discussion_count": 0,
    "sources": [{{"platform": "source", "title": "source title", "url": "https://...", "published_at": "ISO timestamp or null"}}]
  }}],
  "warnings": []
}}
Return at most {brief['topic_limit']} ranked discussions under these requested themes: {brief['themes']}.
Use only supplied research evidence. Never manufacture source URLs, timestamps, engagement, discussion counts, or trends.
If evidence is insufficient, return fewer items and explain the limitation in warnings.
""".strip()


def finalize_additional_information(
    candidate: Any,
    brief: dict[str, Any] | None,
    collected_urls: list[str],
) -> dict[str, Any] | None:
    if not brief:
        return None

    report = dict(candidate) if isinstance(candidate, dict) else {}
    allowed_urls = set(collected_urls)
    discussions: list[dict[str, Any]] = []
    raw_discussions = report.get("top_discussions", report.get("topDiscussions", []))
    if isinstance(raw_discussions, list):
        for raw in raw_discussions[: brief["topic_limit"]]:
            if not isinstance(raw, dict):
                continue
            discussion = dict(raw)
            raw_sources = discussion.get("sources", [])
            discussion["sources"] = [
                source for source in raw_sources
                if isinstance(source, dict) and source.get("url") in allowed_urls
            ] if isinstance(raw_sources, list) else []
            has_meaningful_content = bool(
                discussion.get("headline")
                and any(discussion.get(field) for field in (
                    "why_people_are_talking",
                    "emotional_hook",
                    "debate_or_tension",
                    "why_audience_cares",
                ))
            )
            if has_meaningful_content and discussion["sources"]:
                discussions.append(discussion)

    # An unavailable-source status is operational metadata, not research data.
    # Keep the entire optional UI block absent until there is sourced content.
    if not discussions:
        return None

    model_warnings = report.get("warnings", [])
    warnings = list(brief.get("warnings", []))
    if isinstance(model_warnings, list):
        warnings.extend(str(item) for item in model_warnings if str(item).strip())
    return {
        "type": "creator_research",
        "audience": brief["audience"],
        "research_window": brief["research_window"],
        "source_coverage": brief.get("source_coverage", {}),
        "themes": report.get("themes") or [
            {"name": name, "discussion_count": 0} for name in brief.get("themes", [])
        ],
        "top_discussions": discussions,
        "warnings": list(dict.fromkeys(warnings)),
    }
