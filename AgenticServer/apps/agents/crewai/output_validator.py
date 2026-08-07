import re
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

BANNNED_CTAS = [
    "What do you think?",
    "Share your thoughts",
    "Let me know in the comments",
    "Like and follow",
    "Drop a comment",
]

STOP_WORDS = {
    "and", "the", "for", "with", "from", "that", "this", "your", "about",
    "into", "use", "uses", "using", "ai", "ml", "data", "model", "engine",
    "content", "post", "update",
}

MASTER_ARTICLE_REQUIRED_SECTIONS = [
    "Executive Summary",
    "Target Audience",
    "Business Summary",
    "Why This Topic Matters Now",
    "Key Concepts",
    "Business Impact & Opportunities",
    "Industry Use Cases",
    "Actionable Recommendations",
    "Risks, Challenges & Considerations",
    "Common Mistakes",
    "Metrics To Track",
    "Content Repurposing Ideas",
    "Key Takeaways",
    "Discussion Question",
]

YOUTUBE_DESCRIPTION_REQUIRED_SECTIONS = [
    "Video Angle",
    "Target Audience",
    "Business Summary",
    "Why Watch Now",
    "Business Impact & Opportunities",
    "Key Talking Points",
    "Actionable Recommendations",
    "Proof Points Or Examples",
    "Viewer Takeaways",
    "Discussion Question",
    "Shorts Ideas",
]


def _section_heading_pattern(section: str) -> str:
    return rf"(?im)^\s*#+\s*{re.escape(section)}\s*$"


def _has_heading(text: str, section: str) -> bool:
    return bool(re.search(_section_heading_pattern(section), text))


