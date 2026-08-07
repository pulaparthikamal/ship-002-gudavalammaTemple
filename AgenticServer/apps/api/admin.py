from django.contrib import admin
from .models import GenerationHistory

@admin.register(GenerationHistory)
class GenerationHistoryAdmin(admin.ModelAdmin):
    list_display = ('topic', 'crew_type', 'llm_provider', 'created_at', 'status')
    list_filter = ('crew_type', 'llm_provider', 'status')
    search_fields = ('topic', 'title', 'request_id')
    readonly_fields = ('request_id', 'created_at', 'execution_time_seconds')
    
    fieldsets = (
        ('Request Info', {
            'fields': ('request_id', 'topic', 'crew_type', 'status')
        }),
        ('AI Results', {
            'fields': ('title', 'summary', 'content')
        }),
        ('Engineering Metadata', {
            'fields': ('llm_provider', 'llm_model', 'execution_time_seconds', 'created_at', 'error_message')
        }),
    )
