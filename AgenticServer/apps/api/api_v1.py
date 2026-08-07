import logging
import json
from ninja import NinjaAPI, Schema
from typing import List, Optional, Dict, Any
from uuid import uuid4
from datetime import datetime, timezone
from django.conf import settings
from agents.crewai.crew_service import ContentCrewService
from agents.crewai.repository import TopicRepository, ResolvedTopic
from agents.crewai.research import ResearchCollector
from agents.crewai.creator_research import finalize_additional_information
from agents.crewai.openai_web_search_news import generate_social_news_with_web_search
from .schemas import (
    ContentGenerationRequest,
    ContentGenerationResponse,
    HealthResponse,
    MaintenanceDecision,
    MaintenanceDecisionRequest,
    MaintenanceDecisionResponse,
    RemediationPlan,
    RemediationPlanRequest,
    RemediationPlanResponse,
)
from agents.crewai.crews.server_maintenance_crew import ServerMaintenanceCrew
from agents.crewai.crews.remediation_planner_crew import RemediationPlannerCrew

from .minecare_ai_api import router as minecare_ai_router
from .rcm_api import router as rcm_router
from .deployment_api import router as deployment_router

logger = logging.getLogger("apps.api")
api = NinjaAPI(title="Agentic Server API", version="1.0.0")
api.add_router("/minecare-ai", minecare_ai_router)
api.add_router("/rcm", rcm_router)
api.add_router("/deployment", deployment_router)

# Load logic using Django settings
repository = TopicRepository(settings)
research_collector = ResearchCollector(settings)
crew_service = ContentCrewService()

@api.get("/health", response=HealthResponse)
def health_check(request):
    llm_base_url = (
        settings.OPENAI_BASE_URL
        if settings.LLM_PROVIDER == "openai"
        else settings.OLLAMA_BASE_URL
    )
    llm_model = settings.LLM_MODEL or (
        "gpt-4o-mini" if settings.LLM_PROVIDER == "openai" else settings.OLLAMA_MODEL
    )
    
    health_response = {
        "status": "ok",
        "service": "agentic-server-django",
        "llm_provider": settings.LLM_PROVIDER,
        "ollama_reachable": research_collector.check_ollama() if settings.LLM_PROVIDER == "ollama" else True,
        "llm_model": llm_model,
        "llm_base_url": llm_base_url,
        "mongo_configured": repository.enabled,
    }
    
    logger.debug(f"Health check passed - LLM: {settings.LLM_PROVIDER}, Model: {llm_model}")
    return health_response

import time
from .models import GenerationHistory

