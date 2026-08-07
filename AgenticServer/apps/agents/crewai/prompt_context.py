from __future__ import annotations

import re
import json
from typing import Any


_PLATFORMS = (
    "linkedin", "tiktok", "instagram", "facebook", "youtube", "twitter", "x", "reddit",
)
_DEFAULT_VIDEO_PLATFORMS = ("instagram", "facebook", "linkedin", "youtube", "twitter")
_SPEC_PATTERNS = {
    "audience": r"(?im)^\s*(?:target\s+)?audience\s*:|\b(?:for|aimed at|targeting)\s+[^.!?\n]{2,80}\b(?:owners|founders|executives|leaders|heads|teams|professionals|operators)\b",
    "goal": r"(?im)^\s*(?:goal|objective|purpose|outcome)\s*:|\b(?:goal|objective|purpose)\s+is\b|\bshow how\b",
    "structure": r"(?im)^\s*(?:structure|format|outline|sections?)\s*:|\b(?:open|start|lead|close|end)\s+with\b|\b(?:include|cover)\s+(?:a|an|the|these|five|four|three|\d+)",
    "tone": r"(?im)^\s*(?:tone|voice|style)\s*:|\b(?:tone|voice|style)\s+(?:should|must|needs? to)\b",
    "avoid": r"(?im)^\s*(?:avoid|exclude|do not|don't|must not|without)\s*:|\b(?:avoid|exclude|do not|don't|must not|no hype|no jargon)\b",
    "duration": r"(?i)\b(?:\d+(?:\.\d+)?|one|two|three|four|five)\s*[- ]?\s*(?:seconds?|secs?|minutes?|mins?)\b",
    "deliverable": r"(?i)\b(?:create|write|produce|draft|generate|make)\b.{0,80}\b(?:post|short|video|script|article|report|brief|thread|carousel|caption|newsletter|email|story)\b",
}


def _extract_duration_seconds(topic: str) -> int | None:
    match = re.search(
        r"\b(\d+(?:\.\d+)?|one|two|three|four|five)\s*[- ]?\s*(seconds?|secs?|minutes?|mins?)\b",
        topic,
        re.I,
    )
    if not match:
        return None
    number_words = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5}
    amount_text = match.group(1).lower()
    amount = float(number_words.get(amount_text, amount_text))
    return round(amount * 60) if match.group(2).lower().startswith(("minute", "min")) else round(amount)


def _plain_markdown_line(line: str) -> str:
    return re.sub(r"[*_`#]", "", line).strip()


def _extract_named_block(topic: str, heading: str) -> list[str]:
    lines = topic.splitlines()
    collecting = False
    collected: list[str] = []
    target = heading.lower()
    for line in lines:
        plain = _plain_markdown_line(line)
        if not collecting:
            if plain.lower().rstrip(":") == target:
                collecting = True
            continue
        if plain and re.match(
            r"^(?:target audience|audience|goal|objective|purpose|script requirements|structure|output format|topic|tone|style|avoid|platform|duration)\s*:",
            plain,
            re.I,
        ):
            break
        collected.append(line)
    return collected


def _extract_output_fields(topic: str) -> list[str]:
    fields: list[str] = []
    inline = re.search(r"(?im)^\s*(?:[*_`#]+)?output format(?:[*_`#]+)?[ \t]*:[ \t]*([^\n]+)$", topic)
    if inline:
        for item in re.split(r"\s*(?:,|;|\|)\s*", _plain_markdown_line(inline.group(1))):
            if item and len(item) <= 80 and item not in fields:
                fields.append(item)
    for line in _extract_named_block(topic, "output format"):
        if not re.match(r"^\s*[-*+•]\s+", line):
            continue
        plain = _plain_markdown_line(line)
        plain = re.sub(r"^[-+•]\s*", "", plain).strip()
        if plain and len(plain) <= 80 and plain not in fields:
            fields.append(plain)
    return fields


def _time_label(seconds: int) -> str:
    return f"{seconds // 60}:{seconds % 60:02d}"


def _extract_structure_sections(topic: str) -> list[str]:
    sections: list[str] = []
    inline = re.search(r"(?im)^\s*(?:[*_`#]+)?structure(?:[*_`#]+)?[ \t]*:[ \t]*([^\n]+)$", topic)
    if inline:
        for item in re.split(r"\s*(?:,|;|\||->|→)\s*", _plain_markdown_line(inline.group(1))):
            label = re.sub(r"^\d+[.)]\s*", "", item).strip().rstrip(":")
            if label and len(label) <= 100 and label not in sections:
                sections.append(label)
    for line in _extract_named_block(topic, "structure"):
        plain = _plain_markdown_line(line)
        match = re.match(r"^\d+[.)]\s*(.+?)(?:\s*\([^)]*(?:seconds?|minutes?|secs?|mins?)[^)]*\))?\s*$", plain, re.I)
        if match:
            label = match.group(1).strip().rstrip(":")
            if label and label not in sections:
                sections.append(label)
    return sections


