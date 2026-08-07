from abc import ABC, abstractmethod
from typing import Any
import yaml
import os
from pathlib import Path
from django.conf import settings
from crewai import Agent, Crew, LLM, Process, Task

class BaseCrew(ABC):
    """
    Abstract base class for all Agentic Crews.
    Provides shared LLM initialization and execution logic.
    """
    def __init__(self, service_settings=None, process_type: Process = Process.sequential, api_key: str | None = None, provider: str | None = None, model: str | None = None, base_url: str | None = None) -> None:
        # service_settings is kept for backward compat if called from legacy paths
        self.api_key_override = api_key
        self.provider_override = provider
        self.model_override = model
        self.base_url_override = base_url
        self.llm = self._build_llm()
        self.config_dir = Path(__file__).resolve().parent.parent / "config"
        self.process_type = process_type

    def _load_config(self, filename: str) -> dict[str, Any]:
        """Loads a YAML configuration file from the config directory."""
        config_path = self.config_dir / filename
        if not config_path.exists():
            return {}
        with open(config_path, 'r') as f:
            return yaml.safe_load(f)

    @abstractmethod
    def setup_agents(self, inputs: dict[str, Any]) -> list[Agent]:
        """Define and return a list of Agents for this crew."""
        pass

    @abstractmethod
    def setup_tasks(self, agents: list[Agent], inputs: dict[str, Any]) -> list[Task]:
        """Define and return a list of Tasks for this crew."""
        pass

    def run(self, inputs: dict[str, Any]) -> Any:
        """Kicks off the crew execution."""
        agents = self.setup_agents(inputs)
        tasks = self.setup_tasks(agents, inputs)
        
        crew = Crew(
            agents=agents,
            tasks=tasks,
            process=self.process_type,
            verbose=getattr(settings, "CREWAI_VERBOSE", False),
        )
        result = crew.kickoff()
        return result

    def _build_llm(self) -> LLM:
        """Default LLM builder based on global settings."""
        return self._get_llm_for_model(self.model_override or settings.LLM_MODEL)

    def _get_llm_for_model(self, model_name: str | None) -> LLM:
        """Builds an LLM instance for a specific model name."""
        provider = self.provider_override or settings.LLM_PROVIDER
        
        if provider == "openai":
            model = model_name or "gpt-4o-mini"
            kwargs = {
                "model": model,
                "temperature": settings.OLLAMA_TEMPERATURE,
            }
            if self.api_key_override:
                kwargs["api_key"] = self.api_key_override
            elif settings.OPENAI_API_KEY:
                kwargs["api_key"] = settings.OPENAI_API_KEY
                
            base_url = self.base_url_override or settings.OPENAI_BASE_URL
            if base_url:
                kwargs["base_url"] = base_url
            return LLM(**kwargs)

        # Ollama configuration
        model = model_name or settings.OLLAMA_MODEL
        # For Ollama, we ensure the model name starts with 'ollama/' 
        # and provide a dummy api_key to satisfy CrewAI's internal checks
        if provider == "ollama" and not model.startswith("ollama/"):
            model = f"ollama/{model}"
            
        return LLM(
            model=model,
            base_url=self.base_url_override or settings.OLLAMA_BASE_URL,
            temperature=settings.OLLAMA_TEMPERATURE,
            api_key=self.api_key_override or "NA"
        )
