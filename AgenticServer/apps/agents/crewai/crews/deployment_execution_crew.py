from __future__ import annotations

import json
from typing import Any

from crewai import Agent, Task

from .base import BaseCrew
from .registry import register_crew


@register_crew("deployment_execution")
class DeploymentExecutionCrew(BaseCrew):
    """
    Deployment execution advisory crew.

    Reviews a deployment-in-progress or a planned pipeline and produces
    step-by-step execution guidance. The Node.js pipeline engine is the
    sole execution authority — this crew produces advisory output only.
    """

    def setup_agents(self, inputs: dict[str, Any]) -> list[Agent]:
        pipeline_planner = Agent(
            role="Pipeline Execution Planner",
            goal="Produce an ordered, context-aware execution plan for each pipeline step.",
            backstory=(
                "You are a deployment automation specialist. You understand the release/symlink "
                "pattern, nvm version management, PM2 lifecycle, and nginx configuration. "
                "You produce concrete, actionable step instructions — never vague advice."
            ),
            llm=self.llm,
            allow_delegation=False,
        )
        safety_reviewer = Agent(
            role="Deployment Safety Reviewer",
            goal="Review the execution plan for unsafe operations and enforce the safety boundary.",
            backstory=(
                "You are the last line of defence before commands reach a production server. "
                "You reject any step that bypasses review gates, skips health checks on API components, "
                "or uses destructive commands without a rollback path."
            ),
            llm=self.llm,
            allow_delegation=False,
        )
        return [pipeline_planner, safety_reviewer]

    def setup_tasks(self, agents: list[Agent], inputs: dict[str, Any]) -> list[Task]:
        pipeline_planner, safety_reviewer = agents

        deployment_json = json.dumps(inputs.get("deployment", {}), default=str)
        steps_json = json.dumps(inputs.get("steps", []), default=str)

        planning_task = Task(
            description=(
                "Review the deployment configuration and produce a step-by-step execution plan.\n"
                f"Deployment context:\n{deployment_json}\n"
                f"Pipeline steps:\n{steps_json}\n"
                "For each step specify: preconditions, the exact action, expected output, "
                "and what to do on failure. Steps must follow the release/symlink pattern."
            ),
            expected_output=(
                "JSON only: {\"executionPlan\": [{\"stepName\": \"...\", \"action\": \"...\", "
                "\"preconditions\": [\"...\"], \"expectedOutput\": \"...\", "
                "\"onFailure\": \"abort|retry|skip\", \"rollbackAction\": \"...\"}]}"
            ),
            agent=pipeline_planner,
        )
        safety_task = Task(
            description=(
                "Audit the execution plan for unsafe operations. Reject plans that: "
                "(1) skip health checks on node-api components, "
                "(2) use rm -rf without a rollback path, "
                "(3) expose credentials in command arguments, "
                "(4) run as root without justification."
            ),
            expected_output=(
                "JSON only: {\"planApproved\": true, "
                "\"violations\": [{\"stepName\": \"...\", \"violation\": \"...\", \"severity\": \"...\"}], "
                "\"decisionTrace\": [\"...\"]}"
            ),
            agent=safety_reviewer,
            context=[planning_task],
        )
        return [planning_task, safety_task]
