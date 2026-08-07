from typing import Any
from crewai import Agent, Task
from .base import BaseCrew
from .registry import register_crew

@register_crew("dynamic")
class DynamicCrew(BaseCrew):
    """
    A Crew that is fully driven by YAML configuration.
    This makes it extremely easy to add dozens of new agents without changing Python code.
    """
    
    def setup_agents(self, inputs: dict[str, Any]) -> list[Agent]:
        # Load agents config
        agents_config = self._load_config("agents.yaml")
        
        # We can dynamically create agents based on the config
        # For simplicity, we just create the 'writer', 'reviewer', 'optimizer' defined in the YAML
        agents = []
        for agent_id, config in agents_config.items():
            # Apply variable interpolation (e.g., {topic})
            role = config['role'].format(**self._get_template_vars(inputs))
            goal = config['goal'].format(**self._get_template_vars(inputs))
            backstory = config['backstory'].format(**self._get_template_vars(inputs))
            
            agents.append(Agent(
                role=role,
                goal=goal,
                backstory=backstory,
                llm=self.llm,
                allow_delegation=False
            ))
        return agents

    def setup_tasks(self, agents: list[Agent], inputs: dict[str, Any]) -> list[Task]:
        # Load tasks config
        tasks_config = self._load_config("tasks.yaml")
        
        # Map agents by role/ID for task assignment
        agent_map = {a.role.split(' ')[0].lower(): a for a in agents} # Simple mapping
        
        tasks = []
        for task_id, config in tasks_config.items():
            # Resolve the agent
            agent_key = config.get('agent', 'writer')
            agent = agent_map.get(agent_key, agents[0])
            
            description = config['description'].format(**self._get_template_vars(inputs))
            expected_output = config['expected_output'].format(**self._get_template_vars(inputs))
            
            tasks.append(Task(
                description=description,
                expected_output=expected_output,
                agent=agent
            ))
        return tasks

    def _get_template_vars(self, inputs: dict[str, Any]) -> dict[str, Any]:
        """Provides variables for string formatting in YAML."""
        request = inputs.get("request")
        research = inputs.get("research")
        
        return {
            "topic": research.topic if research else "General Topic",
            "research_text": research.research_text if research else "",
            "audience": request.audience if request else "Business Professionals",
            "tone": request.tone if request else "Balanced",
            "brand_voice": request.brand_voice if request else "Standard",
            "call_to_action": request.call_to_action if request else "Learn more.",
            "platform": "General Platform"  # Default fallback
        }
