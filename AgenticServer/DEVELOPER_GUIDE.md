# 🚀 Junior Developer's Guide: Building your first AI Crew

Welcome! This guide is designed to help you build your own AI Agent team (called a "Crew") even if you are new to coding.

---

## 🏛️ 1. The Big Picture: What is a "Crew"?
Think of a **Crew** as a small digital department in your company. 
*   **Agents** = The Employees (Researcher, Writer, Analyst).
*   **Tasks** = The Work Orders (Jira tickets or specific instructions).
*   **Process** = How they talk to each other (Sequential or Parallel).

---

## 📂 2. Your "Cheat Sheet" File Map

| If you want to... | Go to this folder | Why? |
| :--- | :--- | :--- |
| **Create a new agent team** | `apps/agents/crewai/crews/` | This is where the Python logic lives. |
| **Change the settings** | `config/settings.py` | This is where LLM keys and models are set. |
| **See past agent results** | Visit `http://localhost:8000/admin` | This is your history dashboard. |

---

## 🛠️ 3. Tutorial: Creating your first Crew (Step-by-Step)

Follow these 4 simple steps to create a new AI team.

### Step 1: Create a new file
Go to `apps/agents/crewai/crews/` and create a file named `my_first_crew.py`.

### Step 2: Paste the Template
Copy and paste this code. It is the "skeleton" of every crew:

```python
from crewai import Agent, Task
from .base import BaseCrew           # The core engine
from .registry import register_crew  # The auto-registration tool

@register_crew("my_team")  # <--- THIS IS THE NAME YOU WILL CALL FROM THE API
class MyFirstCrew(BaseCrew):
    
    # --- PART 1: Define the People ---
    def setup_agents(self, inputs):
        """Creates the 'workers' for or your team."""
        researcher = Agent(
            role="Data Detective",
            goal="Find 3 cool statistics about {topic}",
            backstory="You are a veteran researcher who never misses a detail.",
            llm=self.llm  # This connects the agent to OpenAI/Ollama
        )
        return [researcher]

    # --- PART 2: Define the Work ---
    def setup_tasks(self, agents, inputs):
        """Creates the 'assignments' for your workers."""
        work_order = Task(
            description="Browse the web and find 3 stats about {topic}.",
            expected_output="A bulleted list of 3 stats with sources.",
            agent=agents[0] # Assign this task to the 'Data Detective'
        )
        return [work_order]
```

### Step 3: Understand the Functions
1.  **`@register_crew("my_team")`**: This is like a "Hello, my name is..." tag. It tells the API that this crew exists.
2.  **`setup_agents(self, inputs)`**: Use this to define the **Job Title** (role) and **Mission** (goal) of your AI.
3.  **`setup_tasks(self, agents, inputs)`**: Use this to write the **Instructions** (description) and the **Final Product** (expected_output).

### Step 4: Run it!
To trigger your new team, send a request to the API (using Postman or n8n):
*   **URL**: `POST http://localhost:8000/api/v1/content/generate`
*   **Body (JSON)**:
    ```json
    {
      "topic": "Space Travel",
      "crew_type": "my_team"
    }
    ```

---

## ⚡ 4. Advanced: Serial vs. Parallel Execution
*   **Serial (Step-by-Step)**: By default, tasks run one after another.
*   **Parallel (Simultaneous)**: If you want a task to run instantly alongside others, add `async_execution=True` to that Task.

*Example of a Parallel Task:*
```python
Task(
    description="Do this fast!",
    expected_output="Finished work",
    agent=agents[0],
    async_execution=True # <--- Turns on Parallel mode
)
```

---

## 📊 5. How to see if it's working
Look at or your Terminal. You will see:
1.  `INFO [...] Received generation request`: Your API call was heard.
2.  `INFO [...] Starting CrewAI execution`: Your agents have started thinking.
3.  `INFO [...] CrewAI execution completed`: Your result is ready!

**Congratulations! You are now an AI Orchestrator.**