def _plain_text(value: str) -> str:
    text = re.sub(r"```.*?```", " ", value, flags=re.S)
    text = re.sub(r"(?m)^\s*#+\s*", ". ", text)
    text = re.sub(r"[*_`>#|]", "", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def _sentence_items(*sources: str, limit: int = 5) -> list[str]:
    raw = "\n".join(source for source in sources if isinstance(source, str))
    line_candidates: list[str] = []
    for line in raw.splitlines():
        clean = re.sub(r"^\s*(?:#+|[-*•]|\d+[.)])\s*", "", line).strip()
        clean = re.sub(r"\*\*(.*?)\*\*", r"\1", clean)
        if len(clean) < 35:
            continue
        if not clean.endswith((".", "!", "?")):
            clean += "."
        line_candidates.append(clean)

    joined = _plain_text(" ".join(line_candidates) or raw)
    sentences = [sentence.strip(" -•\t\n") for sentence in re.split(r"(?<=[.!?])\s+", joined) if len(sentence.strip()) > 35]

    deduped: list[str] = []
    seen: set[str] = set()
    for sentence in sentences:
        key = sentence.lower()
        if key in seen:
            continue
        seen.add(key)
        deduped.append(sentence)
        if len(deduped) >= limit:
            break

    return deduped


def _bullet_items(source: str, limit: int = 6) -> list[str]:
    items = []
    for line in source.splitlines():
        clean = re.sub(r"^\s*(?:[-*•]|\d+[.)])\s*", "", line).strip()
        clean = re.sub(r"\*\*(.*?)\*\*", r"\1", clean)
        if len(clean) > 12 and clean not in items:
            items.append(clean)
        if len(items) >= limit:
            break
    return items


def _list_text(items: list[str]) -> str:
    return "\n".join(f"{index + 1}. {item}" for index, item in enumerate(items))


def _topic_phrase(topic: str) -> str:
    return topic.strip() or "this topic"


def _fallback_section(section: str, topic: str, source_text: str = "") -> str:
    topic_name = topic.strip() or "this topic"
    source_sentences = _sentence_items(source_text, limit=5)
    source_bullets = _bullet_items(source_text, limit=6)
    first_sentence = source_sentences[0] if source_sentences else f"{topic_name} is important for teams evaluating practical business and operational decisions."
    numbered_source = _list_text(source_bullets or source_sentences[:5])
    fallback_content = {
        "Executive Summary": first_sentence,
        "Target Audience": f"Business leaders, subject-matter experts, operators, and content teams who need to understand and communicate {topic_name} clearly.",
        "Business Summary": f"{topic_name} should be explained through the business problem, the practical opportunity, and the decisions teams can make from the available evidence.",
        "Why This Topic Matters Now": f"{topic_name} matters now because teams need clear, evidence-grounded guidance before investing time, budget, or publishing attention into the topic.",
        "Key Concepts": numbered_source or "1. Business problem\n2. Practical opportunity\n3. Implementation requirements\n4. Risk considerations\n5. Measurement approach",
        "Business Impact & Opportunities": f"The useful business opportunity is to turn the core insights about {topic_name} into better decisions, clearer prioritization, and more practical content assets.",
        "Industry Use Cases": "- Explain the topic for decision-makers\n- Convert the strongest points into educational content\n- Use the recommendations to guide planning, review, or stakeholder discussion",
        "Actionable Recommendations": "1. Keep claims tied to source material or clearly label them as practical guidance.\n2. Identify the audience before writing platform content.\n3. Convert key concepts into specific recommendations.\n4. Review risks and limitations before publishing.\n5. End with a discussion question that invites useful experience.",
        "Risks, Challenges & Considerations": "Avoid unsupported statistics, exaggerated outcomes, and claims that go beyond the available source material. Keep recommendations practical and reviewable.",
        "Common Mistakes": "- Publishing generic summaries without a business angle\n- Using unsupported metrics or invented proof points\n- Skipping target audience and implementation context\n- Ending without a useful engagement question",
        "Metrics To Track": "- Content engagement quality\n- Qualified comments or replies\n- Click-through rate\n- Lead or inquiry quality\n- Audience retention for video\n- Repurposing performance by channel",
        "Content Repurposing Ideas": "- LinkedIn thought-leadership post\n- YouTube explainer\n- Instagram carousel\n- Executive newsletter summary\n- Sales enablement one-pager",
        "Key Takeaways": numbered_source or "The strongest content connects business context, practical recommendations, measurable impact, and a clear discussion prompt.",
        "Discussion Question": f"What would make {topic_name} most useful or valuable for your team right now?",
    }
    return fallback_content.get(section, f"Add practical context for {topic_name}.")


def enforce_master_article_strategy_sections(parsed_output: Dict[str, Any], topic: str) -> None:
    content = parsed_output.get("content")
    if not isinstance(content, str) or not content.strip():
        return

    updated = content.strip()
    if not re.search(r"(?im)^\s*#\s+", updated):
        updated = f"# {parsed_output.get('title') or topic or 'Compelling Title'}\n\n{updated}"

    missing_sections = [section for section in MASTER_ARTICLE_REQUIRED_SECTIONS if not _has_heading(updated, section)]
    if not missing_sections:
        return

    logger.info(
        "Master article missing required strategy sections: %s. Appending local fallback sections.",
        ", ".join(missing_sections),
    )
    additions = [f"## {section}\n{_fallback_section(section, topic, updated)}" for section in missing_sections]
    parsed_output["content"] = f"{updated}\n\n" + "\n\n".join(additions)


def _field_text(value: Any) -> str:
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, list):
        return _list_text([str(item).strip() for item in value if str(item).strip()])
    return ""


def _field_list(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str) and value.strip():
        return _sentence_items(value, limit=5) or [value.strip()]
    return []


