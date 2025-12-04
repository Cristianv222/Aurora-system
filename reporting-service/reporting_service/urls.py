from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/consolidation/', include('apps.consolidation.urls')),
    path('api/analytics/', include('apps.analytics.urls')),
    path('api/dashboards/', include('apps.dashboards.urls')),
    path('api/integrations/', include('apps.integrations.urls')),
    path('api/exports/', include('apps.exports.urls')),
]
