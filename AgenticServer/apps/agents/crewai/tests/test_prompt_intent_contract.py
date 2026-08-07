from __future__ import annotations

import unittest

from agents.crewai.output_validator import (
    apply_custom_video_card_contract,
    custom_platform_package_issues,
    enforce_short_form_video_rules,
    short_form_video_quality_issues,
)
from agents.crewai.prompts import PROMPT_INTENT_RULE, SOCIAL_PLATFORM_TEMPLATE
from agents.crewai.prompt_context import resolve_prompt_context


def complete_video() -> dict:
    spoken_sentences = ["This is a complete prompt-specific executive briefing sentence."] * 22
    windows = [
        ("[0:00-0:05] Executive Hook", 3),
        ("[0:05-0:12] Briefing Promise", 3),
        ("[0:12-0:24] First Development", 3),
        ("[0:24-0:36] Business Impact", 3),
        ("[0:36-0:48] Risk And Opportunity", 3),
        ("[0:48-0:56] Leadership Action", 3),
        ("[0:56-1:00] Specific CTA", 4),
    ]
    cursor = 0
    script_parts = []
    for label, sentence_count in windows:
        script_parts.append(f"## {label}\n" + " ".join(spoken_sentences[cursor:cursor + sentence_count]))
        cursor += sentence_count

    return {
        "duration_seconds": 60,
        "title": "Today’s Enterprise AI Moves Leaders Cannot Ignore",
        "hook": "Only a few AI developments will change your operating priorities today.",
        "script": "\n\n".join(script_parts),
        "thumbnail_text": "AI MOVES TO WATCH",
        "thumbnail_concept": (
            "Create a premium vertical 9:16 editorial thumbnail showing a confident business leader beside an "
            "enterprise intelligence dashboard that separates urgent AI signals from background noise. Use a deep "
            "navy setting, electric blue data highlights, warm amber warning accents, dramatic side lighting, and a "
            "clear focal hierarchy. Place the exact headline AI MOVES TO WATCH in large white type across the upper "
            "third with generous spacing and strong contrast. Keep the executive and dashboard readable at mobile "
            "size. No watermark, logos, extra text, malformed hands, clutter, or unreadable interface elements."
        ),
        "hashtags": ["#EnterpriseAI", "#Automation"],
    }


