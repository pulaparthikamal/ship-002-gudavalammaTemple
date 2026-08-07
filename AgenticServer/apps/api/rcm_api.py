import logging
import json
import re
from datetime import datetime, timezone
from ninja import Router
from ninja.errors import HttpError
from typing import List, Optional, Dict, Any
import requests
from .schemas import (
    RcmCodeSuggestionRequest,
    RcmCodeSuggestionResponse,
    RcmCodingReviewFailureExplanationRequest,
    RcmCodingReviewFailureExplanationResponse,
    RcmDenialPredictionRequest,
    RcmDenialPredictionResponse,
    RcmAckRejectionAnalysisRequest,
    RcmAckRejectionAnalysisResponse,
    RcmDenialAnalysisRequest,
    RcmDenialAnalysisResponse,
    RcmAppealPacketRequest,
    RcmAppealPacketResponse,
    RcmEraMatchExceptionRequest,
    RcmEraMatchExceptionResponse,
    RcmArPrioritizationRequest,
    RcmArPrioritizationResponse,
    RcmAuthPredictionRequest,
    RcmAuthPredictionResponse,
    RcmDependentValidationRequest,
    RcmDependentValidationResponse,
    SuggestedCode
)
from agents.crewai.rcm_coding_service import RcmCodingCrewService
from agents.crewai.rcm_repository import RcmRepository
from django.conf import settings

logger = logging.getLogger("apps.api.rcm")
router = Router(tags=["RCM AI"])
rcm_repo = RcmRepository(settings)
rcm_coding_service = RcmCodingCrewService(settings)

DIAGNOSIS_CODE_PATTERN = re.compile(r"^[A-TV-Z][0-9][0-9AB](?:\.[0-9A-TV-Z]{1,4})?$", re.IGNORECASE)
PROCEDURE_CODE_PATTERN = re.compile(r"^(?:\d{5}|[A-Z]\d{4})$", re.IGNORECASE)

def ensure_rcm_api_authorized(request):
    expected_key = getattr(settings, "AGENTIC_SERVER_API_KEY", None)
    if not expected_key and not getattr(settings, "DEBUG", False):
        raise HttpError(503, "RCM AI API key is not configured.")

    if expected_key and request.headers.get("x-agentic-api-key") != expected_key:
        raise HttpError(401, "Unauthorized")


def normalize_text(value: Any) -> Optional[str]:
    if isinstance(value, str):
        normalized_value = value.strip()
        return normalized_value or None
    return None


def normalize_text_lower(value: Any) -> Optional[str]:
    normalized_value = normalize_text(value)
    return normalized_value.lower() if normalized_value else None


def parse_datetime(value: Any) -> Optional[datetime]:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)

    if isinstance(value, str):
        try:
            parsed_value = datetime.fromisoformat(value.replace("Z", "+00:00"))
            return parsed_value if parsed_value.tzinfo else parsed_value.replace(tzinfo=timezone.utc)
        except ValueError:
            return None

    return None


def dedupe_preserve_order(values: List[str]) -> List[str]:
    seen: set[str] = set()
    next_values: List[str] = []

    for value in values:
        normalized_value = normalize_text(value)
        if not normalized_value or normalized_value in seen:
            continue
        seen.add(normalized_value)
        next_values.append(normalized_value)

    return next_values


def load_payer_context(payer_id: str) -> Optional[Dict[str, Any]]:
    if not payer_id or not rcm_repo.enabled:
        return None

    try:
        return rcm_repo.get_payer(payer_id)
    except Exception as exc:
        logger.warning("Unable to load payer context for %s: %s", payer_id, exc)
        return None


def load_procedure_code(cpt_code: str) -> Optional[Dict[str, Any]]:
    if not cpt_code or not rcm_repo.enabled:
        return None

    try:
        return rcm_repo.get_procedure_code(cpt_code)
    except Exception as exc:
        logger.warning("Unable to load procedure code context for %s: %s", cpt_code, exc)
        return None


def persist_ai_insight(
    insight_type: str,
    request_payload: Dict[str, Any],
    response_payload: Dict[str, Any],
    metadata: Optional[Dict[str, Any]] = None,
) -> None:
    if not rcm_repo.enabled:
        return

    try:
        rcm_repo.save_ai_insight(
            {
                "insightType": insight_type,
                "requestPayload": request_payload,
                "responsePayload": response_payload,
                "metadata": metadata or {},
            }
        )
    except Exception as exc:
        logger.warning("Unable to persist %s AI insight: %s", insight_type, exc)


def normalize_confidence(value: Any) -> float:
    if isinstance(value, (int, float)):
        return max(0.0, min(1.0, float(value)))

    if isinstance(value, str):
        try:
            return max(0.0, min(1.0, float(value)))
        except ValueError:
            return 0.0

    return 0.0


def normalize_units(value: Any) -> Optional[int]:
    if isinstance(value, bool):
        return None

    if isinstance(value, int) and value > 0:
        return value

    if isinstance(value, float) and value.is_integer() and value > 0:
        return int(value)

    if isinstance(value, str):
        try:
            parsed_value = float(value)
        except ValueError:
            return None

        if parsed_value.is_integer() and parsed_value > 0:
            return int(parsed_value)

    return None


def normalize_code_value(value: Any) -> Optional[str]:
    normalized_value = normalize_text(value)
    return normalized_value.upper() if normalized_value else None


def is_diagnosis_code(code: str) -> bool:
    return bool(DIAGNOSIS_CODE_PATTERN.match(code))


def is_procedure_code(code: str) -> bool:
    return bool(PROCEDURE_CODE_PATTERN.match(code))


def normalize_suggested_code(value: Any, default_code_type: Optional[str] = None) -> Optional[tuple[str, SuggestedCode]]:
    if isinstance(value, str):
        normalized_code = normalize_code_value(value)
        if not normalized_code:
            return None

        inferred_code_type = default_code_type
        if not inferred_code_type:
            if is_diagnosis_code(normalized_code):
                inferred_code_type = "diagnosis"
            elif is_procedure_code(normalized_code):
                inferred_code_type = "procedure"

        if inferred_code_type not in {"diagnosis", "procedure"}:
            return None

        return (
            inferred_code_type,
            SuggestedCode(
                code=normalized_code,
                description="",
                confidence=0,
                reasoning="",
            ),
        )

    if not isinstance(value, dict):
        return None

    normalized_code = normalize_code_value(
        value.get("code")
        or value.get("icdCode")
        or value.get("icd10Code")
        or value.get("diagnosisCode")
        or value.get("cptCode")
        or value.get("hcpcsCode")
        or value.get("procedureCode")
        or value.get("value")
    )
    if not normalized_code:
        return None

    inferred_code_type = normalize_text(value.get("codeType") or value.get("type"))
    if inferred_code_type:
        inferred_code_type = inferred_code_type.lower()
    else:
        inferred_code_type = default_code_type

    if inferred_code_type not in {"diagnosis", "procedure"}:
        if is_diagnosis_code(normalized_code):
            inferred_code_type = "diagnosis"
        elif is_procedure_code(normalized_code):
            inferred_code_type = "procedure"

    if inferred_code_type not in {"diagnosis", "procedure"}:
        return None

    units = normalize_units(value.get("units"))

    return (
        inferred_code_type,
        SuggestedCode(
            code=normalized_code,
            description=normalize_text(
                value.get("description")
                or value.get("label")
                or value.get("name")
                or value.get("title")
            ) or "",
            confidence=normalize_confidence(value.get("confidence") or value.get("score")),
            reasoning=normalize_text(
                value.get("reasoning")
                or value.get("rationale")
                or value.get("justification")
                or value.get("notes")
            ) or "",
            units=units,
        ),
    )


