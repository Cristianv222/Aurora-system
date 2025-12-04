from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/authentication/', include('apps.authentication.urls')),
    path('api/users/', include('apps.users.urls')),
    path('api/roles/', include('apps.roles.urls')),
]