@api.post("/content/generate", response=ContentGenerationResponse)
def generate_content(request, payload: ContentGenerationRequest):
    request_id = str(uuid4())
    start_time = time.time()
    logger.info(f"[{request_id}] Received generation request: topic='{payload.topic}', crew='{payload.crew_type}'")
    
    resolved_topic = _resolve_topic(payload)
    logger.info(f"[{request_id}] Resolved topic to: {resolved_topic.topic}")

    web_search_news_config = (
        payload.metadata.get("openaiWebSearchNews", {})
        if isinstance(payload.metadata, dict)
        else {}
    )
    if web_search_news_config.get("enabled"):
        try:
            news_result = generate_social_news_with_web_search(
                topic=resolved_topic.topic,
                audience=payload.audience,
                tone=payload.tone,
                metadata=payload.metadata,
            )
        except Exception as exc:
            error_msg = str(exc)
            logger.error(f"[{request_id}] OpenAI web-search news generation failed: {exc}", exc_info=True)
            try:
                GenerationHistory.objects.create(
                    request_id=request_id,
                    topic=resolved_topic.topic,
                    crew_type=payload.crew_type,
                    status="failed",
                    error_message=error_msg,
                    llm_provider="openai",
                    llm_model=settings.OPENAI_WEB_SEARCH_MODEL or "gpt-5.5",
                )
            except Exception as db_exc:
                logger.warning(f"[{request_id}] Failed to save failure history to DB: {db_exc}")
            return api.create_response(request, {"detail": f"OpenAI web-search news generation failed: {exc}"}, status=502)

        execution_time = time.time() - start_time
        try:
            GenerationHistory.objects.create(
                request_id=request_id,
                topic=resolved_topic.topic,
                crew_type=payload.crew_type,
                title=news_result.title,
                summary=news_result.summary,
                content=news_result.content,
                status="success",
                llm_provider="openai",
                llm_model=settings.OPENAI_WEB_SEARCH_MODEL or "gpt-5.5",
                execution_time_seconds=round(execution_time, 2),
            )
        except Exception as db_exc:
            logger.warning(f"[{request_id}] Failed to save success history to DB: {db_exc}")

        return {
            "status": "success",
            "message": "Content generated successfully",
            "request_id": request_id,
            "topic": resolved_topic.topic,
            "title": news_result.title,
            "summary": news_result.summary,
            "content": news_result.content,
            "final_content": news_result.content,
            "hashtags": news_result.hashtags,
            "keywords": news_result.keywords,
            "source_urls": news_result.source_urls,
            "source_count": len(news_result.source_urls),
            "instagram_image": None,
            "instagram_images": [],
            "instagram_html": None,
            "instagram_slides": [],
            "platform_specific_content": news_result.platform_specific_content,
            "additional_information": news_result.additional_information,
            "generation_brief": news_result.generation_brief,
            "master_article": news_result.master_article,
            "image_prompt": None,
            "output_collection_id": None,
            "debug": None,
        }
    
    research_bundle = research_collector.build_bundle(payload, resolved_topic)
    logger.info(f"[{request_id}] Research bundle built with {research_bundle.source_count} sources.")

    error_msg = None
    crew_result = None
    try:
        logger.debug(f"[{request_id}] Starting CrewAI execution...")
        crew_result = crew_service.run(payload, research_bundle)
        logger.debug(f"[{request_id}] CrewAI execution completed successfully.")
    except Exception as exc:
        error_msg = str(exc)
        logger.error(f"[{request_id}] CrewAI execution failed: {exc}", exc_info=True)
        # Create history record for the failure
        try:
            GenerationHistory.objects.create(
                request_id=request_id,
                topic=resolved_topic.topic,
                crew_type=payload.crew_type,
                status="failed",
                error_message=error_msg,
                llm_provider=settings.LLM_PROVIDER,
                llm_model=settings.LLM_MODEL or "default"
            )
        except Exception as db_exc:
            logger.warning(f"[{request_id}] Failed to save failure history to DB: {db_exc}")
        return api.create_response(request, {"detail": f"CrewAI execution failed: {exc}"}, status=502)

    parsed = crew_result.parsed_output
    additional_information = finalize_additional_information(
        parsed.get("additional_information"),
        research_bundle.creator_research,
        research_bundle.source_urls,
    )
    final_content = str(parsed["content"]).strip()
    title = str(parsed["title"]).strip()
    summary = str(parsed["summary"]).strip()
    hashtags = list(parsed.get("hashtags", []))
    keywords = list(parsed.get("keywords", [])) or payload.keywords
    image_prompt = str(parsed.get("image_prompt", "")).strip()

    # Save to internal Django History (SQLite)
    execution_time = time.time() - start_time
    try:
        GenerationHistory.objects.create(
            request_id=request_id,
            topic=resolved_topic.topic,
            crew_type=payload.crew_type,
            title=title,
            summary=summary,
            content=final_content,
            status="success",
            llm_provider=settings.LLM_PROVIDER,
            llm_model=settings.LLM_MODEL or "default",
            execution_time_seconds=round(execution_time, 2)
        )
    except Exception as db_exc:
        logger.warning(f"[{request_id}] Failed to save success history to DB: {db_exc}")

    # Legacy MongoDB Save Logic
    output_collection_id = None
    should_save = (
        payload.save_result
        if payload.save_result is not None
        else settings.SAVE_RESULT_DEFAULT
    )
    should_mark_processed = (
        payload.mark_topic_processed
        if payload.mark_topic_processed is not None
        else settings.MARK_TOPIC_PROCESSED_DEFAULT
    )

    if should_save and repository.enabled:
        record = {
            "request_id": request_id,
            "topic": resolved_topic.topic,
            "topic_id": resolved_topic.topic_id,
            "title": title,
            "summary": summary,
            "content": final_content,
            "hashtags": hashtags,
            "keywords": keywords,
            "image_prompt": image_prompt if image_prompt else None,
            "source_urls": research_bundle.source_urls,
            "source_count": research_bundle.source_count,
            "metadata": payload.metadata,
            "instagram_image": crew_result.instagram_image_path,
            "instagram_images": crew_result.instagram_image_paths,
            "instagram_html": crew_result.instagram_image_paths[0] if crew_result.instagram_image_paths else None,
            "instagram_slides": crew_result.instagram_slides,
            "instagramImage": crew_result.instagram_image_path,
            "model_used": settings.OLLAMA_MODEL if settings.LLM_PROVIDER == "ollama" else settings.LLM_MODEL,
            "created_at": datetime.now(timezone.utc),
        }
        output_collection_id = repository.save_generation(record)

    if should_mark_processed and repository.enabled and resolved_topic.topic_id:
        repository.mark_processed(
            resolved_topic.topic_id, 
            resolved_topic.topic, 
            research_bundle.source_urls,
            content=final_content,
            instagram_image=crew_result.instagram_image_path
        )

    debug = None
    if payload.include_debug:
        debug = {
            "full_output": crew_result.full_output,
            "raw_final_output": crew_result.raw_final_output,
            "research_text": research_bundle.research_text,
        }

    response_data = {
        "status": "success",
        "message": "Content generated successfully",
        "request_id": request_id,
        "topic": resolved_topic.topic,
        "title": title,
        "summary": summary,
        "content": final_content,
        "final_content": final_content,
        "hashtags": hashtags,
        "keywords": keywords,
        "source_urls": research_bundle.source_urls,
        "source_count": research_bundle.source_count,
        "instagram_image": crew_result.instagram_image_path,
        "instagram_images": crew_result.instagram_image_paths,
        "instagram_html": crew_result.instagram_image_paths[0] if crew_result.instagram_image_paths else None,
        "instagram_slides": crew_result.instagram_slides,
        "platform_specific_content": parsed.get("platform_specific_content"),
        "additional_information": additional_information,
        "generation_brief": parsed.get("generation_brief"),
        "image_prompt": image_prompt if image_prompt else None,
        "output_collection_id": output_collection_id,
        "debug": debug,
    }
    
    # Log response details
    logger.info(f"[{request_id}] ✅ Generation completed successfully in {execution_time:.2f}s")
    logger.info(f"[{request_id}] Response Summary:")
    logger.info(f"  - Title: {title[:50]}...")
    logger.info(f"  - Content Length: {len(final_content)} characters")
    logger.info(f"  - Keywords: {', '.join(keywords[:3])}{'...' if len(keywords) > 3 else ''}")
    logger.info(f"  - Sources Used: {research_bundle.source_count}")
    
    return response_data


