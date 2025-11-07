from django.apps import AppConfig

class DocsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'docs'

    def ready(self):
        # Import signal handlers
        from . import signals  # noqa: F401
