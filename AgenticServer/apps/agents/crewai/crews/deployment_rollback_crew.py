from __future__ import annotations

import json
from typing import Any

from crewai import Agent, Task

from .base import BaseCrew
from .registry import register_crew


@register_crew("deployment_rollback")
class DeploymentRollbackCrew(BaseCrew):
    """
    Rollback decision and planning crew.

    Given a failed or unhealthy deployment, this crew determines whether
    a rollback is safe, which release to target, and produces a structured
    rollback plan. Execution remains with the Node.js engine.
    """

    def setup_agents(self, inputs: dict[str, Any]) -> list[Agent]:
        rollback_analyst = Agent(
            role="Rollback Decision Analyst",
            goal="Determine whether a rollback is safe and identify the optimal rollback target.",
            backstory=(
                "You are a cautious SRE who has managed rollbacks in production. "
                "You understand that rolling back a database migration alongside code is dangerous. "
                "You assess: is there a known-good previous release? Are there database migrations "
                "that make rollback risky? What is the blast radius of NOT rolling back?"
            ),
            llm=self.llm,
            allow_delegation=False,
        )
        rollback_planner = Agent(
            role="Rollback Plan Generator",
            goal="Produce a safe, step-by-step rollback plan for the Node.js execution engine.",
            backstory=(
                "You translate rollback decisions into concrete, ordered steps. "
                "You follow the release/symlink pattern: repoint symlinks, reload PM2 processes, "
                "and reload nginx. You never suggest deleting the failed release until the rollback "
                "has been verified healthy."
            ),
            llm=self.llm,
            allow_delegation=False,
        )
        return [rollback_analyst, rollback_planner]

    def setup_tasks(self, agents: list[Agent], inputs: dict[str, Any]) -> list[Task]:
        rollback_analyst, rollback_planner = agents

        deployment_json = json.dumps(inputs.get("deployment", {}), default=str)
        previous_release_json = json.dumps(inputs.get("previousRelease", {}), default=str)
        failure_json = json.dumps(inputs.get("failureContext", {}), default=str)

        analysis_task = Task(
            description=(
                "Analyse the failed deployment and assess rollback safety.\n"
                f"Failed deployment:\n{deployment_json}\n"
                f"Previous release:\n{previous_release_json}\n"
                f"Failure context:\n{failure_json}\n"
                "Consider: database migration risk, data schema changes, whether the previous "
                "release is still present on disk, and the failure step."
            ),
            expected_output=(
                "JSON only: {\"rollbackSafe\": true, \"rollbackTarget\": \"...\", "
                "\"riskLevel\": \"low|medium|high\", "
                "\"warnings\": [\"...\"], \"decisionTrace\": [\"...\"]}"
            ),
            agent=rollback_analyst,
        )
        plan_task = Task(
            description=(
                "Produce a concrete rollback execution plan based on the analysis. "
                "Use only the release/symlink pattern. "
                "Never emit raw shell commands — produce named steps for the Node.js engine."
            ),
            expected_output=(
                "JSON only: {\"rollbackPlan\": [{\"step\": \"repoint-symlink\", "
                "\"component\": \"api\", \"targetPath\": \"...\", \"action\": \"...\"}], "
                "\"postRollbackVerification\": [{\"check\": \"health-check\", \"component\": \"api\"}], "
                "\"estimatedDurationSeconds\": 30}"
            ),
            agent=rollback_planner,
            context=[analysis_task],
        )
        return [analysis_task, plan_task]
