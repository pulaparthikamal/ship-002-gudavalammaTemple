from __future__ import annotations

import unittest

from agents.crewai.prompt_context import build_output_contract, resolve_prompt_context


class PromptContextTests(unittest.TestCase):
    def test_short_topic_keeps_current_defaults(self):
        context = resolve_prompt_context(
            "How AI reduces invoice processing costs",
            "Finance leaders",
            "Professional",
        )

        self.assertEqual(context["mode"], "simple_topic")
        self.assertIsNone(context["duration_seconds"])
        self.assertIn("existing platform", context["instruction"])

    def test_structured_full_prompt_becomes_custom_brief(self):
        topic = """Create a 90-second LinkedIn/TikTok business short.

Audience: United States mid-sized business owners and COOs.
Goal: Show how automation can reduce operating costs.
Structure: Pain hook, real example, cost impact, strategic takeaway, closing insight.
Tone: Executive-level, practical, ROI-focused, no hype.
Avoid: Generic AI explanations and technical jargon."""
        context = resolve_prompt_context(topic, "Fallback audience", "Fallback tone")

        self.assertEqual(context["mode"], "custom_brief")
        self.assertEqual(context["duration_seconds"], 90)
        self.assertEqual(context["requested_platforms"], ["linkedin", "tiktok"])
        self.assertTrue({"audience", "goal", "structure", "tone", "avoid", "duration"}.issubset(
            context["explicit_dimensions"]
        ))
        self.assertIn(topic, context["instruction"])

    def test_unstructured_instructions_are_detected(self):
        topic = (
            "Write a practical LinkedIn video for hospital operations leaders. Keep it under two minutes, "
            "open with a scheduling failure, include a representative example, and do not use technical jargon."
        )
        context = resolve_prompt_context(topic, "Fallback audience", "Fallback tone")

        self.assertEqual(context["mode"], "custom_brief")
        self.assertIn("linkedin", context["requested_platforms"])
        self.assertIn("avoid", context["explicit_dimensions"])

    def test_partial_brief_keeps_form_fallbacks(self):
        context = resolve_prompt_context(
            "Create a 45-second TikTok script. Avoid hype and close with one practical action.",
            "US dental practice owners",
            "Calm and credible",
        )

        self.assertEqual(context["mode"], "custom_brief")
        self.assertIn("US dental practice owners", context["instruction"])
        self.assertIn("Calm and credible", context["instruction"])

    def test_custom_contract_replaces_legacy_example(self):
        context = resolve_prompt_context(
            "Create a 90-second TikTok short for founders. Avoid jargon.",
            "Founders",
            "Practical",
        )
        contract = build_output_contract("LEGACY 60 SECOND CONTRACT", context)

        self.assertNotIn("LEGACY 60 SECOND CONTRACT", contract)
        self.assertIn('"duration_seconds": 90', contract)
        self.assertIn("Do not add unrequested platforms", contract)

    def test_duration_only_video_instruction_activates_custom_timeline(self):
        context = resolve_prompt_context("90-second video about invoice automation", "Finance leaders", "Practical")
        card = context["video_card"]

        self.assertEqual(context["mode"], "custom_brief")
        self.assertEqual(
            context["resolved_platforms"],
            ["instagram", "facebook", "linkedin", "youtube", "twitter"],
        )
        self.assertEqual(card["duration_seconds"], 90)
        self.assertEqual(card["word_count"], {"min": 195, "max": 232})
        self.assertEqual(card["timeline"][0]["start_seconds"], 0)
        self.assertEqual(card["timeline"][-1]["end_seconds"], 90)
        self.assertTrue(all(
            current["end_seconds"] == following["start_seconds"]
            for current, following in zip(card["timeline"], card["timeline"][1:])
        ))

    def test_video_without_named_platform_builds_post_and_video_for_all_platforms(self):
        context = resolve_prompt_context(
            "Create a practical video about reducing invoice-processing costs.",
            "US business leaders",
            "Executive",
        )
        contract = build_output_contract("LEGACY", context)

        self.assertEqual(context["mode"], "custom_brief")
        self.assertEqual(context["requested_platforms"], [])
        self.assertEqual(
            context["resolved_platforms"],
            ["instagram", "facebook", "linkedin", "youtube", "twitter"],
        )
        self.assertEqual(contract.count('"shortFormVideo"'), 5)
        self.assertIn('"caption": "<complete Instagram caption>"', contract)
        self.assertIn('"caption": "<complete Facebook post>"', contract)
        self.assertIn('"content": "<complete LinkedIn post>"', contract)
        self.assertIn('"description": "<complete YouTube description>"', contract)
        self.assertIn('"content": "<complete Twitter/X post or thread>"', contract)

    def test_named_platform_limits_post_and_video_contract(self):
        context = resolve_prompt_context(
            "Create a 90-second LinkedIn video for finance leaders.",
            "Finance leaders",
            "Executive",
        )
        contract = build_output_contract("LEGACY", context)

        self.assertEqual(context["resolved_platforms"], ["linkedin"])
        self.assertEqual(contract.count('"shortFormVideo"'), 1)
        self.assertIn('"linkedin"', contract)
        self.assertNotIn('"instagram"', contract)

    def test_inline_structure_and_output_format_are_resolved(self):
        context = resolve_prompt_context(
            """Create a 60-second LinkedIn video for COOs.
Structure: Problem, Business Example, Takeaway
Output Format: Video Title, Full Script, Final Insight""",
            "COOs",
            "Practical",
        )

        self.assertEqual(context["video_card"]["structure"], ["Problem", "Business Example", "Takeaway"])
        self.assertEqual(
            [field["label"] for field in context["video_card"]["fields"]],
            ["Video Title", "Full Script", "Final Insight"],
        )

    def test_exact_section_durations_are_preserved(self):
        context = resolve_prompt_context(
            """Create a 60-second LinkedIn video for COOs.
Structure:
1. Hook (10 seconds)
2. Business Example (35 seconds)
3. Closing (15 seconds)""",
            "COOs",
            "Practical",
        )

        self.assertEqual(
            [(item["start_seconds"], item["end_seconds"]) for item in context["video_card"]["timeline"]],
            [(0, 10), (10, 45), (45, 60)],
        )

    def test_three_minute_markdown_brief_builds_replacement_video_card(self):
        topic = """Create a **3-minute executive-level business video script** for LinkedIn, TikTok, YouTube Shorts, or Instagram Reels.

**Target Audience:** United States mid-sized business owners and COOs.
**Script Requirements:**
* Length: Approximately 3 minutes (350–500 words)

**Structure:**
1. **Executive Hook (15–30 seconds)**
2. **The Hidden Cost (30–45 seconds)**
3. **Real-World Business Example (45–60 seconds)**
4. **Financial Impact & ROI (45–60 seconds)**
5. **Strategic Leadership Insight (30–45 seconds)**
6. **Powerful Closing (15–30 seconds)**

**Output Format:**
* Video Title
* Opening Hook
* Full Script
* On-Screen Text Suggestions
* Final Closing Statement

**Topic:** Invoice processing waste
**Tone:** Executive, practical, no hype."""
        context = resolve_prompt_context(topic, "Fallback audience", "Fallback tone")
        card = context["video_card"]

        self.assertEqual(context["mode"], "custom_brief")
        self.assertEqual(context["duration_seconds"], 180)
        self.assertEqual(context["requested_platforms"], ["linkedin", "tiktok", "instagram", "youtube"])
        self.assertTrue(card["replace_fallback"])
        self.assertEqual(card["title"], "3-Minute Executive Business Video")
        self.assertEqual(card["word_count"], {"min": 350, "max": 500})
        self.assertEqual(card["word_count_source"], "explicit")
        self.assertEqual(card["timeline"][0]["start_seconds"], 0)
        self.assertEqual(card["timeline"][-1]["end_seconds"], 180)
        self.assertEqual(
            [field["label"] for field in card["fields"]],
            ["Video Title", "Opening Hook", "Full Script", "On-Screen Text Suggestions", "Final Closing Statement"],
        )
        self.assertEqual(card["structure"][0], "Executive Hook")
        self.assertEqual(card["structure"][-1], "Powerful Closing")
        self.assertNotIn("Thumbnail Text", [field["label"] for field in card["fields"]])

    def test_negative_thumbnail_instruction_does_not_add_legacy_fields(self):
        context = resolve_prompt_context(
            "Create a 2-minute LinkedIn video for operations leaders. Do not include thumbnail text or a thumbnail image prompt.",
            "Operations leaders",
            "Practical",
        )

        labels = [field["label"] for field in context["video_card"]["fields"]]
        self.assertNotIn("Thumbnail Text", labels)
        self.assertNotIn("Thumbnail Image Prompt", labels)


if __name__ == "__main__":
    unittest.main()
