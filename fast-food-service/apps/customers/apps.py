from django.apps import AppConfig

class CustomersConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.customers'
    
    def ready(self):
        # Importar señales si las hay
        try:
            import apps.customers.signals
        except ImportError:
            pass