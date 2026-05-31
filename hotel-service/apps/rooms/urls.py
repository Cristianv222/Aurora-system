from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import FloorViewSet, RoomViewSet

router = DefaultRouter()
router.register('floors', FloorViewSet, basename='floor')
router.register('rooms', RoomViewSet, basename='room')

urlpatterns = [
    path('', include(router.urls)),
]
