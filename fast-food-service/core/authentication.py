from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from django.contrib.auth.models import AnonymousUser


class SimpleUser:
    """
    Clase simple para representar un usuario autenticado desde otro servicio
    """
    def __init__(self, user_data):
        self.id = user_data.get('user_id')
        self.username = user_data.get('username', '')
        self.email = user_data.get('email', '')
        self.is_authenticated = True
        self.is_active = True
        self.is_staff = user_data.get('is_staff', False)
        self.is_superuser = user_data.get('is_superuser', False)
        self.role = user_data.get('role')
        self.role_id = user_data.get('role_id')
        self._user_data = user_data
    
    def __str__(self):
        return self.username or f"User-{self.id}"
    
    @property
    def is_anonymous(self):
        return False


class JWTAuthentication(BaseAuthentication):
    """
    Autenticación personalizada que usa los datos del middleware
    """
    
    def authenticate(self, request):
        # El middleware ya validó el token y agregó user_data
        user_data = getattr(request, 'user_data', None)
        
        if user_data is None:
            # No hay token o no fue validado
            return None
        
        # Crear objeto de usuario simple
        user = SimpleUser(user_data)
        
        # Retornar tupla (user, auth) como espera DRF
        return (user, None)
    
    def authenticate_header(self, request):
        return 'Bearer'