from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

# Router para viewsets (si usamos viewsets en el futuro)
# router = DefaultRouter()
# router.register(r'customers', views.CustomerViewSet, basename='customer')

urlpatterns = [
    # ========== ENDPOINTS PÚBLICOS ==========
    path('register/', views.register_customer, name='customer-register'),
    path('login/', views.login_customer, name='customer-login'),
    path('verify-email/', views.verify_email, name='verify-email'),
    path('health/', views.health_check, name='health-check'),
    path('info/', views.service_info, name='service-info'),
    
    # ========== ENDPOINTS AUTENTICADOS ==========
    # Perfil del cliente
    path('me/', views.get_customer_profile, name='customer-profile'),
    path('me/', views.update_customer_profile, name='customer-update'),  # PUT/PATCH
    
    # Estadísticas personales
    path('me/stats/', views.get_customer_stats, name='customer-stats'),
    
    # Lealtad
    path('me/loyalty/', views.get_customer_loyalty, name='customer-loyalty'),
    path('me/loyalty/history/', views.get_loyalty_history, name='loyalty-history'),
    
    # Direcciones
    path('me/addresses/', views.get_customer_addresses, name='customer-addresses'),
    path('me/addresses/', views.create_customer_address, name='create-address'),
    path('me/addresses/<uuid:address_id>/', views.customer_address_detail, name='address-detail'),
    path('me/addresses/default/', views.get_default_address, name='default-address'),
    path('me/addresses/default/<str:address_type>/', views.get_default_address, name='default-address-by-type'),
    
    # Dispositivos
    path('me/devices/', views.register_device, name='register-device'),
    path('me/devices/<str:device_token>/', views.unregister_device, name='unregister-device'),
    
    # ========== ENDPOINTS DE ADMINISTRADOR ==========
    # Listado y búsqueda
    path('admin/list/', views.admin_customer_list, name='admin-customer-list'),
    path('admin/search/', views.admin_search_customers, name='admin-search'),
    path('admin/stats/', views.admin_customer_stats, name='admin-stats'),
    
    # Operaciones por cliente
    path('admin/<uuid:customer_id>/', views.admin_customer_detail, name='admin-customer-detail'),
    path('admin/<uuid:customer_id>/notes/', views.admin_create_customer_note, name='admin-create-note'),
    path('admin/<uuid:customer_id>/loyalty/add-points/', views.admin_add_loyalty_points, name='admin-add-points'),
]