def _build_youtube_strategy(youtube: Dict[str, Any], topic: str, article: str, audience: str = "") -> Dict[str, Any]:
    topic_name = _topic_phrase(topic)
    audience_name = audience.strip()
    description = youtube.get("description") if isinstance(youtube.get("description"), str) else ""
    source_text = "\n\n".join(part for part in [article, description, youtube.get("script", "")] if isinstance(part, str))
    source_sentences = _sentence_items(source_text, limit=8)
    source_bullets = _bullet_items(source_text, limit=8)
    concept_items = source_bullets or source_sentences[:6]

    business_summary = source_sentences[0] if source_sentences else (
        f"This video explains {topic_name} in practical business language, focusing on what the topic means, why it matters, and how teams can act on it without relying on unsupported claims."
    )
    why_now = (
        f"{topic_name} is worth watching now because teams need evidence-grounded guidance before turning the topic into decisions, investments, or public-facing content."
    )

    return {
        "video_angle": youtube.get("video_angle") or f"A practical, evidence-grounded business explainer on {topic_name}.",
        "target_audience": youtube.get("target_audience") or audience_name or f"Business leaders, practitioners, content teams, and decision-makers evaluating {topic_name}.",
        "business_summary": youtube.get("business_summary") or business_summary,
        "why_watch_now": youtube.get("why_watch_now") or why_now,
        "business_impact_opportunities": youtube.get("business_impact_opportunities") or (
            f"The business opportunity is to translate {topic_name} into clearer priorities, safer decisions, useful educational content, and practical next steps."
        ),
        "key_talking_points": _field_list(youtube.get("key_talking_points")) or concept_items[:5] or [
            f"What {topic_name} means in business terms.",
            "Why the topic matters now.",
            "Where the practical opportunities are.",
            "What risks and limitations need review.",
            "How to turn the insight into content and action.",
        ],
        "actionable_recommendations": _field_list(youtube.get("actionable_recommendations")) or [
            "Keep every claim tied to source material or clearly frame it as practical guidance.",
            "Define the target audience before writing the video script or description.",
            "Turn key concepts into specific recommendations viewers can apply.",
            "Review risks, limitations, and regulatory or operational constraints before publishing.",
            "End with a discussion question that invites real experience from the audience.",
        ],
        "proof_points_or_examples": _field_list(youtube.get("proof_points_or_examples")) or [
            "Use examples already present in the source material or generated article.",
            "When evidence is limited, frame examples as practical scenarios rather than factual case studies.",
            "Avoid unsupported statistics, company names, benchmarks, or outcome claims.",
        ],
        "viewer_takeaways": _field_list(youtube.get("viewer_takeaways")) or source_sentences[:5] or [
            f"Viewers should understand the business relevance of {topic_name}.",
            "Viewers should know which risks or assumptions need review.",
            "Viewers should leave with practical recommendations for content or planning.",
        ],
        "discussion_question": youtube.get("discussion_question") or f"Which part of {topic_name} would be most useful for your team to explore next?",
        "shorts_ideas": _field_list(youtube.get("shorts_ideas")) or [
            f"The business problem behind {topic_name}.",
            f"One mistake to avoid when explaining {topic_name}.",
            f"A practical first step for teams exploring {topic_name}.",
        ],
    }


def _format_chapters(chapters: Any) -> str:
    if not isinstance(chapters, list) or not chapters:
        return ""

    rows = []
    for chapter in chapters:
        if isinstance(chapter, dict):
            rows.append(f"{chapter.get('timestamp') or '-'} {chapter.get('title') or 'Untitled chapter'}")
        else:
            rows.append(str(chapter))
    return "\n".join(rows)


def _ensure_youtube_description_sections(youtube: Dict[str, Any], strategy: Dict[str, Any], topic: str) -> None:
    description = youtube.get("description") if isinstance(youtube.get("description"), str) else ""
    missing_sections = [
        section for section in YOUTUBE_DESCRIPTION_REQUIRED_SECTIONS
        if not _has_heading(description, section)
    ]
    if not missing_sections:
        return

    logger.info(
        "YouTube description missing strategy sections: %s. Appending grounded strategy sections.",
        ", ".join(missing_sections),
    )

    section_content = {
        "Video Angle": strategy["video_angle"],
        "Target Audience": strategy["target_audience"],
        "Business Summary": strategy["business_summary"],
        "Why Watch Now": strategy["why_watch_now"],
        "Business Impact & Opportunities": strategy["business_impact_opportunities"],
        "Key Talking Points": _list_text(strategy["key_talking_points"]),
        "Actionable Recommendations": _list_text(strategy["actionable_recommendations"]),
        "Proof Points Or Examples": _list_text(strategy["proof_points_or_examples"]),
        "Viewer Takeaways": _list_text(strategy["viewer_takeaways"]),
        "Discussion Question": strategy["discussion_question"],
        "Shorts Ideas": _list_text(strategy["shorts_ideas"]),
    }

    chapters = _format_chapters(youtube.get("chapters"))
    if chapters:
        section_content["Chapter-By-Chapter Content"] = chapters

    additions = [
        f"## {section}\n{section_content[section]}"
        for section in missing_sections
        if section_content.get(section)
    ]
    if chapters and not _has_heading(description, "Chapter-By-Chapter Content"):
        additions.append(f"## Chapter-By-Chapter Content\n{chapters}")

    if not additions:
        return

    youtube["description"] = f"{description.strip()}\n\n" + "\n\n".join(additions) if description.strip() else "\n\n".join(additions)


