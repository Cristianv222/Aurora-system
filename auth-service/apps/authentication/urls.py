from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

urlpatterns = [
    # Autenticación
    path('login/', views.CustomTokenObtainPairView.as_view(), name='login'),
    path('register/', views.register_view, name='register'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('logout/', views.logout_view, name='logout'),
    
    # Verificación de token
    path('verify-token/', views.verify_token_view, name='verify_token'),
    
    # Usuario actual
    path('me/', views.current_user_view, name='current_user'),
]