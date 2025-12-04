from django.urls import path
from . import views

urlpatterns = [
    path('health/', views.health_check, name='health'),
    path('test-auth/', views.test_auth_view, name='test-auth'),
]