def upsert_suggestion(mapper: Dict[str, SuggestedCode], suggestion: SuggestedCode) -> None:
    existing = mapper.get(suggestion.code)
    if existing is None or suggestion.confidence >= existing.confidence:
        mapper[suggestion.code] = suggestion


def dedupe_suggested_codes(values: List[Any], default_code_type: Optional[str] = None) -> List[SuggestedCode]:
    suggestions_by_code: Dict[str, SuggestedCode] = {}
    for value in values:
        if isinstance(value, SuggestedCode):
            suggestion = value
        else:
            normalized_suggestion = normalize_suggested_code(value, default_code_type)
            if not normalized_suggestion:
                continue
            _, suggestion = normalized_suggestion
        upsert_suggestion(suggestions_by_code, suggestion)
    return list(suggestions_by_code.values())


def combine_suggested_codes(
    diagnosis_codes: List[SuggestedCode],
    procedure_codes: List[SuggestedCode],
) -> List[SuggestedCode]:
    return dedupe_suggested_codes([*diagnosis_codes, *procedure_codes])


def has_code_suggestions(response_payload: Dict[str, Any]) -> bool:
    return bool(response_payload.get("diagnosisCodes") or response_payload.get("procedureCodes"))


def is_valid_validation_status(value: Any) -> bool:
    normalized_value = (normalize_text(value) or "").strip().lower()
    return normalized_value in {"valid", "supported", "supportable"}


def normalize_validation_code_type(value: Any, code: str) -> Optional[str]:
    normalized_value = (normalize_text(value) or "").strip().lower()

    if normalized_value in {"diagnosis", "diagnosiscode", "diagnosis code", "icd", "icd10", "icd-10"}:
        return "diagnosis"
    if normalized_value in {"procedure", "procedurecode", "procedure code", "cpt", "hcpcs", "cdt"}:
        return "procedure"
    if DIAGNOSIS_CODE_PATTERN.match(code):
        return "diagnosis"
    if PROCEDURE_CODE_PATTERN.match(code):
        return "procedure"

    return None


def build_procedure_reference_context(payload: RcmCodeSuggestionRequest) -> List[Dict[str, Any]]:
    reference_by_code: Dict[str, Dict[str, Any]] = {}

    if not payload.procedure_reference_context and rcm_repo.enabled:
        active_chargemasters = rcm_repo.list_active_chargemasters(payload.place_of_service_code)
        for item in active_chargemasters:
            normalized_code = normalize_code_value(item.get("cptCode"))
            if not normalized_code:
                continue

            reference_by_code[normalized_code] = {
                "code": normalized_code,
                "description": normalize_text(item.get("description")),
                "placeOfService": normalize_text(item.get("placeOfService")),
                "defaultChargeAmount": item.get("defaultChargeAmount"),
                "modifiersAllowed": item.get("modifiersAllowed") or [],
                "diagnosisRestrictions": item.get("diagnosisRestrictions") or [],
            }
    else:
        for item in payload.procedure_reference_context:
            normalized_code = normalize_code_value(item.code)
            if not normalized_code:
                continue

            reference_by_code[normalized_code] = {
                "code": normalized_code,
                "description": normalize_text(item.description),
                "placeOfService": normalize_text(item.place_of_service),
                "defaultChargeAmount": item.default_charge_amount,
                "modifiersAllowed": item.modifiers_allowed,
                "diagnosisRestrictions": item.diagnosis_restrictions,
            }

    for procedure_code in payload.existing_procedure_codes:
        procedure_document = load_procedure_code(procedure_code)
        if not procedure_document:
            continue

        normalized_code = normalize_code_value(procedure_code)
        if not normalized_code:
            continue

        reference_by_code.setdefault(
            normalized_code,
            {
                "code": normalized_code,
                "description": normalize_text(
                    procedure_document.get("description")
                    or procedure_document.get("shortDescription")
                    or procedure_document.get("longDescription")
                    or procedure_document.get("procedureDescription")
                ),
                "category": normalize_text(procedure_document.get("category")),
            }
        )

    return list(reference_by_code.values())


def build_procedure_reference_from_document(code: str, document: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "code": code,
        "description": normalize_text(
            document.get("description")
            or document.get("shortDescription")
            or document.get("longDescription")
            or document.get("procedureDescription")
        ),
        "placeOfService": normalize_text(document.get("placeOfService")),
        "defaultChargeAmount": document.get("defaultChargeAmount"),
        "modifiersAllowed": document.get("modifiersAllowed") or [],
        "diagnosisRestrictions": document.get("diagnosisRestrictions") or [],
        "category": normalize_text(document.get("category")),
    }


def resolve_procedure_reference(
    code: str,
    reference_by_code: Dict[str, Dict[str, Any]],
) -> Optional[Dict[str, Any]]:
    reference = reference_by_code.get(code)
    if reference:
        return reference

    procedure_document = load_procedure_code(code)
    if not procedure_document:
        return None

    reference = build_procedure_reference_from_document(code, procedure_document)
    reference_by_code[code] = reference
    return reference