def enforce_youtube_strategy_fields(parsed_output: Dict[str, Any], topic: str, audience: str = "") -> None:
    platform_content = parsed_output.get("platform_specific_content")
    if not isinstance(platform_content, dict):
        return

    youtube = platform_content.get("youtube")
    if not isinstance(youtube, dict):
        return

    article = parsed_output.get("content") if isinstance(parsed_output.get("content"), str) else ""
    strategy = _build_youtube_strategy(youtube, topic, article, audience)

    for field, fallback in strategy.items():
        value = youtube.get(field)
        if isinstance(value, str) and value.strip():
            continue
        if isinstance(value, list) and len(value) > 0:
            continue
        youtube[field] = fallback

    if not isinstance(youtube.get("title"), str) or not youtube.get("title", "").strip():
        youtube["title"] = parsed_output.get("title") or f"Video about {topic}"
    if not isinstance(youtube.get("description"), str) or not youtube.get("description", "").strip():
        youtube["description"] = parsed_output.get("summary") or parsed_output.get("content") or ""
    if not isinstance(youtube.get("tags"), list):
        youtube["tags"] = []
    _ensure_youtube_description_sections(youtube, strategy, topic)


def normalize_hashtag(tag: str) -> str:
    clean = tag.strip()
    if not clean:
        return ''
    if not clean.startswith('#'):
        clean = f"#{clean}"
    clean = '#' + re.sub(r'[^A-Za-z0-9_]', '', clean.lstrip('#'))
    return clean


def build_topic_hashtags(topic: str, existing: list[str], needed: int) -> list[str]:
    existing_normalized = {normalize_hashtag(tag).lower() for tag in existing if normalize_hashtag(tag)}
    candidates: list[str] = []

    for token in re.findall(r"[A-Za-z0-9]+", topic):
        lower = token.lower()
        if len(lower) < 3 or lower in STOP_WORDS:
            continue
        tag = normalize_hashtag(lower)
        if tag and tag.lower() not in existing_normalized and tag not in candidates:
            candidates.append(tag)

    result = list(existing)
    for tag in candidates:
        if len(result) >= len(existing) + needed:
            break
        result.append(tag)

    fallback = ["#learned", "#insights", "#production"]
    for tag in fallback:
        if len(result) >= len(existing) + needed:
            break
        if tag.lower() not in existing_normalized:
            result.append(tag)

    return result[: len(existing) + needed]


def replace_banned_cta(caption: str, topic: str) -> str:
    caption = caption.strip()
    if not caption:
        return caption

    last_sentence = caption.split('.')[-1].strip()
    if not last_sentence or not any(banned.lower() in last_sentence.lower() for banned in BANNNED_CTAS):
        return caption

    topic_keyword = next(
        (word.lower() for word in re.findall(r"[A-Za-z0-9]+", topic) if len(word) > 4 and word.lower() not in STOP_WORDS),
        'this topic'
    )
    new_cta = f"Which {topic_keyword} tradeoff has your team had to fix first?"

    prefix = re.sub(r"([.?!])?\s*[^.?!]*$", '', caption).strip()
    if prefix:
        if not prefix.endswith(('.', '?', '!')):
            prefix += '.'
        return f"{prefix} {new_cta}"

    return new_cta


def extract_tagged_segments(text: str) -> tuple[str | None, str | None, str | None]:
    joke = re.search(r"\[JOKE\]:\s*(.*?)(?=(\[ANCHOR\]:|$))", text, flags=re.S)
    anchor = re.search(r"\[ANCHOR\]:\s*(.*?)(?=(\[REALISM\]:|$))", text, flags=re.S)
    realism = re.search(r"\[REALISM\]:\s*(.*)", text, flags=re.S)
    return (
        joke.group(1).strip() if joke else None,
        anchor.group(1).strip() if anchor else None,
        realism.group(1).strip() if realism else None,
    )


