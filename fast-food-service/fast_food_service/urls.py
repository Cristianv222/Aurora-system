from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('fast-food/admin/', admin.site.urls),
    path('fast-food/api/menu/', include('apps.menu.urls')),
    path('fast-food/api/pos/', include('apps.pos.urls')),
    path('fast-food/api/orders/', include('apps.orders.urls')),
    path('fast-food/api/payments/', include('apps.payments.urls')),
    path('fast-food/api/kitchen/', include('apps.kitchen.urls')),
    path('fast-food/api/hardware/', include('apps.printer.urls')),
    path('fast-food/api/customers/', include('apps.customers.urls')),
    path('fast-food/api/reports/', include('apps.reports.urls')),
]

from django.conf import settings
from django.conf.urls.static import static

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
