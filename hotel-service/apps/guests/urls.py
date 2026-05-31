from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import GuestViewSet

router = DefaultRouter()
router.register('', GuestViewSet, basename='guest')

urlpatterns = [
    path('', include(router.urls)),
]
