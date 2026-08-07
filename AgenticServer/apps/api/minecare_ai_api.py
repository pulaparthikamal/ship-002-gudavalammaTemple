import json
import logging
import re
import subprocess
import tempfile
from io import BytesIO
from pathlib import Path
from typing import Any, Dict, List

import pdfplumber
import requests
from django.conf import settings
from ninja import Body, File, Router
from ninja.errors import HttpError
from ninja.files import UploadedFile
from PIL import Image

try:
    import pypdfium2 as pdfium
except ImportError:  # pragma: no cover - optional OCR fallback
    pdfium = None

logger = logging.getLogger("apps.api.minecare")
router = Router(tags=["MineCare AI"])

MAX_TEXT_CHARS = 24000
MAX_PREVIEW_CHARS = 2500


def ensure_minecare_api_authorized(request):
    expected_key = getattr(settings, "AGENTIC_SERVER_API_KEY", None)
    if not expected_key and not getattr(settings, "DEBUG", False):
        raise HttpError(503, "MineCare AI API key is not configured.")

    if expected_key and request.headers.get("x-agentic-api-key") != expected_key:
        raise HttpError(401, "Unauthorized")


def normalize_text(value: Any) -> str:
    return value.strip() if isinstance(value, str) and value.strip() else ""


def normalize_number(value: Any, fallback: float = 0) -> float:
    if isinstance(value, bool):
        return fallback
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        cleaned = re.sub(r"[^0-9.\-]", "", value)
        try:
            return float(cleaned)
        except ValueError:
            return fallback
    return fallback


def normalize_confidence(value: Any) -> float:
    normalized = normalize_number(value, 0)
    if normalized > 1 and normalized <= 100:
        normalized = normalized / 100
    return max(0, min(1, normalized))


def normalize_string_list(value: Any) -> List[str]:
    if isinstance(value, list):
        return [normalize_text(item) for item in value if normalize_text(item)]
    if isinstance(value, str):
        return [item.strip() for item in value.split(",") if item.strip()]
    return []


