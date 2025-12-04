from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

# Crear el router para los ViewSets
router = DefaultRouter()

# Registrar los ViewSets
router.register(r'currencies', views.CurrencyViewSet, basename='currency')
router.register(r'exchange-rates', views.ExchangeRateViewSet, basename='exchangerate')
router.register(r'payment-methods', views.PaymentMethodViewSet, basename='paymentmethod')
router.register(r'payments', views.PaymentViewSet, basename='payment')
router.register(r'refunds', views.RefundViewSet, basename='refund')
router.register(r'cash-registers', views.CashRegisterViewSet, basename='cashregister')
router.register(r'cash-movements', views.CashMovementViewSet, basename='cashmovement')

# URLs
urlpatterns = [
    # Health check
    path('health/', views.health_check, name='health-check'),
    
    # Incluir las rutas del router
    path('', include(router.urls)),
]