"""
Custom runserver command that displays startup information
"""
import sys
from django.core.management.commands.runserver import Command as BaseCommand
from django.core.management.base import SystemCheckError
from config.startup import display_startup_info


class Command(BaseCommand):
    """Override default runserver command to display startup info"""
    
    def add_arguments(self, parser):
        """Add arguments from parent"""
        super().add_arguments(parser)
    
    def handle(self, *args, **options):
        """Override handle to show startup info before running"""
        # Extract the address port
        addrport = options.get('addrport', '')
        
        # Parse host and port
        if not addrport:
            host = '127.0.0.1'
            port = '8007'
        elif ':' in addrport:
            host, port = addrport.rsplit(':', 1)
        elif addrport.isdigit():
            host = '127.0.0.1'
            port = addrport
        else:
            host = addrport
            port = '8007'
        
        # Display startup info
        display_startup_info(port=port, host=host if host else '127.0.0.1')
        
        # Call parent handle to start server
        try:
            super().handle(*args, **options)
        except SystemCheckError as e:
            print(f"⚠️  System check failed: {e}")
            sys.exit(1)
        except KeyboardInterrupt:
            print("\n\n🛑 Server stopped.")
            sys.exit(0)

