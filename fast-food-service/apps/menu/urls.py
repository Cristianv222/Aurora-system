from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

# Crear el router para los ViewSets
router = DefaultRouter()

# Registrar los ViewSets
router.register(r'categories', views.CategoryViewSet, basename='category')
router.register(r'products', views.ProductViewSet, basename='product')
router.register(r'sizes', views.SizeViewSet, basename='size')
router.register(r'extras', views.ExtraViewSet, basename='extra')
router.register(r'combos', views.ComboViewSet, basename='combo')
router.register(r'menu', views.MenuViewSet, basename='menu')

# URLs
urlpatterns = [
    # Health check y test endpoints
    path('health/', views.health_check, name='health-check'),
    path('test-auth/', views.test_auth_view, name='test-auth'),
    path('test-staff/', views.test_staff_view, name='test-staff'),
    
    # Incluir las rutas del router
    path('', include(router.urls)),
]