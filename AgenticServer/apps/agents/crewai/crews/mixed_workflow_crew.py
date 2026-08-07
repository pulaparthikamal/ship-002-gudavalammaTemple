from crewai import Agent, Task
from .base import BaseCrew
from .registry import register_crew

@register_crew("mixed_example")
class MixedWorkflowCrew(BaseCrew):
    """
    Industry Standard Example: Mixed Parallel & Serial Workflow.
    
    Workflow Pattern: Fan-Out (Parallel) -> Fan-In (Serial/Consolidation)
    """
    def setup_agents(self, inputs):
        # Workers (To run in Parallel)
        self.market_analyst = Agent(
            role="Market Data Analyst",
            goal=f"Extract raw financial data for {inputs.get('topic', 'Topic')}",
            backstory="You are a data crawler specializing in hard numbers.",
            llm=self.llm
        )
        
        self.sentiment_analyst = Agent(
            role="Social Sentiment Analyst",
            goal=f"Gauge public opinion on {inputs.get('topic', 'Topic')}",
            backstory="You are an expert in social psychology and trend mapping.",
            llm=self.llm
        )
        
        # Manager/Consolidator (To run in Serial after workers finish)
        self.writer = Agent(
            role="Chief Editor",
            goal=f"Consolidate all findings into a master report for {inputs.get('topic', 'Topic')}",
            backstory="You are a veteran editor who excels at critical synthesis.",
            llm=self.llm
        )
        
        return [self.market_analyst, self.sentiment_analyst, self.writer]

    def setup_tasks(self, agents, inputs):
        # --- PARALLEL TASKS (Fan-Out) ---
        # These two tasks run simultaneously to save time.
        market_task = Task(
            description=f"Fetch prices and volume for {inputs.get('topic', 'Topic')}.",
            expected_output="A table of market metrics.",
            agent=self.market_analyst,
            async_execution=True  # ⚡ Parallel Execution Mode
        )
        
        sentiment_task = Task(
            description=f"Fetch social sentiment and mentions for {inputs.get('topic', 'Topic')}.",
            expected_output="A sentiment score map.",
            agent=self.sentiment_analyst,
            async_execution=True  # ⚡ Parallel Execution Mode
        )

        # --- SERIAL TASK (Fan-In / Synthesis) ---
        # This task waits for the parallel tasks and combines them.
        summary_task = Task(
            description="Merge the market data and sentiment data into a final analysis.",
            expected_output="A professional 2-page research report.",
            agent=self.writer,
            context=[market_task, sentiment_task]  # 🧩 Merges outputs from previous tasks
        )
        
        return [market_task, sentiment_task, summary_task]
