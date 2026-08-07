from __future__ import annotations

import json
from typing import Any

from crewai import Agent, Task

from .base import BaseCrew
from .registry import register_crew


@register_crew("deployment_analysis")
class DeploymentAnalysisCrew(BaseCrew):
    """
    Pre-deployment analysis crew.

    Examines the target server environment, checks existing processes,
    disk space, and potential conflicts before a deployment begins.
    """

    def setup_agents(self, inputs: dict[str, Any]) -> list[Agent]:
        environment_analyst = Agent(
            role="Server Environment Analyst",
            goal="Assess the current server state and identify anything that could block the deployment.",
            backstory=(
                "You are a DevOps engineer who inspects server environments before deployments. "
                "You look for insufficient disk space, port conflicts, conflicting PM2 processes, "
                "missing system dependencies, and incompatible Node versions."
            ),
            llm=self.llm,
            allow_delegation=False,
        )
        dependency_checker = Agent(
            role="Dependency Compatibility Checker",
            goal="Verify that the application's runtime requirements are compatible with the target server.",
            backstory=(
                "You specialise in Node.js version compatibility and npm dependency analysis. "
                "You flag version mismatches, unsupported engine ranges, and missing peer dependencies "
                "before they become production failures."
            ),
            llm=self.llm,
            allow_delegation=False,
        )
        return [environment_analyst, dependency_checker]

    def setup_tasks(self, agents: list[Agent], inputs: dict[str, Any]) -> list[Task]:
        environment_analyst, dependency_checker = agents

        env_json = json.dumps(inputs.get("serverEnvironment", {}), default=str)
        app_json = json.dumps(inputs.get("application", {}), default=str)

        analysis_task = Task(
            description=(
                "Analyse the server environment snapshot for deployment blockers.\n"
                f"Server environment:\n{env_json}\n"
                f"Application requirements:\n{app_json}\n"
                "Check: available disk space vs estimated deploy size, port availability, "
                "existing PM2 processes for this app name, and OS compatibility."
            ),
            expected_output=(
                "JSON only: {\"environmentReady\": true, "
                "\"issues\": [{\"type\": \"disk|port|process|os\", \"severity\": \"low|medium|high\", "
                "\"detail\": \"...\", \"resolution\": \"...\"}], "
                "\"availableDiskGb\": 10.5, \"conflictingProcesses\": []}"
            ),
            agent=environment_analyst,
        )
        dependency_task = Task(
            description=(
                "Check that each component's Node.js version and key dependencies are compatible "
                "with the target server's available runtimes."
            ),
            expected_output=(
                "JSON only: {\"compatible\": true, "
                "\"componentChecks\": [{\"componentKey\": \"...\", \"requiredNode\": \"20\", "
                "\"compatible\": true, \"notes\": \"...\"}]}"
            ),
            agent=dependency_checker,
            context=[analysis_task],
        )
        return [analysis_task, dependency_task]
