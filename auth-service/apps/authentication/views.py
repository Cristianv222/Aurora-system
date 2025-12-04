from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken, AccessToken
from rest_framework_simplejwt.exceptions import TokenError, InvalidToken

from .serializers import CustomTokenObtainPairSerializer, RegisterSerializer, VerifyTokenSerializer
from apps.users.serializers import UserSerializer


class CustomTokenObtainPairView(TokenObtainPairView):
    """Login - Obtener token JWT"""
    serializer_class = CustomTokenObtainPairSerializer


@api_view(['POST'])
@permission_classes([AllowAny])
def register_view(request):
    """Registro de nuevo usuario"""
    serializer = RegisterSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        
        # Generar tokens para el usuario recién creado
        refresh = RefreshToken.for_user(user)
        
        return Response({
            'message': 'Usuario creado exitosamente',
            'user': UserSerializer(user).data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            }
        }, status=status.HTTP_201_CREATED)
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([AllowAny])
def verify_token_view(request):
    """Verificar si un token JWT es válido"""
    serializer = VerifyTokenSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    token = serializer.validated_data['token']
    
    try:
        # Decodificar el token
        access_token = AccessToken(token)
        
        # Extraer datos del token
        user_id = access_token['user_id']
        
        return Response({
            'valid': True,
            'user_id': user_id,
            'username': access_token.get('username'),
            'email': access_token.get('email'),
            'full_name': access_token.get('full_name'),
            'role': access_token.get('role'),
            'role_id': access_token.get('role_id'),
            'is_staff': access_token.get('is_staff'),
            'is_superuser': access_token.get('is_superuser'),
        }, status=status.HTTP_200_OK)
        
    except TokenError as e:
        return Response({
            'valid': False,
            'error': str(e)
        }, status=status.HTTP_401_UNAUTHORIZED)
    except Exception as e:
        return Response({
            'valid': False,
            'error': 'Token inválido'
        }, status=status.HTTP_401_UNAUTHORIZED)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def current_user_view(request):
    """Obtener información del usuario actual"""
    serializer = UserSerializer(request.user)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_view(request):
    """Logout - Invalidar refresh token"""
    try:
        refresh_token = request.data.get('refresh_token')
        if refresh_token:
            token = RefreshToken(refresh_token)
            token.blacklist()
        
        return Response({
            'message': 'Sesión cerrada exitosamente'
        }, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({
            'error': 'Error al cerrar sesión'
        }, status=status.HTTP_400_BAD_REQUEST)