from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from api.schemas import RcmCodeSuggestionRequest
from dotenv import dotenv_values

from .crews.rcm_coding_crew import RcmCodingCrew


@dataclass
class RcmCodingCrewResult:
    parsed_output: dict[str, Any]
    raw_final_output: str
    full_output: str


class RcmCodingCrewService:
    """
    Orchestrates the encounter coding CrewAI workflow and normalizes the final
    JSON payload emitted by the crew.
    """

    def __init__(self, service_settings=None, env_file_path: Path | None = None) -> None:
        self.settings = service_settings
        self.env_file_path = env_file_path or Path(__file__).resolve().parents[3] / ".env.local"
        self.local_env = self._load_local_env()
        self.runtime_config = self._build_runtime_config()

    def _load_local_env(self) -> dict[str, str]:
        if not self.env_file_path.is_file():
            return {}

        return {
            key: value
            for key, value in dotenv_values(self.env_file_path).items()
            if key and isinstance(value, str)
        }

    def _read_config_value(self, *keys: str, default: Any = None) -> Any:
        for key in keys:
            local_value = self.local_env.get(key)
            if isinstance(local_value, str) and local_value.strip():
                return local_value.strip()

            env_value = os.getenv(key)
            if isinstance(env_value, str) and env_value.strip():
                return env_value.strip()

        return default

    def _read_bool_config_value(self, *keys: str, default: bool) -> bool:
        value = self._read_config_value(*keys)
        if not isinstance(value, str):
            return default

        return value.strip().lower() in {"1", "true", "yes", "on"}

    def _read_float_config_value(self, *keys: str, default: float) -> float:
        value = self._read_config_value(*keys)
        if not isinstance(value, str):
            return default

        try:
            return float(value)
        except ValueError:
            return default

    def _read_int_config_value(self, *keys: str, default: int) -> int:
        value = self._read_config_value(*keys)
        if not isinstance(value, str):
            return default

        try:
            return int(value)
        except ValueError:
            return default

    def _build_runtime_config(self) -> dict[str, Any]:
        settings_obj = self.settings
        default_provider = getattr(settings_obj, "LLM_PROVIDER", "ollama")
        default_llm_model = getattr(settings_obj, "LLM_MODEL", "")
        default_openai_api_key = getattr(settings_obj, "OPENAI_API_KEY", None)
        default_openai_base_url = getattr(settings_obj, "OPENAI_BASE_URL", None)
        default_ollama_base_url = getattr(settings_obj, "OLLAMA_BASE_URL", "http://localhost:11434")
        default_ollama_model = getattr(settings_obj, "OLLAMA_MODEL", "ollama/gpt-oss:120b-cloud")
        default_temperature = float(getattr(settings_obj, "OLLAMA_TEMPERATURE", 0.4))
        default_timeout = int(getattr(settings_obj, "OLLAMA_TIMEOUT", 180))

        return {
            "crewai_enabled": self._read_bool_config_value(
                "RCM_CODING_CREWAI_ENABLED",
                default=True,
            ),
            "provider": str(
                self._read_config_value(
                    "RCM_CODING_LLM_PROVIDER",
                    "CREWAI_LLM_PROVIDER",
                    "CREWAI_CONTENT_LLM_PROVIDER",
                    default=default_provider,
                )
            ).strip().lower(),
            "llm_model": self._read_config_value(
                "RCM_CODING_LLM_MODEL",
                "CREWAI_LLM_MODEL",
                "CREWAI_CONTENT_LLM_MODEL",
                default=default_llm_model,
            ),
            "openai_api_key": self._read_config_value(
                "RCM_CODING_OPENAI_API_KEY",
                "CREWAI_OPENAI_API_KEY",
                "CREWAI_CONTENT_OPENAI_API_KEY",
                "OPENAI_API_KEY",
                default=default_openai_api_key,
            ),
            "openai_base_url": self._read_config_value(
                "RCM_CODING_OPENAI_BASE_URL",
                "CREWAI_OPENAI_BASE_URL",
                "CREWAI_CONTENT_OPENAI_BASE_URL",
                default=default_openai_base_url,
            ),
            "ollama_base_url": self._read_config_value(
                "RCM_CODING_OLLAMA_BASE_URL",
                "CREWAI_OLLAMA_BASE_URL",
                "CREWAI_CONTENT_OLLAMA_BASE_URL",
                default=default_ollama_base_url,
            ),
            "ollama_model": self._read_config_value(
                "RCM_CODING_OLLAMA_MODEL",
                "CREWAI_OLLAMA_MODEL",
                "CREWAI_CONTENT_OLLAMA_MODEL",
                default=default_ollama_model,
            ),
            "temperature": self._read_float_config_value(
                "RCM_CODING_OLLAMA_TEMPERATURE",
                "CREWAI_OLLAMA_TEMPERATURE",
                "CREWAI_CONTENT_OLLAMA_TEMPERATURE",
                default=default_temperature,
            ),
            "timeout": self._read_int_config_value(
                "RCM_CODING_OLLAMA_TIMEOUT",
                "CREWAI_OLLAMA_TIMEOUT",
                "CREWAI_CONTENT_OLLAMA_TIMEOUT",
                default=default_timeout,
            ),
        }

    def is_enabled(self) -> bool:
        return bool(self.runtime_config.get("crewai_enabled", True))

    def get_runtime_config(self) -> dict[str, Any]:
        return dict(self.runtime_config)

    def run(
        self,
        request: RcmCodeSuggestionRequest,
        procedure_reference_context: list[dict[str, Any]] | None = None,
    ) -> RcmCodingCrewResult:
        crew_output = RcmCodingCrew(
            self.settings,
            llm_config=self.get_runtime_config(),
        ).run(
            {
                "encounter_note": request.encounter_note,
                "clinical_notes": request.clinical_notes,
                "appointment_type": request.appointment_type,
                "visit_type": request.visit_type,
                "appointment_reason": request.appointment_reason,
                "appointment_notes": request.appointment_notes,
                "service_date": request.service_date,
                "patient_age": request.patient_age,
                "patient_gender": request.patient_gender,
                "patient_sex": request.patient_sex,
                "chief_complaint": request.chief_complaint,
                "history_of_present_illness": request.history_of_present_illness,
                "provider_specialty": request.provider_specialty,
                "provider_credentials": request.provider_credentials,
                "provider_type": request.provider_type,
                "facility_name": request.facility_name,
                "place_of_service_code": request.place_of_service_code,
                "vitals": request.vitals.model_dump(by_alias=True) if request.vitals else None,
                "patient_history": request.patient_history,
                "existing_diagnosis_codes": request.existing_diagnosis_codes,
                "existing_procedure_codes": request.existing_procedure_codes,
                "requested_code_types": request.requested_code_types,
                "procedure_reference_context": [
                    item.model_dump(by_alias=True) for item in request.procedure_reference_context
                ] or procedure_reference_context or [],
            }
        )

        raw_final = str(getattr(crew_output, "raw", "") or str(crew_output)).strip()
        parsed = self._extract_json_object(raw_final)
        parsed_task_outputs = self._extract_task_json_outputs(crew_output)

        if parsed_task_outputs:
            parsed = {
                **parsed,
                "_taskOutputs": parsed_task_outputs,
            }

        return RcmCodingCrewResult(
            parsed_output=parsed,
            raw_final_output=raw_final,
            full_output=raw_final,
        )

    def _extract_task_json_outputs(self, crew_output: Any) -> list[dict[str, Any]]:
        parsed_outputs: list[dict[str, Any]] = []
        task_outputs = getattr(crew_output, "tasks_output", None) or []

        for task_output in task_outputs:
            parsed_task_output = self._extract_task_json_output(task_output)
            if parsed_task_output:
                parsed_outputs.append(parsed_task_output)

        return parsed_outputs

    def _extract_task_json_output(self, task_output: Any) -> dict[str, Any] | None:
        json_dict = getattr(task_output, "json_dict", None)
        if isinstance(json_dict, dict):
            return json_dict

        model_value = getattr(task_output, "pydantic", None)
        if model_value is not None and hasattr(model_value, "model_dump"):
            dumped_value = model_value.model_dump(by_alias=True)
            if isinstance(dumped_value, dict):
                return dumped_value

        raw_output = str(getattr(task_output, "raw", "") or str(task_output)).strip()
        if not raw_output:
            return None

        try:
            return self._extract_json_object(raw_output)
        except Exception:
            return None

    def _extract_json_object(self, raw_text: str) -> dict[str, Any]:
        sanitized_text = self._strip_markdown_code_fences(self._strip_think_blocks(raw_text))

        try:
            parsed = json.loads(sanitized_text)
        except json.JSONDecodeError:
            match = re.search(r"\{[\s\S]*\}", sanitized_text)
            if not match:
                raise
            parsed = json.loads(match.group(0))

        if not isinstance(parsed, dict):
            raise ValueError("CrewAI coding output must be a JSON object.")

        return parsed

    def _strip_markdown_code_fences(self, raw_text: str) -> str:
        text = raw_text.strip()
        if text.startswith("```"):
            text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
            text = re.sub(r"\s*```$", "", text)
        return text.strip()

    def _strip_think_blocks(self, raw_text: str) -> str:
        return re.sub(r"<think>[\s\S]*?</think>", "", raw_text, flags=re.IGNORECASE).strip()
