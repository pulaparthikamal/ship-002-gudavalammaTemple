from django.db import models
from django.utils.timezone import now

class GenerationHistory(models.Model):
    """
    Industry-standard tracking for agentic workflows.
    Stores metadata and results for audit and observability.
    """
    request_id = models.CharField(max_length=100, unique=True, db_index=True)
    topic = models.CharField(max_length=500)
    crew_type = models.CharField(max_length=100)
    title = models.CharField(max_length=500, blank=True, null=True)
    summary = models.TextField(blank=True, null=True)
    content = models.TextField(blank=True, null=True)
    
    # Metadata
    llm_provider = models.CharField(max_length=50)
    llm_model = models.CharField(max_length=100)
    created_at = models.DateTimeField(default=now)
    execution_time_seconds = models.FloatField(default=0.0)
    status = models.CharField(max_length=20, default="success")
    error_message = models.TextField(blank=True, null=True)

    class Meta:
        verbose_name_plural = "Generation Histories"
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.topic} ({self.crew_type}) - {self.request_id[:8]}"
