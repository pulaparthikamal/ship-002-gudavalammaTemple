from __future__ import annotations

import json
from typing import Any

from crewai import Agent, Task

from .base import BaseCrew
from .registry import register_crew


@register_crew("deployment_validation")
class DeploymentValidationCrew(BaseCrew):
    """
    Post-deployment validation crew.

    Analyses the deployment result, step logs, and health check outcomes
    to determine whether the deployment was truly successful. Produces a
    structured validation report.
    """

    def setup_agents(self, inputs: dict[str, Any]) -> list[Agent]:
        log_analyst = Agent(
            role="Deployment Log Analyst",
            goal="Parse deployment logs and step results to identify hidden failures or warnings.",
            backstory=(
                "You are an expert at reading deployment logs. You spot patterns like: "
                "npm peer dependency warnings that indicate future breakage, PM2 cluster forks "
                "that silently failed, nginx config tests that passed but had non-fatal warnings, "
                "and health checks that returned 200 but with unexpected latency."
            ),
            llm=self.llm,
            allow_delegation=False,
        )
        health_verifier = Agent(
            role="Application Health Verifier",
            goal="Verify that the deployed application is truly healthy and serving traffic correctly.",
            backstory=(
                "You assess application health beyond a simple HTTP 200. You review process uptime, "
                "memory usage at startup, error log presence, and whether the health endpoint "
                "reflects actual application readiness, not just an HTTP server starting."
            ),
            llm=self.llm,
            allow_delegation=False,
        )
        return [log_analyst, health_verifier]

    def setup_tasks(self, agents: list[Agent], inputs: dict[str, Any]) -> list[Task]:
        log_analyst, health_verifier = agents

        logs_json = json.dumps(inputs.get("deploymentLogs", []), default=str)
        steps_json = json.dumps(inputs.get("stepResults", []), default=str)
        health_json = json.dumps(inputs.get("healthCheckResults", {}), default=str)

        log_analysis_task = Task(
            description=(
                "Analyse the deployment step results and logs for anomalies.\n"
                f"Step results:\n{steps_json}\n"
                f"Deployment logs (last 200 lines):\n{logs_json}\n"
                "Identify: failed steps, warning patterns, non-zero exit codes in sub-commands, "
                "and any log lines that indicate degraded operation."
            ),
            expected_output=(
                "JSON only: {\"anomalies\": [{\"stepName\": \"...\", \"severity\": \"low|medium|high\", "
                "\"pattern\": \"...\", \"logLine\": \"...\"}], "
                "\"overallLogHealth\": \"clean|warnings|errors\"}"
            ),
            agent=log_analyst,
        )
        health_task = Task(
            description=(
                "Assess application health using the health check results and log analysis.\n"
                f"Health check results:\n{health_json}\n"
                "Determine if the application is production-ready or if a rollback is recommended."
            ),
            expected_output=(
                "JSON only: {\"deploymentHealthy\": true, "
                "\"rollbackRecommended\": false, "
                "\"healthSummary\": \"...\", "
                "\"issues\": [{\"component\": \"...\", \"issue\": \"...\", \"recommendation\": \"...\"}], "
                "\"confidenceScore\": 0.95}"
            ),
            agent=health_verifier,
            context=[log_analysis_task],
        )
        return [log_analysis_task, health_task]
