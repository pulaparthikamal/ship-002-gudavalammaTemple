"""
Deployment Agent API endpoints (Django Ninja).

These endpoints are called by the Node.js deployment agent when AI-assisted
analysis, validation, or rollback planning is needed. All execution remains
in the Node.js pipeline engine — these endpoints produce advisory output only.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any
from ninja import Router
from pydantic import BaseModel
from django.views.decorators.csrf import csrf_exempt

from apps.agents.crewai.crews.deployment_coordinator_crew import DeploymentCoordinatorCrew
from apps.agents.crewai.crews.deployment_analysis_crew import DeploymentAnalysisCrew
from apps.agents.crewai.crews.deployment_execution_crew import DeploymentExecutionCrew
from apps.agents.crewai.crews.deployment_validation_crew import DeploymentValidationCrew
from apps.agents.crewai.crews.deployment_rollback_crew import DeploymentRollbackCrew
from apps.agents.crewai.crews.deployment_prediction_crew import DeploymentPredictionCrew
from apps.agents.crewai.parser import parse_final_output

logger = logging.getLogger("apps.api")
router = Router()


# ─── Request / Response Schemas ─────────────────────────────────────────────

class ApplicationConfig(BaseModel):
    name: str
    layout: str
    components: list[dict[str, Any]]
    repository: dict[str, Any]

class TargetConfig(BaseModel):
    host: str
    os: str = "ubuntu"
    nodeInstallStrategy: str = "nvm"
    reverseProxy: str = "nginx-managed"
    privilegeEscalation: str = "sudo"

class CoordinatorRequest(BaseModel):
    application: dict[str, Any]
    target: dict[str, Any]

class AnalysisRequest(BaseModel):
    application: dict[str, Any]
    serverEnvironment: dict[str, Any]

class ExecutionRequest(BaseModel):
    deployment: dict[str, Any]
    steps: list[dict[str, Any]]

class ValidationRequest(BaseModel):
    deploymentLogs: list[dict[str, Any]]
    stepResults: list[dict[str, Any]]
    healthCheckResults: dict[str, Any]

class RollbackRequest(BaseModel):
    deployment: dict[str, Any]
    previousRelease: dict[str, Any]
    failureContext: dict[str, Any]

class RollbackAnalysisRequest(BaseModel):
    deployment: dict[str, Any]
    previousRelease: dict[str, Any]
    failureContext: dict[str, Any]

class PredictionRequest(BaseModel):
    application: dict[str, Any]
    target: dict[str, Any] = {}
    commit: dict[str, Any] = {}
    changedFiles: list[dict[str, Any]] = []
    components: list[dict[str, Any]] = []
    dependencyGraph: dict[str, Any] = {}
    operationalContext: dict[str, Any] = {}

class AgentResponse(BaseModel):
    success: bool
    data: dict[str, Any]
    raw: str


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _run_crew(crew_instance: Any, inputs: dict[str, Any]) -> AgentResponse:
    result = crew_instance.run(inputs)
    raw = str(getattr(result, "raw", "") or str(result)).strip()
    parsed = parse_final_output(raw)
    return AgentResponse(success=True, data=parsed, raw=raw)


def _extract_json(raw_text: str) -> dict[str, Any]:
    """Extract the first JSON object from raw crew output (structured-output crews)."""
    match = re.search(r"\{.*\}", raw_text, flags=re.DOTALL)
    if not match:
        return {}
    try:
        parsed = json.loads(match.group(0))
        return parsed if isinstance(parsed, dict) else {}
    except Exception:
        return {}


def _require_score(value: Any, field_name: str) -> int:
    try:
        num = float(value)
    except (TypeError, ValueError):
        raise ValueError(f"Missing or invalid {field_name}.")
    # Accept either 0-1 or 0-100 scales and normalise to 0-100
    if 0 <= num <= 1:
        num *= 100
    return int(max(0, min(100, round(num))))


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.post("/coordinator", response=AgentResponse)
def analyse_deployment_strategy(request, payload: CoordinatorRequest):
    """
    Analyse an application + target configuration and produce a deployment strategy.
    Called before triggering the pipeline to get AI-advised configuration validation.
    """
    crew = DeploymentCoordinatorCrew()
    return _run_crew(crew, {
        "application": payload.application,
        "target": payload.target,
    })


@router.post("/analyse", response=AgentResponse)
def analyse_environment(request, payload: AnalysisRequest):
    """
    Pre-deployment environment analysis.
    Returns a go/no-go recommendation with specific blockers.
    """
    crew = DeploymentAnalysisCrew()
    return _run_crew(crew, {
        "application": payload.application,
        "serverEnvironment": payload.serverEnvironment,
    })


@router.post("/execution-plan", response=AgentResponse)
def generate_execution_plan(request, payload: ExecutionRequest):
    """
    Generate a step-by-step execution advisory for the deployment pipeline.
    The Node.js engine uses this as supplementary guidance — not as a command source.
    """
    crew = DeploymentExecutionCrew()
    return _run_crew(crew, {
        "deployment": payload.deployment,
        "steps": payload.steps,
    })


@router.post("/validate", response=AgentResponse)
def validate_deployment(request, payload: ValidationRequest):
    """
    Post-deployment validation. Analyses logs, step results, and health checks
    to determine whether the deployment is truly healthy or a rollback is needed.
    """
    crew = DeploymentValidationCrew()
    return _run_crew(crew, {
        "deploymentLogs": payload.deploymentLogs,
        "stepResults": payload.stepResults,
        "healthCheckResults": payload.healthCheckResults,
    })


@router.post("/rollback-plan", response=AgentResponse)
def plan_rollback(request, payload: RollbackRequest):
    """
    Rollback decision and planning.
    Returns a safety assessment and a structured rollback plan.
    """
    crew = DeploymentRollbackCrew()
    return _run_crew(crew, {
        "deployment": payload.deployment,
        "previousRelease": payload.previousRelease,
        "failureContext": payload.failureContext,
    })


@router.post("/analyze-rollback", response=AgentResponse)
def analyze_rollback(request, payload: RollbackAnalysisRequest):
    """
    AI-powered rollback analysis for the UI.
    Returns a structured analysis with confidence score, risk level,
    recommendation, estimated recovery time, and failure analysis.
    Designed for real-time display in the rollback modal.
    """
    crew = DeploymentRollbackCrew()
    raw_result = _run_crew(crew, {
        "deployment": payload.deployment,
        "previousRelease": payload.previousRelease,
        "failureContext": payload.failureContext,
    })

    # Extract and normalise values from crew output for the UI
    crew_data = raw_result.data or {}

    rollback_safe = crew_data.get("rollbackSafe", True)
    risk_level_raw = str(crew_data.get("riskLevel", "medium")).lower()
    risk_level = risk_level_raw if risk_level_raw in ("low", "medium", "high") else "medium"

    risk_to_confidence = {"low": 90, "medium": 65, "high": 40}
    confidence_score = risk_to_confidence.get(risk_level, 65)
    if not rollback_safe:
        confidence_score = max(confidence_score - 25, 20)

    recommendation = (
        "Rollback Recommended" if rollback_safe and risk_level in ("low", "medium")
        else "Rollback Not Recommended — high risk detected" if not rollback_safe
        else "Proceed with Caution"
    )

    warnings = crew_data.get("warnings", [])
    decision_trace = crew_data.get("decisionTrace", [])
    plan = crew_data.get("rollbackPlan", [])

    step_count = len(plan) if plan else 3
    estimated_seconds = step_count * 30 + 60
    if estimated_seconds < 60:
        recovery_time = f"{estimated_seconds}s"
    elif estimated_seconds < 3600:
        recovery_time = f"{estimated_seconds // 60}-{estimated_seconds // 60 + 2} minutes"
    else:
        recovery_time = f"{estimated_seconds // 3600} hour(s)"

    failure_context = payload.failureContext or {}
    failed_step = failure_context.get("failedStep", "unknown step")
    error_message = failure_context.get("errorMessage", "No error details available.")

    result_data = {
        "confidenceScore": confidence_score,
        "riskLevel": risk_level,
        "recommendation": recommendation,
        "estimatedRecoveryTime": recovery_time,
        "failureAnalysis": {
            "rootCause": f"Failure detected at step: {failed_step}." if failed_step and failed_step != "unknown step" else error_message,
            "impactAssessment": "; ".join(warnings) if warnings else "Impact assessment not available.",
            "recoveryRecommendation": "; ".join(decision_trace[:2]) if decision_trace else recommendation,
        },
    }

    return AgentResponse(success=True, data=result_data, raw=raw_result.raw)


@router.post("/predict", response=AgentResponse)
def predict_deployment(request, payload: PredictionRequest):
    """
    AI Predictive Deployment Intelligence (pre-deployment).

    Analyses the candidate commit + changed files against the application's component
    map and service dependency graph to predict deployment risk, failure probability,
    impacted components, and recommendations. Returns success=False when the LLM
    cannot produce a complete AI prediction; callers should surface that honestly
    instead of generating deterministic fallback scores.
    """
    try:
        crew = DeploymentPredictionCrew()
        result = crew.run({
            "application": payload.application,
            "target": payload.target,
            "commit": payload.commit,
            "changedFiles": payload.changedFiles,
            "components": payload.components,
            "dependencyGraph": payload.dependencyGraph,
            "operationalContext": payload.operationalContext,
        })
        raw = str(getattr(result, "raw", "") or str(result)).strip()
        crew_data = _extract_json(raw)

        if not crew_data:
            return AgentResponse(success=False, data={"error": "LLM did not return a JSON prediction."}, raw=raw)

        try:
            risk_score = _require_score(crew_data.get("riskScore"), "riskScore")
            failure_probability = _require_score(crew_data.get("failureProbability"), "failureProbability")
            confidence_score = _require_score(crew_data.get("confidenceScore"), "confidenceScore")
        except ValueError as exc:
            return AgentResponse(success=False, data={"error": str(exc)}, raw=raw)

        recommendation_raw = str(crew_data.get("recommendation", "")).strip().lower().replace(" ", "_")
        if recommendation_raw not in ("proceed", "proceed_with_caution", "block"):
            return AgentResponse(success=False, data={"error": "Missing or invalid recommendation."}, raw=raw)

        summary = str(crew_data.get("summary", "")).strip()
        if not summary:
            return AgentResponse(success=False, data={"error": "Missing reasoning summary."}, raw=raw)

        risks = crew_data.get("risks") if isinstance(crew_data.get("risks"), list) else []
        impacted = crew_data.get("impactedComponents") if isinstance(crew_data.get("impactedComponents"), list) else []
        recommendations = crew_data.get("recommendations") if isinstance(crew_data.get("recommendations"), list) else []

        result_data = {
            "riskScore": risk_score,
            "failureProbability": failure_probability,
            "confidenceScore": confidence_score,
            "recommendation": recommendation_raw,
            "summary": summary,
            "risks": risks,
            "impactedComponents": impacted,
            "recommendations": recommendations,
        }
        return AgentResponse(success=True, data=result_data, raw=raw)

    except Exception as exc:
        logger.warning("Deployment prediction crew failed: %s", exc)
        return AgentResponse(success=False, data={"error": f"AI prediction failed: {exc}"}, raw=str(exc))
