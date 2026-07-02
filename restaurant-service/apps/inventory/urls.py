from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import RawMaterialViewSet, RecipeItemViewSet, DailyInventoryViewSet

router = DefaultRouter()
router.register(r'raw-materials', RawMaterialViewSet)
router.register(r'recipe-items', RecipeItemViewSet)
router.register(r'daily-inventory', DailyInventoryViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
