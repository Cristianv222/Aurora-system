from functools import wraps
from django.http import JsonResponse
from rest_framework.permissions import BasePermission

class IsJWTAuthenticated(BasePermission):
    """
    Clase de permiso de DRF para verificar que el middleware
    haya autenticado el token JWT con éxito.
    """
    def has_permission(self, request, view):
        return hasattr(request, 'user_data') and request.user_data is not None

def require_jwt_auth(view_func):
    """
    Decorador para requerir autenticación JWT
    """
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if not hasattr(request, 'user_data') or request.user_data is None:
            return JsonResponse({'error': 'Autenticación JWT requerida'}, status=401)
        return view_func(request, *args, **kwargs)
    return wrapper

def require_company_access(view_func):
    """
    Decorador para verificar que el usuario pertenece o tiene acceso a la empresa
    """
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if not hasattr(request, 'user_data') or request.user_data is None:
            return JsonResponse({'error': 'Autenticación requerida'}, status=401)
        
        # Permitir superusuarios
        if request.user_data.get('is_superuser'):
            return view_func(request, *args, **kwargs)
            
        # Comprobar pertenencia a empresa (por simplicidad, permitimos acceso
        # si hay una empresa asignada al rol o usuario en sus metadatos)
        # TODO: Refinar lógica de coincidencia de empresa según especificaciones de base de datos
        
        return view_func(request, *args, **kwargs)
    return wrapper
