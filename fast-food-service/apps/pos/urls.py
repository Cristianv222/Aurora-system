"""
apps/pos/urls.py

URLs para el módulo POS - Versión simplificada
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    ShiftViewSet,
    DiscountViewSet,
    TableViewSet,
    DailySummaryViewSet,
)

# Router para los ViewSets
router = DefaultRouter()

# ViewSets para operaciones POS
router.register(r'shifts', ShiftViewSet, basename='shift')
router.register(r'discounts', DiscountViewSet, basename='discount')
router.register(r'tables', TableViewSet, basename='table')
router.register(r'daily-summaries', DailySummaryViewSet, basename='daily-summary')

urlpatterns = [
    path('', include(router.urls)),
]