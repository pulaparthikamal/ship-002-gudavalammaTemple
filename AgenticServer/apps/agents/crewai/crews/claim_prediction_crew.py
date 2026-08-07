from typing import Any
from django.conf import settings
from crewai import Agent, Task, Process
from .base import BaseCrew
from .registry import register_crew

@register_crew("claim_prediction")
class ClaimPredictionCrew(BaseCrew):
    """
    Crew for predicting claim allowed and paid amounts.
    """
    def __init__(self, service_settings=None) -> None:
        super().__init__(service_settings, process_type=Process.sequential)
        self.agents_config = self._load_config("agents.yaml")
        self.tasks_config = self._load_config("tasks.yaml")

    def setup_agents(self, inputs: dict[str, Any]) -> list[Agent]:
        analyst = Agent(
            config=self.agents_config['claim_analyst'],
            llm=self.llm,
            verbose=getattr(settings, "CREWAI_VERBOSE", False),
            allow_delegation=False
        )
        return [analyst]

    def setup_tasks(self, agents: list[Agent], inputs: dict[str, Any]) -> list[Task]:
        # Format the task description with inputs
        historical = inputs.get('request', {}).metadata.get('historical', {})
        topic = inputs.get('request', {}).topic
        research_text = inputs.get('research', {}).research_text

        task = Task(
            config=self.tasks_config['prediction_task'],
            agent=agents[0]
        )
        # Manually override description to include context if needed, 
        # but CrewAI usually handles this via {topic} in config if passed in inputs
        return [task]

    def run(self, inputs: dict[str, Any]) -> Any:
        """Kicks off the crew execution."""
        agents = self.setup_agents(inputs)
        tasks = self.setup_tasks(agents, inputs)
        
        # Prepare inputs for the crew
        crew_inputs = {
            "topic": inputs.get('request').topic,
            "historical_stats": inputs.get('request').metadata.get('historical', {}),
            "research_text": inputs.get('research').research_text,
            "audience": inputs.get('request').audience,
            "tone": inputs.get('request').tone
        }
        
        from crewai import Crew
        crew = Crew(
            agents=agents,
            tasks=tasks,
            process=self.process_type,
            verbose=getattr(settings, "CREWAI_VERBOSE", False),
        )
        return crew.kickoff(inputs=crew_inputs)
