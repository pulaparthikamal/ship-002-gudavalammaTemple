"""
Custom management command to display startup information
This will be run after the server starts via a signal handler
"""
import logging
import os
from django.conf import settings

logger = logging.getLogger("django")


def display_startup_info(port="8007", host="127.0.0.1"):
    """Display server startup information"""
    # Convert 127.0.0.1 to localhost for display
    display_host = "localhost" if host == "127.0.0.1" else host
    
    startup_message = f"""
{'='*70}
🚀 AGENTIC SERVER - STARTED SUCCESSFULLY
{'='*70}

📍 Server is running on: http://{display_host}:{port}

🔗 API Available at:
   - Base URL: http://{display_host}:{port}/api/v1/
   - Health Check: http://{display_host}:{port}/api/v1/health
   - Generate Content: http://{display_host}:{port}/api/v1/content/generate

🛠️  Admin Panel: http://{display_host}:{port}/admin/

⚙️  Configuration:
   - LLM Provider: {settings.LLM_PROVIDER}
   - LLM Model: {settings.LLM_MODEL or 'Default'}
   - Debug Mode: {settings.DEBUG}
   - Allowed Hosts: {', '.join(settings.ALLOWED_HOSTS)}

📊 API Calls will be logged in the terminal as they happen.

💡 To run on all interfaces use: python manage.py runserver 0.0.0.0:{port}

{'='*70}
"""
    logger.info(startup_message)
    print(startup_message)
