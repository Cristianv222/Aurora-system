from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

# Crear el router para los ViewSets
router = DefaultRouter()

# Registrar los ViewSets (cuando se implementen)
# router.register(r'reservations', views.ReservationViewSet, basename='reservation')

# URLs
urlpatterns = [
    # Health check
    path('health/', lambda request: HttpResponse('OK'), name='health-check'),
    
    # Incluir las rutas del router
    path('', include(router.urls)),
]

from django.http import HttpResponse
