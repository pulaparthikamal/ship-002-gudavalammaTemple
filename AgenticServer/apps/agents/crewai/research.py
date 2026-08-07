from __future__ import annotations

from html import unescape
from urllib.parse import urljoin
from datetime import datetime, timezone
import json
import logging
import requests
from bs4 import BeautifulSoup

try:
    from scrapling import Fetcher
    HAS_SCRAPLING = True
except ImportError:
    HAS_SCRAPLING = False

from api.schemas import ContentGenerationRequest, ResearchBundle, ResolvedTopic
from django.conf import settings
from .creator_research import parse_creator_research_brief

logger = logging.getLogger(__name__)

BLOCKED_DOMAINS = {
    "facebook.com", "twitter.com", "instagram.com", "linkedin.com",
    "youtube.com", "pinterest.com", "reddit.com", "tiktok.com"
}

class ResearchCollector:
    """
    Handles web searching and scraping to build a research bundle for the agents.
    """
    def __init__(self, collector_settings=None) -> None:
        self.settings = collector_settings or settings
        self._session = requests.Session()
        self._session.headers.update({"User-Agent": getattr(self.settings, "USER_AGENT", "Mozilla/5.0")})

    def build_bundle(
        self,
        request: ContentGenerationRequest,
        resolved_topic: ResolvedTopic,
    ) -> ResearchBundle:
        source_urls = [str(url) for url in request.source_urls]
        research_blocks: list[str] = []
        creator_research = parse_creator_research_brief(resolved_topic.topic, request.audience)

        if resolved_topic.additional_context:
            research_blocks.append(f"Topic context:\n{resolved_topic.additional_context}")

        if request.research_text:
            research_blocks.append(f"Provided research:\n{request.research_text.strip()}")

        if creator_research:
            if source_urls:
                provided_blocks, _ = self._scrape_urls(source_urls)
                research_blocks.extend(provided_blocks)
            blocks, discovered_urls, coverage = self._collect_creator_research(
                resolved_topic.topic,
                creator_research,
            )
            source_urls.extend(url for url in discovered_urls if url not in source_urls)
            research_blocks.extend(blocks)
            creator_research["source_coverage"] = coverage
            creator_research["warnings"] = [
                f"{source.replace('_', ' ').title()} could not be searched because its API is not configured or reachable."
                for source, status in coverage.items() if status == "unavailable"
            ]
            if any(source in coverage for source in ("substack", "web")):
                creator_research["warnings"].append(
                    "Web and Substack search use day-level provider filtering; items without a verifiable timestamp are treated as partial coverage."
                )
            research_blocks.append(
                "Creator research specification:\n"
                + json.dumps(creator_research, indent=2)
            )
        elif source_urls:
            blocks, _ = self._scrape_urls(source_urls)
            research_blocks.extend(blocks)
        elif request.search_enabled and resolved_topic.topic:
            discovered_urls = self._search_google_cse(resolved_topic.topic)
            source_urls.extend(discovered_urls)
            blocks, _ = self._scrape_urls(discovered_urls)
            research_blocks.extend(blocks)

        if not research_blocks:
            research_blocks.append(
                "No external research found. Generate content based on general knowledge of the topic."
            )

        combined_research = "\n\n---\n\n".join(research_blocks)

        return ResearchBundle(
            topic=resolved_topic.topic,
            research_text=combined_research,
            source_urls=source_urls,
            source_count=len(source_urls),
            creator_research=creator_research,
        )

    def _collect_creator_research(
        self,
        topic: str,
        brief: dict,
    ) -> tuple[list[str], list[str], dict[str, str]]:
        blocks: list[str] = []
        urls: list[str] = []
        coverage: dict[str, str] = {}
        query = brief.get("themes", [topic])[0]
        if query == "Key audience discussions":
            query = topic[:300]
        else:
            query = f"{query} {brief.get('audience', '')}"[:300]
        cutoff = datetime.fromisoformat(brief["research_window"]["from"])

        for source in brief.get("requested_sources", []):
            try:
                if source == "reddit":
                    source_blocks, source_urls = self._collect_reddit(query, cutoff)
                elif source == "youtube_comments":
                    source_blocks, source_urls = self._collect_youtube_comments(query, cutoff)
                elif source == "twitter":
                    source_blocks, source_urls = self._collect_x_posts(query, cutoff)
                elif source == "substack":
                    source_blocks, source_urls = self._collect_cse_sources(
                        f"site:substack.com {query}", brief["lookback_hours"]
                    )
                else:
                    source_blocks, source_urls = self._collect_cse_sources(query, brief["lookback_hours"])
            except Exception as exc:
                logger.warning("Creator research source %s failed: %s", source, exc)
                source_blocks, source_urls = [], []

            configured = self._source_is_configured(source)
            if source in {"substack", "web"}:
                coverage[source] = "partial" if configured else "unavailable"
            else:
                coverage[source] = "searched" if source_blocks else "partial" if configured else "unavailable"
            blocks.extend(source_blocks)
            urls.extend(url for url in source_urls if url not in urls)

        return blocks, urls, coverage

    def _source_is_configured(self, source: str) -> bool:
        if source == "reddit":
            return True
        if source == "youtube_comments":
            return bool(getattr(self.settings, "YOUTUBE_DATA_API_KEY", None))
        if source == "twitter":
            return bool(getattr(self.settings, "X_BEARER_TOKEN", None))
        return bool(
            getattr(self.settings, "GOOGLE_CSE_API_KEY", None)
            and getattr(self.settings, "GOOGLE_CSE_ID", None)
        )

    def _collect_reddit(self, query: str, cutoff: datetime) -> tuple[list[str], list[str]]:
        response = self._session.get(
            "https://www.reddit.com/search.json",
            params={"q": query, "sort": "new", "t": "day", "limit": 50, "raw_json": 1},
            timeout=getattr(self.settings, "REQUEST_TIMEOUT_SECONDS", 45),
        )
        response.raise_for_status()
        blocks: list[str] = []
        urls: list[str] = []
        for child in response.json().get("data", {}).get("children", []):
            item = child.get("data", {})
            published = datetime.fromtimestamp(float(item.get("created_utc", 0)), timezone.utc)
            if published < cutoff:
                continue
            url = urljoin("https://www.reddit.com", item.get("permalink", ""))
            urls.append(url)
            blocks.append(
                "Discussion source: reddit\n"
                f"Title: {item.get('title', '')}\nPublished at: {published.isoformat()}\n"
                f"Engagement: score={item.get('score', 0)}, comments={item.get('num_comments', 0)}\n"
                f"URL: {url}\nText: {item.get('selftext', '')[:4000]}"
            )
        return blocks, urls

    def _collect_youtube_comments(self, query: str, cutoff: datetime) -> tuple[list[str], list[str]]:
        api_key = getattr(self.settings, "YOUTUBE_DATA_API_KEY", None)
        if not api_key:
            return [], []
        search = self._session.get(
            "https://www.googleapis.com/youtube/v3/search",
            params={
                "key": api_key, "part": "snippet", "type": "video", "q": query,
                "order": "date", "maxResults": 10, "publishedAfter": cutoff.isoformat().replace("+00:00", "Z"),
            },
            timeout=getattr(self.settings, "REQUEST_TIMEOUT_SECONDS", 45),
        )
        search.raise_for_status()
        blocks: list[str] = []
        urls: list[str] = []
        for video in search.json().get("items", []):
            video_id = video.get("id", {}).get("videoId")
            if not video_id:
                continue
            comments = self._session.get(
                "https://www.googleapis.com/youtube/v3/commentThreads",
                params={"key": api_key, "part": "snippet", "videoId": video_id, "order": "time", "maxResults": 50},
                timeout=getattr(self.settings, "REQUEST_TIMEOUT_SECONDS", 45),
            )
            if not comments.ok:
                continue
            url = f"https://www.youtube.com/watch?v={video_id}"
            for thread in comments.json().get("items", []):
                snippet = thread.get("snippet", {}).get("topLevelComment", {}).get("snippet", {})
                published_text = snippet.get("publishedAt")
                if not published_text:
                    continue
                published = datetime.fromisoformat(published_text.replace("Z", "+00:00"))
                if published < cutoff:
                    continue
                urls.append(url)
                blocks.append(
                    "Discussion source: youtube_comments\n"
                    f"Video: {video.get('snippet', {}).get('title', '')}\nPublished at: {published.isoformat()}\n"
                    f"Engagement: likes={snippet.get('likeCount', 0)}\nURL: {url}\n"
                    f"Comment: {snippet.get('textDisplay', '')[:2000]}"
                )
        return blocks, list(dict.fromkeys(urls))

    def _collect_x_posts(self, query: str, cutoff: datetime) -> tuple[list[str], list[str]]:
        token = getattr(self.settings, "X_BEARER_TOKEN", None)
        if not token:
            return [], []
        response = self._session.get(
            "https://api.x.com/2/tweets/search/recent",
            headers={"Authorization": f"Bearer {token}"},
            params={
                "query": f"({query}) lang:en -is:retweet",
                "start_time": cutoff.isoformat().replace("+00:00", "Z"),
                "max_results": 100,
                "tweet.fields": "created_at,public_metrics",
            },
            timeout=getattr(self.settings, "REQUEST_TIMEOUT_SECONDS", 45),
        )
        response.raise_for_status()
        blocks: list[str] = []
        urls: list[str] = []
        for item in response.json().get("data", []):
            url = f"https://x.com/i/web/status/{item['id']}"
            urls.append(url)
            blocks.append(
                "Discussion source: twitter\n"
                f"Published at: {item.get('created_at')}\nEngagement: {item.get('public_metrics', {})}\n"
                f"URL: {url}\nPost: {item.get('text', '')}"
            )
        return blocks, urls

    def _collect_cse_sources(self, query: str, lookback_hours: int) -> tuple[list[str], list[str]]:
        urls = self._search_google_cse(query, date_restrict=max(1, (lookback_hours + 23) // 24), allow_social=True)
        blocks, _ = self._scrape_urls(urls)
        return blocks, urls

    def _search_google_cse(self, query: str, date_restrict: int | None = None, allow_social: bool = False) -> list[str]:
        api_key = getattr(self.settings, 'GOOGLE_CSE_API_KEY', None)
        cx = getattr(self.settings, 'GOOGLE_CSE_ID', None)
        if not api_key or not cx:
            return []

        try:
            response = self._session.get(
                "https://www.googleapis.com/customsearch/v1",
                params={
                    "key": api_key, "cx": cx, "q": query, "num": 10,
                    **({"dateRestrict": f"d{date_restrict}"} if date_restrict else {}),
                },
                timeout=getattr(self.settings, 'REQUEST_TIMEOUT_SECONDS', 45),
            )
            response.raise_for_status()
            payload = response.json()
        except requests.RequestException:
            return []

        urls: list[str] = []
        for item in payload.get("items", []):
            link = item.get("link")
            if not link or (not allow_social and any(domain in link for domain in BLOCKED_DOMAINS)):
                continue
            if link not in urls:
                urls.append(link)
        return urls[: getattr(self.settings, 'MAX_SCRAPE_SOURCES', 4)]

    def _scrape_urls(self, urls: list[str]) -> tuple[list[str], list[dict[str, str]]]:
        scraped_blocks: list[str] = []
        timeout = getattr(self.settings, 'REQUEST_TIMEOUT_SECONDS', 45)
        max_chars = getattr(self.settings, 'MAX_CHARS_PER_SOURCE', 6000)
        max_sources = getattr(self.settings, 'MAX_SCRAPE_SOURCES', 4)

        for url in urls[:max_sources]:
            text_content = None
            # Try Scrapling first
            if HAS_SCRAPLING:
                try:
                    fetcher = Fetcher()
                    page = fetcher.get(url, timeout=timeout)
                    if page.status == 200:
                        text_content = self._extract_text(page.body)
                except Exception:
                    pass

            # Fallback to BeautifulSoup if Scrapling failed or returned very little
            if not text_content or len(text_content.split()) < 80:
                try:
                    response = self._session.get(url, timeout=timeout)
                    response.raise_for_status()
                    text_content = self._extract_text(response.text)
                except Exception:
                    continue

            if not text_content or len(text_content.split()) < 80:
                continue

            text_content = text_content[:max_chars]
            scraped_blocks.append(f"Source URL: {url}\n{text_content}")
        return scraped_blocks, []

    @staticmethod
    def _extract_text(html: str) -> str:
        soup = BeautifulSoup(html, "html.parser")
        for element in soup(["script", "style", "noscript"]):
            element.decompose()
        main = soup.find("article") or soup.find("main") or soup.body or soup
        text = main.get_text(separator="\n", strip=True)
        lines = [unescape(line.strip()) for line in text.splitlines() if line.strip()]
        return "\n".join(lines)
