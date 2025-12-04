from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/access/', include('apps.access.urls')),
    path('api/pricing/', include('apps.pricing.urls')),
    path('api/customers/', include('apps.customers.urls')),
    path('api/lockers/', include('apps.lockers.urls')),
    path('api/reports/', include('apps.reports.urls')),
]
