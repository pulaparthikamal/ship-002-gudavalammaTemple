from __future__ import annotations
from typing import Any
from crewai import Agent, Task
from .base import BaseCrew
from .registry import register_crew

@register_crew("linkedin_trends")
class LinkedInCrew(BaseCrew):
    """
    Crew designed to research AI market trends and generate LinkedIn content with image prompts.
    """
    def setup_agents(self, inputs: dict[str, Any]) -> list[Agent]:
        researcher = Agent(
            role="AI Market Analyst",
            goal="Identify the most impactful AI advancements from the last 48 hours.",
            backstory=(
                "You are an expert in the AI market. You sift through news, research papers, "
                "and company announcements to find what actually matters to business leaders."
            ),
            llm=self.llm,
            allow_delegation=False,
        )

        copywriter = Agent(
            role="LinkedIn Growth Specialist",
            goal="Craft viral, high-engagement LinkedIn posts based on AI trends.",
            backstory=(
                "You know exactly how to write for LinkedIn. You use white space, punchy hooks, "
                "and actionable takeaways to ensure the AI news resonates with a professional audience."
            ),
            llm=self.llm,
            allow_delegation=False,
        )

        visualizer = Agent(
            role="Digital Artist & Prompt Engineer",
            goal="Create hyper-realistic and symbolic image prompts for AI generation.",
            backstory=(
                "You translate complex AI topics into visual metaphors. You generate detailed "
                "prompts for models like DALL-E 3 or Midjourney to create stunning cover images."
            ),
            llm=self.llm,
            allow_delegation=False,
        )

        return [researcher, copywriter, visualizer]

    def setup_tasks(self, agents: list[Agent], inputs: dict[str, Any]) -> list[Task]:
        researcher, copywriter, visualizer = agents
        research_bundle = inputs.get("research")

        research_task = Task(
            description=(
                "Analyze the provided research material to find the top 3 AI trends or "
                "breakthroughs. Focus on market impact and business utility.\n\n"
                f"Source Data:\n{research_bundle.research_text}"
            ),
            expected_output="A summary of the 3 most important AI advancements found.",
            agent=researcher,
        )

        copywriting_task = Task(
            description=(
                "Based on the research, write a LinkedIn post. Requirements:\n"
                "- 1 strong hook line\n"
                "- Bullet points for the 3 advancements\n"
                "- A 'Why this matters' section\n"
                "- 2 relevant questions to encourage comments\n"
                "- Relevant hashtags"
            ),
            expected_output="A full LinkedIn post draft.",
            agent=copywriter,
            context=[research_task],
        )

        visualization_task = Task(
            description=(
                "Create a high-quality DALL-E 3 prompt that visually represents the core "
                "theme of the LinkedIn post. Avoid text in the image. Use a professional, "
                "futuristic, and clean aesthetic."
            ),
            expected_output=(
                "Provide the final output in the following format:\n"
                "TITLE: <post title>\n"
                "SUMMARY: <post summary>\n"
                "CONTENT: <linkedIn post text>\n"
                "HASHTAGS: <hashtags>\n"
                "IMAGE_PROMPT: <the detailed d-alle prompt>\n"
            ),
            agent=visualizer,
            context=[copywriting_task],
        )

        return [research_task, copywriting_task, visualization_task]
