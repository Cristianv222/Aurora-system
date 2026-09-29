import requests
import logging
from django.conf import settings
from django.http import JsonResponse

logger = logging.getLogger(__name__)

class JWTAuthenticationMiddleware:
    """
    Middleware compatible con ASGI/Daphne para validar JWT contra auth-service
    """
    EXEMPT_PATHS = [
        '/api/hardware/',
        '/admin/login/',
        '/admin/logout/',
        '/health/',
    ]

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        for path in self.EXEMPT_PATHS:
            if request.path.startswith(path):
                request.user_data = None
                return self.get_response(request)

        if request.path.startswith('/admin/') and not request.path.startswith('/api/'):
            request.user_data = None
            return self.get_response(request)

        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header:
            request.user_data = None
            return self.get_response(request)

        if not auth_header.startswith('Bearer '):
            if request.path.startswith('/api/'):
                return JsonResponse({'error': 'Token inválido. Debe ser Bearer token'}, status=401)
            return self.get_response(request)

        token = auth_header.split(' ')[1]

        auth_url = getattr(settings, 'AUTH_SERVICE_URL', 'http://auth-service:8000/auth').rstrip('/')
        if not auth_url.endswith('/auth'):
            auth_url = f"{auth_url}/auth"

        try:
            response = requests.post(
                f"{auth_url}/api/authentication/verify-token/",
                json={'token': token},
                timeout=5,
                headers={'Host': 'auth-service:8000'}
            )
            if response.status_code == 200:
                user_data = response.json()
                request.user_data = user_data
                request.user_id = user_data.get('user_id')
                request.username = user_data.get('username')
                request.user_email = user_data.get('email')
                request.user_role = user_data.get('role')
                request.user_role_id = user_data.get('role_id')
                request.is_staff = user_data.get('is_staff', False)
                request.is_superuser = user_data.get('is_superuser', False)
                logger.info(f"✅ Usuario autenticado: {request.username}")
            else:
                logger.warning(f"❌ Token inválido: {response.status_code}")
                if request.path.startswith('/api/'):
                    return JsonResponse({'error': 'Token inválido o expirado'}, status=401)
        except requests.exceptions.Timeout:
            logger.error("⚠️ Timeout al conectar con auth-service")
            if request.path.startswith('/api/'):
                return JsonResponse({'error': 'Error de autenticación: servicio no disponible'}, status=503)
        except requests.exceptions.RequestException as e:
            logger.error(f"⚠️ Error al validar token: {str(e)}")
            if request.path.startswith('/api/'):
                return JsonResponse({'error': 'Error de autenticación'}, status=500)
        except Exception as e:
            logger.error(f"⚠️ Error inesperado: {str(e)}")
            if request.path.startswith('/api/'):
                return JsonResponse({'error': 'Error interno de autenticación'}, status=500)

        return self.get_response(request)


try:
    import ctypes
    _libc = ctypes.CDLL('libc.so.6')
    _has_malloc_trim = hasattr(_libc, 'malloc_trim')
except Exception:
    _libc = None
    _has_malloc_trim = False


class MemoryTrimMiddleware:
    """
    Middleware para liberar memoria RAM al SO (Kernel Linux).
    Ejecuta malloc_trim(0) tras procesar cada petición HTTP de Django.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        if _has_malloc_trim:
            try:
                _libc.malloc_trim(0)
            except Exception:
                pass
        return response

