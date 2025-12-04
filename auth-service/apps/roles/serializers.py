from rest_framework import serializers
from .models import Role, Permission


class PermissionSerializer(serializers.ModelSerializer):
    display_name = serializers.CharField(source='get_code_display', read_only=True)
    
    class Meta:
        model = Permission
        fields = ['id', 'code', 'display_name', 'description']


class RoleSerializer(serializers.ModelSerializer):
    display_name = serializers.CharField(source='get_name_display', read_only=True)
    user_count = serializers.IntegerField(source='users.count', read_only=True)
    
    class Meta:
        model = Role
        fields = ['id', 'name', 'display_name', 'description', 'permissions', 'user_count', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']


class RoleCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ['name', 'description', 'permissions']
    
    def validate_permissions(self, value):
        """Validar que los permisos sean un diccionario con la estructura correcta"""
        if not isinstance(value, dict):
            raise serializers.ValidationError("Los permisos deben ser un diccionario")
        return value