def format_tagged_content(text: str, platform: str) -> str:
    joke, anchor, realism = extract_tagged_segments(text)
    if not any((joke, anchor, realism)):
        return text

    if platform == 'linkedin':
        parts = []
        if anchor:
            parts.append(anchor.rstrip('.').strip())
        if realism:
            parts.append(realism.rstrip('.').strip())
        formatted = '. '.join(parts).strip()
        if formatted and not formatted.endswith('.'):
            formatted += '.'
        return formatted

    if platform == 'instagram':
        parts = []
        if joke:
            parts.append(joke.rstrip('.').strip())
        if anchor:
            parts.append(anchor.rstrip('.').strip())
        formatted = '. '.join(parts).strip()
        if formatted and not formatted.endswith('.'):
            formatted += '.'
        return formatted

    if platform == 'twitter':
        segments = []
        if joke:
            segments.append(joke.rstrip('.').strip())
        if anchor:
            segments.append(anchor.rstrip('.').strip())
        formatted = ' — '.join(segments).strip()
        if realism:
            realism_text = realism.rstrip('.').strip()
            formatted = f"{formatted}; {realism_text}" if formatted else realism_text
        if formatted and not formatted.endswith('.'):
            formatted += '.'
        return formatted

    return text


def enforce_platform_item_rules(content_item: Dict[str, Any], platform: str, topic: str) -> None:
    for field in ['caption', 'content']:
        if isinstance(content_item.get(field), str):
            content_item[field] = format_tagged_content(content_item[field], platform)

    if isinstance(content_item.get('caption'), str):
        content_item['caption'] = replace_banned_cta(content_item['caption'], topic)
    elif isinstance(content_item.get('content'), str):
        content_item['content'] = replace_banned_cta(content_item['content'], topic)


def _spoken_word_count(script: str) -> int:
    spoken = re.sub(r"(?m)^\s*#{1,6}\s+.*$", " ", script)
    spoken = re.sub(r"\[(?:\d{1,2}:\d{2}(?:-\d{1,2}:\d{2})?|[^\]]+)\]", " ", spoken)
    spoken = re.sub(r"(?m)^\s*(?:HOOK|SCRIPT|CTA|CONTEXT|PAYOFF|INSIGHT|ACTION)\s*:?[ \t]*$", " ", spoken, flags=re.I)
    return len(re.findall(r"\b[\w’'-]+\b", spoken))


def _timestamp_seconds(value: str) -> int:
    minutes, seconds = value.split(":", 1)
    return int(minutes) * 60 + int(seconds)


def _script_timeline(script: str) -> list[dict[str, Any]]:
    pattern = re.compile(
        r"\[(\d{1,3}:\d{2})\s*[-–—]\s*(\d{1,3}:\d{2})\]\s*([^\n]*)\n?"
        r"(.*?)(?=\n?\s*(?:#{1,6}\s*)?\[\d{1,3}:\d{2}\s*[-–—]\s*\d{1,3}:\d{2}\]|\Z)",
        re.S,
    )
    sections = []
    for match in pattern.finditer(script):
        heading_or_dialogue = match.group(3).strip().lstrip("#").strip()
        body = match.group(4).strip()
        # A timestamp followed by a newline normally has a section heading. Inline
        # text is presenter dialogue unless a separate body follows it.
        dialogue = body if body else heading_or_dialogue
        sections.append({
            "start": _timestamp_seconds(match.group(1)),
            "end": _timestamp_seconds(match.group(2)),
            "heading": heading_or_dialogue if body else "",
            "dialogue": dialogue,
            "words": _spoken_word_count(dialogue),
        })
    return sections


def _presentation_value(value: Any) -> str:
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, list):
        return "\n".join(f"- {item}" for item in value if str(item).strip())
    return ""