def _extract_exact_section_durations(topic: str, sections: list[str]) -> dict[str, int]:
    exact: dict[str, int] = {}
    for line in _extract_named_block(topic, "structure"):
        plain = _plain_markdown_line(line)
        match = re.match(
            r"^\d+[.)]\s*(.+?)\s*\(\s*(\d+(?:\.\d+)?)\s*(seconds?|secs?|minutes?|mins?)\s*\)\s*$",
            plain,
            re.I,
        )
        if not match:
            continue
        label = match.group(1).strip().rstrip(":")
        amount = float(match.group(2))
        seconds = round(amount * 60) if match.group(3).lower().startswith(("minute", "min")) else round(amount)
        if label in sections and seconds > 0:
            exact[label] = seconds
    return exact


def _section_weight(label: str) -> float:
    lowered = label.lower()
    if any(word in lowered for word in ("hook", "opening", "closing", "close", "cta")):
        return 0.7
    if any(word in lowered for word in ("example", "impact", "roi", "cost", "implementation")):
        return 1.2
    return 1.0


def _allocate_seconds(total: int, labels: list[str]) -> list[int]:
    weights = [_section_weight(label) for label in labels]
    weight_total = sum(weights)
    raw = [total * weight / weight_total for weight in weights]
    values = [int(value) for value in raw]
    remaining = total - sum(values)
    order = sorted(range(len(raw)), key=lambda index: raw[index] - values[index], reverse=True)
    for index in order[:remaining]:
        values[index] += 1
    return values


def _build_timeline(
    duration_seconds: int,
    structure: list[str],
    word_count: dict[str, int],
    exact_durations: dict[str, int] | None = None,
) -> list[dict[str, Any]]:
    if duration_seconds == 60 and not structure:
        labels = [
            "Opening Hook", "Problem Context", "First Insight", "Practical Example",
            "Business Impact", "Strategic Takeaway", "Closing",
        ]
        boundaries = [(0, 5), (5, 12), (12, 24), (24, 36), (36, 48), (48, 56), (56, 60)]
    else:
        labels = structure or [
            "Opening Hook", "Core Business Problem", "Practical Example",
            "Business Impact", "Strategic Takeaway", "Closing",
        ]
        fixed = exact_durations or {}
        fixed_total = sum(fixed.get(label, 0) for label in labels)
        unspecified = [label for label in labels if label not in fixed]
        if fixed and fixed_total <= duration_seconds and (unspecified or fixed_total == duration_seconds):
            remaining_values = _allocate_seconds(duration_seconds - fixed_total, unspecified) if unspecified else []
            remaining = iter(remaining_values)
            durations = [fixed[label] if label in fixed else next(remaining) for label in labels]
        else:
            durations = _allocate_seconds(duration_seconds, labels)
        boundaries = []
        cursor = 0
        for duration in durations:
            boundaries.append((cursor, cursor + duration))
            cursor += duration

    timeline = []
    for label, (start, end) in zip(labels, boundaries):
        share = (end - start) / duration_seconds
        timeline.append({
            "label": label,
            "start_seconds": start,
            "end_seconds": end,
            "timestamp": f"[{_time_label(start)}-{_time_label(end)}]",
            "word_min": max(1, round(word_count["min"] * share)),
            "word_max": max(1, round(word_count["max"] * share)),
        })
    return timeline


def _extract_word_range(topic: str) -> dict[str, int] | None:
    match = re.search(r"\b(\d{2,5})\s*[-–—]\s*(\d{2,5})\s+words?\b", topic, re.I)
    if not match:
        return None
    return {"min": int(match.group(1)), "max": int(match.group(2))}


def _field_key(label: str) -> str:
    key = re.sub(r"[^a-z0-9]+", "_", label.lower()).strip("_")
    aliases = {
        "video_title": "title",
        "opening_hook": "hook",
        "full_script": "script",
        "thumbnail_image_prompt": "thumbnail_concept",
    }
    return aliases.get(key, key)


