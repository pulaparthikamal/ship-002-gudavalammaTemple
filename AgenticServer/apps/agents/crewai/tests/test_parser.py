from __future__ import annotations

import json
import unittest

from agents.crewai.parser import parse_final_output


class ContentParserCompatibilityTests(unittest.TestCase):
    def test_existing_fields_are_preserved_when_research_is_absent(self):
        parsed = parse_final_output(json.dumps({
            "title": "Normal title",
            "summary": "Normal summary",
            "master_article": "Normal article",
            "platforms": {"instagram": {"hashtags": ["#AI"]}},
            "additional_information": None,
        }))

        self.assertEqual(parsed["title"], "Normal title")
        self.assertEqual(parsed["content"], "Normal article")
        self.assertEqual(parsed["hashtags"], ["#AI"])
        self.assertIsNone(parsed["additional_information"])

    def test_optional_research_field_is_returned_without_changing_platforms(self):
        report = {"type": "creator_research", "top_discussions": []}
        parsed = parse_final_output(json.dumps({
            "title": "Research title",
            "master_article": "Article remains present",
            "platforms": {"facebook": {"caption": "Existing caption"}},
            "additional_information": report,
        }))

        self.assertEqual(parsed["platform_specific_content"]["facebook"]["caption"], "Existing caption")
        self.assertEqual(parsed["additional_information"], report)


if __name__ == "__main__":
    unittest.main()