def apply_custom_video_card_contract(
    content_item: Dict[str, Any],
    prompt_context: Dict[str, Any],
) -> None:
    video_card = prompt_context.get("video_card", {})
    if not video_card.get("replace_fallback"):
        return

    key = "shortFormVideo" if isinstance(content_item.get("shortFormVideo"), dict) else "short_form_video"
    video = content_item.get(key)
    if not isinstance(video, dict):
        video = {}
        content_item["shortFormVideo"] = video
        key = "shortFormVideo"

    existing_presentation = video.get("presentation") if isinstance(video.get("presentation"), dict) else {}
    existing_sections = existing_presentation.get("sections", []) if isinstance(existing_presentation, dict) else []
    section_lookup: dict[str, str] = {}
    if isinstance(existing_sections, list):
        for section in existing_sections:
            if not isinstance(section, dict):
                continue
            content = _presentation_value(section.get("content"))
            for lookup_key in (section.get("key"), section.get("label")):
                if lookup_key and content:
                    section_lookup[str(lookup_key).lower()] = content

    sections = []
    for requested in video_card.get("fields", []):
        if not isinstance(requested, dict):
            continue
        field_key = str(requested.get("key") or "").strip()
        label = str(requested.get("label") or field_key.replace("_", " ").title()).strip()
        candidates = [
            section_lookup.get(field_key.lower()),
            section_lookup.get(label.lower()),
            _presentation_value(video.get(field_key)),
            _presentation_value(content_item.get(field_key)),
        ]
        content = next((candidate for candidate in candidates if candidate), "")
        sections.append({"key": field_key, "label": label, "content": content})

    video["duration_seconds"] = video_card.get("duration_seconds") or video.get("duration_seconds")
    video["presentation"] = {
        "replace_fallback": True,
        "title": video_card.get("title") or existing_presentation.get("title") or "Custom Video Script",
        "sections": sections,
        "structure": video_card.get("structure", []),
        "word_count": video_card.get("word_count"),
        "timeline": video_card.get("timeline", []),
        "duration_source": video_card.get("duration_source"),
        "word_count_source": video_card.get("word_count_source"),
    }
    if key == "short_form_video":
        content_item["shortFormVideo"] = video
        content_item.pop("short_form_video", None)


def short_form_video_quality_issues(video: Dict[str, Any], prompt_context: Dict[str, Any] | None = None) -> list[str]:
    issues: list[str] = []
    custom_brief = bool(prompt_context and prompt_context.get("mode") == "custom_brief")
    required_text = [] if custom_brief else ["title", "hook", "script", "thumbnail_text", "thumbnail_concept"]
    missing = [field for field in required_text if not isinstance(video.get(field), str) or not video[field].strip()]
    if missing:
        issues.append(f"missing fields: {', '.join(missing)}")

    title_words = len(str(video.get("title", "")).split())
    if not custom_brief and title_words and not 4 <= title_words <= 12:
        issues.append("title must contain 4-12 words")

    requested_duration = prompt_context.get("duration_seconds") if custom_brief else None
    actual_duration = video.get("duration_seconds")
    if requested_duration and actual_duration != requested_duration:
        issues.append(f"duration_seconds is {actual_duration}; expected {requested_duration} from the user brief")

    script_text = str(video.get("script", ""))
    if custom_brief and not script_text.strip() and isinstance(video.get("presentation"), dict):
        script_text = next((
            str(section.get("content") or "")
            for section in video["presentation"].get("sections", [])
            if isinstance(section, dict) and any(
                token in str(section.get(field) or "").lower()
                for field in ("key", "label")
                for token in ("script", "dialogue", "narration")
            )
        ), "")
    script_words = _spoken_word_count(script_text)
    if not custom_brief and script_words and not 170 <= script_words <= 195:
        issues.append(f"script has {script_words} spoken words; expected 170-195")
    if custom_brief:
        word_count = prompt_context.get("video_card", {}).get("word_count")
        if word_count and script_words and not word_count["min"] <= script_words <= word_count["max"]:
            issues.append(
                f"script has {script_words} spoken words; expected {word_count['min']}-{word_count['max']} from the user brief"
            )
        requested_structure = prompt_context.get("video_card", {}).get("structure", [])
        missing_structure = [section for section in requested_structure if section.lower() not in script_text.lower()]
        if missing_structure:
            issues.append(f"script is missing requested sections: {', '.join(missing_structure)}")

    timeline = _script_timeline(script_text)
    timeline_windows = [(section["start"], section["end"]) for section in timeline]
    expected_windows = [
        (0, 5), (5, 12), (12, 24), (24, 36), (36, 48), (48, 56), (56, 60),
    ]
    if not custom_brief and timeline_windows != expected_windows:
        issues.append("script must contain all seven continuous timeline windows from 0:00 through 1:00")
    if custom_brief and script_text.strip():
        expected_duration = prompt_context.get("video_card", {}).get("duration_seconds")
        if not timeline:
            issues.append("script has no timestamped sections")
        else:
            if timeline[0]["start"] != 0:
                issues.append("timeline must start at 0:00")
            if expected_duration and timeline[-1]["end"] != expected_duration:
                issues.append(f"timeline ends at {timeline[-1]['end']} seconds; expected {expected_duration} seconds")
            for previous, current in zip(timeline, timeline[1:]):
                if current["start"] > previous["end"]:
                    issues.append(f"timeline gap between {previous['end']} and {current['start']} seconds")
                elif current["start"] < previous["end"]:
                    issues.append(f"timeline overlap between {current['start']} and {previous['end']} seconds")

            expected_timeline = prompt_context.get("video_card", {}).get("timeline", [])
            for index, expected in enumerate(expected_timeline):
                if index >= len(timeline):
                    issues.append(f"timeline is missing section: {expected.get('label', index + 1)}")
                    continue
                actual = timeline[index]
                if (actual["start"], actual["end"]) != (expected.get("start_seconds"), expected.get("end_seconds")):
                    issues.append(f"timeline does not follow the resolved window {expected.get('timestamp')}")
                minimum = expected.get("word_min")
                if isinstance(minimum, int) and actual["words"] < minimum:
                    issues.append(
                        f"section {expected.get('label', index + 1)} has {actual['words']} spoken words; expected at least {minimum}"
                    )

    thumbnail_prompt = str(video.get("thumbnail_concept", "")).strip()
    thumbnail_prompt_words = len(thumbnail_prompt.split())
    if not custom_brief and thumbnail_prompt_words and not 60 <= thumbnail_prompt_words <= 120:
        issues.append(f"thumbnail prompt has {thumbnail_prompt_words} words; expected 60-120")
    thumbnail_text = str(video.get("thumbnail_text", "")).strip()
    if not custom_brief and thumbnail_prompt and thumbnail_text and thumbnail_text.lower() not in thumbnail_prompt.lower():
        issues.append("thumbnail prompt must include the exact thumbnail_text")

    hashtags = video.get("hashtags")
    if not custom_brief and (not isinstance(hashtags, list) or not hashtags):
        issues.append("hashtags must be a non-empty list")
    if custom_brief:
        presentation = video.get("presentation")
        if not isinstance(presentation, dict) or not presentation.get("replace_fallback"):
            issues.append("custom video presentation contract is missing")
        else:
            missing_sections = [
                section.get("label") or section.get("key")
                for section in presentation.get("sections", [])
                if isinstance(section, dict) and not _presentation_value(section.get("content"))
            ]
            if missing_sections:
                issues.append(f"custom presentation fields are empty: {', '.join(map(str, missing_sections))}")
    return issues