def _maintenance_fallback_decision(file_item, config: Dict[str, Any]) -> MaintenanceDecision:
    tags = file_item.tags or [file_item.category]
    trace = [
        f"File category={file_item.category}, tags={', '.join(tags)}.",
        "Decision generated deterministically from user configuration.",
    ]
    action = "review"
    reason = "No configured rule clearly authorizes delete or archive."
    confidence = 0.68

    if any(file_item.path == folder or file_item.path.startswith(f"{folder}/") for folder in config.get("ignoreFolders", [])):
        action = "ignore"
        reason = "Path matches an ignored folder."
        confidence = 1
    elif "large" in tags and file_item.sizeMb >= float(config.get("archiveLargeFileMb", 250)):
        action = "archive"
        reason = "File exceeds configured archive size."
        confidence = 0.82
    elif "temp" in tags:
        action = "delete"
        reason = "Temporary file matched configured cleanup category."
        confidence = 0.78
    elif "logs" in tags and file_item.sizeMb >= float(config.get("largeFileMb", 100)):
        action = "archive"
        reason = "Large log should be archived before removal."
        confidence = 0.76

    trace.append(f"Recommended action={action}.")
    return MaintenanceDecision(
        path=file_item.path,
        action=action,
        confidence=confidence,
        reason=reason,
        decisionTrace=trace,
    )


