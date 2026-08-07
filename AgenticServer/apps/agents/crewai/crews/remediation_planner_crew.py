from __future__ import annotations

import json
from typing import Any

from crewai import Agent, Task

from .base import BaseCrew
from .registry import register_crew


@register_crew("remediation_planner")
class RemediationPlannerCrew(BaseCrew):
    """
    LLM planner for server remediation.

    The crew only produces a structured tool plan. The Node server remains the
    execution and policy boundary.
    """

    def setup_agents(self, inputs: dict[str, Any]) -> list[Agent]:
        planner = Agent(
            role="Server Remediation Planner",
            goal="Choose the safest sequence of approved remediation tools for the stated intent.",
            backstory=(
                "You are a cautious SRE planner. You never invent tools, never emit shell "
                "commands, and always prefer diagnostics before destructive steps."
            ),
            llm=self.llm,
            allow_delegation=False,
        )
        return [planner]

    def setup_tasks(self, agents: list[Agent], inputs: dict[str, Any]) -> list[Task]:
        planner = agents[0]
        tools_json = json.dumps(inputs.get("tools", []), default=str)
        context_json = json.dumps(inputs.get("context", {}), default=str)

        plan_task = Task(
            description=(
                f"User intent: {inputs.get('intent', '')}\n"
                "Use only the provided tools. Prefer collecting metrics and health checks "
                "before risky actions. Never output shell commands.\n"
                f"Available tools:\n{tools_json}\n"
                f"Server context:\n{context_json}"
            ),
            expected_output=(
                "JSON only with this shape: "
                "{\"goal\":\"...\",\"summary\":\"...\",\"target\":\"...\",\"description\":\"...\","
                "\"planner\":\"crewai_remediation_planner\",\"decisionTrace\":[\"...\"],"
                "\"riskLevel\":\"low|medium|high|critical\",\"requiresApproval\":true,"
                "\"steps\":[{\"toolName\":\"collect_metrics\",\"args\":{},\"reasoning\":\"...\"}],"
                "\"rollbackSteps\":[],\"contextSnapshot\":{}}"
            ),
            agent=planner,
        )
        return [plan_task]
