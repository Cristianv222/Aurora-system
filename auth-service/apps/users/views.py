from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.response import Response
from django.contrib.auth.hashers import check_password

from .models import User
from .serializers import (
    UserSerializer, 
    UserCreateSerializer, 
    ChangePasswordSerializer
)


class UserViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestionar usuarios
    """
    queryset = User.objects.all().select_related('role')
    permission_classes = [IsAuthenticated]
    
    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        return UserSerializer
    
    def get_permissions(self):
        """
        Solo admins pueden crear, actualizar y eliminar usuarios
        """
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminUser()]
        return [IsAuthenticated()]
    
    def get_queryset(self):
        """
        Los usuarios normales solo pueden ver su propio perfil
        Los admins pueden ver todos los usuarios
        """
        if self.request.user.is_staff or self.request.user.is_superuser:
            return User.objects.all().select_related('role')
        return User.objects.filter(id=self.request.user.id)
    
    @action(detail=False, methods=['get'])
    def me(self, request):
        """
        Endpoint para obtener el perfil del usuario actual
        GET /api/users/me/
        """
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def change_password(self, request, pk=None):
        """
        Cambiar contraseña de un usuario
        POST /api/users/{id}/change_password/
        """
        user = self.get_object()
        
        # Solo el mismo usuario o un admin puede cambiar la contraseña
        if user.id != request.user.id and not request.user.is_staff:
            return Response(
                {'error': 'No tienes permiso para cambiar esta contraseña'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        serializer = ChangePasswordSerializer(data=request.data)
        if serializer.is_valid():
            # Verificar contraseña antigua
            if not check_password(serializer.validated_data['old_password'], user.password):
                return Response(
                    {'error': 'La contraseña actual es incorrecta'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Establecer nueva contraseña
            user.set_password(serializer.validated_data['new_password'])
            user.save()
            
            return Response({
                'message': 'Contraseña actualizada exitosamente'
            })
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        """
        Activar un usuario
        POST /api/users/{id}/activate/
        """
        if not request.user.is_staff:
            return Response(
                {'error': 'No tienes permiso para realizar esta acción'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        user = self.get_object()
        user.is_active = True
        user.save()
        
        return Response({
            'message': f'Usuario {user.username} activado exitosamente'
        })
    
    @action(detail=True, methods=['post'])
    def deactivate(self, request, pk=None):
        """
        Desactivar un usuario
        POST /api/users/{id}/deactivate/
        """
        if not request.user.is_staff:
            return Response(
                {'error': 'No tienes permiso para realizar esta acción'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        user = self.get_object()
        
        # No permitir desactivar al propio usuario
        if user.id == request.user.id:
            return Response(
                {'error': 'No puedes desactivar tu propia cuenta'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        user.is_active = False
        user.save()
        
        return Response({
            'message': f'Usuario {user.username} desactivado exitosamente'
        })
    
    @action(detail=False, methods=['get'])
    def staff(self, request):
        """
        Listar solo usuarios staff
        GET /api/users/staff/
        """
        if not request.user.is_staff:
            return Response(
                {'error': 'No tienes permiso para ver esta información'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        users = User.objects.filter(is_staff=True).select_related('role')
        serializer = self.get_serializer(users, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def by_role(self, request):
        """
        Filtrar usuarios por rol
        GET /api/users/by_role/?role=ADMIN_FAST_FOOD
        """
        if not request.user.is_staff:
            return Response(
                {'error': 'No tienes permiso para ver esta información'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        role_name = request.query_params.get('role')
        if not role_name:
            return Response(
                {'error': 'Debes proporcionar el parámetro role'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        users = User.objects.filter(role__name=role_name).select_related('role')
        serializer = self.get_serializer(users, many=True)
        return Response(serializer.data)