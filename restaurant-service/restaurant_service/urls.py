from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/menu/', include('apps.menu.urls')),
    path('api/tables/', include('apps.tables.urls')),
    path('api/reservations/', include('apps.reservations.urls')),
    path('api/pos/', include('apps.pos.urls')),
    path('api/orders/', include('apps.orders.urls')),
    path('api/payments/', include('apps.payments.urls')),
    path('api/kitchen/', include('apps.kitchen.urls')),
    path('api/printer/', include('apps.printer.urls')),
    path('api/customers/', include('apps.customers.urls')),
    path('api/reports/', include('apps.reports.urls')),
]
