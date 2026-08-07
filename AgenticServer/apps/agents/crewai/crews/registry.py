from __future__ import annotations
from typing import Type, Dict
import importlib
import pkgutil
import os

# Registry of available crews
CREW_REGISTRY: Dict[str, Type['BaseCrew']] = {}

def register_crew(name: str):
    """Decorator to register a crew class in the global registry."""
    def decorator(cls):
        CREW_REGISTRY[name.lower()] = cls
        return cls
    return decorator

def get_crew_class(crew_type: str) -> Type['BaseCrew']:
    """Returns the Class for the requested crew type, with auto-discovery."""
    # Ensure all modules in this package are imported so decorators are executed
    _discover_crews()
    
    from .content_crew import ContentCrew # Default fallback
    return CREW_REGISTRY.get(crew_type.lower(), ContentCrew)

def _discover_crews():
    """Automatically imports all modules in the crews directory to register decorated classes."""
    package_dir = os.path.dirname(__file__)
    for _, module_name, _ in pkgutil.iter_modules([package_dir]):
        if module_name not in ['base', 'registry']:
            importlib.import_module(f'.{module_name}', package=__package__)
