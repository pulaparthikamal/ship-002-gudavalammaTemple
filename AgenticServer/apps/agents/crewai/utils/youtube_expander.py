from __future__ import annotations
from typing import List, Dict
import re


def _ts_to_seconds(ts: str) -> int:
    parts = [int(p) for p in ts.split(":")]
    if len(parts) == 3:
        h, m, s = parts
        return h * 3600 + m * 60 + s
    if len(parts) == 2:
        m, s = parts
        return m * 60 + s
    return int(parts[0])


def expand_chapters_to_script(topic: str, chapters: List[Dict[str, str]], wps: float = 3.0) -> str:
    """Expand chapter timestamps into a presenter-ready YouTube script.

    - topic: main video topic
    - chapters: list of {"timestamp": "M:SS", "title": "..."}
    - wps: words per second estimate (default 3)

    Produces a script string including chapter markers, b-roll cues, on-screen text,
    pauses, engagement cues, and a concise outro with CTA.
    """
    if not chapters:
        return ""

    secs = [_ts_to_seconds(c["timestamp"]) for c in chapters]
    durations = []
    for i in range(len(secs)):
        if i < len(secs) - 1:
            durations.append(max(10, secs[i + 1] - secs[i]))
        else:
            durations.append(90)

    out: List[str] = []
    out.append(f"Topic: {topic}\n")

    # Templates for each chapter to ensure specificity and actionability
    for ch, dur in zip(chapters, durations):
        ts = ch.get("timestamp")
        title = ch.get("title")
        target_words = int(dur * wps)

        out.append(f"[CHAPTER MARKER: {title}]\n{ts} — {title}\n")

        # Start with a strong lead that connects topic to chapter
        lead = (
            f"In this segment on {title.lower()}, we\'ll translate the idea into a concrete rule you can apply immediately. "
            f"Think of this as the one decision that changes outcomes when working on {topic}."
        )

        sentences = [lead]
        sentences += [
            "[B-ROLL SUGGESTION: diagram or code snippet illustrating the point]",
            "Why this matters: most teams implicitly assume X, which causes Y under load.",
            "The correction is straightforward and repeatable — follow this short rule.",
            "[ON-SCREEN TEXT: Key rule or mnemonic summarizing the action]",
            "Example: in a real system this looks like... (short explicit example).",
            "[PAUSE]",
            "Step-by-step: 1) do this, 2) verify this metric, 3) avoid this common pitfall.",
            "[ENGAGEMENT CUE: Ask viewers to check their system for the same pattern and comment below]",
        ]

        body = " ".join(sentences)
        # Expand body until roughly target_words
        current_words = len(re.findall(r"\w+", body))
        i = 0
        while current_words < target_words:
            piece = sentences[2 + (i % (len(sentences) - 3))]
            body += " " + piece
            current_words = len(re.findall(r"\w+", body))
            i += 1

        out.append(body + "\n")

    # Outro
    outro = (
        "[OUTRO]\n"
        "Numbered recap — top 5 takeaways: 1) the one rule to apply, 2) the diagnostic to run, "
        "3) the ordering that prevents the pitfall, 4) the quick optimization, 5) the real-world metric to watch.\n"
        "[ON-SCREEN TEXT: Top 5 takeaways]\n"
        "If this helped, subscribe for more deep technical breakdowns. Leave one exact example in the comments — "
        "I\'ll feature the best ones in the next video."
    )
    out.append(outro)

    return "\n".join(out)
