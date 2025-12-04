from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.response import Response

from .models import Role, Permission
from .serializers import RoleSerializer, RoleCreateUpdateSerializer, PermissionSerializer


class RoleViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestionar roles
    """
    queryset = Role.objects.all()
    permission_classes = [IsAuthenticated]
    
    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return RoleCreateUpdateSerializer
        return RoleSerializer
    
    def get_permissions(self):
        """
        Solo admins pueden crear, actualizar y eliminar roles
        """
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminUser()]
        return [IsAuthenticated()]
    
    @action(detail=False, methods=['get'])
    def choices(self, request):
        """
        Obtener lista de roles disponibles para select/dropdown
        GET /api/roles/choices/
        """
        roles = Role.objects.all()
        data = [
            {
                'value': role.id,
                'label': role.get_name_display(),
                'name': role.name
            }
            for role in roles
        ]
        return Response(data)
    
    @action(detail=True, methods=['get'])
    def users(self, request, pk=None):
        """
        Obtener usuarios con este rol
        GET /api/roles/{id}/users/
        """
        role = self.get_object()
        from apps.users.serializers import UserSerializer
        users = role.users.all()
        serializer = UserSerializer(users, many=True)
        return Response(serializer.data)


class PermissionViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet para listar permisos (solo lectura)
    """
    queryset = Permission.objects.all()
    serializer_class = PermissionSerializer
    permission_classes = [IsAuthenticated]
    
    @action(detail=False, methods=['get'])
    def by_service(self, request):
        """
        Agrupar permisos por servicio
        GET /api/permissions/by_service/
        """
        permissions = Permission.objects.all()
        
        grouped = {}
        for perm in permissions:
            service = perm.code.split('.')[0]
            if service not in grouped:
                grouped[service] = []
            grouped[service].append({
                'id': perm.id,
                'code': perm.code,
                'display_name': perm.get_code_display(),
                'description': perm.description
            })
        
        return Response(grouped)