def _build_video_card(topic: str, mode: str, duration_seconds: int | None) -> dict[str, Any]:
    if mode == "simple_topic":
        return {"replace_fallback": False}

    lowered = topic.lower()
    is_video_request = duration_seconds is not None or bool(
        re.search(r"\b(?:video|reel|shorts?|tiktok)\b", lowered)
        or ("script" in lowered and duration_seconds is not None)
    )
    if re.search(r"\b(?:do not|don't|without)\b.{0,30}\bvideo(?: script)?\b", lowered) or not is_video_request:
        return {"replace_fallback": False}

    requested_fields = _extract_output_fields(topic)
    if not requested_fields:
        requested_fields = ["Video Title", "Opening Hook", "Full Script"]

    thumbnail_forbidden = bool(re.search(r"\b(?:do not|don't|without|exclude)\b.{0,50}\bthumbnail", lowered))
    if not thumbnail_forbidden and re.search(r"\b(?:include|provide|show|add|output)\b.{0,35}\bthumbnail text\b", lowered) and not any(
        "thumbnail text" in field.lower() for field in requested_fields
    ):
        requested_fields.append("Thumbnail Text")
    if not thumbnail_forbidden and re.search(r"\b(?:include|provide|show|add|output)\b.{0,35}\bthumbnail (?:image prompt|concept)\b", lowered) and not any(
        "thumbnail" in field.lower() and ("prompt" in field.lower() or "concept" in field.lower())
        for field in requested_fields
    ):
        requested_fields.append("Thumbnail Image Prompt")

    effective_duration = duration_seconds or 60
    explicit_word_count = _extract_word_range(topic)
    if explicit_word_count:
        word_count = explicit_word_count
    elif effective_duration == 60:
        word_count = {"min": 170, "max": 195}
    else:
        word_count = {
            "min": round(effective_duration * 130 / 60),
            "max": round(effective_duration * 155 / 60),
        }
    structure = _extract_structure_sections(topic)
    exact_durations = _extract_exact_section_durations(topic, structure)
    timeline = _build_timeline(effective_duration, structure, word_count, exact_durations)

    if effective_duration % 60 == 0:
        duration_label = f"{effective_duration // 60}-Minute"
    else:
        duration_label = f"{effective_duration}-Second"
    card_title = (
        f"{duration_label} Executive Business Video"
        if "executive" in lowered
        else f"{duration_label} Video Script"
    )
    return {
        "replace_fallback": True,
        "title": card_title,
        "duration_seconds": effective_duration,
        "duration_source": "explicit" if duration_seconds is not None else "fallback",
        "fields": [{"key": _field_key(label), "label": label} for label in requested_fields],
        "structure": [item["label"] for item in timeline],
        "word_count": word_count,
        "word_count_source": "explicit" if explicit_word_count else "fallback" if duration_seconds is None else "duration_derived",
        "timeline": timeline,
    }


