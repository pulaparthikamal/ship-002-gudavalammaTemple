import base64
import json
import logging
import requests
from pathlib import Path
from django.conf import settings

logger = logging.getLogger(__name__)

class VisionService:
    """
    Analyzes images using a vision-capable LLM (Gemma 4) to extract visual style data.
    """
    def __init__(self, service_settings=None) -> None:
        self.settings = service_settings or settings
        self.model = "gemma4:31b-cloud"
        self.base_url = getattr(self.settings, "OLLAMA_BASE_URL", "http://localhost:11434")

    def analyze_images(self, scraped_images: list[dict[str, str]]) -> dict[str, str]:
        """
        Analyzes local images with their titles, chooses the best one, and returns
        guidelines including placement.
        """
        if not scraped_images:
            return {
                "selected_image": "",
                "visual_style": "No images found. Use the MASTERPIECE STYLE: Deep Charcoal background with bold geometric shapes in Electric Violet and Emerald Green. Add diagonal lines and bokeh in Coral Pink. Create a full-page editorial layout.",
                "placement": "Full-page editorial layout with content occupying the majority of the canvas for a comprehensive look."
            }

        image_data = []
        for img_info in scraped_images[:3]: # check top 3 images
            path = img_info.get("path")
            title = img_info.get("title", "Unknown Image")
            full_path = Path(self.settings.MEDIA_ROOT) / path
            if not full_path.exists():
                continue
            
            description = self._get_image_description(full_path, title)
            if description:
                image_data.append({"path": path, "title": title, "description": description})

        if not image_data:
            return {
                "selected_image": "",
                "visual_style": "Could not analyze images. Use a high-end professional aesthetic with a full-page editorial layout.",
                "placement": "Full-page layout."
            }

        # Let the model choose the best image and summarize
        combined_context = "\n".join([f"Image {i} (Title: {d['title']}): {d['description']}" for i, d in enumerate(image_data)])
        summary_result = self._summarize_visual_style(combined_context)
        
        return {
            "selected_image": image_data[0]["path"], # Default to first successful one for path
            "visual_style": summary_result,
            "placement": "As described in visual style."
        }

    def _get_image_description(self, image_path: Path, title: str) -> str | None:
        try:
            with open(image_path, "rb") as image_file:
                image_base64 = base64.b64encode(image_file.read()).decode("utf-8")

            prompt = (
                f"This image is titled '{title}'. "
                "Analyze this image and describe its visual style, color palette, "
                "mood, and typography if any. Focus on details that would help a "
                "designer create a matching Instagram post."
            )

            payload = {
                "model": self.model,
                "prompt": prompt,
                "images": [image_base64],
                "stream": False
            }

            print(f"--- INVOKING VISION MODEL ({self.model}) ---")
            print(f"Path: {image_path}")
            response = requests.post(f"{self.base_url}/api/generate", json=payload, timeout=600)
            response.raise_for_status()
            result = response.json().get("response", "").strip()
            print(f"--- FULL VISION ANALYSIS FOR {image_path.name} ---")
            print(result)
            print("------------------------------------------")
            return result
        except Exception as e:
            logger.error(f"Error analyzing image {image_path}: {e}")
            return None

    def _summarize_visual_style(self, raw_descriptions: str) -> str:
        """Uses the LLM to summarize multiple image descriptions into a single design guideline."""
        try:
            prompt = (
                f"Analyze these image descriptions and choose the BEST one for an Instagram post background or feature. "
                f"Then, create a brief design guideline. "
                f"Tell the designer EXACTLY where to place the image (e.g. background, top half, circle in corner) "
                f"and which colors to use for text to ensure visibility.\n\n"
                f"Descriptions:\n{raw_descriptions}"
            )

            payload = {
                "model": self.model,
                "prompt": prompt,
                "stream": False
            }

            print("--- SUMMARIZING VISUAL STYLE ({self.model}) ---")
            response = requests.post(f"{self.base_url}/api/generate", json=payload, timeout=600)
            response.raise_for_status()
            result = response.json().get("response", "").strip()
            print("--- FINAL DESIGN GUIDELINES & PLACEMENT ---")
            print(result)
            print("------------------------------------------")
            return result
        except Exception as e:
            logger.error(f"Error summarizing visual style: {e}")
            return "A professional and vibrant design matching the provided research topic."
