from rest_framework.decorators import api_view
from rest_framework.response import Response
from core.permissions import require_authentication, require_staff


@api_view(['GET'])
@require_staff
def test_consolidated_view(request):
    """Vista de prueba para reportes consolidados"""
    return Response({
        'message': 'Acceso a reportes consolidados exitoso',
        'user': request.username,
        'role': request.user_role
    })


@api_view(['GET'])
def health_check(request):
    """Health check"""
    return Response({
        'status': 'ok',
        'service': 'reporting-service'
    })