def _fallback_remediation_plan(payload: RemediationPlanRequest) -> RemediationPlan:
    intent = payload.intent.lower()
    user_context = payload.context.get("userContext", {}) if isinstance(payload.context, dict) else {}
    latest_metrics = payload.context.get("latestMetrics", []) if isinstance(payload.context, dict) else []

    service_name = (
        user_context.get("serviceName")
        or user_context.get("service")
    )
    pid = user_context.get("pid") or user_context.get("processId")
    file_path = (
        user_context.get("path")
        or user_context.get("filePath")
        or user_context.get("targetPath")
    )
    directories = user_context.get("directories") if isinstance(user_context.get("directories"), list) else None

    steps = [{"toolName": "collect_metrics", "args": {}, "reasoning": "Capture fresh diagnostics before any change."}]
    rollback_steps = []
    target = "server"
    summary = "Collected live diagnostics before selecting a safe remediation action."
    description = payload.intent
    risk_level = "medium"
    requires_approval = True
    trace = [
        "Fallback remediation planner used deterministic heuristics.",
        f"Intent received: {payload.intent}",
    ]

    if latest_metrics:
        latest = latest_metrics[0]
        trace.append(
            "Latest metrics snapshot: "
            f"cpu={latest.get('cpuUsagePercent', 'n/a')} "
            f"memory={latest.get('memoryUsagePercent', 'n/a')} "
            f"disk={latest.get('diskUsagePercent', 'n/a')}"
        )

    if "restart" in intent and service_name:
        target = str(service_name)
        summary = f"Restart {service_name} after collecting metrics and validating server health."
        description = f"AI-planned restart for service {service_name}."
        steps = [
            {"toolName": "collect_metrics", "args": {}, "reasoning": "Capture current utilization before the restart."},
            {"toolName": "run_health_check", "args": {}, "reasoning": "Baseline the server state before the restart."},
            {"toolName": "restart_service", "args": {"serviceName": service_name}, "reasoning": "Restart the impacted service."},
            {"toolName": "run_health_check", "args": {}, "reasoning": "Verify the server recovered after the restart."},
        ]
        rollback_steps = [
            {"toolName": "restart_service", "args": {"serviceName": service_name}, "reasoning": "Best-effort rollback by restarting the service again."}
        ]
    elif ("kill" in intent or "terminate" in intent) and pid:
        target = str(pid)
        summary = f"Terminate PID {pid} after gathering diagnostics."
        description = f"AI-planned process termination for PID {pid}."
        risk_level = "high"
        steps = [
            {"toolName": "collect_metrics", "args": {}, "reasoning": "Capture system state before termination."},
            {"toolName": "kill_process", "args": {"pid": str(pid)}, "reasoning": "Terminate the offending process."},
            {"toolName": "collect_metrics", "args": {}, "reasoning": "Verify resource pressure improved."},
        ]
    elif ("cache" in intent or "memory" in intent) and "clear" in intent:
        target = "memory-cache"
        summary = "Clear filesystem cache with pre- and post-health verification."
        description = "AI-planned cache clearing for memory pressure."
        steps = [
            {"toolName": "collect_metrics", "args": {}, "reasoning": "Capture memory pressure before clearing cache."},
            {"toolName": "run_health_check", "args": {}, "reasoning": "Baseline the server state."},
            {"toolName": "clear_cache", "args": {}, "reasoning": "Drop Linux filesystem caches."},
            {"toolName": "run_health_check", "args": {}, "reasoning": "Confirm the server remained healthy."},
        ]
    elif ("disk" in intent or "space" in intent or "storage" in intent) and file_path:
        target = str(file_path)
        summary = f"Archive {file_path} to free disk space while preserving recoverability."
        description = f"AI-planned file archival for {file_path}."
        steps = [
            {"toolName": "collect_metrics", "args": {}, "reasoning": "Capture disk pressure before archival."},
            {"toolName": "archive_file", "args": {"path": file_path}, "reasoning": "Archive the large candidate file."},
            {"toolName": "run_health_check", "args": {}, "reasoning": "Verify server health after archival."},
        ]
    elif ("delete" in intent or "remove" in intent) and file_path:
        target = str(file_path)
        summary = f"Prepare a safe cleanup recommendation for {file_path}."
        description = f"AI-planned recommendation workflow for {file_path}."
        risk_level = "medium"
        steps = [
            {"toolName": "collect_metrics", "args": {}, "reasoning": "Capture state before deletion."},
            {"toolName": "start_scan", "args": {"directories": [str(file_path).rsplit("/", 1)[0] or "/"]}, "reasoning": "Scan target directory before any action."},
            {"toolName": "analyze_scan_results", "args": {}, "reasoning": "Generate recommendations for Node-side review and execution."},
            {"toolName": "run_health_check", "args": {}, "reasoning": "Verify the server remained healthy."},
        ]
    else:
        target = "configured-directories"
        summary = "Scan configured directories and generate cleanup recommendations for Node execution."
        description = "AI-planned scan and recommendation workflow."
        risk_level = "medium"
        steps = [
            {"toolName": "collect_metrics", "args": {}, "reasoning": "Capture current system state."},
            {
                "toolName": "start_scan",
                "args": {"directories": directories} if directories else {},
                "reasoning": "Discover cleanup candidates before taking destructive action.",
            },
            {
                "toolName": "analyze_scan_results",
                "args": {},
                "reasoning": "Analyze the scan results and determine safe cleanup actions.",
            },
        ]

    return RemediationPlan(
        goal=payload.intent,
        summary=summary,
        target=target,
        description=description,
        planner="fallback_remediation_planner",
        decisionTrace=trace,
        riskLevel=risk_level,
        requiresApproval=requires_approval,
        steps=steps,
        rollbackSteps=rollback_steps,
        contextSnapshot=payload.context,
    )


