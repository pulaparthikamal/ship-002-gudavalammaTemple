# 🔗 Agentic Server (Django + CrewAI)

A professional, industry-standard backend for orchestrating **CrewAI** multi-agent systems. Built for scalability, observability, and high-performance automation.

---

## 🚀 PHASE 1: Execution (Choose your path)

### Option A: Using Docker (Professional/Recommended)

Best for production-like consistency and ease of deployment.

```bash
# 1. Build and Start
docker compose up -d --build

# 2. Setup Database (First time only)
docker compose run --rm agent_server python manage.py migrate

# 3. Watch Agents Thinking
docker compose logs -f agent_server
```

### Option B: Running Locally (Non-Docker)

Best for fast iteration and local experimentation.

```bash
# 1. Navigate to AgenticServer
cd AgenticServer

# 2. Create and activate virtual environment (first time only)
python3 -m venv venv
source venv/bin/activate  # On Mac/Linux
# or on Windows: venv\Scripts\activate

# 3. Environment Configuration
# Create .env file with your OPENAI_API_KEY and OLLAMA_BASE_URL

# 4. Install Dependencies

pip install -r requirements.txt
   or


# Using the new seamless workflow automatcally save the installed packages to requirements.txt and install them  :
      make install

      # 5. Dependency Management (Automatic Update)
      # To install a new library and automatically add it to requirements.txt:
      make add PKG=library_name

      # To manually sync requirements.txt with your current environment:
      make freeze

# 6. Initialize Database
python manage.py migrate



# 8. Start Server
# For localhost only (your machine):
python manage.py runserver

# For network access (Docker/n8n integration):
python manage.py runserver 0.0.0.0:8007
```

#### ✨ Enhanced Features

- **📊 Live API Logging**: All API requests and responses are automatically logged to the terminal
  - Shows request method, path, status code, and response time
  - Logs API call details with execution time and content metrics
- **🚀 Startup Banner**: Displays server URL, port, and all available endpoints on startup
- **⚡ Debug Information**: Each API call shows execution time, content length, keywords, and sources
- **🔗 Easy Integration**: Terminal output makes debugging with n8n and other services simple

#### 📌 API Endpoints

Once the server is running, you can access:

- **Health Check**: `http://localhost:8007/api/v1/health`
- **Generate Content**: `http://localhost:8007/api/v1/content/generate`
- **Admin Panel**: `http://localhost:8007/admin/`

#### 🌐 Network Access

If running from **n8n or Docker**, use your machine's IP address:

```bash
# Find your machine IP
hostname -I

# Then use in n8n:
# http://192.168.1.64:8007/api/v1/content/generate
```

---

## 📊 PHASE 2: Monitoring & Audit

### 🕒 Generation History

Every time an agent runs, the result is saved internally. You can view these in the **Django Admin**:

1.  **Create Admin User**: `docker compose run --rm agent_server python manage.py createsuperuser`
2.  **Login**: [http://localhost:8007/admin/](http://localhost:8007/admin/)
3.  **Browse History**: View topics, content, execution time, and LLM metadata in the "Generation Histories" section.

## 📂 Project Structure

- **`config/`**: Django system settings & global configurations.
- **`apps/api/`**: API endpoints & request schemas (Django Ninja).
- **`apps/agents/crewai/`**: The core multi-agent engine (Crews, Tools, Logic).
- **`apps/agents/crewai/config/`**: YAML agent/task definitions for scaling.

---

### 📁 Detailed Folder Structure

```text
AgenticServer/
├── config/                 # ⚙️ Django Core
│   ├── settings.py         # Unified Config
│   └── urls.py             # Main Routing
├── apps/
│   ├── api/                # 🌐 Web Layer
│   │   ├── api_v1.py       # Endpoints
│   │   ├── schemas.py      # Data Models
│   │   └── models.py       # History DB
│   └── agents/             # 🧠 Brain Layer
│       └── crewai/
│           ├── crews/      # Agent Classes
│           ├── config/     # YAML Definitions
│           └── tools/      # Custom Powers
├── scripts/                # 🛠️ Helper Scripts
│   └── manage_deps.sh      # Dependency Manager
├── Makefile                # 📜 Task Runner
├── Dockerfile              # 🐳 Packaging
└── docker-compose.yml      # 📦 Orchestration
```
