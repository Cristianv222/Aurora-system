from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('auth/admin/', admin.site.urls),
    path('auth/api/authentication/', include('apps.authentication.urls')),
    path('auth/api/users/', include('apps.users.urls')),
    path('auth/api/', include('apps.roles.urls')),  # Incluye /roles/ y /permissions/
]
