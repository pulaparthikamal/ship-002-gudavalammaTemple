from __future__ import annotations

import json
from typing import Any

from crewai import Agent, Task

from .base import BaseCrew
from .registry import register_crew


@register_crew("deployment_coordinator")
class DeploymentCoordinatorCrew(BaseCrew):
    """
    High-level deployment coordinator that orchestrates the overall deployment strategy.

    Analyses the application configuration, validates readiness, and produces a
    structured deployment plan. The Node.js pipeline engine executes the actual steps;
    this crew only advises.
    """

    def setup_agents(self, inputs: dict[str, Any]) -> list[Agent]:
        strategist = Agent(
            role="Deployment Strategist",
            goal="Analyse the application and target configuration and produce a deployment strategy.",
            backstory=(
                "You are a senior SRE with deep experience in zero-downtime Node.js deployments. "
                "You review application layouts, component types, and target constraints before "
                "recommending a deployment approach. You never guess — you derive decisions from "
                "the supplied configuration."
            ),
            llm=self.llm,
            allow_delegation=False,
        )
        risk_assessor = Agent(
            role="Deployment Risk Assessor",
            goal="Identify risks in the proposed deployment and flag steps that need extra attention.",
            backstory=(
                "You are a cautious infrastructure engineer. You scan for common deployment pitfalls: "
                "missing health checks, absent rollback targets, port conflicts, insecure credential "
                "handling, and missing build steps for UI components."
            ),
            llm=self.llm,
            allow_delegation=False,
        )
        return [strategist, risk_assessor]

    def setup_tasks(self, agents: list[Agent], inputs: dict[str, Any]) -> list[Task]:
        strategist, risk_assessor = agents

        app_json = json.dumps(inputs.get("application", {}), default=str)
        target_json = json.dumps(inputs.get("target", {}), default=str)

        strategy_task = Task(
            description=(
                "Review the application and target configuration and produce a deployment strategy.\n"
                f"Application:\n{app_json}\n"
                f"Target:\n{target_json}\n"
                "Determine: layout type, which components need a build step, which need PM2, "
                "whether nginx management is needed, and the correct deploy path pattern."
            ),
            expected_output=(
                "JSON only: {\"strategy\": {\"layout\": \"monorepo|multi-repo\", "
                "\"components\": [{\"key\": \"...\", \"type\": \"...\", \"needsBuild\": true, "
                "\"needsPm2\": true, \"deployPath\": \"...\"}], "
                "\"requiresNginx\": true, \"estimatedDurationMinutes\": 5, "
                "\"decisionTrace\": [\"...\"]}}"
            ),
            agent=strategist,
        )
        risk_task = Task(
            description=(
                "Review the deployment strategy and flag any risks or missing configuration. "
                "Focus on: health check presence for API components, rollback capability, "
                "credential completeness, and node version pinning."
            ),
            expected_output=(
                "JSON only: {\"risks\": [{\"severity\": \"low|medium|high|critical\", "
                "\"component\": \"...\", \"issue\": \"...\", \"recommendation\": \"...\"}], "
                "\"deploymentApproved\": true, \"blockers\": []}"
            ),
            agent=risk_assessor,
            context=[strategy_task],
        )
        return [strategy_task, risk_task]