def resolve_prompt_context(topic: str, audience: str, tone: str) -> dict[str, Any]:
    """Classify a topic without trying to replace the LLM's semantic interpretation."""
    clean_topic = (topic or "").strip()
    dimensions = [name for name, pattern in _SPEC_PATTERNS.items() if re.search(pattern, clean_topic)]
    heading_count = sum(
        1
        for line in clean_topic.splitlines()
        if re.match(
            r"^(?:target\s+)?(?:audience|goal|objective|purpose|structure|format|output format|script requirements|tone|style|avoid|include|platform|duration)\s*:",
            _plain_markdown_line(line),
            re.I,
        )
    )
    instruction_density = len(dimensions)
    duration_seconds = _extract_duration_seconds(clean_topic)
    video_instruction = duration_seconds is not None or bool(
        "deliverable" in dimensions
        and re.search(r"\b(?:video|reel|shorts?|script|tiktok)\b", clean_topic, re.I)
    ) or bool(
        re.search(r"\b(?:video script|video content|short-form video|short form video)\b", clean_topic, re.I)
    )
    is_custom = video_instruction or heading_count >= 2 or instruction_density >= 3 or (
        "deliverable" in dimensions and instruction_density >= 2
    )
    platforms = []
    lowered = clean_topic.lower()
    for platform in _PLATFORMS:
        if re.search(rf"\b{re.escape(platform)}\b", lowered):
            normalized = "twitter" if platform == "x" else platform
            if normalized not in platforms:
                platforms.append(normalized)

    mode = "custom_brief" if is_custom else "simple_topic"
    video_card = _build_video_card(clean_topic, mode, duration_seconds)
    resolved_platforms = platforms or (
        list(_DEFAULT_VIDEO_PLATFORMS) if video_card.get("replace_fallback") else []
    )
    public_brief = {
        "mode": mode,
        "explicit_dimensions": dimensions,
        "requested_platforms": platforms,
        "resolved_platforms": resolved_platforms,
        "duration_seconds": duration_seconds,
        "fallback_audience": audience,
        "fallback_tone": tone,
        "video_card": video_card,
    }

    if not is_custom:
        instruction = (
            "PROMPT MODE: SIMPLE TOPIC. Apply the existing platform, structure, length, audience, tone, "
            "and validation defaults. Treat the topic as the subject, not as a replacement output contract."
        )
    else:
        instruction = f"""PROMPT MODE: CUSTOM CREATIVE BRIEF.
The complete text below is the authoritative content brief, even when it is conversational or does not use headings:
<USER_BRIEF>
{clean_topic}
</USER_BRIEF>

CUSTOM BRIEF PRECEDENCE:
1. Follow every explicit or clearly implied deliverable, platform, duration, audience, goal, structure, tone, inclusion, exclusion, CTA, and formatting instruction in USER_BRIEF.
2. USER_BRIEF overrides every legacy default that conflicts with it, including one-minute timelines, fixed word counts, mandatory old section names, long-form platform patterns, and default tone/style rules. A later legacy rule marked MUST or MANDATORY is still void when it conflicts with USER_BRIEF.
3. For a dimension not specified in USER_BRIEF, inherit the supplied audience '{audience}' and supplied tone '{tone}'. When a video is requested without naming a platform, generate all resolved platforms {resolved_platforms}.
4. Keep the machine-readable JSON envelope, but make its actual content and sections match USER_BRIEF. Every resolved platform MUST contain its normal platform-native post content as well as video content; video instructions never replace the caption, post, description, tags, or hashtags.
5. When video_card.replace_fallback is true, every resolved platform MUST contain a shortFormVideo presentation matching this exact resolved UI contract: {video_card}. The Full Script MUST use every exact timestamp and section label in video_card.timeline, end at video_card.duration_seconds, and contain complete presenter-ready dialogue proportional to each window's word_min and word_max. Do not return one short sentence per timestamp, an outline, or placeholders. Timestamps and headings do not count as spoken words. Do not add legacy video display fields unless video_card.fields requests them. When replace_fallback is false, do not invent a video card for a non-video deliverable.
6. Do not invent facts, metrics, case studies, or ROI. A requested real-world example must be source-grounded or transparently framed as a representative scenario.
7. Return generation_brief with mode, requested_platforms, resolved_platforms, duration_seconds, explicit_dimensions, video_card, and a concise resolved_summary so the UI can explain which contract was followed.
"""

    return {**public_brief, "instruction": instruction}


def public_prompt_context(context: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in context.items() if key != "instruction"}


def build_output_contract(base_contract: str, context: dict[str, Any]) -> str:
    if context.get("mode") != "custom_brief":
        return base_contract
    video_card = context.get("video_card", {})
    platforms = context.get("resolved_platforms") or context.get("requested_platforms") or ["linkedin"]
    native_shapes: dict[str, dict[str, Any]] = {
        "instagram": {"caption": "<complete Instagram caption>", "hashtags": ["<Instagram hashtag>"]},
        "facebook": {"caption": "<complete Facebook post>", "hashtags": ["<Facebook hashtag>"]},
        "linkedin": {"content": "<complete LinkedIn post>", "hashtags": ["<LinkedIn hashtag>"]},
        "youtube": {
            "title": "<YouTube title>",
            "description": "<complete YouTube description>",
            "tags": ["<YouTube tag>"],
        },
        "twitter": {"content": "<complete Twitter/X post or thread>", "hashtags": ["<Twitter hashtag>"]},
        "reddit": {"title": "<Reddit title>", "content": "<complete Reddit post>"},
        "tiktok": {"caption": "<complete TikTok caption>", "hashtags": ["<TikTok hashtag>"]},
    }
    platform_schema = {}
    for platform in platforms:
        platform_content = dict(native_shapes.get(platform, {"content": "<complete platform-native post>"}))
        if video_card.get("replace_fallback"):
            platform_content["shortFormVideo"] = {
                **{field["key"]: f"<complete {field['label']}>" for field in video_card.get("fields", [])},
                "duration_seconds": video_card.get("duration_seconds"),
                "presentation": {
                    "replace_fallback": True,
                    "title": video_card.get("title"),
                    "sections": [
                        {"key": field["key"], "label": field["label"], "content": "<complete requested content>"}
                        for field in video_card.get("fields", [])
                    ],
                },
            }
        platform_schema[platform] = platform_content
    schema = {
        "title": "<prompt-aligned title>",
        "summary": "<concise summary>",
        "selected_focus": "<selected focus>",
        "master_article": "<supporting content>",
        "platforms": platform_schema,
        "generation_brief": public_prompt_context(context),
        "additional_information": None,
        "instagram_carousel": {"slides": []},
    }
    return (
        "Return one valid JSON object using this custom-mode structure. Replace every placeholder with complete content. "
        "Do not add unrequested platforms or legacy video rules.\n"
        f"{json.dumps(schema, indent=2)}\n\n{context['instruction']}"
    )


