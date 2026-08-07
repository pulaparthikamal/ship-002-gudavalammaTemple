import asyncio
import uuid
from pathlib import Path
from django.conf import settings
from playwright.async_api import async_playwright
import logging

logger = logging.getLogger(__name__)

async def html_to_image(html_content: str, output_name: str = None) -> str | None:
    """
    Converts HTML content to a high-quality JPEG image using Playwright.
    Implements a production-grade wait and rendering strategy.
    """
    if not html_content:
        return None

    if not output_name:
        output_name = f"insta_{uuid.uuid4().hex[:8]}.jpg"

    media_root = Path(settings.MEDIA_ROOT)
    output_dir = media_root / "social_media_posts"
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / output_name

    async with async_playwright() as p:
        browser = await p.chromium.launch(args=["--allow-file-access-from-files", "--no-sandbox"])
        context = await browser.new_context(
            viewport={"width": 1080, "height": 1080},
            bypass_csp=True,
            device_scale_factor=2 # Retina quality
        )
        page = await context.new_page()
        
        # Set content and wait for network idle
        await page.set_content(html_content)
        await page.wait_for_load_state('networkidle')

        # Production-grade image load validation
        await page.evaluate("""async () => {
            const imgs = Array.from(document.images);
            await Promise.all(
                imgs.map(img => {
                    if (img.complete) return Promise.resolve();
                    return new Promise(resolve => {
                        img.onload = resolve;
                        img.onerror = resolve;
                    });
                })
            );
        }""")

        # Wait an extra bit for stable rendering
        await page.wait_for_timeout(500)
        
        # Take a high-quality JPEG screenshot
        await page.screenshot(
            path=str(output_path), 
            type='jpeg', 
            quality=95, 
            omit_background=False
        )
        await browser.close()

    return f"social_media_posts/{output_name}"

def run_html_to_image(html_content: str) -> str | None:
    """Sync wrapper for the async html_to_image function."""
    try:
        # Use existing loop if possible to avoid issues in some environments
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # This is tricky in some frameworks, but for a simple script:
                import nest_asyncio
                nest_asyncio.apply()
                return loop.run_until_complete(html_to_image(html_content))
            return loop.run_until_complete(html_to_image(html_content))
        except RuntimeError:
            return asyncio.run(html_to_image(html_content))
    except Exception:
        logger.exception("Error converting Instagram HTML slide to image")
        return None
