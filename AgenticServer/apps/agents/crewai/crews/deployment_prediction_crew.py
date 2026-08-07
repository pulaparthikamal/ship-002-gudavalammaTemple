from __future__ import annotations

import json
from typing import Any

from crewai import Agent, Task

from .base import BaseCrew
from .registry import register_crew
from ..deployment_prompts import (
    DEPLOYMENT_COMMIT_RISK_BACKSTORY,
    DEPLOYMENT_IMPACT_BACKSTORY,
    DEPLOYMENT_PREDICTION_OUTPUT_SCHEMA,
)


@register_crew("deployment_prediction")
class DeploymentPredictionCrew(BaseCrew):
    """
    Pre-deployment predictive intelligence crew.

    Given a candidate commit, its changed files, the application's component map,
    and a derived service dependency graph, this crew predicts how risky the
    deployment is, what could fail, and which services/components are impacted.
    It produces calibrated risk/failure/confidence scores plus human-readable
    explanations and recommendations. Execution remains with the Node.js engine —
    this output is advisory and shown to the user before deploying.
    """

    def setup_agents(self, inputs: dict[str, Any]) -> list[Agent]:
        commit_risk_analyst = Agent(
            role="Commit Risk Analyst",
            goal=(
                "Analyse the commit metadata and changed files and produce a calibrated "
                "risk score, a failure probability, and a confidence score."
            ),
            backstory=DEPLOYMENT_COMMIT_RISK_BACKSTORY,
            llm=self.llm,
            allow_delegation=False,
        )
        impact_predictor = Agent(
            role="Infrastructure Impact Predictor",
            goal=(
                "Predict which components and downstream services are affected using the "
                "service dependency graph, and produce mitigations and a final recommendation."
            ),
            backstory=DEPLOYMENT_IMPACT_BACKSTORY,
            llm=self.llm,
            allow_delegation=False,
        )
        return [commit_risk_analyst, impact_predictor]

    def setup_tasks(self, agents: list[Agent], inputs: dict[str, Any]) -> list[Task]:
        commit_risk_analyst, impact_predictor = agents

        commit_json = json.dumps(inputs.get("commit", {}), default=str)
        changed_files_json = json.dumps(inputs.get("changedFiles", []), default=str)
        components_json = json.dumps(inputs.get("components", []), default=str)
        dependency_graph_json = json.dumps(inputs.get("dependencyGraph", {}), default=str)
        operational_context_json = json.dumps(inputs.get("operationalContext", {}), default=str)
        application_json = json.dumps(inputs.get("application", {}), default=str)

        risk_task = Task(
            description=(
                "Assess the risk of deploying this change.\n"
                f"Commit metadata:\n{commit_json}\n"
                f"Changed files, line counts, and available diff snippets:\n{changed_files_json}\n"
                f"Application:\n{application_json}\n"
                f"Recent deployments, health checks, and operational signals:\n{operational_context_json}\n"
                "Consider: diff breadth and size, edits to dependency manifests and lockfiles, "
                "environment/config/infrastructure files, database migrations, and commit message "
                "signals (hotfix, revert, breaking, WIP), recent deployment outcomes, error patterns, "
                "health-check failures, response times, failed pipeline steps, and service dependency "
                "blast radius. Perform code-content analysis using the supplied diff snippets. If source "
                "diffs or operational data are sparse, lower your confidence and explain what evidence is missing."
            ),
            expected_output=(
                "JSON only: {\"riskScore\": 0-100, \"failureProbability\": 0-100, "
                "\"confidenceScore\": 0-100, \"summary\": \"...\", "
                "\"risks\": [{\"severity\": \"low|medium|high|critical\", \"area\": \"...\", "
                "\"issue\": \"...\", \"mitigation\": \"...\"}]}"
            ),
            agent=commit_risk_analyst,
        )

        impact_task = Task(
            description=(
                "Using the risk assessment plus the component map and service dependency graph, "
                "predict the infrastructure impact and produce the final recommendation.\n"
                f"Components:\n{components_json}\n"
                f"Service dependency graph:\n{dependency_graph_json}\n"
                "Identify directly-changed components and their downstream consumers (e.g. a react-ui "
                "that calls a changed node-api). Recommend 'block' only when the risk is genuinely high. "
                "Return the COMPLETE prediction object combining the risk scores from the previous task "
                "with the impact analysis.\n\n" + DEPLOYMENT_PREDICTION_OUTPUT_SCHEMA
            ),
            expected_output="The complete prediction JSON object described in the schema. JSON only.",
            agent=impact_predictor,
            context=[risk_task],
        )

        return [risk_task, impact_task]
