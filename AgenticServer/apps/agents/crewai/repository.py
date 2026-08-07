from datetime import datetime, timezone
from typing import Any
from bson import ObjectId
from pymongo import MongoClient
from django.conf import settings

from api.schemas import ResolvedTopic


class TopicRepository:
    def __init__(self, service_settings=None) -> None:
        self.settings = service_settings or settings
        self._client: MongoClient | None = None

    @property
    def enabled(self) -> bool:
        return bool(getattr(self.settings, "MONGO_URI", None) and getattr(self.settings, "MONGO_DB_NAME", None))

    def _get_collection(self, collection_name: str):
        if not self.enabled:
            raise RuntimeError("MongoDB is not configured for this service.")
        if self._client is None:
            self._client = MongoClient(self.settings.MONGO_URI)
        return self._client[self.settings.MONGO_DB_NAME][collection_name]

    def fetch_next_topic(self) -> ResolvedTopic | None:
        collection = self._get_collection(getattr(self.settings, "MONGO_TOPICS_COLLECTION", "topics"))
        query = {
            "$or": [
                {"status": {"$ne": "processed"}},
                {"isContentGenerated": {"$ne": True}},
            ]
        }
        document = collection.find_one(query, sort=[("created", 1), ("_id", 1)])
        return self._to_resolved_topic(document)

    def fetch_topic_by_id(self, topic_id: str) -> ResolvedTopic | None:
        collection = self._get_collection(getattr(self.settings, "MONGO_TOPICS_COLLECTION", "topics"))
        try:
            object_id = ObjectId(topic_id)
        except Exception:
            return None
        document = collection.find_one({"_id": object_id})
        return self._to_resolved_topic(document)

    def mark_processed(
        self, 
        topic_id: str | None, 
        topic: str, 
        source_urls: list[str] | None = None,
        content: str | None = None,
        instagram_image: str | None = None
    ) -> None:
        collection = self._get_collection(getattr(self.settings, "MONGO_TOPICS_COLLECTION", "topics"))
        update = {
            "$set": {
                "status": "processed",
                "isContentGenerated": True,
                "processed_at": datetime.now(timezone.utc),
            }
        }
        if source_urls:
            update["$set"]["topicUrls"] = source_urls
        if content:
            update["$set"]["content"] = content
        if instagram_image:
            update["$set"]["instagramImage"] = instagram_image

        if topic_id:
            try:
                object_id = ObjectId(topic_id)
            except Exception:
                object_id = None
            if object_id is not None:
                collection.update_one({"_id": object_id}, update)
                return
        collection.update_one({"topic": topic}, update)

    def save_generation(self, payload: dict[str, Any]) -> str:
        collection = self._get_collection(self.settings.MONGO_OUTPUT_COLL)
        result = collection.insert_one(payload)
        return str(result.inserted_id)

    def _to_resolved_topic(self, document: dict[str, Any] | None) -> ResolvedTopic | None:
        if not document:
            return None
        topic_value = (
            document.get("topic")
            or document.get("title")
            or document.get("name")
            or document.get("subject")
        )
        if not topic_value:
            return None

        context_parts: list[str] = []
        for field_name in ("description", "notes", "brief", "summary", "keywords"):
            value = document.get(field_name)
            if isinstance(value, list):
                value = ", ".join(str(item) for item in value if item)
            if value:
                context_parts.append(f"{field_name}: {value}")

        return ResolvedTopic(
            topic_id=str(document.get("_id")),
            topic=str(topic_value).strip(),
            mongo_document=document,
            additional_context="\n".join(context_parts) or None,
        )
