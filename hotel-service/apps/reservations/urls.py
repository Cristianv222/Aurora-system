from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ReservationViewSet, PaymentViewSet, SRIConfigurationViewSet, HotelSettingsViewSet

router = DefaultRouter()
router.register('sri-config', SRIConfigurationViewSet, basename='sri-config')
router.register('hotel-settings', HotelSettingsViewSet, basename='hotel-settings')
router.register('payments', PaymentViewSet, basename='payment')
router.register('', ReservationViewSet, basename='reservation')

urlpatterns = [
    path('', include(router.urls)),
]

