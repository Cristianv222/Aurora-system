from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/email/', include('apps.email.urls')),
    path('api/sms/', include('apps.sms.urls')),
    path('api/push/', include('apps.push.urls')),
]
