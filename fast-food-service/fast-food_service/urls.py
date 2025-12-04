from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/menu/', include('apps.menu.urls')),
    path('api/pos/', include('apps.pos.urls')),
    path('api/orders/', include('apps.orders.urls')),
    path('api/payments/', include('apps.payments.urls')),
    path('api/kitchen/', include('apps.kitchen.urls')),
    path('api/printer/', include('apps.printer.urls')),
    path('api/customers/', include('apps.customers.urls')),
    path('api/reports/', include('apps.reports.urls')),
]

from django.conf import settings
from django.conf.urls.static import static

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
