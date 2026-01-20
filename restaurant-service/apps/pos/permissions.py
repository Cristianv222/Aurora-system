"""
apps/pos/permissions.py

Permisos personalizados para el módulo POS
"""

from rest_framework import permissions


class IsOwnerOrAdmin(permissions.BasePermission):
    """
    Permiso personalizado para permitir que solo el dueño o admin acceda.
    Usado en Shift para que un empleado solo vea sus propios turnos.
    """
    
    def has_object_permission(self, request, view, obj):
        # Admin tiene acceso total
        if request.user.is_staff or request.user.is_superuser:
            return True
        
        # El dueño puede acceder a su propio objeto
        if hasattr(obj, 'user_id'):
            return str(obj.user_id) == str(request.user.id)
        
        return False


class IsManagerOrAdmin(permissions.BasePermission):
    """
    Permiso para managers y admins.
    Usado para acciones como crear/editar descuentos, cerrar turnos de otros, etc.
    """
    
    def has_permission(self, request, view):
        # Verificar si es admin
        if request.user.is_staff or request.user.is_superuser:
            return True
        
        # Verificar si tiene rol de MANAGER
        if hasattr(request.user, 'role'):
            role = request.user.role
            if isinstance(role, dict):
                return role.get('name') in ['MANAGER', 'ADMIN_FAST_FOOD']
            return getattr(role, 'name', '') in ['MANAGER', 'ADMIN_FAST_FOOD']
        
        return False


class CanManageDiscounts(permissions.BasePermission):
    """
    Permiso para gestionar descuentos.
    Solo managers, admins y usuarios con permiso específico.
    """
    
    def has_permission(self, request, view):
        # Solo lectura es público
        if request.method in permissions.SAFE_METHODS:
            return True
        
        # Crear/Editar/Eliminar solo para managers/admins
        if request.user.is_staff or request.user.is_superuser:
            return True
        
        if hasattr(request.user, 'role'):
            role = request.user.role
            if isinstance(role, dict):
                return role.get('name') in ['MANAGER', 'ADMIN_FAST_FOOD']
            return getattr(role, 'name', '') in ['MANAGER', 'ADMIN_FAST_FOOD']
        
        return False


class CanManageTables(permissions.BasePermission):
    """
    Permiso para gestionar mesas.
    Meseros pueden ocupar/liberar, managers pueden crear/editar/eliminar.
    """
    
    def has_permission(self, request, view):
        # Lectura para todos los autenticados
        if request.method in permissions.SAFE_METHODS:
            return True
        
        # Acciones de ocupar/liberar permitidas para meseros
        if view.action in ['occupy', 'free', 'set_cleaning']:
            return True
        
        # Crear/Editar/Eliminar solo para managers/admins
        if request.user.is_staff or request.user.is_superuser:
            return True
        
        if hasattr(request.user, 'role'):
            role = request.user.role
            if isinstance(role, dict):
                return role.get('name') in ['MANAGER', 'ADMIN_FAST_FOOD']
            return getattr(role, 'name', '') in ['MANAGER', 'ADMIN_FAST_FOOD']
        
        return False


class CanViewReports(permissions.BasePermission):
    """
    Permiso para ver reportes.
    Solo managers y admins.
    """
    
    def has_permission(self, request, view):
        if request.user.is_staff or request.user.is_superuser:
            return True
        
        if hasattr(request.user, 'role'):
            role = request.user.role
            if isinstance(role, dict):
                return role.get('name') in ['MANAGER', 'ADMIN_FAST_FOOD']
            return getattr(role, 'name', '') in ['MANAGER', 'ADMIN_FAST_FOOD']
        
        return False