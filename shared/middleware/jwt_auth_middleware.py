import requests
import logging
from django.conf import settings
from django.http import JsonResponse
from django.utils.deprecation import MiddlewareMixin

logger = logging.getLogger(__name__)


class JWTAuthenticationMiddleware(MiddlewareMixin):
    """
    Middleware para validar JWT contra auth-service
    y extraer información del usuario
    """
    
    # Rutas que no requieren autenticación
    EXEMPT_PATHS = [
        '/admin/login/',
        '/admin/logout/',
        '/health/',
    ]
    
    def process_request(self, request):
        # Saltar rutas exentas
        for path in self.EXEMPT_PATHS:
            if request.path.startswith(path):
                return None
        
        # Saltar rutas de admin (excepto API)
        if request.path.startswith('/admin/') and not request.path.startswith('/api/'):
            return None
        
        # Obtener token del header Authorization
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        
        if not auth_header:
            # Si no hay token, permitir pero sin usuario
            request.user_data = None
            return None
        
        if not auth_header.startswith('Bearer '):
            return JsonResponse({
                'error': 'Token inválido. Debe ser Bearer token'
            }, status=401)
        
        token = auth_header.split(' ')[1]
        
        # Validar token contra auth-service
        try:
            response = requests.post(
                f"{settings.AUTH_SERVICE_URL}/api/authentication/verify-token/",
                json={'token': token},
                timeout=5
            )
            
            if response.status_code == 200:
                user_data = response.json()
                
                # Adjuntar información del usuario al request
                request.user_data = user_data
                request.user_id = user_data.get('user_id')
                request.username = user_data.get('username')
                request.user_email = user_data.get('email')
                request.user_role = user_data.get('role')
                request.user_role_id = user_data.get('role_id')
                request.is_staff = user_data.get('is_staff', False)
                request.is_superuser = user_data.get('is_superuser', False)
                
                logger.info(f"Usuario autenticado: {request.username}")
                return None
            
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