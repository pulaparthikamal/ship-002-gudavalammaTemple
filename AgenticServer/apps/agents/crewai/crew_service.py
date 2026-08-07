from __future__ import annotations
from dataclasses import dataclass
from django.conf import settings
from .parser import parse_final_output
from api.schemas import ContentGenerationRequest, ResearchBundle
from .crews.registry import get_crew_class
from .image_utils import run_html_to_image
from .output_validator import validate_platform_content, run_eligibility_gate
from .prompt_context import public_prompt_context, resolve_prompt_context

@dataclass
class CrewExecutionResult:
    parsed_output: dict[str, object]
    raw_final_output: str
    # These fields can be expanded or made generic if needed
    full_output: str 
    instagram_image_path: str | None = None  # Legacy, single image
    instagram_image_paths: list[str] | None = None
    instagram_slides: list[str] | None = None
class ContentCrewService:
    """
    Generic orchestration service that dispatches requests to specialized Crews.
    """
    def __init__(self, service_settings=None) -> None:
        self.settings = service_settings

    def run(
        self,
        request: ContentGenerationRequest,
        research: ResearchBundle,
    ) -> CrewExecutionResult:
        # 1. Resolve which Crew class to use
        crew_type = request.crew_type
        
        # Auto-switch to OpenAI crew if provider is OpenAI and default crew is selected
        if settings.LLM_PROVIDER == "openai" and crew_type == "content":
            crew_type = "openai_content"
            
        crew_class = get_crew_class(crew_type)
        
        # 2. Instantiate and run the crew
        crew_instance = crew_class(self.settings)
        
        # 3. Prepare contextual inputs for the agents
        inputs = {
            "request": request,
            "research": research,
            "visual_style": "A premium, clean, and modern editorial design with bold typography.",
            "selected_image_path": None,
            "placement_suggestion": None
        }
        
        # 4. Execute
        topic = research.topic if research else "the specified topic"
        platforms = request.platforms if hasattr(request, 'platforms') else []
        prompt_context = resolve_prompt_context(
            topic,
            getattr(request, "audience", "Business and LinkedIn readers"),
            getattr(request, "tone", "Professional, practical, and confident"),
        )
        inputs["prompt_context"] = prompt_context
        
        # Run Eligibility Gate
        run_eligibility_gate(topic, platforms)
        
        crew_output = crew_instance.run(inputs)
        
        # 5. Extract results
        raw_final = str(getattr(crew_output, "raw", "") or str(crew_output)).strip()
        parsed = parse_final_output(raw_final)
        parsed["generation_brief"] = {
            **(
                parsed.get("generation_brief", {})
                if isinstance(parsed.get("generation_brief"), dict)
                else {}
            ),
            **public_prompt_context(prompt_context),
        }
        
        # 5.1 Run Output Validators (Hashtags/CTA)
        parsed = validate_platform_content(parsed, topic, crew_instance, inputs)

        # 6. Generate Instagram Images using Deterministic Templates
        instagram_carousel = parsed.get("instagram_carousel", {})
        instagram_slides = []
        
        # If the LLM returned structured JSON slides, render them using our engine
        if isinstance(instagram_carousel, dict) and "slides" in instagram_carousel:
            from .templates import render_instagram_slides
            instagram_slides = render_instagram_slides(instagram_carousel)
        
        image_paths = []
        for html in instagram_slides:
            if html:
                path = run_html_to_image(html)
                if path:
                    image_paths.append(path)
        
        # Keep legacy compatibility for first image
        primary_image = image_paths[0] if image_paths else None

        return CrewExecutionResult(
            parsed_output=parsed,
            raw_final_output=raw_final,
            full_output=raw_final,
            instagram_image_path=primary_image,
            instagram_image_paths=image_paths,
            instagram_slides=instagram_slides
        )