def build_code_suggestion_response(
    payload_data: Dict[str, Any],
    request_payload: RcmCodeSuggestionRequest,
    crewai_used: bool,
) -> Dict[str, Any]:
    allowed_procedure_reference_by_code = index_procedure_reference_context(
        build_procedure_reference_context(request_payload)
    )
    roots: List[Dict[str, Any]] = [payload_data]

    for key in ["data", "result", "response", "suggestions"]:
        candidate = payload_data.get(key)
        if isinstance(candidate, dict):
            roots.append(candidate)

    for candidate in payload_data.get("_taskOutputs", []) or []:
        if isinstance(candidate, dict):
            roots.append(candidate)

    diagnosis_codes_by_value: Dict[str, SuggestedCode] = {}
    procedure_codes_by_value: Dict[str, SuggestedCode] = {}
    validation_results: List[Dict[str, Any]] = []
    suggested_fixes: List[str] = []
    summary: Optional[str] = None
    status = "success"

    for root in roots:
        for entry in root.get("diagnosisCodes", []) or root.get("suggestedDiagnosisCodes", []) or root.get("icdCodes", []) or root.get("icd10Codes", []):
            normalized_suggestion = normalize_suggested_code(entry, "diagnosis")
            if normalized_suggestion:
                _, suggestion = normalized_suggestion
                upsert_suggestion(diagnosis_codes_by_value, suggestion)

        for procedure_entries in (
            root.get("procedureCodes", []),
            root.get("suggestedProcedureCodes", []),
            root.get("cptCodes", []),
            root.get("hcpcsCodes", []),
            root.get("cdtCodes", []),
            root.get("dentalCodes", []),
            root.get("dentalProcedureCodes", []),
        ):
            for entry in procedure_entries or []:
                normalized_suggestion = normalize_suggested_code(entry, "procedure")
                if normalized_suggestion:
                    _, suggestion = normalized_suggestion
                    upsert_suggestion(procedure_codes_by_value, suggestion)

        for entry in root.get("suggestedCodes", []) or root.get("codes", []) or root.get("codeSuggestions", []):
            normalized_suggestion = normalize_suggested_code(entry)
            if not normalized_suggestion:
                continue

            code_type, suggestion = normalized_suggestion
            if code_type == "diagnosis":
                upsert_suggestion(diagnosis_codes_by_value, suggestion)
            elif code_type == "procedure":
                upsert_suggestion(procedure_codes_by_value, suggestion)

        for field_name in ["suggestedFixes", "recommendedActions", "fixes", "nextActions"]:
            for value in root.get(field_name, []) or []:
                normalized_value = normalize_text(value)
                if normalized_value and normalized_value not in suggested_fixes:
                    suggested_fixes.append(normalized_value)

        if summary is None:
            summary = normalize_text(root.get("summary") or root.get("message") or root.get("overview"))

        for entry in root.get("validationResults", []) or []:
            if isinstance(entry, dict) and entry.get("code"):
                normalized_validation_code = normalize_code_value(entry.get("code"))
                normalized_validation_type = normalize_validation_code_type(
                    entry.get("codeType"),
                    normalized_validation_code or "",
                )
                normalized_validation_status = normalize_text(entry.get("status"))
                normalized_validation_reasoning = normalize_text(entry.get("reasoning")) or ""

                validation_results.append({
                    "code": normalized_validation_code or "",
                    "codeType": normalized_validation_type or normalize_text(entry.get("codeType")) or "",
                    "status": normalized_validation_status or "",
                    "reasoning": normalized_validation_reasoning,
                    "suggestedAlternative": normalize_code_value(entry.get("suggestedAlternative")),
                })

                if not normalized_validation_code or not is_valid_validation_status(normalized_validation_status):
                    continue

                validation_confidence = normalize_confidence(entry.get("confidence") or entry.get("score"))

                if normalized_validation_type == "procedure":
                    reference = resolve_procedure_reference(
                        normalized_validation_code,
                        allowed_procedure_reference_by_code,
                    )
                    if not reference:
                        continue

                    upsert_suggestion(
                        procedure_codes_by_value,
                        SuggestedCode(
                            code=normalized_validation_code,
                            description=normalize_text(reference.get("description")) or "",
                            confidence=validation_confidence or 0.86,
                            reasoning=normalized_validation_reasoning
                            or "Validated as supported by the AI coding auditor and matched to the active Charge Master.",
                            units=1,
                        ),
                    )
                elif normalized_validation_type == "diagnosis":
                    upsert_suggestion(
                        diagnosis_codes_by_value,
                        SuggestedCode(
                            code=normalized_validation_code,
                            description="",
                            confidence=validation_confidence or 0.82,
                            reasoning=normalized_validation_reasoning
                            or "Validated as supported by the AI coding auditor.",
                        ),
                    )

        normalized_status = normalize_text(root.get("status") or root.get("resultStatus") or root.get("outcome"))
        if normalized_status:
            status = normalized_status

    diagnosis_codes = [
        suggestion
        for code, suggestion in diagnosis_codes_by_value.items()
        if code not in {existing_code.upper() for existing_code in request_payload.existing_diagnosis_codes}
    ]
    procedure_codes = [
        suggestion
        for code, suggestion in procedure_codes_by_value.items()
        if code not in {existing_code.upper() for existing_code in request_payload.existing_procedure_codes}
    ]

    if allowed_procedure_reference_by_code:
        constrained_procedure_codes: List[SuggestedCode] = []
        missing_procedure_reference_codes: List[str] = []

        for suggestion in procedure_codes:
            reference = resolve_procedure_reference(
                suggestion.code,
                allowed_procedure_reference_by_code,
            )
            if not reference:
                missing_procedure_reference_codes.append(suggestion.code)
                constrained_procedure_codes.append(suggestion)
                continue

            constrained_procedure_codes.append(
                SuggestedCode(
                    code=suggestion.code,
                    description=normalize_text(reference.get("description")) or suggestion.description,
                    confidence=suggestion.confidence,
                    reasoning=suggestion.reasoning or "Selected from active Charge Master entries using encounter documentation.",
                    units=suggestion.units or 1,
                )
            )
        procedure_codes = constrained_procedure_codes

        if missing_procedure_reference_codes:
            suggested_fixes.append(
                "Some AI procedure suggestions could not be confirmed by AgenticServer Charge Master context "
                f"({', '.join(missing_procedure_reference_codes)}). Backend Encounter validation should confirm these against the application Charge Master."
            )

        selected_procedure_codes = {suggestion.code for suggestion in procedure_codes}
        allowed_diagnosis_codes = {
            diagnosis_code.upper()
            for procedure_code in selected_procedure_codes
            for diagnosis_code in allowed_procedure_reference_by_code
                .get(procedure_code, {})
                .get("diagnosisRestrictions", [])
            if normalize_code_value(diagnosis_code)
        }
        constrained_diagnosis_codes: List[SuggestedCode] = []

        for suggestion in diagnosis_codes:
            if suggestion.code in allowed_diagnosis_codes:
                constrained_diagnosis_codes.append(
                    SuggestedCode(
                        code=suggestion.code,
                        description=suggestion.description,
                        confidence=suggestion.confidence,
                        reasoning=suggestion.reasoning,
                    )
                )

        if allowed_diagnosis_codes:
            diagnosis_codes = dedupe_suggested_codes(constrained_diagnosis_codes, "diagnosis")
        elif missing_procedure_reference_codes:
            suggested_fixes.append(
                "Diagnosis restriction validation was deferred because AgenticServer could not resolve every selected procedure in Charge Master context."
            )
        else:
            diagnosis_codes = []

    if "diagnosis" not in request_payload.requested_code_types:
        diagnosis_codes = []
    if "procedure" not in request_payload.requested_code_types:
        procedure_codes = []

    if diagnosis_codes or procedure_codes:
        status = "success"

    response_model = RcmCodeSuggestionResponse(
        status=status,
        summary=summary,
        diagnosisCodes=dedupe_suggested_codes(diagnosis_codes),
        procedureCodes=dedupe_suggested_codes(procedure_codes),
        suggestedCodes=combine_suggested_codes(diagnosis_codes, procedure_codes),
        suggestedFixes=suggested_fixes,
        validationResults=validation_results,
        crewaiUsed=crewai_used,
    )
    return response_model.model_dump(by_alias=True)


def merge_code_suggestion_responses(
    primary_response: Dict[str, Any],
    secondary_response: Dict[str, Any],
) -> Dict[str, Any]:
    primary_diagnosis_codes = dedupe_suggested_codes(primary_response.get("diagnosisCodes", []))
    secondary_diagnosis_codes = dedupe_suggested_codes(secondary_response.get("diagnosisCodes", []))
    primary_procedure_codes = dedupe_suggested_codes(primary_response.get("procedureCodes", []))
    secondary_procedure_codes = dedupe_suggested_codes(secondary_response.get("procedureCodes", []))
    diagnosis_codes = primary_diagnosis_codes or secondary_diagnosis_codes
    procedure_codes = primary_procedure_codes or secondary_procedure_codes
    suggested_fixes = dedupe_preserve_order(
        [
            *(primary_response.get("suggestedFixes") or []),
            *(secondary_response.get("suggestedFixes") or []),
        ]
    )

    response_model = RcmCodeSuggestionResponse(
        status=primary_response.get("status") or secondary_response.get("status") or "success",
        summary=primary_response.get("summary") or secondary_response.get("summary"),
        diagnosisCodes=diagnosis_codes,
        procedureCodes=procedure_codes,
        suggestedCodes=combine_suggested_codes(diagnosis_codes, procedure_codes),
        suggestedFixes=suggested_fixes,
        validationResults=primary_response.get("validationResults") or secondary_response.get("validationResults") or [],
        crewaiUsed=bool(primary_response.get("crewaiUsed")),
    )
    return response_model.model_dump(by_alias=True)


