from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def test_auth(request):
    return Response({
        'message': 'Autenticación exitosa en reporting-service',
        'user_id': request.user.id if hasattr(request.user, 'id') else None,
        'username': request.user.username if hasattr(request.user, 'username') else None,
        'email': request.user.email if hasattr(request.user, 'email') else None,
        'is_staff': request.user.is_staff if hasattr(request.user, 'is_staff') else None,
    })