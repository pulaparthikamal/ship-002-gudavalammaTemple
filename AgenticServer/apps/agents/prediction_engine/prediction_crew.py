from __future__ import annotations

import json
from typing import Any

from crewai import Agent, Task

from agents.crewai.crews.base import BaseCrew


class PredictionCrew(BaseCrew):
    """LLM validator for explanations only; detection remains deterministic."""

    def setup_agents(self, inputs: dict[str, Any]) -> list[Agent]:
        return [
            Agent(
                role="Prediction Explanation Validator",
                goal="Validate failure prediction explanations without adding remediation or commands.",
                backstory="You are a conservative SRE reviewer. You only explain evidence and uncertainty.",
                llm=self.llm,
                allow_delegation=False,
            )
        ]

    def setup_tasks(self, agents: list[Agent], inputs: dict[str, Any]) -> list[Task]:
        payload_json = json.dumps(inputs, default=str)
        return [
            Task(
                description=(
                    "Review this deterministic prediction JSON. Do not change detection outcomes. "
                    "Only refine rootCauseAnalysis text if evidence supports it. "
                    "Return strict JSON with the same top-level keys and no remediation commands.\n"
                    f"{payload_json}"
                ),
                expected_output="Strict JSON only, same schema as input.",
                agent=agents[0],
            )
        ]
