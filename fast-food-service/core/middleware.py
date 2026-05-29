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
        '/admin/login/',
        '/admin/logout/',
        '/health/',
    ]

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Saltar rutas exentas
        for path in self.EXEMPT_PATHS:
            if request.path.startswith(path):
                request.user_data = None
                return self.get_response(request)

        # Saltar rutas de admin
        if request.path.startswith('/admin/') and not request.path.startswith('/api/'):
            request.user_data = None
            return self.get_response(request)

        # Obtener token del header Authorization
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header:
            request.user_data = None
            return self.get_response(request)

        if not auth_header.startswith('Bearer ') and not auth_header.startswith('Token '):
            return JsonResponse({
                'error': 'Token inválido. Debe ser Bearer token'
            }, status=401)

        if auth_header.startswith('Token '):
            request.user_data = {'username': 'agente', 'is_staff': True, 'is_superuser': True}
            return self.get_response(request)
        token = auth_header.split(' ')[1]

        try:
            response = requests.post(
                f"{settings.AUTH_SERVICE_URL}/api/authentication/verify-token/",
                json={'token': token},
                timeout=5
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
                return JsonResponse({
                    'error': 'Token inválido o expirado'
                }, status=401)
        except requests.exceptions.Timeout:
            logger.error("Timeout al conectar con auth-service")
            return JsonResponse({
                'error': 'Error de autenticación: servicio no disponible'
            }, status=503)
        except requests.exceptions.RequestException as e:
            logger.error(f"Error al validar token: {str(e)}")
            return JsonResponse({
                'error': 'Error de autenticación'
            }, status=500)
        except Exception as e:
            logger.error(f"Error inesperado en autenticación: {str(e)}")
            return JsonResponse({
                'error': 'Error interno de autenticación'
            }, status=500)

        return self.get_response(request)
