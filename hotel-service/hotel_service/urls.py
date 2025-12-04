from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/rooms/', include('apps.rooms.urls')),
    path('api/reservations/', include('apps.reservations.urls')),
    path('api/checkin/', include('apps.checkin.urls')),
    path('api/guests/', include('apps.guests.urls')),
    path('api/services/', include('apps.services.urls')),
    path('api/reports/', include('apps.reports.urls')),
]