class PromptIntentContractTests(unittest.TestCase):
    def test_semantic_brief_preserves_prompt_deliverable(self):
        self.assertIn("Treat the complete topic text as instructions", PROMPT_INTENT_RULE)
        self.assertIn("requested deliverable", PROMPT_INTENT_RULE)
        self.assertIn("A report becomes an executive briefing", PROMPT_INTENT_RULE)
        self.assertIn("Never reduce it to its first few words", PROMPT_INTENT_RULE)

    def test_current_output_contract_requires_ai_short_form_for_three_platforms(self):
        self.assertEqual(SOCIAL_PLATFORM_TEMPLATE.count('"shortFormVideo"'), 3)
        self.assertIn("Instagram, Facebook, and LinkedIn MUST each include", SOCIAL_PLATFORM_TEMPLATE)
        self.assertIn("170-195 spoken words", SOCIAL_PLATFORM_TEMPLATE)
        self.assertIn("seven continuous speaking windows", SOCIAL_PLATFORM_TEMPLATE)
        self.assertIn("standalone 60-120 word prompt", SOCIAL_PLATFORM_TEMPLATE)

    def test_complete_ai_short_form_is_preserved_without_rewriting(self):
        original = complete_video()
        content = {"shortFormVideo": dict(original)}

        enforce_short_form_video_rules(content, "linkedin")

        self.assertEqual(content["shortFormVideo"], original)
        self.assertEqual(short_form_video_quality_issues(content["shortFormVideo"]), [])

    def test_incomplete_ai_short_form_is_preserved_without_static_fallback(self):
        content = {
            "shortFormVideo": {
                "title": "Incomplete title",
                "hook": "Generic hook",
                "script": "Too short",
            }
        }

        enforce_short_form_video_rules(content, "instagram")

        self.assertEqual(content["shortFormVideo"]["script"], "Too short")
        self.assertNotIn("short_form_video", content)
        issues = short_form_video_quality_issues(content["shortFormVideo"])
        self.assertTrue(any("spoken words" in issue for issue in issues))
        self.assertTrue(any("timeline windows" in issue for issue in issues))

    def test_complete_script_covers_the_full_one_minute_timeline(self):
        issues = short_form_video_quality_issues(complete_video())

        self.assertFalse(any("timeline windows" in issue for issue in issues))

    def test_thumbnail_concept_is_a_paste_ready_image_prompt(self):
        video = complete_video()
        prompt = video["thumbnail_concept"]

        self.assertIn(video["thumbnail_text"], prompt)
        self.assertIn("vertical 9:16", prompt.lower())
        self.assertIn("No watermark", prompt)
        self.assertGreaterEqual(len(prompt.split()), 60)
        self.assertLessEqual(len(prompt.split()), 120)

    def test_non_short_form_platform_is_not_modified(self):
        content = {"shortFormVideo": {"script": "Existing YouTube-specific structure"}}

        enforce_short_form_video_rules(content, "youtube")

        self.assertIn("shortFormVideo", content)

    def test_custom_duration_does_not_enforce_legacy_one_minute_contract(self):
        context = resolve_prompt_context(
            "Create a 90-second LinkedIn business short for COOs. Avoid hype.",
            "COOs",
            "Practical",
        )
        script_parts = []
        for section in context["video_card"]["timeline"]:
            dialogue = " ".join(["business"] * section["word_min"])
            script_parts.append(f"## {section['timestamp']} {section['label']}\n{dialogue}")
        video = complete_video()
        video["duration_seconds"] = 90
        video["script"] = "\n\n".join(script_parts)
        apply_custom_video_card_contract({"shortFormVideo": video}, context)
        video["presentation"] = {
            "replace_fallback": True,
            "sections": [{"key": "script", "label": "Full Script", "content": video["script"]}],
        }

        issues = short_form_video_quality_issues(video, context)

        self.assertFalse(any("170-195" in issue for issue in issues))
        self.assertFalse(any("timeline" in issue for issue in issues))
        self.assertFalse(any("duration_seconds" in issue for issue in issues))

    def test_custom_timeline_reports_early_ending_and_insufficient_dialogue(self):
        context = resolve_prompt_context(
            "Create a 90-second LinkedIn business short for COOs. Avoid hype.",
            "COOs",
            "Practical",
        )
        video = {
            "duration_seconds": 90,
            "script": "[0:00-0:30] Opening Hook\nToo short.\n[0:30-1:00] Closing\nStill too short.",
            "presentation": {
                "replace_fallback": True,
                "sections": [{"key": "script", "label": "Full Script", "content": "present"}],
            },
        }

        issues = short_form_video_quality_issues(video, context)

        self.assertTrue(any("timeline ends" in issue for issue in issues))
        self.assertTrue(any("spoken words" in issue for issue in issues))

    def test_inline_timestamp_dialogue_counts_as_spoken_content(self):
        context = resolve_prompt_context(
            "Create a 30-second LinkedIn video for COOs. Avoid hype.",
            "COOs",
            "Practical",
        )
        script = "\n".join(
            f"{section['timestamp']} " + " ".join(["spoken"] * section["word_min"])
            for section in context["video_card"]["timeline"]
        )
        video = {
            "duration_seconds": 30,
            "script": script,
            "presentation": {
                "replace_fallback": True,
                "sections": [{"key": "script", "label": "Full Script", "content": script}],
            },
        }

        issues = short_form_video_quality_issues(video, context)

        self.assertFalse(any("spoken words" in issue for issue in issues))
        self.assertFalse(any("timeline" in issue for issue in issues))

    def test_custom_presentation_contains_only_requested_fields(self):
        context = resolve_prompt_context(
            """Create a 3-minute executive business video for LinkedIn.
Output Format:
* Video Title
* Opening Hook
* Full Script
* Final Closing Statement
Avoid hype.""",
            "COOs",
            "Practical",
        )
        content = {
            "shortFormVideo": {
                "title": "Reduce Invoice Waste",
                "hook": "Your invoice queue is consuming margin.",
                "script": "Executive Hook\n" + ("A practical business sentence. " * 80),
                "final_closing_statement": "Automate the bottleneck that consumes the most margin first.",
                "thumbnail_text": "LEGACY THUMBNAIL",
                "thumbnail_concept": "Legacy image prompt that must not be displayed.",
            }
        }

        apply_custom_video_card_contract(content, context)

        video = content["shortFormVideo"]
        self.assertEqual(video["duration_seconds"], 180)
        self.assertTrue(video["presentation"]["replace_fallback"])
        self.assertEqual(
            [section["label"] for section in video["presentation"]["sections"]],
            ["Video Title", "Opening Hook", "Full Script", "Final Closing Statement"],
        )
        self.assertNotIn("Thumbnail Text", [section["label"] for section in video["presentation"]["sections"]])

    def test_custom_package_requires_post_and_video_for_every_resolved_platform(self):
        context = resolve_prompt_context(
            "Create a 90-second business video about invoice automation.",
            "Business leaders",
            "Executive",
        )
        package = {
            "instagram": {"caption": "Complete Instagram post", "shortFormVideo": {}},
            "facebook": {"caption": "Complete Facebook post"},
            "linkedin": {"content": "Complete LinkedIn post", "shortFormVideo": {}},
        }

        issues = custom_platform_package_issues(package, context)

        self.assertIn("facebook is missing shortFormVideo", issues)
        self.assertIn("missing platform package: youtube", issues)
        self.assertIn("missing platform package: twitter", issues)


if __name__ == "__main__":
    unittest.main()
