from functools import wraps
from django.http import JsonResponse


def require_authentication(view_func):
    """
    Decorador para requerir autenticación en una vista
    """
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if not hasattr(request, 'user_data') or request.user_data is None:
            return JsonResponse({
                'error': 'Autenticación requerida'
            }, status=401)
        
        if not request.user_data.get('valid', True):
            return JsonResponse({
                'error': 'Token inválido'
            }, status=401)
        
        return view_func(request, *args, **kwargs)
    
    return wrapper


def require_permission(permission_code):
    """
    Decorador para requerir un permiso específico
    Uso: @require_permission('fast_food.manage_menu')
    """
    def decorator(view_func):
        @wraps(view_func)
        def wrapper(request, *args, **kwargs):
            # Primero verificar autenticación
            if not hasattr(request, 'user_data') or request.user_data is None:
                return JsonResponse({
                    'error': 'Autenticación requerida'
                }, status=401)
            
            # Superusuarios tienen todos los permisos
            if request.user_data.get('is_superuser'):
                return view_func(request, *args, **kwargs)
            
            # Verificar permiso específico
            # TODO: Implementar verificación de permisos contra auth-service
            # Por ahora, solo verificamos que esté autenticado
            
            return view_func(request, *args, **kwargs)
        
        return wrapper
    
    return decorator


def require_staff(view_func):
    """
    Decorador para requerir que el usuario sea staff
    """
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if not hasattr(request, 'user_data') or request.user_data is None:
            return JsonResponse({
                'error': 'Autenticación requerida'
            }, status=401)
        
        if not request.user_data.get('is_staff') and not request.user_data.get('is_superuser'):
            return JsonResponse({
                'error': 'Permisos de staff requeridos'
            }, status=403)
        
        return view_func(request, *args, **kwargs)
    
    return wrapper


def require_role(role_name):
    """
    Decorador para requerir un rol específico
    Uso: @require_role('ADMIN_FAST_FOOD')
    """
    def decorator(view_func):
        @wraps(view_func)
        def wrapper(request, *args, **kwargs):
            if not hasattr(request, 'user_data') or request.user_data is None:
                return JsonResponse({
                    'error': 'Autenticación requerida'
                }, status=401)
            
            # Superusuarios tienen acceso a todo
            if request.user_data.get('is_superuser'):
                return view_func(request, *args, **kwargs)
            
            user_role = request.user_data.get('role')
            if user_role != role_name:
                return JsonResponse({
                    'error': f'Rol {role_name} requerido'
                }, status=403)
            
            return view_func(request, *args, **kwargs)
        
        return wrapper
    
    return decorator