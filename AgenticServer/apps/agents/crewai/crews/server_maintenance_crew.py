from __future__ import annotations

import json
from typing import Any

from crewai import Agent, Task

from .base import BaseCrew
from .registry import register_crew


@register_crew("server_maintenance")
class ServerMaintenanceCrew(BaseCrew):
    """
    CrewAI setup for explainable server maintenance decisions.

    The Node SaaS API remains the safety boundary. This crew can advise, but the
    Node execution engine re-checks review state and user configuration before
    any action is run.
    """

    def setup_agents(self, inputs: dict[str, Any]) -> list[Agent]:
        monitor = Agent(
            role="Monitor Agent",
            goal="Interpret system metrics and identify threshold-driven maintenance needs.",
            backstory=(
                "You are a conservative SRE agent. You observe CPU, memory, disk, "
                "and network signals without taking destructive action."
            ),
            llm=self.llm,
            allow_delegation=False,
        )
        classifier = Agent(
            role="Classification Agent",
            goal="Classify files into unused, large, logs, temp, and duplicate categories.",
            backstory=(
                "You specialize in file-system hygiene. You add metadata and avoid "
                "guessing when evidence is insufficient."
            ),
            llm=self.llm,
            allow_delegation=False,
        )
        decision = Agent(
            role="Decision Agent",
            goal="Generate deterministic, explainable maintenance recommendations.",
            backstory=(
                "You respect user configuration above all else. You explain every "
                "recommendation using thresholds, categories, and historical patterns."
            ),
            llm=self.llm,
            allow_delegation=False,
        )
        execution = Agent(
            role="Execution Agent",
            goal="Prepare safe delete, archive, or ignore plans without bypassing review.",
            backstory=(
                "You never execute directly. You produce a clear execution plan that "
                "the Node safety engine can validate."
            ),
            llm=self.llm,
            allow_delegation=False,
        )
        return [monitor, classifier, decision, execution]

    def setup_tasks(self, agents: list[Agent], inputs: dict[str, Any]) -> list[Task]:
        monitor, classifier, decision, execution = agents
        files_json = json.dumps(inputs.get("files", []), default=str)
        config_json = json.dumps(inputs.get("config", {}), default=str)

        monitor_task = Task(
            description=(
                "Review the maintenance context and call out only concrete threshold "
                f"or storage risks.\nConfig:\n{config_json}"
            ),
            expected_output="A concise list of concrete monitoring risks.",
            agent=monitor,
        )
        classification_task = Task(
            description=(
                "Validate the categories already assigned to these files. Do not invent "
                f"files.\nFiles:\n{files_json}"
            ),
            expected_output="A concise classification audit.",
            agent=classifier,
            context=[monitor_task],
        )
        decision_task = Task(
            description=(
                "Create explainable recommendations for each file. Allowed actions are "
                "delete, archive, ignore, or review. Respect config strictly. If config "
                "does not clearly allow delete/archive, choose review or ignore."
            ),
            expected_output=(
                "JSON only: {\"decisions\":[{\"path\":\"...\",\"action\":\"review\","
                "\"confidence\":0.7,\"reason\":\"...\",\"decisionTrace\":[\"...\"]}]}"
            ),
            agent=decision,
            context=[monitor_task, classification_task],
        )
        execution_task = Task(
            description=(
                "Review the JSON decisions and ensure each decision has a reason and "
                "decisionTrace. Do not add commands."
            ),
            expected_output="The same JSON shape, corrected if needed.",
            agent=execution,
            context=[decision_task],
        )
        return [monitor_task, classification_task, decision_task, execution_task]
