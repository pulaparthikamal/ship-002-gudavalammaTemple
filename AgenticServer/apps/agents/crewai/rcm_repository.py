from datetime import datetime, timezone
from typing import Any, List, Optional, Dict
from bson import ObjectId
from pymongo import MongoClient
from django.conf import settings

class RcmRepository:
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

    def get_procedure_code(self, code: str) -> Optional[Dict[str, Any]]:
        candidate_queries = [
            ("chargemasters", {"cptCode": code, "active": {"$ne": False}}),
            ("procedurecodes", {"code": code, "active": {"$ne": False}}),
            ("procedurecodes", {"cptCode": code, "active": {"$ne": False}}),
        ]

        for collection_name, query in candidate_queries:
            document = self._get_collection(collection_name).find_one(query)
            if document:
                return document

        return None

    def list_procedure_codes(self, category: Optional[str] = None) -> List[Dict[str, Any]]:
        collection = self._get_collection("procedurecodes")
        query = {"active": {"$ne": False}}
        if category:
            query["category"] = category
        return list(collection.find(query))

    def list_active_chargemasters(self, place_of_service: Optional[str] = None) -> List[Dict[str, Any]]:
        if not self.enabled:
            return []
            
        collection = self._get_collection("chargemasters")
        query: Dict[str, Any] = {"active": {"$ne": False}, "isDeleted": {"$ne": True}}
        if place_of_service:
            query["placeOfService"] = place_of_service
            
        return list(collection.find(query))

    def get_payer(self, payer_reference: str) -> Optional[Dict[str, Any]]:
        if not payer_reference:
            return None

        collection = self._get_collection("payers")
        candidate_queries: list[Dict[str, Any]] = [
            {"payerId": payer_reference, "active": {"$ne": False}, "isDeleted": {"$ne": True}},
        ]

        if ObjectId.is_valid(payer_reference):
            candidate_queries.append(
                {"_id": ObjectId(payer_reference), "active": {"$ne": False}, "isDeleted": {"$ne": True}}
            )

        for query in candidate_queries:
            document = collection.find_one(query)
            if document:
                return document

        return None

    def save_ai_insight(self, insight: Dict[str, Any]):
        collection = self._get_collection("rcm_ai_insights")
        insight["created_at"] = datetime.now(timezone.utc)
        result = collection.insert_one(insight)
        return str(result.inserted_id)
