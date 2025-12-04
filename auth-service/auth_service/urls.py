from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/authentication/', include('apps.authentication.urls')),
    path('api/users/', include('apps.users.urls')),
    path('api/', include('apps.roles.urls')),  # Incluye /roles/ y /permissions/
]