@api.post("/maintenance/decide", response=MaintenanceDecisionResponse)
def decide_maintenance(request, payload: MaintenanceDecisionRequest):
    crewai_enabled = getattr(settings, "MAINTENANCE_CREWAI_ENABLED", False)
    if crewai_enabled and payload.files:
        try:
            crew_output = ServerMaintenanceCrew(
                api_key=payload.openAiKey,
                provider=payload.llmProvider,
                model=payload.llmModel,
                base_url=payload.llmBaseUrl
            ).run(
                {
                    "serverId": payload.serverId,
                    "files": [file_item.model_dump() for file_item in payload.files],
                    "config": payload.config,
                }
            )
            raw_final = str(getattr(crew_output, "raw", "") or str(crew_output)).strip()
            parsed = json.loads(raw_final)
            decisions = [
                MaintenanceDecision(**decision)
                for decision in parsed.get("decisions", [])
                if isinstance(decision, dict) and decision.get("path")
            ]
            if decisions:
                return {
                    "status": "success",
                    "decisions": decisions,
                    "crewaiUsed": True,
                }
        except Exception as exc:
            logger.warning("CrewAI maintenance advisor failed, using deterministic fallback: %s", exc)

    return {
        "status": "success",
        "decisions": [
            _maintenance_fallback_decision(file_item, payload.config)
            for file_item in payload.files
        ],
        "crewaiUsed": False,
    }


