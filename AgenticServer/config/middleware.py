import logging
import json
from django.http import HttpRequest, HttpResponse
from django.utils.deprecation import MiddlewareMixin

logger = logging.getLogger("api.requests")


class APILoggingMiddleware(MiddlewareMixin):
    """Middleware to log all API requests and responses"""

    def process_request(self, request: HttpRequest):
        # Store the request start time
        request._request_start_time = __import__("time").time()
        
        # Log the incoming request
        method = request.method
        path = request.path
        
        logger.info(f"📨 API Request: {method} {path}")
        
        # Log request body if it exists
        if request.method in ["POST", "PUT", "PATCH"]:
            try:
                body = request.body.decode("utf-8")
                if body:
                    logger.debug(f"Request Body: {body}")
            except Exception as e:
                logger.debug(f"Could not parse request body: {e}")

    def process_response(self, request: HttpRequest, response: HttpResponse):
        # Calculate request duration
        if hasattr(request, "_request_start_time"):
            import time
            duration = (time.time() - request._request_start_time) * 1000  # Convert to ms
        else:
            duration = 0

        method = request.method
        path = request.path
        status_code = response.status_code

        # Determine status emoji
        if 200 <= status_code < 300:
            status_emoji = "✅"
        elif 300 <= status_code < 400:
            status_emoji = "🔄"
        elif 400 <= status_code < 500:
            status_emoji = "⚠️"
        else:
            status_emoji = "❌"

        # Log the response
        logger.info(
            f"{status_emoji} API Response: {method} {path} | Status: {status_code} | Duration: {duration:.2f}ms"
        )

        # Log response body if it's JSON
        if response.get("Content-Type", "").startswith("application/json"):
            try:
                if hasattr(response, "streaming_content"):
                    # For streaming responses, we can't log the body
                    logger.debug("Response: (Streaming)")
                else:
                    response_data = response.content.decode("utf-8")
                    if response_data:
                        logger.debug(f"Response Body: {response_data[:500]}")  # Limit to 500 chars
            except Exception as e:
                logger.debug(f"Could not parse response body: {e}")

        return response
