from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

# Crear el router para los ViewSets
router = DefaultRouter()

# Registrar los ViewSets
router.register(r'orders', views.OrderViewSet, basename='order')
router.register(r'deliveries', views.DeliveryInfoViewSet, basename='delivery')

# URLs
urlpatterns = [
    # Health check
    path('health/', views.health_check, name='health-check'),
    
    # Incluir las rutas del router
    path('', include(router.urls)),
]