def build_novelty_instructions(
    metadata: dict[str, Any],
    audience: str,
    tone: str,
) -> tuple[str, str]:
    novelty = metadata.get("contentNovelty", {}) if isinstance(metadata, dict) else {}
    previous_items = novelty.get("previousItems", []) if isinstance(novelty, dict) else []
    previous_lines: list[str] = []

    if isinstance(previous_items, list):
        for index, item in enumerate(previous_items[:12], 1):
            if not isinstance(item, dict):
                continue
            short_form_lines = []
            short_form_videos = item.get("shortFormVideos", [])
            if isinstance(short_form_videos, list):
                for video in short_form_videos[:3]:
                    if not isinstance(video, dict):
                        continue
                    short_form_lines.append(
                        f"{video.get('platform')}: title={video.get('title') or ''}; "
                        f"hook={video.get('hook') or ''}; ending={video.get('scriptEnding') or ''}; "
                        f"thumbnail={video.get('thumbnailText') or ''}; hashtags={video.get('hashtags') or []}"
                    )
            previous_lines.append(
                f"{index}. Title: {item.get('title') or 'Untitled'} | "
                f"Focus: {item.get('selectedFocus') or 'Not provided'} | "
                f"Summary: {item.get('summary') or item.get('contentExcerpt') or ''} | "
                f"Prior shorts: {' || '.join(short_form_lines) or 'Not provided'}"
            )

    rejected_candidate = novelty.get("rejectedCandidate") if isinstance(novelty, dict) else None
    if isinstance(rejected_candidate, dict):
        previous_lines.append(
            "REJECTED CURRENT DRAFT - do not paraphrase it: "
            f"platform={rejected_candidate.get('platform')}; title={rejected_candidate.get('title') or ''}; "
            f"hook={rejected_candidate.get('hook') or ''}; script={rejected_candidate.get('scriptExcerpt') or ''}; "
            f"matched prior title={rejected_candidate.get('previousTitle') or ''}; "
            f"matched prior hook={rejected_candidate.get('previousHook') or ''}"
        )

    full_instruction = (
        "NOVELTY MEMORY:\n"
        "Previous generated content for this automation/topic/audience:\n"
        + ("\n".join(previous_lines) if previous_lines else "None provided.")
        + "\n\nNOVELTY RULES:\n"
        "  - Generate a genuinely new angle today. Do NOT reuse prior titles, selected focus, hooks, examples, CTAs, key points, or hashtag clusters.\n"
        "  - Rotate the angle through a different lens such as trust, operations, customer experience, product quality, cost, growth, risk, vendor management, founder decision-making, or compliance/safety.\n"
        "  - If previous content focused on one lens, choose a different lens and explain it in a new way.\n"
        "  - The final title must be fresh, audience-specific, curiosity-driven, and clearly different from previous titles.\n"
        "  - Before drafting, produce [NOVELTY_PLAN] naming the prior angle and hook mechanism being avoided, then state the new central promise, opening mechanism, narrative structure, three insights, CTA, thumbnail metaphor, and hashtag direction.\n"
        "  - For short-form video, change the opening mechanism and narrative structure; do not merely paraphrase old sentences.\n"
        "  - Make the new short informative and shareable: high information density, a curiosity promise resolved within the script, a quotable insight, one surprising nuance, and a practical next action. Never use unsupported hype or fabricated urgency.\n"
        f"  - Keep the requested topic, audience '{audience}', and tone '{tone}' intact even while changing the angle.\n"
    )
    follow_through = (
        "NOVELTY FOLLOW-THROUGH: Apply the [NOVELTY_PLAN] from the research context. "
        "Keep its new angle, opening mechanism, examples, CTA, thumbnail metaphor, and hashtag direction; "
        "do not reproduce anything identified as prior or rejected content.\n"
    )
    return full_instruction, follow_through