def strip_markdown_json(raw_text: str) -> str:
    text = re.sub(r"<think>[\s\S]*?</think>", "", raw_text, flags=re.IGNORECASE).strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```$", "", text)
    return text.strip()


def extract_json_object(raw_text: str) -> Dict[str, Any]:
    text = strip_markdown_json(raw_text)
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{[\s\S]*\}", text)
        if not match:
            raise
        parsed = json.loads(match.group(0))

    if not isinstance(parsed, dict):
        raise ValueError("AI response must be a JSON object.")
    return parsed


def run_tesseract_for_image(image: Image.Image) -> str:
    with tempfile.NamedTemporaryFile(suffix=".png", delete=True) as tmp_file:
        image.convert("RGB").save(tmp_file.name, format="PNG")
        try:
            result = subprocess.run(
                ["tesseract", tmp_file.name, "stdout"],
                capture_output=True,
                check=False,
                text=True,
                timeout=90,
            )
        except FileNotFoundError as exc:
            raise ValueError("Tesseract OCR is not installed or not available on PATH.") from exc
        if result.returncode != 0:
            raise ValueError(result.stderr.strip() or "Tesseract OCR failed.")
        return result.stdout.strip()


def extract_pdf_text(file_bytes: bytes) -> str:
    text_blocks: List[str] = []

    with pdfplumber.open(BytesIO(file_bytes)) as pdf:
        for page in pdf.pages[:10]:
            page_text = page.extract_text() or ""
            if page_text.strip():
                text_blocks.append(page_text.strip())

    text = "\n\n".join(text_blocks).strip()
    if text or pdfium is None:
        return text

    ocr_blocks: List[str] = []
    pdf_doc = pdfium.PdfDocument(file_bytes)
    for index in range(min(len(pdf_doc), 6)):
        page = pdf_doc[index]
        bitmap = page.render(scale=2).to_pil()
        page_text = run_tesseract_for_image(bitmap)
        if page_text:
            ocr_blocks.append(page_text)
    return "\n\n".join(ocr_blocks).strip()


def extract_image_text(file_bytes: bytes) -> str:
    image = Image.open(BytesIO(file_bytes))
    return run_tesseract_for_image(image)


def extract_document_text(document: UploadedFile) -> Dict[str, str]:
    file_name = Path(document.name or "document").name
    content_type = document.content_type or ""
    file_bytes = document.read()
    suffix = Path(file_name).suffix.lower()

    try:
        if suffix == ".pdf" or content_type == "application/pdf":
            text = extract_pdf_text(file_bytes)
        elif content_type.startswith("image/") or suffix in {".png", ".jpg", ".jpeg", ".webp", ".tif", ".tiff"}:
            text = extract_image_text(file_bytes)
        elif suffix in {".txt", ".csv"} or content_type.startswith("text/"):
            text = file_bytes.decode("utf-8", errors="ignore").strip()
        else:
            raise ValueError(f"Unsupported document type for {file_name}. Upload PDF, image, or text files.")
    except subprocess.TimeoutExpired as exc:
        raise ValueError(f"OCR timed out for {file_name}.") from exc

    if not text:
        raise ValueError(f"No readable text was extracted from {file_name}.")

    return {"fileName": file_name, "text": text[:MAX_TEXT_CHARS]}


def build_extraction_prompt(documents: List[Dict[str, str]]) -> str:
    document_text = "\n\n---\n\n".join(
        f"Document: {item['fileName']}\n{item['text']}" for item in documents
    )
    return "\n".join([
        "You are MineCare AI, a mining equipment document extraction specialist.",
        "Extract equipment onboarding data from invoices, purchase orders, warranty cards, manuals, and service documents.",
        "Use only the provided document text. Do not invent values. Leave unavailable string fields empty, numeric fields as 0, and arrays empty.",
        "Infer service schedules only when service interval, service name, or parts are present in the document text.",
        "Return only strict JSON with this exact shape:",
        '{"equipment":{"equipmentId":"","name":"","type":"","brand":"","model":"","serialNumber":"","location":"","department":"","purchaseDate":"","invoiceValue":0,"vendor":"","currentRunningHours":0,"averageDailyUsage":8,"status":"Active","criticality":"High"},"warranty":{"startDate":"","endDate":"","hourLimit":0,"coveredComponents":[],"terms":""},"serviceSchedules":[{"equipmentType":"","serviceName":"","intervalHours":0,"requiredParts":[],"estimatedCost":0}],"aiExtractionSummary":"","onboardingSummary":"","warrantyInsight":"","recommendedFirstService":"","suggestedSpareKit":[],"suggestedCriticality":"Medium","extractedFieldsCount":0,"fieldConfidenceMap":{},"confidence":0,"missingFields":[],"sourceDocuments":[],"rawExtractedTextPreview":""}',
        "",
        "Document text:",
        document_text[:MAX_TEXT_CHARS],
    ])


def run_ollama_json_prompt(prompt: str, system_content: str = "Return strict JSON for MineCare equipment document extraction.") -> Dict[str, Any]:
    if getattr(settings, "LLM_PROVIDER", "ollama") != "ollama":
        raise ValueError("MineCare document extraction currently requires the Ollama LLM provider.")

    base_url = str(getattr(settings, "OLLAMA_BASE_URL", "http://127.0.0.1:11434")).rstrip("/")
    model = str(getattr(settings, "OLLAMA_MODEL", "") or getattr(settings, "LLM_MODEL", "") or "gpt-oss:120b-cloud").strip()
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
                {"role": "system", "content": system_content},
                {"role": "user", "content": prompt},
            ],
        },
        timeout=int(getattr(settings, "OLLAMA_TIMEOUT", 180)),
    )
    response.raise_for_status()
    payload = response.json()
    message = payload.get("message") if isinstance(payload, dict) else None
    content = message.get("content") if isinstance(message, dict) else payload.get("response")
    if not normalize_text(content):
        raise ValueError("Ollama response did not include JSON content.")
    return extract_json_object(str(content))


def build_copilot_prompt(question: str, context: Dict[str, Any]) -> str:
    return "\n".join([
        "You are MineCare AI, a mining maintenance copilot.",
        "Answer using only the provided MineCare context. Be specific about equipment IDs, asset names, service timing, warranty exposure, spare shortages, budget exposure, and recommended actions when relevant.",
        "If the question is about a specific asset, focus on that asset. If the answer is not supported by the context, say what is missing.",
        "Return only strict JSON with this exact shape:",
        '{"answer":"","recommendedActions":[{"id":"","priority":"High","status":"Open","equipment":"","equipmentName":"","action":"","source":"AI Copilot"}],"referencedAssets":[],"confidence":0}',
        "",
        f"Question: {question}",
        f"MineCare context: {json.dumps(context, default=str)[:MAX_TEXT_CHARS]}",
    ])


def normalize_copilot_response(value: Dict[str, Any]) -> Dict[str, Any]:
    payload = value if isinstance(value, dict) else {}
    answer = normalize_text(payload.get("answer"))
    recommended_actions = []
    raw_actions = payload.get("recommendedActions")
    if isinstance(raw_actions, list):
        for index, item in enumerate(raw_actions):
            if not isinstance(item, dict):
                continue
            action = normalize_text(item.get("action"))
            if not action:
                continue
            recommended_actions.append({
                "id": normalize_text(item.get("id")) or f"copilot-action-{index + 1}",
                "priority": normalize_text(item.get("priority")) or "Medium",
                "status": normalize_text(item.get("status")) or "Open",
                "equipment": normalize_text(item.get("equipment")),
                "equipmentName": normalize_text(item.get("equipmentName")),
                "action": action,
                "source": normalize_text(item.get("source")) or "AI Copilot",
            })
    referenced_assets = payload.get("referencedAssets")

    return {
        "answer": answer or "MineCare AI could not produce a supported answer from the provided context.",
        "recommendedActions": recommended_actions,
        "referencedAssets": normalize_string_list(referenced_assets),
        "confidence": normalize_confidence(payload.get("confidence")),
    }


def build_json_prompt(task: str, shape: str, payload: Dict[str, Any]) -> str:
    return "\n".join([
        "You are MineCare AI for mining equipment maintenance.",
        task,
        "Use only the supplied payload and context. Do not invent unsupported asset IDs or dates.",
        "Return only strict JSON with this exact shape:",
        shape,
        "",
        f"Payload: {json.dumps(payload, default=str)[:MAX_TEXT_CHARS]}",
    ])


def build_insight_enrichment_prompt(feature: str, fallback: Any, context: Any, task: str) -> str:
    return "\n".join([
        "You are MineCare AI for mining equipment maintenance.",
        "Enhance the supplied MineCare output with AI-generated operational insight.",
        "Keep all asset IDs, record IDs, statuses, dates, and factual numeric business values from the fallback unless the field is explicitly an AI score, AI confidence, or AI probability.",
        "Use only the provided fallback and context. Do not invent assets, records, dates, vendors, or costs.",
        "Return only strict JSON with this exact shape:",
        '{"result": <same JSON shape as fallback>}',
        "",
        f"Feature: {feature}",
        f"Task: {task or 'Rewrite only AI narrative, recommendation, reasoning, priority, risk, plan, action, confidence, and probability fields.'}",
        f"Fallback JSON: {json.dumps(fallback, default=str)[:MAX_TEXT_CHARS]}",
        f"MineCare context: {json.dumps(context, default=str)[:MAX_TEXT_CHARS]}",
    ])


def normalize_phase2_payload(value: Dict[str, Any], defaults: Dict[str, Any]) -> Dict[str, Any]:
    payload = value if isinstance(value, dict) else {}
    normalized = dict(defaults)
    for key, default_value in defaults.items():
      if isinstance(default_value, list):
          normalized[key] = normalize_string_list(payload.get(key)) or default_value
      elif isinstance(default_value, (int, float)):
          normalized[key] = normalize_number(payload.get(key), default_value)
      else:
          normalized[key] = normalize_text(payload.get(key)) or default_value
    if "confidence" in normalized:
        normalized["confidence"] = normalize_confidence(payload.get("confidence"))
    return normalized


def normalize_extraction_response(value: Dict[str, Any], documents: List[Dict[str, str]]) -> Dict[str, Any]:
    payload = value if isinstance(value, dict) else {}
    equipment = payload.get("equipment") if isinstance(payload.get("equipment"), dict) else {}
    warranty = payload.get("warranty") if isinstance(payload.get("warranty"), dict) else {}
    service_schedules = payload.get("serviceSchedules") if isinstance(payload.get("serviceSchedules"), list) else []

    normalized_equipment = {
        "equipmentId": normalize_text(equipment.get("equipmentId")),
        "name": normalize_text(equipment.get("name")),
        "type": normalize_text(equipment.get("type")),
        "brand": normalize_text(equipment.get("brand")),
        "model": normalize_text(equipment.get("model")),
        "serialNumber": normalize_text(equipment.get("serialNumber")),
        "location": normalize_text(equipment.get("location")),
        "department": normalize_text(equipment.get("department")),
        "purchaseDate": normalize_text(equipment.get("purchaseDate")),
        "invoiceValue": normalize_number(equipment.get("invoiceValue"), 0),
        "vendor": normalize_text(equipment.get("vendor")),
        "currentRunningHours": normalize_number(equipment.get("currentRunningHours"), 0),
        "averageDailyUsage": normalize_number(equipment.get("averageDailyUsage"), 8),
        "status": normalize_text(equipment.get("status")) or "Active",
        "criticality": normalize_text(equipment.get("criticality")) or "Medium",
    }

    normalized_warranty = {
        "startDate": normalize_text(warranty.get("startDate")),
        "endDate": normalize_text(warranty.get("endDate")),
        "hourLimit": normalize_number(warranty.get("hourLimit"), 0),
        "coveredComponents": normalize_string_list(warranty.get("coveredComponents")),
        "terms": normalize_text(warranty.get("terms")),
    }

    normalized_schedules = []
    for schedule in service_schedules:
        if not isinstance(schedule, dict):
            continue
        normalized_schedules.append({
            "equipmentType": normalize_text(schedule.get("equipmentType")),
            "serviceName": normalize_text(schedule.get("serviceName")),
            "intervalHours": normalize_number(schedule.get("intervalHours"), 0),
            "requiredParts": normalize_string_list(schedule.get("requiredParts")),
            "estimatedCost": normalize_number(schedule.get("estimatedCost"), 0),
        })

    source_documents = normalize_string_list(payload.get("sourceDocuments")) or [item["fileName"] for item in documents]
    raw_preview = normalize_text(payload.get("rawExtractedTextPreview"))
    if not raw_preview:
        raw_preview = "\n\n---\n\n".join(item["text"] for item in documents)[:MAX_PREVIEW_CHARS]

    return {
        "equipment": normalized_equipment,
        "warranty": normalized_warranty,
        "serviceSchedules": normalized_schedules,
        "aiExtractionSummary": normalize_text(payload.get("aiExtractionSummary")),
        "onboardingSummary": normalize_text(payload.get("onboardingSummary")),
        "warrantyInsight": normalize_text(payload.get("warrantyInsight")),
        "recommendedFirstService": normalize_text(payload.get("recommendedFirstService")),
        "suggestedSpareKit": normalize_string_list(payload.get("suggestedSpareKit")),
        "suggestedCriticality": normalize_text(payload.get("suggestedCriticality")),
        "extractedFieldsCount": normalize_number(payload.get("extractedFieldsCount"), 0),
        "fieldConfidenceMap": payload.get("fieldConfidenceMap") if isinstance(payload.get("fieldConfidenceMap"), dict) else {},
        "confidence": normalize_confidence(payload.get("confidence")),
        "missingFields": normalize_string_list(payload.get("missingFields")),
        "sourceDocuments": source_documents,
        "rawExtractedTextPreview": raw_preview[:MAX_PREVIEW_CHARS],
    }


@router.post("/extract-equipment-documents")
def extract_equipment_documents(request, documents: List[UploadedFile] = File(...)):
    ensure_minecare_api_authorized(request)

    if not documents:
        raise HttpError(400, "At least one document is required.")

    try:
        extracted_documents = [extract_document_text(document) for document in documents]
    except ValueError as exc:
        logger.warning("MineCare OCR failed: %s", exc)
        raise HttpError(400, str(exc)) from exc
    except Exception as exc:
        logger.error("MineCare OCR failed: %s", exc, exc_info=True)
        raise HttpError(502, f"MineCare OCR failed: {exc}") from exc

    try:
        ai_payload = run_ollama_json_prompt(build_extraction_prompt(extracted_documents))
        return normalize_extraction_response(ai_payload, extracted_documents)
    except requests.RequestException as exc:
        logger.error("MineCare Ollama request failed: %s", exc, exc_info=True)
        raise HttpError(502, "MineCare AI extraction service is unavailable.") from exc
    except json.JSONDecodeError as exc:
        logger.error("MineCare AI returned invalid extraction JSON: %s", exc, exc_info=True)
        raise HttpError(502, "MineCare AI returned invalid extraction JSON.") from exc
    except Exception as exc:
        logger.error("MineCare AI extraction failed: %s", exc, exc_info=True)
        raise HttpError(502, f"MineCare AI extraction failed: {exc}") from exc


@router.post("/copilot")
def minecare_copilot(request, payload: Dict[str, Any] = Body(...)):
    ensure_minecare_api_authorized(request)

    question = normalize_text(payload.get("question"))
    context = payload.get("context") if isinstance(payload.get("context"), dict) else {}

    if not question:
        raise HttpError(400, "question is required.")

    try:
        ai_payload = run_ollama_json_prompt(
            build_copilot_prompt(question, context),
            "Return strict JSON for MineCare AI copilot answers.",
        )
        return normalize_copilot_response(ai_payload)
    except requests.RequestException as exc:
        logger.error("MineCare Copilot Ollama request failed: %s", exc, exc_info=True)
        raise HttpError(502, "MineCare Copilot AI service is unavailable.") from exc
    except json.JSONDecodeError as exc:
        logger.error("MineCare Copilot returned invalid JSON: %s", exc, exc_info=True)
        raise HttpError(502, "MineCare Copilot returned invalid AI JSON.") from exc
    except Exception as exc:
        logger.error("MineCare Copilot failed: %s", exc, exc_info=True)
        raise HttpError(502, f"MineCare Copilot failed: {exc}") from exc


@router.post("/insights/enrich")
def minecare_insights_enrich(request, payload: Dict[str, Any] = Body(...)):
    ensure_minecare_api_authorized(request)

    feature = normalize_text(payload.get("feature")) or "minecare-insight"
    fallback = payload.get("fallback")
    context = payload.get("context") if isinstance(payload.get("context"), (dict, list)) else {}
    task = normalize_text(payload.get("task"))

    if fallback is None:
        raise HttpError(400, "fallback is required.")

    try:
        ai_payload = run_ollama_json_prompt(
            build_insight_enrichment_prompt(feature, fallback, context, task),
            "Return strict JSON for MineCare AI insight enrichment.",
        )
        return ai_payload.get("result") if "result" in ai_payload else ai_payload
    except Exception as exc:
        logger.error("MineCare insight enrichment failed: %s", exc, exc_info=True)
        raise HttpError(502, f"MineCare insight enrichment failed: {exc}") from exc


@router.post("/root-cause/analyze")
def minecare_root_cause_analyze(request, payload: Dict[str, Any] = Body(...)):
    ensure_minecare_api_authorized(request)
    defaults = {
        "equipmentId": normalize_text(payload.get("equipmentId")),
        "equipmentName": normalize_text(payload.get("equipmentName")),
        "failureType": normalize_text(payload.get("failureType")) or "Equipment Failure",
        "component": normalize_text(payload.get("component")),
        "problem": normalize_text(payload.get("problem")),
        "likelyRootCauses": [],
        "evidence": [],
        "recommendedActions": [],
        "preventiveControls": [],
        "evidenceSummary": "",
        "confidence": 0.0,
    }
    prompt = build_json_prompt(
        "Analyze the likely root cause for the reported equipment failure and recommend concrete maintenance actions.",
        '{"equipmentId":"","equipmentName":"","failureType":"","component":"","problem":"","likelyRootCauses":[],"causeConfidence":[{"cause":"","confidence":0}],"evidence":[],"evidenceSummary":"","recommendedActions":[],"preventiveControls":[],"confidence":0}',
        payload,
    )
    try:
        ai_payload = run_ollama_json_prompt(prompt, "Return strict JSON for MineCare root cause analysis.")
        normalized = normalize_phase2_payload(ai_payload, defaults)
        normalized["causeConfidence"] = ai_payload.get("causeConfidence") if isinstance(ai_payload.get("causeConfidence"), list) else []
        return normalized
    except Exception as exc:
        logger.error("MineCare root cause analysis failed: %s", exc, exc_info=True)
        raise HttpError(502, f"MineCare root cause analysis failed: {exc}") from exc


@router.post("/checklists/generate")
def minecare_checklist_generate(request, payload: Dict[str, Any] = Body(...)):
    ensure_minecare_api_authorized(request)
    defaults = {
        "equipmentId": normalize_text(payload.get("equipmentId")),
        "equipmentName": normalize_text(payload.get("equipmentName")),
        "serviceType": normalize_text(payload.get("serviceType")) or "Preventive Maintenance",
        "checklistTitle": normalize_text(payload.get("checklistTitle")) or "Maintenance Checklist",
        "safetyPrecautions": [],
        "requiredTools": [],
        "requiredParts": normalize_string_list(payload.get("requiredParts")),
        "skillRequirement": "",
        "qualityGate": "",
        "aiPreparationNotes": [],
        "confidence": 0.0,
    }
    prompt = build_json_prompt(
        "Generate a safe, ordered maintenance checklist for the equipment and service type. Include items with itemId, step, task, safetyNote, requiredPart, estimatedTimeMinutes, and completed=false.",
        '{"equipmentId":"","equipmentName":"","serviceType":"","checklistTitle":"","items":[{"itemId":"","step":1,"task":"","safetyNote":"","requiredPart":"","estimatedTimeMinutes":0,"completed":false}],"safetyPrecautions":[],"requiredTools":[],"requiredParts":[],"skillRequirement":"","qualityGate":"","aiPreparationNotes":[],"confidence":0}',
        payload,
    )
    try:
        ai_payload = run_ollama_json_prompt(prompt, "Return strict JSON for MineCare maintenance checklists.")
        normalized = normalize_phase2_payload(ai_payload, defaults)
        normalized["items"] = ai_payload.get("items") if isinstance(ai_payload.get("items"), list) else []
        return normalized
    except Exception as exc:
        logger.error("MineCare checklist generation failed: %s", exc, exc_info=True)
        raise HttpError(502, f"MineCare checklist generation failed: {exc}") from exc


@router.post("/knowledge/ingest")
def minecare_knowledge_ingest(request, documents: List[UploadedFile] = File(...)):
    ensure_minecare_api_authorized(request)
    if not documents:
        raise HttpError(400, "At least one document is required.")
    try:
        extracted_documents = [extract_document_text(document) for document in documents]
        combined_text = "\n\n---\n\n".join(item["text"] for item in extracted_documents)
        return {
            "documents": [{"fileName": item["fileName"], "textPreview": item["text"][:MAX_PREVIEW_CHARS]} for item in extracted_documents],
            "text": combined_text[:MAX_TEXT_CHARS],
            "chunkCount": max(1, int(len(combined_text) / 1000) + 1) if combined_text else 0,
        }
    except ValueError as exc:
        logger.warning("MineCare knowledge ingest failed: %s", exc)
        raise HttpError(400, str(exc)) from exc
    except Exception as exc:
        logger.error("MineCare knowledge ingest failed: %s", exc, exc_info=True)
        raise HttpError(502, f"MineCare knowledge ingest failed: {exc}") from exc


@router.post("/knowledge/ask")
def minecare_knowledge_ask(request, payload: Dict[str, Any] = Body(...)):
    ensure_minecare_api_authorized(request)
    question = normalize_text(payload.get("question"))
    if not question:
        raise HttpError(400, "question is required.")
    prompt = build_json_prompt(
        "Answer the MineCare maintenance knowledge question using only the supplied chunks. Include source citations with documentId, documentName, pageNumber if known, section, snippet, and confidence. Include recommendedActions.",
        '{"answer":"","sources":[{"documentId":"","documentName":"","pageNumber":0,"section":"","snippet":"","confidence":0}],"citations":[{"documentId":"","documentName":"","section":"","snippet":"","confidence":0}],"recommendedActions":[],"confidence":0}',
        payload,
    )
    try:
        ai_payload = run_ollama_json_prompt(prompt, "Return strict JSON for MineCare knowledge assistant answers.")
        citations = ai_payload.get("citations") if isinstance(ai_payload.get("citations"), list) else []
        sources = ai_payload.get("sources") if isinstance(ai_payload.get("sources"), list) else citations
        return {
            "answer": normalize_text(ai_payload.get("answer")) or "No supported answer was found in the supplied MineCare knowledge chunks.",
            "sources": sources,
            "citations": citations,
            "recommendedActions": normalize_string_list(ai_payload.get("recommendedActions")),
            "confidence": normalize_confidence(ai_payload.get("confidence")),
        }
    except Exception as exc:
        logger.error("MineCare knowledge assistant failed: %s", exc, exc_info=True)
        raise HttpError(502, f"MineCare knowledge assistant failed: {exc}") from exc


@router.post("/repair-replace/analyze")
def minecare_repair_replace_analyze(request, payload: Dict[str, Any] = Body(...)):
    ensure_minecare_api_authorized(request)
    defaults = {
        "equipmentId": normalize_text(payload.get("equipmentId")),
        "equipmentName": normalize_text(payload.get("equipmentName")),
        "recommendation": "Review",
        "reason": "",
        "repairCostRatio": 0.0,
        "estimatedReplacementYear": 0.0,
        "recommendedActions": [],
        "decisionFactors": [],
        "paybackEstimate": "",
        "confidence": 0.0,
    }
    prompt = build_json_prompt(
        "Compare repair versus replacement for the asset using cost, downtime, health, and breakdown context. Return financialImpact with repairOptionCost, replacementOptionCost, downtimeRisk, and projectedSavings.",
        '{"equipmentId":"","equipmentName":"","recommendation":"Repair","reason":"","repairCostRatio":0,"estimatedReplacementYear":2026,"financialImpact":{"repairOptionCost":0,"replacementOptionCost":0,"downtimeRisk":0,"projectedSavings":0},"decisionFactors":[],"paybackEstimate":"","recommendedActions":[],"confidence":0}',
        payload,
    )
    try:
        ai_payload = run_ollama_json_prompt(prompt, "Return strict JSON for MineCare repair replace analysis.")
        normalized = normalize_phase2_payload(ai_payload, defaults)
        normalized["financialImpact"] = ai_payload.get("financialImpact") if isinstance(ai_payload.get("financialImpact"), dict) else {}
        return normalized
    except Exception as exc:
        logger.error("MineCare repair replace analysis failed: %s", exc, exc_info=True)
        raise HttpError(502, f"MineCare repair replace analysis failed: {exc}") from exc


@router.post("/procurement-options/compare")
def minecare_procurement_compare(request, payload: Dict[str, Any] = Body(...)):
    ensure_minecare_api_authorized(request)
    prompt = build_json_prompt(
        "Compare procurement options for mining equipment. Consider purchase cost, warranty, maintenance, fuel, expected life, resale value, and downtime risk. Choose the best option.",
        '{"bestOption":"","reason":"","comparison":[{"optionId":"","name":"","fiveYearTco":0}],"vendorRiskSummary":"","negotiationPoints":[],"decisionFactors":[],"recommendedActions":[],"confidence":0}',
        payload,
    )
    try:
        ai_payload = run_ollama_json_prompt(prompt, "Return strict JSON for MineCare procurement comparison.")
        return {
            "bestOption": normalize_text(ai_payload.get("bestOption")),
            "reason": normalize_text(ai_payload.get("reason")),
            "comparison": ai_payload.get("comparison") if isinstance(ai_payload.get("comparison"), list) else [],
            "vendorRiskSummary": normalize_text(ai_payload.get("vendorRiskSummary")),
            "negotiationPoints": normalize_string_list(ai_payload.get("negotiationPoints")),
            "decisionFactors": normalize_string_list(ai_payload.get("decisionFactors")),
            "recommendedActions": normalize_string_list(ai_payload.get("recommendedActions")),
            "confidence": normalize_confidence(ai_payload.get("confidence")),
        }
    except Exception as exc:
        logger.error("MineCare procurement comparison failed: %s", exc, exc_info=True)
        raise HttpError(502, f"MineCare procurement comparison failed: {exc}") from exc
