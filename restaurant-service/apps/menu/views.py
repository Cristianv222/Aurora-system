from rest_framework.decorators import api_view
from rest_framework.response import Response
from core.permissions import require_authentication, require_staff


@api_view(['GET'])
@require_authentication
def test_auth_view(request):
    """Vista de prueba autenticación"""
    return Response({
        'message': 'Autenticación exitosa en restaurant-service',
        'user_id': request.user_id,
        'username': request.username,
        'email': request.user_email,
        'role': request.user_role
    })


@api_view(['GET'])
def health_check(request):
    """Health check"""
    return Response({
        'status': 'ok',
        'service': 'restaurant-service'
    })