def enforce_short_form_video_rules(
    content_item: Dict[str, Any],
    platform: str,
    prompt_context: Dict[str, Any] | None = None,
) -> None:
    requested_platforms = (
        prompt_context.get("resolved_platforms") or prompt_context.get("requested_platforms", [])
        if prompt_context else []
    )
    if platform not in {"instagram", "facebook", "linkedin"} and platform not in requested_platforms:
        return

    key = "shortFormVideo" if isinstance(content_item.get("shortFormVideo"), dict) else "short_form_video"
    video = content_item.get(key)
    if not isinstance(video, dict):
        return

    issues = short_form_video_quality_issues(video, prompt_context)
    if issues:
        logger.warning(
            "AI short-form video output for %s has quality issues (%s); preserving available AI-authored fields for Content Explorer.",
            platform,
            "; ".join(issues),
        )


def custom_platform_package_issues(
    platform_content: Dict[str, Any],
    prompt_context: Dict[str, Any],
) -> list[str]:
    video_card = prompt_context.get("video_card", {})
    if prompt_context.get("mode") != "custom_brief" or not video_card.get("replace_fallback"):
        return []

    issues: list[str] = []
    platforms = prompt_context.get("resolved_platforms") or prompt_context.get("requested_platforms", [])
    post_fields = {
        "instagram": ("caption",),
        "facebook": ("caption",),
        "linkedin": ("content",),
        "twitter": ("content",),
        "youtube": ("title", "description"),
        "tiktok": ("caption",),
        "reddit": ("title", "content"),
    }
    for platform in platforms:
        item = platform_content.get(platform)
        if not isinstance(item, dict):
            issues.append(f"missing platform package: {platform}")
            continue
        missing_post_fields = [
            field for field in post_fields.get(platform, ("content",))
            if not isinstance(item.get(field), str) or not item[field].strip()
        ]
        if missing_post_fields:
            issues.append(f"{platform} is missing post content: {', '.join(missing_post_fields)}")
        video = item.get("shortFormVideo") or item.get("short_form_video")
        if not isinstance(video, dict):
            issues.append(f"{platform} is missing shortFormVideo")
    return issues


