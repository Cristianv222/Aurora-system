from django.contrib import admin
from .models import Role, Permission


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ['name', 'get_name_display', 'user_count', 'created_at']
    search_fields = ['name', 'description']
    readonly_fields = ['created_at', 'updated_at']
    
    def user_count(self, obj):
        return obj.users.count()
    user_count.short_description = 'Usuarios'


@admin.register(Permission)
class PermissionAdmin(admin.ModelAdmin):
    list_display = ['code', 'get_code_display', 'description']
    search_fields = ['code', 'description']