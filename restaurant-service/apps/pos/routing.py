from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r'^ws/restaurant/reports/$', consumers.ReportsConsumer.as_asgi()),
    re_path(r'^ws/reports/$', consumers.ReportsConsumer.as_asgi()),
]
