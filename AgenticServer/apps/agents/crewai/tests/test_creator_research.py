from __future__ import annotations

import unittest

from agents.crewai.creator_research import (
    finalize_additional_information,
    is_creator_research_prompt,
    parse_creator_research_brief,
)


class CreatorResearchIntentTests(unittest.TestCase):
    def test_short_normal_topic_does_not_trigger_research(self):
        self.assertFalse(is_creator_research_prompt("AI automation for small businesses"))
        self.assertIsNone(parse_creator_research_brief("Why AI projects fail after the demo"))

    def test_long_explanatory_topic_does_not_trigger_research(self):
        prompt = (
            "Explain how a mid-sized accounting firm can introduce AI automation gradually "
            "without creating employee fear or disrupting existing client workflows."
        )
        self.assertFalse(is_creator_research_prompt(prompt))

    def test_short_research_topic_triggers_research(self):
        brief = parse_creator_research_brief("Find today's top AI tools for US business owners")
        self.assertIsNotNone(brief)
        self.assertEqual(brief["lookback_hours"], 24)
        self.assertEqual(brief["topic_limit"], 10)

    def test_long_prompt_extracts_window_sources_theme_limit_and_audience(self):
        prompt = """My audience is English-speaking US midlevel business owners interested in technology, AI and automation.
Open Reddit, Twitter/X, YouTube comments, Substack, and other public sources.
Find what they have been discussing in the last 30 hours.
Cluster everything into theme: New AI tools
Identify the top 10 things my audience is discussing."""
        brief = parse_creator_research_brief(prompt)

        self.assertIsNotNone(brief)
        self.assertEqual(brief["lookback_hours"], 30)
        self.assertEqual(brief["topic_limit"], 10)
        self.assertEqual(brief["themes"], ["New AI tools"])
        self.assertIn("English-speaking US midlevel business owners", brief["audience"])
        self.assertEqual(
            brief["requested_sources"],
            ["reddit", "twitter", "youtube_comments", "substack", "web"],
        )

    def test_days_are_converted_to_hours_and_limits_are_bounded(self):
        brief = parse_creator_research_brief(
            "Research public sources from the last 7 days and give me the top 100 discussions"
        )
        self.assertEqual(brief["lookback_hours"], 168)
        self.assertEqual(brief["topic_limit"], 25)


class CreatorResearchFinalizationTests(unittest.TestCase):
    def test_normal_content_forces_additional_information_to_null(self):
        self.assertIsNone(finalize_additional_information({"type": "creator_research"}, None, []))

    def test_research_without_sourced_discussions_is_hidden(self):
        brief = {
            "type": "creator_research",
            "audience": "US business owners",
            "topic_limit": 10,
            "themes": ["New AI tools"],
            "research_window": {"hours": 30, "from": "2026-01-01T00:00:00Z", "to": "2026-01-02T06:00:00Z"},
            "source_coverage": {"twitter": "unavailable"},
            "warnings": ["Twitter unavailable"],
        }
        candidate = {
            "top_discussions": [{
                "headline": "Unsupported discussion",
                "why_people_are_talking": "Model-only claim",
                "sources": [],
            }]
        }

        self.assertIsNone(finalize_additional_information(candidate, brief, []))

    def test_collector_metadata_overrides_model_and_unknown_urls_are_removed(self):
        brief = {
            "type": "creator_research",
            "audience": "US business owners",
            "topic_limit": 1,
            "themes": ["New AI tools"],
            "research_window": {"hours": 30, "from": "2026-01-01T00:00:00Z", "to": "2026-01-02T06:00:00Z"},
            "source_coverage": {"reddit": "searched", "twitter": "unavailable"},
            "warnings": ["Twitter unavailable"],
        }
        candidate = {
            "audience": "wrong audience",
            "top_discussions": [
                {
                    "rank": 1,
                    "headline": "Verified topic",
                    "why_people_are_talking": "The collected source contains a current discussion.",
                    "sources": [
                        {"url": "https://reddit.com/verified", "platform": "reddit"},
                        {"url": "https://invented.example/item", "platform": "web"},
                    ],
                },
                {"rank": 2, "headline": "Over requested limit", "sources": []},
            ],
        }

        report = finalize_additional_information(candidate, brief, ["https://reddit.com/verified"])

        self.assertEqual(report["audience"], "US business owners")
        self.assertEqual(report["source_coverage"], brief["source_coverage"])
        self.assertEqual(len(report["top_discussions"]), 1)
        self.assertEqual(report["top_discussions"][0]["sources"], [candidate["top_discussions"][0]["sources"][0]])


if __name__ == "__main__":
    unittest.main()
