from django.urls import re_path
from .consumers import InvoiceConsumer

websocket_urlpatterns = [
    re_path(r'^ws/invoice/(?P<reservation_id>[^/]+)/$', InvoiceConsumer.as_asgi()),
]