def index_procedure_reference_context(values: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    reference_by_code: Dict[str, Dict[str, Any]] = {}

    for item in values:
        normalized_code = normalize_code_value(item.get("code"))
        if not normalized_code:
            continue

        reference_by_code[normalized_code] = item

    return reference_by_code


def build_rule_based_code_suggestions(payload: RcmCodeSuggestionRequest) -> Dict[str, Any]:
    response_model = RcmCodeSuggestionResponse(
        status="no_suggestions",
        summary="AI coding did not return a supportable Charge Master selection.",
        diagnosisCodes=[],
        procedureCodes=[],
        suggestedCodes=[],
        suggested_fixes=[
            "No code was suggested because deterministic keyword fallback is disabled. Review clinical documentation, active Charge Master setup, and AI service availability."
        ],
        crewai_used=False,
    )
    return response_model.model_dump(by_alias=True)


def strip_markdown_code_fences(raw_text: str) -> str:
    text = raw_text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```$", "", text)
    return text.strip()


def strip_think_blocks(raw_text: str) -> str:
    return re.sub(r"<think>[\s\S]*?</think>", "", raw_text, flags=re.IGNORECASE).strip()


def extract_json_object(raw_text: str) -> Dict[str, Any]:
    sanitized_text = strip_markdown_code_fences(strip_think_blocks(raw_text))

    try:
        parsed = json.loads(sanitized_text)
    except json.JSONDecodeError:
        match = re.search(r"\{[\s\S]*\}", sanitized_text)
        if not match:
            raise
        parsed = json.loads(match.group(0))

    if not isinstance(parsed, dict):
        raise ValueError("AI response must be a JSON object.")

    return parsed


def normalize_failure_explanation_response(value: Any) -> Dict[str, Any]:
    payload = value if isinstance(value, dict) else {}
    issues: List[Dict[str, Any]] = []

    for entry in payload.get("issues", []) or payload.get("failureIssues", []) or []:
        if not isinstance(entry, dict):
            continue

        title = normalize_text(entry.get("title"))
        explanation = normalize_text(entry.get("explanation") or entry.get("reason"))
        correction = normalize_text(entry.get("correction") or entry.get("recommendedCorrection") or entry.get("action"))
        source = normalize_text(entry.get("source") or entry.get("sourceError"))
        field = normalize_text(entry.get("field") or entry.get("category") or entry.get("affectedField"))
        raw_line_number = entry.get("lineNumber") or entry.get("line_number")
        line_number = raw_line_number if isinstance(raw_line_number, int) and raw_line_number > 0 else None

        if not title or not explanation or not correction:
            continue

        issues.append({
            "lineNumber": line_number,
            "field": field or "Coding review",
            "title": title,
            "explanation": explanation,
            "correction": correction,
            "source": source or title,
        })

    return RcmCodingReviewFailureExplanationResponse(
        status=normalize_text(payload.get("status")) or ("success" if issues else "no_explanations"),
        summary=normalize_text(payload.get("summary")),
        issues=issues,
        suggestedFixes=[
            value for value in [
                normalize_text(item)
                for item in payload.get("suggestedFixes", []) or payload.get("recommendedActions", []) or []
            ]
            if value
        ],
        crewaiUsed=False,
    ).model_dump(by_alias=True)


def build_coding_review_failure_prompt(payload: RcmCodingReviewFailureExplanationRequest) -> str:
    return "\n".join([
        "You are an RCM coding review explainer.",
        "Convert coding review failures into structured, plain-language correction guidance.",
        "Use only the provided review, charge, encounter, and scrub findings. Do not invent codes, charge lines, payer rules, or documentation.",
        "Tie an issue to lineNumber only when the provided scrub finding or charge line data supports that line.",
        "For each issue, explain why claim creation failed and what must be corrected before rerunning coding review.",
        "When a finding includes current diagnoses, allowed diagnoses, CPT/CDT code, Charge Master description, or AI evidence, include those specifics in the explanation and correction.",
        "For Revenue Integrity or Coding Completeness findings, explain the likely missing revenue/code capture risk and whether the user should add the missing line/code or correct the encounter if it was not performed.",
        "Avoid generic wording. Each issue must mention the affected code, line, or configuration shown in the input.",
        "Return only strict JSON with this exact shape:",
        '{"status":"success","summary":"...","issues":[{"lineNumber":1,"field":"...","title":"...","explanation":"...","correction":"...","source":"..."}],"suggestedFixes":["..."]}',
        "",
        f"Review: {json.dumps(payload.review, default=str)}",
        f"Charge: {json.dumps(payload.charge, default=str)}",
        f"Encounter: {json.dumps(payload.encounter, default=str)}",
        f"Validation Errors: {json.dumps(payload.validation_errors)}",
        f"Modifier Issues: {json.dumps(payload.modifier_issues)}",
        f"Payer Rule Failures: {json.dumps(payload.payer_specific_rule_failures)}",
    ])


def run_ollama_json_prompt(prompt: str) -> Dict[str, Any]:
    runtime_config = rcm_coding_service.get_runtime_config()
    provider = str(runtime_config.get("provider") or "ollama").strip().lower()

    if provider != "ollama":
        raise ValueError("Coding review failure explanation currently requires Ollama provider.")

    base_url = str(runtime_config.get("ollama_base_url") or "http://127.0.0.1:11434").rstrip("/")
    model = str(runtime_config.get("ollama_model") or runtime_config.get("llm_model") or "gpt-oss:120b-cloud").strip()
    if model.startswith("ollama/"):
        model = model[len("ollama/"):]

    response = requests.post(
        f"{base_url}/api/chat",
        json={
            "model": model,
            "stream": False,
            "format": "json",
            "options": {"temperature": 0.1},
            "messages": [
                {
                    "role": "system",
                    "content": "You return strict JSON for RCM coding review failure explanations.",
                },
                {
                    "role": "user",
                    "content": prompt,
                },
            ],
        },
        timeout=int(runtime_config.get("timeout") or 180),
    )
    response.raise_for_status()
    data = response.json()
    message = data.get("message") if isinstance(data, dict) else None
    content = None

    if isinstance(message, dict):
        content = normalize_text(message.get("content"))
    if not content and isinstance(data, dict):
        content = normalize_text(data.get("response"))
    if not content:
        raise ValueError("Ollama response did not include JSON content.")

    return extract_json_object(content)

@router.post("/suggest-codes", response=RcmCodeSuggestionResponse)
def suggest_codes(request, payload: RcmCodeSuggestionRequest):
    ensure_rcm_api_authorized(request)
    logger.info(f"Generating code suggestions for encounter note: {payload.encounter_note[:50]}...")
    runtime_config = rcm_coding_service.get_runtime_config()
    logger.debug(
        "RCM coding LLM config: provider=%s model=%s ollama_model=%s",
        runtime_config.get("provider", "unknown"),
        runtime_config.get("llm_model") or "(default)",
        runtime_config.get("ollama_model") or "(default)",
    )
    procedure_reference_context = build_procedure_reference_context(payload)
    crewai_enabled = rcm_coding_service.is_enabled()
    crewai_response: Optional[Dict[str, Any]] = None
    final_response: Dict[str, Any]

    if crewai_enabled:
        try:
            crew_result = rcm_coding_service.run(payload, procedure_reference_context)
            crewai_response = build_code_suggestion_response(
                crew_result.parsed_output,
                payload,
                crewai_used=True,
            )
        except Exception as exc:
            logger.warning("CrewAI RCM coding failed, using fallback suggestions: %s", exc)

    fallback_response = build_rule_based_code_suggestions(payload)
    final_response = fallback_response

    if crewai_response:
        final_response = merge_code_suggestion_responses(crewai_response, fallback_response)
        if not has_code_suggestions(final_response):
            final_response = crewai_response

    persist_ai_insight(
        "code_suggestion",
        payload.model_dump(by_alias=True),
        final_response,
        metadata={
            "suggestionCount": len(final_response.get("suggestedCodes", [])),
            "diagnosisSuggestionCount": len(final_response.get("diagnosisCodes", [])),
            "procedureSuggestionCount": len(final_response.get("procedureCodes", [])),
            "fixCount": len(final_response.get("suggestedFixes", [])),
            "crewaiUsed": bool(final_response.get("crewaiUsed")),
            "requestedCodeTypes": payload.requested_code_types,
        },
    )

    return final_response


@router.post("/explain-coding-review-failure", response=RcmCodingReviewFailureExplanationResponse)
def explain_coding_review_failure(request, payload: RcmCodingReviewFailureExplanationRequest):
    ensure_rcm_api_authorized(request)

    all_findings = [
        *payload.validation_errors,
        *payload.modifier_issues,
        *payload.payer_specific_rule_failures,
    ]

    if not all_findings:
        return RcmCodingReviewFailureExplanationResponse(
            status="no_explanations",
            summary="No failed coding review findings were provided.",
            issues=[],
            suggested_fixes=[],
            crewai_used=False,
        ).model_dump(by_alias=True)

    try:
        raw_response = run_ollama_json_prompt(build_coding_review_failure_prompt(payload))
        final_response = normalize_failure_explanation_response(raw_response)
    except Exception as exc:
        logger.warning("AI coding review failure explanation failed: %s", exc)
        final_response = RcmCodingReviewFailureExplanationResponse(
            status="error",
            summary="AI could not generate coding review failure explanations.",
            issues=[],
            suggested_fixes=[],
            crewai_used=False,
        ).model_dump(by_alias=True)

    persist_ai_insight(
        "coding_review_failure_explanation",
        payload.model_dump(by_alias=True),
        final_response,
        metadata={
            "issueCount": len(final_response.get("issues", [])),
            "findingCount": len(all_findings),
        },
    )

    return final_response

@router.post("/predict-denial", response=RcmDenialPredictionResponse)
def predict_denial(request, payload: RcmDenialPredictionRequest):
    ensure_rcm_api_authorized(request)
    logger.info(f"Predicting denial for payer: {payload.payer_id}")

    prob = 0.08
    reasons = []
    actions = []

    claim = payload.claim_data or {}
    claim_lines = claim.get("claimLines") or []
    diagnosis_codes = claim.get("diagnosisCodes") or []
    payer = load_payer_context(payload.payer_id)
    payer_name = normalize_text((payer or {}).get("payerName"))
    payer_type = normalize_text_lower((payer or {}).get("payerType"))
    submission_method = normalize_text_lower((payer or {}).get("claimsSubmissionMethod")) or "electronic"
    timely_filing_days = (payer or {}).get("timelyFilingDays")

    billing_provider_npi = (
        claim.get("billingProviderNpi")
        or claim.get("facilityNpi")
        or claim.get("renderingProviderNpi")
    )
    member_id = claim.get("memberId") or claim.get("subscriberId")
    auth_number = normalize_text(claim.get("authNumber"))
    referral_number = normalize_text(claim.get("referralNumber"))
    payer_edi_id = normalize_text(claim.get("ediPayerId")) or normalize_text((payer or {}).get("ediPayerId"))
    claim_date = parse_datetime(claim.get("claimDate"))

    if not billing_provider_npi:
        prob += 0.25
        reasons.append("Missing Billing Provider NPI")
        actions.append("Update Facility profile with NPI")

    if not member_id:
        prob += 0.35
        reasons.append("Missing Member ID / Insurance Policy")
        actions.append("Verify patient insurance coverage")

    if not diagnosis_codes:
        prob += 0.2
        reasons.append("No diagnosis codes linked to the claim")
        actions.append("Review ICD-10 documentation and diagnosis linkage")

    if not claim_lines:
        prob += 0.25
        reasons.append("Claim has no service lines")
        actions.append("Add claim service lines before submission")

    if submission_method == "electronic" and not payer_edi_id:
        prob += 0.22
        reasons.append("Payer requires electronic routing but no EDI payer ID is configured")
        actions.append("Update payer or insurance policy with the correct EDI payer ID")

    if claim.get("authorizationRequired") and not auth_number:
        prob += 0.2
        reasons.append("Authorization is required but no authorization number is attached")
        actions.append("Link the approved authorization number before claim submission")

    if claim.get("referralRequired") and not referral_number:
        prob += 0.14
        reasons.append("Referral is required but no referral number is attached")
        actions.append("Attach a valid referral before claim submission")

    if claim.get("correctedClaimIndicator") and not normalize_text(claim.get("originalClaimId")):
        prob += 0.2
        reasons.append("Corrected claim is missing the original claim reference")
        actions.append("Populate the original claim ID before resubmission")

    if claim_date and isinstance(timely_filing_days, (int, float)):
        claim_age_days = (datetime.now(timezone.utc) - claim_date.astimezone(timezone.utc)).days

        if claim_age_days > timely_filing_days:
            prob += 0.45
            reasons.append(f"Claim appears past {int(timely_filing_days)}-day timely filing for this payer")
            actions.append("Hold submission and review payer timely filing appeal options")
        elif claim_age_days > max(int(timely_filing_days) - 15, 0):
            prob += 0.1
            reasons.append("Claim is approaching payer timely filing limit")
            actions.append("Prioritize this claim for immediate submission")

    if payer_type in {"medicaid", "managed medicaid"} and any(
        normalize_text(line.get("cptCode", "")) and str(line.get("cptCode")).startswith(("705", "721", "732", "737", "741", "755", "788"))
        for line in claim_lines
    ):
        prob += 0.08
        reasons.append("Advanced imaging often requires stricter Medicaid documentation or authorization review")
        actions.append("Confirm payer-specific imaging authorization requirements before submission")

    if payer_type == "workers compensation" and not normalize_text(claim.get("claimNumber")):
        prob += 0.18
        reasons.append("Workers compensation claims typically require an employer or claim reference number")
        actions.append("Add workers compensation claim details before submission")

    for index, line in enumerate(claim_lines, start=1):
        if not line.get("cptCode"):
            prob += 0.2
            reasons.append(f"Line {index} missing CPT code")
            actions.append(f"Add CPT code to line {index}")

        if not line.get("units"):
            prob += 0.1
            reasons.append(f"Line {index} missing units")
            actions.append(f"Add valid units to line {index}")

        if not line.get("placeOfService"):
            prob += 0.1
            reasons.append(f"Line {index} missing place of service")
            actions.append(f"Populate place of service for line {index}")

    response_payload = {
        "status": "success",
        "denialProbability": min(prob, 1.0),
        "potentialRejectionReasons": dedupe_preserve_order(reasons),
        "recommendedActions": dedupe_preserve_order(actions),
    }

    persist_ai_insight(
        "denial_prediction",
        payload.model_dump(by_alias=True),
        response_payload,
        metadata={
            "payerName": payer_name,
            "payerType": payer_type,
            "submissionMethod": submission_method,
        },
    )

    return response_payload


def _upper_values(values: Any) -> List[str]:
    if not isinstance(values, list):
        return []
    return [
        str(value).strip().upper()
        for value in values
        if str(value).strip()
    ]


def _money(value: Any) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def _days_until(value: Any) -> Optional[int]:
    date_value = parse_datetime(value)
    if not date_value:
        return None
    now = datetime.now(timezone.utc)
    return (date_value.astimezone(timezone.utc) - now).days


def _recommendation_from_denial_codes(carc_codes: List[str], category: Optional[str]) -> tuple[str, str, List[str], List[str]]:
    category_key = (category or "").upper()
    codes = set(carc_codes)
    evidence: List[str] = []
    missing_docs: List[str] = []

    if category_key in {"CODING", "INFORMATION_MISSING"} or codes.intersection({"16", "125", "181", "182"}):
        return (
            "CORRECTED_CLAIM",
            "Denial appears tied to claim data, coding, or missing information that should be corrected and resubmitted.",
            ["Original claim", "Corrected diagnosis/procedure linkage", "Updated claim scrub result"],
            ["Corrected claim data"],
        )

    if category_key in {"AUTHORIZATION", "REFERRAL"} or codes.intersection({"197", "198", "288"}):
        return (
            "APPEAL",
            "Denial appears recoverable if authorization, referral, or payer approval evidence exists.",
            ["Authorization/referral record", "Eligibility response", "Payer correspondence"],
            ["Authorization approval proof"],
        )

    if category_key in {"MEDICAL_NECESSITY", "TIMELY_FILING"} or codes.intersection({"50", "96", "29"}):
        if "50" in codes:
            missing_docs.append("Clinical documentation supporting medical necessity")
        if "29" in codes:
            missing_docs.append("Timely filing proof or payer exception documentation")
        return (
            "APPEAL",
            "Denial is typically worked through an appeal when documentation supports payer reconsideration.",
            ["Clinical notes", "Medical necessity rationale", "Payer policy excerpt"],
            missing_docs or ["Supporting documentation"],
        )

    if category_key in {"ELIGIBILITY", "COVERAGE", "COORDINATION_OF_BENEFITS"} or codes.intersection({"22", "27", "31", "109", "200"}):
        return (
            "PATIENT_TRANSFER",
            "Coverage or COB denial may require patient/payer coordination before payer recovery is realistic.",
            ["Eligibility response", "COB details", "Patient insurance update"],
            ["Updated coverage/COB confirmation"],
        )

    return (
        "MANUAL_REVIEW",
        "No confident automated recovery path was identified from the denial category and CARC/RARC signals.",
        ["ERA line details", "Claim", "Payer notes"],
        [],
    )


@router.post("/analyze-ack-rejection", response=RcmAckRejectionAnalysisResponse)
def analyze_ack_rejection(request, payload: RcmAckRejectionAnalysisRequest):
    ensure_rcm_api_authorized(request)
    tracking = payload.claim_tracking or {}
    claim = payload.claim or {}
    reason_codes = _upper_values(tracking.get("rejectionReasonCodes"))
    status_description = normalize_text(tracking.get("statusDescription") or tracking.get("summary")) or ""
    field_path = normalize_text(tracking.get("remediationFieldPath"))
    affected_fields = []
    recommended_actions = []
    correction_type = "MANUAL_REVIEW"
    root_cause = status_description or "Claim acknowledgement rejected by clearinghouse or payer."
    priority = "HIGH"
    confidence = 0.62

    if field_path:
        affected_fields.append(field_path)

    combined_text = " ".join([status_description, " ".join(reason_codes)]).lower()
    if any(token in combined_text for token in ["subscriber", "member", "patient", "insured", "demographic"]):
        correction_type = "DEMOGRAPHIC_OR_SUBSCRIBER_FIX"
        affected_fields.extend(["insurancePolicy.memberId", "patient.demographics"])
        recommended_actions.append("Verify subscriber/member ID, patient demographics, and relationship to subscriber.")
        confidence = 0.78
    elif any(token in combined_text for token in ["diagnosis", "icd", "procedure", "cpt", "modifier", "service line"]):
        correction_type = "CODING_FIX"
        affected_fields.extend(["claim.diagnosisCodes", "claim.claimLines"])
        recommended_actions.append("Correct diagnosis/procedure/modifier linkage and rerun claim readiness.")
        confidence = 0.8
    elif any(token in combined_text for token in ["npi", "provider", "taxonomy", "billing"]):
        correction_type = "PROVIDER_SETUP_FIX"
        affected_fields.extend(["provider.npi", "provider.taxonomyCode", "facility.billingProfile"])
        recommended_actions.append("Correct billing/rendering provider setup before resubmission.")
        confidence = 0.76
    elif any(token in combined_text for token in ["payer", "receiver", "edi"]):
        correction_type = "PAYER_ROUTING_FIX"
        affected_fields.extend(["payer.ediPayerId", "insurancePolicy.ediPayerId"])
        recommended_actions.append("Verify EDI payer ID and clearinghouse routing configuration.")
        confidence = 0.74

    if not recommended_actions:
        recommended_actions.append("Review acknowledgement error details, correct the claim, and resubmit when readiness passes.")

    if claim.get("totalChargeAmount") and _money(claim.get("totalChargeAmount")) >= 500:
        priority = "CRITICAL"

    response_payload = {
        "status": "success",
        "rootCause": root_cause,
        "correctionType": correction_type,
        "affectedFields": dedupe_preserve_order(affected_fields),
        "recommendedActions": dedupe_preserve_order(recommended_actions),
        "correctedClaimRecommended": True,
        "priority": priority,
        "confidence": confidence,
        "source": "agentic-ack-rejection-v1",
    }
    persist_ai_insight("ack_rejection_analysis", payload.model_dump(by_alias=True), response_payload)
    return response_payload


@router.post("/analyze-denial", response=RcmDenialAnalysisResponse)
def analyze_denial(request, payload: RcmDenialAnalysisRequest):
    ensure_rcm_api_authorized(request)
    denial = payload.denial or {}
    claim = payload.claim or {}
    carc_codes = _upper_values(denial.get("carcCodes") or ([denial.get("denialCode")] if denial.get("denialCode") else []))
    rarc_codes = _upper_values(denial.get("rarcCodes"))
    category = normalize_text(denial.get("denialCategory"))
    recommendation, reason, evidence, missing_docs = _recommendation_from_denial_codes(carc_codes, category)
    amount = _money(denial.get("remainingDeniedBalance") or denial.get("denialAmount") or claim.get("totalChargeAmount"))
    confidence = 0.82 if recommendation in {"APPEAL", "CORRECTED_CLAIM"} else 0.58

    policy_notes = []
    if category:
        policy_notes.append(f"Review payer policy for {category.replace('_', ' ').lower()} denials.")
    if carc_codes:
        policy_notes.append(f"CARC signals considered: {', '.join(carc_codes)}.")
    if rarc_codes:
        policy_notes.append(f"RARC signals considered: {', '.join(rarc_codes)}.")

    next_action_map = {
        "APPEAL": "Create or update appeal packet, attach evidence, and submit to payer review.",
        "CORRECTED_CLAIM": "Create corrected claim, rerun readiness, and resubmit through normal claim submission.",
        "PATIENT_TRANSFER": "Verify coverage/COB and transfer only confirmed patient responsibility to billing.",
        "WRITE_OFF": "Route for write-off approval with reason and audit trail.",
        "MANUAL_REVIEW": "Assign denial for manual review before choosing appeal, correction, patient transfer, or write-off.",
    }

    response_payload = {
        "status": "success",
        "rootCause": normalize_text(denial.get("rootCause")) or normalize_text(denial.get("classificationExplanation")) or reason,
        "recommendation": recommendation,
        "recommendationReason": reason,
        "evidenceNeeded": dedupe_preserve_order(evidence),
        "missingDocumentation": dedupe_preserve_order(missing_docs),
        "payerPolicyNotes": dedupe_preserve_order(policy_notes),
        "nextBestAction": next_action_map.get(recommendation, next_action_map["MANUAL_REVIEW"]),
        "confidence": min(0.95, confidence + (0.05 if amount >= 250 else 0)),
        "source": "agentic-denial-analysis-v1",
    }
    persist_ai_insight("denial_analysis", payload.model_dump(by_alias=True), response_payload, {"amount": amount})
    return response_payload


@router.post("/generate-appeal-packet", response=RcmAppealPacketResponse)
def generate_appeal_packet(request, payload: RcmAppealPacketRequest):
    ensure_rcm_api_authorized(request)
    appeal = payload.appeal or {}
    denial = payload.denial or {}
    claim = payload.claim or {}
    payer_name = normalize_text(claim.get("payerName") or denial.get("payerId") or appeal.get("payerId")) or "Payer"
    denial_code = normalize_text(denial.get("denialCode")) or "denial"
    denial_reason = normalize_text(denial.get("denialReason") or denial.get("payerDenialReason")) or "payer denial"
    amount = _money(denial.get("remainingDeniedBalance") or denial.get("denialAmount"))
    category = normalize_text(denial.get("denialCategory")) or "OTHER"
    evidence = ["Original claim", "ERA denial line", "Clinical documentation"]
    if category in {"AUTHORIZATION", "REFERRAL"}:
        evidence.append("Authorization/referral approval evidence")
    if category == "MEDICAL_NECESSITY":
        evidence.extend(["Medical necessity notes", "Provider attestation"])
    if category == "TIMELY_FILING":
        evidence.extend(["Timely filing proof", "Submission acknowledgement history"])

    medical_argument = (
        "The documentation supports the billed service as medically necessary for the patient condition."
        if category == "MEDICAL_NECESSITY"
        else None
    )
    payer_argument = f"Request reconsideration of {denial_code} based on claim, ERA, and attached evidence."
    letter = (
        f"To {payer_name} Appeals Department,\n\n"
        f"We request reconsideration of claim {claim.get('_id') or claim.get('claimId') or ''} for denial {denial_code}. "
        f"The denial reason was: {denial_reason}. "
        f"The disputed amount is {amount:.2f}. "
        f"Please review the enclosed documentation and reprocess the claim according to the member benefits and payer policy.\n\n"
        "This draft is advisory and requires operator review before submission."
    )
    missing_docs = []
    if not claim.get("diagnosisCodes"):
        missing_docs.append("Diagnosis code support")
    if category == "MEDICAL_NECESSITY":
        missing_docs.append("Specific clinical note excerpt supporting medical necessity")

    response_payload = {
        "status": "success",
        "appealLetterDraft": letter,
        "evidenceChecklist": dedupe_preserve_order(evidence),
        "medicalNecessityArgument": medical_argument,
        "payerSpecificArgument": payer_argument,
        "missingDocs": dedupe_preserve_order(missing_docs),
        "overturnProbability": 0.72 if category in {"MEDICAL_NECESSITY", "AUTHORIZATION", "TIMELY_FILING"} else 0.55,
        "confidence": 0.74,
        "source": "agentic-appeal-packet-v1",
    }
    persist_ai_insight("appeal_packet_generation", payload.model_dump(by_alias=True), response_payload)
    return response_payload


@router.post("/explain-era-match-exception", response=RcmEraMatchExceptionResponse)
def explain_era_match_exception(request, payload: RcmEraMatchExceptionRequest):
    ensure_rcm_api_authorized(request)
    exception = payload.era_exception or {}
    claim = payload.claim or {}
    denial = payload.denial or {}
    exception_type = normalize_text(exception.get("exceptionType")) or "ERA exception"
    reasons = []
    actions = []
    if not claim:
        reasons.append("No related claim context was available.")
        actions.append("Search by claim control number, payer claim number, DOS, and patient/member ID.")
    if exception_type in {"SERVICE_LINE_MISMATCH", "POSTING_IMBALANCE"}:
        reasons.append("ERA service line, paid amount, or adjustment balance did not match the expected claim line.")
        actions.append("Validate CPT/CDT, DOS, line charge, paid amount, and adjustment group/reason codes.")
    if exception_type in {"DUPLICATE_ERA", "UNMATCHED_ERA"}:
        reasons.append("ERA may be duplicate or missing stable claim/payment linkage.")
        actions.append("Compare TRN/EFT/check number, payer claim number, and prior import idempotency key.")

    response_payload = {
        "status": "success",
        "explanation": f"{exception_type} requires manual validation before replay or posting.",
        "likelyMatch": {
            "claimId": claim.get("_id") or exception.get("relatedClaim"),
            "denialId": denial.get("_id") or exception.get("relatedDenial"),
        },
        "ambiguityReasons": dedupe_preserve_order(reasons) or ["Insufficient matching confidence for automated posting."],
        "recommendedActions": dedupe_preserve_order(actions) or ["Resolve matching data, then reprocess the ERA exception."],
        "confidence": 0.64 if claim else 0.42,
        "source": "agentic-era-match-exception-v1",
    }
    persist_ai_insight("era_match_exception_explanation", payload.model_dump(by_alias=True), response_payload)
    return response_payload


@router.post("/prioritize-ar-work", response=RcmArPrioritizationResponse)
def prioritize_ar_work(request, payload: RcmArPrioritizationRequest):
    ensure_rcm_api_authorized(request)
    item = payload.ar_work_item or {}
    denial = payload.denial or {}
    appeal = payload.appeal or {}
    amount = _money(item.get("balanceAmount") or item.get("varianceAmount") or denial.get("remainingDeniedBalance") or denial.get("denialAmount"))
    due_days = _days_until(item.get("dueDate") or item.get("followUpDate") or appeal.get("appealDeadline"))
    category = normalize_text(item.get("category") or denial.get("denialCategory")) or "AR"
    priority = "NORMAL"
    sla_risk = "LOW"
    if amount >= 1000 or (due_days is not None and due_days <= 1):
        priority = "CRITICAL"
        sla_risk = "CRITICAL"
    elif amount >= 300 or (due_days is not None and due_days <= 5):
        priority = "HIGH"
        sla_risk = "HIGH"
    elif amount >= 100 or (due_days is not None and due_days <= 14):
        priority = "NORMAL"
        sla_risk = "MEDIUM"

    if "APPEAL" in category.upper():
        queue = "APPEALS"
        next_action = "Follow payer appeal status and update payer review/outcome."
    elif "DENIAL" in category.upper():
        queue = "DENIALS"
        next_action = "Work denial root cause and choose appeal, corrected claim, or patient transfer."
    elif "UNDERPAYMENT" in category.upper():
        queue = "PAYMENT_VARIANCE"
        next_action = "Validate contract expected amount and payer adjustment reason."
    else:
        queue = "AR_FOLLOW_UP"
        next_action = "Contact payer or resolve linked exception."

    response_payload = {
        "status": "success",
        "priority": priority,
        "financialImpact": amount,
        "slaRisk": sla_risk,
        "recommendedOwnerQueue": queue,
        "nextAction": next_action,
        "reason": f"Priority based on ${amount:.2f} financial impact and SLA window {due_days if due_days is not None else 'unknown'} days.",
        "confidence": 0.76,
        "source": "agentic-ar-prioritization-v1",
    }
    persist_ai_insight("ar_prioritization", payload.model_dump(by_alias=True), response_payload)
    return response_payload

@router.post("/predict-auth", response=RcmAuthPredictionResponse)
def predict_auth(request, payload: RcmAuthPredictionRequest):
    ensure_rcm_api_authorized(request)
    logger.info(f"Checking auth requirements for {payload.cpt_code} with payer {payload.payer_id}")

    proc_code = load_procedure_code(payload.cpt_code)
    payer = load_payer_context(payload.payer_id)
    payer_name = normalize_text((payer or {}).get("payerName")) or payload.payer_id
    payer_type = normalize_text_lower((payer or {}).get("payerType"))

    if proc_code and "requiresAuth" in proc_code:
        response_payload = {
            "status": "success",
            "requiresAuth": proc_code.get("requiresAuth", False),
            "confidence": 1.0,
            "ruleSource": "Charge Master / Procedure Code Repository"
        }

        persist_ai_insight(
            "auth_prediction",
            payload.model_dump(by_alias=True),
            response_payload,
            metadata={"payerName": payer_name, "payerType": payer_type},
        )

        return response_payload

    medical_prior_auth_cpts = {
        "70553",
        "73721",
        "27447",
        "29881",
        "64483",
    }
    imaging_prefixes = ("705", "721", "732", "737", "741", "755", "783", "784", "788")
    surgery_prefixes = ("27", "29", "33", "47", "64")

    requires_auth = False
    rule_source = "Medical prior-auth heuristic"
    confidence = 0.72

    if payload.cpt_code in medical_prior_auth_cpts:
        requires_auth = True
        confidence = 0.84
    elif payload.cpt_code.startswith(imaging_prefixes):
        requires_auth = True
        rule_source = "Advanced imaging heuristic"
        confidence = 0.82
    elif payload.cpt_code.startswith(surgery_prefixes) and not payload.cpt_code.startswith("99"):
        requires_auth = True
        rule_source = "Outpatient surgery heuristic"
        confidence = 0.82

    if payer_type in {"medicaid", "managed medicaid"} and payload.cpt_code.startswith(imaging_prefixes):
        requires_auth = True
        rule_source = f"{payer_name} Medicaid imaging rule heuristic"
        confidence = max(confidence, 0.88)

    if payer_type == "workers compensation" and payload.cpt_code.startswith(("27", "29", "64")):
        requires_auth = True
        rule_source = f"{payer_name} workers compensation surgery heuristic"
        confidence = max(confidence, 0.9)

    if payer_type == "medicare" and payload.cpt_code.startswith("G043"):
        requires_auth = False
        rule_source = f"{payer_name} preventive wellness exception heuristic"
        confidence = 0.93

    response_payload = {
        "status": "success",
        "requiresAuth": requires_auth,
        "confidence": confidence if requires_auth else max(confidence, 0.72),
        "ruleSource": rule_source
    }

    persist_ai_insight(
        "auth_prediction",
        payload.model_dump(by_alias=True),
        response_payload,
        metadata={"payerName": payer_name, "payerType": payer_type},
    )

    return response_payload

@router.post("/validate-dependent-subscriber", response=RcmDependentValidationResponse)
def validate_dependent_subscriber(request, payload: RcmDependentValidationRequest):
    ensure_rcm_api_authorized(request)
    patient = payload.patient or {}
    policy = payload.insurance_policy or {}
    subscriber = policy.get("subscriber") or {}
    card = policy.get("card") or {}
    relationship = normalize_text_lower(policy.get("relationshipToSubscriber")) or "unknown"
    issues: List[str] = []
    fixes: List[str] = []
    risk = 0.05

    patient_first = normalize_text_lower(patient.get("firstName"))
    patient_last = normalize_text_lower(patient.get("lastName"))
    subscriber_first = normalize_text_lower(subscriber.get("firstName"))
    subscriber_last = normalize_text_lower(subscriber.get("lastName"))
    patient_dob = parse_datetime(patient.get("dateOfBirth"))
    subscriber_dob = parse_datetime(subscriber.get("dob"))
    has_card = bool(normalize_text(card.get("frontImageUrl")) or normalize_text(card.get("backImageUrl")))

    if relationship == "self":
        if subscriber_first and patient_first and subscriber_first != patient_first:
            risk += 0.25
            issues.append("Subscriber first name does not match patient for self coverage")
            fixes.append("Correct subscriber name or change relationship to subscriber")
        if subscriber_last and patient_last and subscriber_last != patient_last:
            risk += 0.25
            issues.append("Subscriber last name does not match patient for self coverage")
            fixes.append("Correct subscriber name or change relationship to subscriber")
        if subscriber_dob and patient_dob and subscriber_dob.date() != patient_dob.date():
            risk += 0.3
            issues.append("Subscriber DOB does not match patient DOB for self coverage")
            fixes.append("Correct subscriber DOB before eligibility or claim submission")
    elif relationship in {"spouse", "child", "other", "unknown"}:
        if not subscriber_first or not subscriber_last or not subscriber_dob:
            risk += 0.35
            issues.append("Dependent policy is missing subscriber name or DOB")
            fixes.append("Capture subscriber demographics from card or payer portal")
        if relationship == "child" and not normalize_text(policy.get("dependentNumber")):
            risk += 0.12
            issues.append("Child dependent policy has no dependent number")
            fixes.append("Confirm dependent sequence on card, eligibility response, or payer portal")

    if has_card and not normalize_text(policy.get("memberId")):
        risk += 0.3
        issues.append("Insurance card image exists but member ID is blank")
        fixes.append("Enter member ID from the uploaded card")

    if has_card and not normalize_text(policy.get("subscriberId")) and relationship != "self":
        risk += 0.1
        issues.append("Card is uploaded but subscriber ID is blank for dependent coverage")
        fixes.append("Capture subscriber ID from card or payer portal")

    return {
        "status": "success",
        "riskScore": min(risk, 1.0),
        "issues": dedupe_preserve_order(issues),
        "suggestedFixes": dedupe_preserve_order(fixes),
        "source": "agentic-dependent-subscriber-rules-v1",
    }
