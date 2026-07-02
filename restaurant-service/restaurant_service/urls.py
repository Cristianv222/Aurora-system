from django.contrib import admin
from django.urls import path, include

from django.http import JsonResponse

def health_check(request):
    return JsonResponse({"status": "ok"})

urlpatterns = [
    path("health/", health_check),
    path('restaurant/admin/', admin.site.urls),
    path('restaurant/api/menu/', include('apps.menu.urls')),
    path('restaurant/api/tables/', include('apps.tables.urls')),
    path('restaurant/api/reservations/', include('apps.reservations.urls')),
    path('restaurant/api/pos/', include('apps.pos.urls')),
    path('restaurant/api/orders/', include('apps.orders.urls')),
    path('restaurant/api/payments/', include('apps.payments.urls')),
    path('restaurant/api/kitchen/', include('apps.kitchen.urls')),
    path('restaurant/api/hardware/', include('apps.printer.urls')),
    path('restaurant/api/customers/', include('apps.customers.urls')),
    path('restaurant/api/reports/', include('apps.reports.urls')),
    path('restaurant/api/inventory/', include('apps.inventory.urls')),
]

from django.conf import settings
from django.conf.urls.static import static

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
