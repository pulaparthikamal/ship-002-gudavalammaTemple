from __future__ import annotations

import json
from typing import Any

from crewai import Agent, Task

from .base import BaseCrew
from .registry import register_crew


@register_crew("predictive_maintenance")
class PredictiveMaintenanceCrew(BaseCrew):
    """
    CrewAI setup for predictive server maintenance and anomaly detection.
    """

    def setup_agents(self, inputs: dict[str, Any]) -> list[Agent]:
        analyst = Agent(
            role="Metrics Analyst",
            goal="Analyze recent system metrics, identify anomalies, memory leaks, disk I/O saturation, and CPU bottlenecks.",
            backstory=(
                "You are an expert system administrator who monitors server health. You look for trends in load, memory usage, and disk space."
            ),
            llm=self.llm,
            allow_delegation=False,
        )
        predictor = Agent(
            role="Predictive SRE",
            goal="Predict when intervention or cleanup is needed before server failure.",
            backstory=(
                "You are a predictive site reliability engineer. You anticipate server failure by looking at current metrics and log volume patterns."
            ),
            llm=self.llm,
            allow_delegation=False,
        )
        advisor = Agent(
            role="Maintenance Advisor",
            goal="Formulate actionable recommendations to prevent server downtime.",
            backstory=(
                "You are a pragmatic advisor. You convert complex metric analysis into simple, actionable steps for a human administrator."
            ),
            llm=self.llm,
            allow_delegation=False,
        )
        return [analyst, predictor, advisor]

    def setup_tasks(self, agents: list[Agent], inputs: dict[str, Any]) -> list[Task]:
        analyst, predictor, advisor = agents
        metrics_json = json.dumps(inputs.get("metrics", []), default=str)

        analyst_task = Task(
            description=(
                f"Review the following recent system metrics and identify any anomalies or bottlenecks.\nMetrics:\n{metrics_json}"
            ),
            expected_output="A summary of identified anomalies and bottlenecks.",
            agent=analyst,
        )
        predictor_task = Task(
            description=(
                "Based on the identified anomalies, predict what components will fail and when, if no action is taken."
            ),
            expected_output="A timeline of predicted failures.",
            agent=predictor,
            context=[analyst_task],
        )
        advisor_task = Task(
            description=(
                "Based on the predicted failures, propose concrete, actionable recommendations for server maintenance. "
                "Output MUST be strict JSON in this format: "
                "{\"predictions\":[{\"issue\":\"...\",\"predictedFailure\":\"...\",\"recommendation\":\"...\",\"severity\":\"high/medium/low\",\"affectedComponents\":[\"...\"],\"timeframe\":\"...\",\"horizonMinutes\":30,\"confidence\":0.9,\"evidence\":[\"...\"],\"recommendedActions\":[\"...\"]}]}"
            ),
            expected_output="JSON containing predictions and recommendations.",
            agent=advisor,
            context=[predictor_task],
        )
        return [analyst_task, predictor_task, advisor_task]
