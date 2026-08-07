from __future__ import annotations
import re
import json

def parse_final_output(raw_text: str) -> dict[str, object]:
    """
    Parses the final output from the Crew. 
    Prioritizes full JSON parsing, with a fallback to regex-based extraction.
    """
    # 1. Attempt to find and parse a full JSON object
    json_match = re.search(r'(\{.*\})', raw_text, flags=re.DOTALL)
    if json_match:
        try:
            data = json.loads(json_match.group(1))
            # Normalize keys to match internal consumption
            return {
                "title": data.get("title", "Generated Content"),
                "summary": data.get("summary", ""),
                "content": data.get("master_article", data.get("content", "")),
                "hashtags": data.get("platforms", {}).get("instagram", {}).get("hashtags", []),
                "keywords": [],
                "image_prompt": "",
                "instagram_carousel": data.get("instagram_carousel", {}),
                "platform_specific_content": data.get("platforms", {}),
                "additional_information": data.get("additional_information"),
                "generation_brief": data.get("generation_brief"),
            }
        except Exception:
            pass

    # 2. Fallback to Regex if full JSON fails
    def _extract(pattern, text):
        match = re.search(pattern, text, flags=re.DOTALL)
        return match.group(1).strip() if match else ""

    title = _extract(r"TITLE:\s*(.+?)(?:\n|\Z)", raw_text)
    summary = _extract(r"SUMMARY:\s*(.+?)(?:\n|\Z)", raw_text)
    content = _extract(r"CONTENT:\s*(.+?)(?:\n[A-Z]+:|\Z)", raw_text)
    
    return {
        "title": title or "Generated Content",
        "summary": summary,
        "content": content,
        "hashtags": re.findall(r"#\w+", raw_text),
        "keywords": [],
        "image_prompt": "",
        "instagram_carousel": {},
        "platform_specific_content": {},
        "additional_information": None,
        "generation_brief": None,
    }
