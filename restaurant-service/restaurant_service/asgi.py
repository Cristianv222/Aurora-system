import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from channels.security.websocket import AllowedHostsOriginValidator

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'restaurant_service.settings')
django_asgi_app = get_asgi_application()

import apps.inventory.routing
import apps.pos.routing

combined_websocket_urlpatterns = (
    apps.inventory.routing.websocket_urlpatterns +
    apps.pos.routing.websocket_urlpatterns
)

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": AuthMiddlewareStack(
        URLRouter(
            combined_websocket_urlpatterns
        )
    ),
})