def validate_platform_content(parsed_output: Dict[str, Any], topic: str, crew_instance: Any, inputs: Dict[str, Any]) -> Dict[str, Any]:
    """
    Runs hashtag and CTA validation rules on the platform-specific content.
    If rules are violated, it can re-call the crew or perform local fixes.
    """
    prompt_context = inputs.get("prompt_context", {}) if isinstance(inputs, dict) else {}
    custom_brief = prompt_context.get("mode") == "custom_brief"
    if not custom_brief:
        enforce_master_article_strategy_sections(parsed_output, topic)
    request = inputs.get("request") if isinstance(inputs, dict) else None
    audience = getattr(request, "audience", "") if request else ""
    if not custom_brief:
        enforce_youtube_strategy_fields(parsed_output, topic, audience)

    platform_content = parsed_output.get("platform_specific_content", {})
    package_issues = custom_platform_package_issues(platform_content, prompt_context)
    if package_issues:
        logger.warning(
            "AI custom platform package has quality issues (%s); preserving available AI-authored fields.",
            "; ".join(package_issues),
        )
    if not platform_content:
        return parsed_output

    requested_platforms = prompt_context.get("resolved_platforms") or prompt_context.get("requested_platforms", [])
    if custom_brief and requested_platforms:
        for platform in list(platform_content):
            if platform not in requested_platforms:
                platform_content.pop(platform, None)

    platforms = list(dict.fromkeys([
        "instagram", "linkedin", "twitter", "facebook", "reddit",
        *requested_platforms,
    ]))
    min_hashtags = {
        "instagram": 8,
        "linkedin": 4,
        "twitter": 3,
        "facebook": 3,
        "reddit": 0,
    }

    for platform in platforms:
        if platform not in platform_content:
            continue

        content_item = platform_content[platform]
        if not custom_brief:
            enforce_platform_item_rules(content_item, platform, topic)
        else:
            apply_custom_video_card_contract(content_item, prompt_context)
        enforce_short_form_video_rules(content_item, platform, prompt_context)

        if not custom_brief and platform != "reddit":
            current_hashtags = content_item.get("hashtags", [])
            target_min = min_hashtags.get(platform, 0)

            if len(current_hashtags) < target_min:
                needed = target_min - len(current_hashtags)
                logger.info(
                    f"Platform {platform} below minimum hashtags ({len(current_hashtags)}/{target_min}). "
                    f"Auto-expanding with {needed} topic-relevant tag(s)."
                )
                content_item["hashtags"] = build_topic_hashtags(topic, current_hashtags, needed)

        caption = content_item.get("caption") or content_item.get("content") or ""
        if not custom_brief and caption:
            last_sentence = caption.strip().split('.')[-1].strip()
            if any(banned.lower() in last_sentence.lower() for banned in BANNNED_CTAS):
                logger.info(f"Banned CTA detected on {platform}: '{last_sentence}'. Replacing with a topic-specific prompt.")
                if isinstance(content_item.get('caption'), str):
                    content_item['caption'] = replace_banned_cta(content_item['caption'], topic)
                elif isinstance(content_item.get('content'), str):
                    content_item['content'] = replace_banned_cta(content_item['content'], topic)

    return parsed_output


def run_eligibility_gate(topic: str, platforms: list) -> bool:
    """
    Checks if technical content is being sent to general Facebook feed.
    Returns True if valid, False if it requires confirmation.
    """
    tech_keywords = ["LLM", "GPU", "pipeline", "architecture", "deployment", "ML", "AI engineering"]
    is_tech = any(kw.lower() in topic.lower() for kw in tech_keywords)
    
    if is_tech and "facebook" in [p.lower() for p in platforms]:
        logger.warning(f"Technical content flagged for Facebook general feed — consider LinkedIn or Reddit instead. Topic: {topic}")
        # In a real system, this would return False to trigger a 403 or confirmation in the UI.
        return False
    
    return True