@api.post("/maintenance/remediation-plan", response=RemediationPlanResponse)
def remediation_plan(request, payload: RemediationPlanRequest):
    crewai_enabled = getattr(settings, "MAINTENANCE_CREWAI_ENABLED", False)
    if crewai_enabled and payload.tools:
        try:
            crew_output = RemediationPlannerCrew(
                api_key=payload.openAiKey,
                provider=payload.llmProvider,
                model=payload.llmModel,
                base_url=payload.llmBaseUrl,
            ).run(
                {
                    "intent": payload.intent,
                    "context": payload.context,
                    "tools": [tool.model_dump() for tool in payload.tools],
                }
            )
            raw_final = str(getattr(crew_output, "raw", "") or str(crew_output)).strip()
            parsed = json.loads(raw_final)
            plan = RemediationPlan(**parsed)
            return {
                "status": "success",
                "plan": plan,
                "crewaiUsed": True,
            }
        except Exception as exc:
            logger.warning("CrewAI remediation planner failed, using deterministic fallback: %s", exc)

    return {
        "status": "success",
        "plan": _fallback_remediation_plan(payload),
        "crewaiUsed": False,
    }


from .schemas import PredictiveMaintenanceRequest, PredictiveMaintenanceResponse
from agents.prediction_engine.failure_predictor import FailurePredictor

@api.post("/maintenance/predict", response=PredictiveMaintenanceResponse)
def predict_maintenance(request, payload: PredictiveMaintenanceRequest):
    try:
        context = {
            "serverId": payload.serverId,
            "trends": getattr(payload, "trends", {}),
            "healthScore": getattr(payload, "healthScore", None),
            "scanResults": getattr(payload, "scanResults", []),
            "maintenanceLogs": getattr(payload, "maintenanceLogs", []),
        }
        result = FailurePredictor(payload.metrics or [], context).run()

        return {
            "status": "success",
            **result,
        }

    except Exception as exc:
        logger.error("Predictive maintenance failed: %s", exc, exc_info=True)

        return {
            "status": "success",
            "predictions": [
                {
                    "issue": "Predictive analysis failed",
                    "predictedFailure": "Unknown",
                    "recommendation": "Check predictive maintenance server logs",
                    "severity": "low",
                    "confidence": 0,
                    "horizonMinutes": 0,
                    "evidence": [
                        {
                            "source": "event",
                            "title": "Execution Error",
                            "detail": str(exc),
                            "severity": "low",
                            "metadata": {},
                        }
                    ],
                    "recommendedActions": [
                        "Check logs"
                    ],
                    "affectedComponents": [
                        "AI Service"
                    ],
                }
            ],
            "aiGeneratedResponse": False,
        }

def _resolve_topic(payload: ContentGenerationRequest) -> ResolvedTopic:
    if payload.topic_id:
        if not repository.enabled:
            return api.create_response(None, {"detail": "MongoDB is not configured for topic_id lookup."}, status=400)
        topic = repository.fetch_topic_by_id(payload.topic_id)
        if topic is None:
            return api.create_response(None, {"detail": "Topic document not found."}, status=404)
        return topic

    if payload.use_topic_queue:
        if not repository.enabled:
            return api.create_response(None, {"detail": "MongoDB is not configured for queue mode."}, status=400)
        topic = repository.fetch_next_topic()
        if topic is None:
            return api.create_response(None, {"detail": "No pending topics found in the queue."}, status=404)
        return topic

    if payload.topic:
        return ResolvedTopic(topic=payload.topic.strip())

    if payload.research_text:
        return ResolvedTopic(topic="Generated Topic")

    if payload.source_urls:
        return ResolvedTopic(topic="Content from provided sources")

    return api.create_response(None, {"detail": "Unable to resolve a topic from the request payload."}, status=400)
