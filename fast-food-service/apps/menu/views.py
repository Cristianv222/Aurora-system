from rest_framework.decorators import api_view
from rest_framework.response import Response
from core.permissions import require_authentication, require_staff


@api_view(['GET'])
@require_authentication
def test_auth_view(request):
    """
    Vista de prueba para verificar que la autenticación JWT funciona
    GET /api/menu/test-auth/
    """
    return Response({
        'message': 'Autenticación exitosa',
        'user_id': request.user_id,
        'username': request.username,
        'email': request.user_email,
        'role': request.user_role,
        'is_staff': request.is_staff,
        'is_superuser': request.is_superuser
    })


@api_view(['GET'])
@require_staff
def test_staff_view(request):
    """
    Vista de prueba que requiere permisos de staff
    GET /api/menu/test-staff/
    """
    return Response({
        'message': 'Acceso de staff exitoso',
        'user': request.username
    })


@api_view(['GET'])
def health_check(request):
    """
    Health check endpoint (sin autenticación)
    GET /api/menu/health/
    """
    return Response({
        'status': 'ok',
        'service': 'fast-food-service'
    })