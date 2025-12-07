# apps/customers/admin.py (COMPLETO Y MODIFICADO)

from django.contrib import admin
from django.utils.html import format_html
from .models import (
    Customer, CustomerAddress, CustomerNote,
    CustomerLoyalty, CustomerLoyaltyHistory, CustomerDevice
)

class CustomerAddressInline(admin.TabularInline):
    model = CustomerAddress
    extra = 1
    fields = ['address_type', 'is_default', 'street', 'city', 'state', 'country']
    readonly_fields = ['created_at', 'updated_at']

class CustomerNoteInline(admin.TabularInline):
    model = CustomerNote
    extra = 1
    fields = ['note_type', 'content', 'created_by_name', 'is_archived']
    readonly_fields = ['created_at', 'updated_at']

class CustomerLoyaltyInline(admin.StackedInline):
    model = CustomerLoyalty
    can_delete = False
    fields = ['current_tier', 'points_balance', 'total_points_earned', 
              'total_points_redeemed', 'discount_rate', 'free_delivery', 
              'priority_service']
    readonly_fields = ['current_tier', 'points_balance', 'total_points_earned',
                       'total_points_redeemed', 'discount_rate', 'free_delivery',
                       'priority_service']

@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ['email', 'full_name', 'cedula', 'phone', 'customer_type', # <-- CEDULA en list_display
                     'is_active', 'is_vip', 'total_orders', 'total_spent_display',
                     'created_at']
    list_filter = ['customer_type', 'is_active', 'is_vip',
                   'newsletter_subscribed', 'city', 'country', 'created_at']
    search_fields = ['email', 'phone', 'first_name', 'last_name', 'address', 'city', 'cedula'] # <-- CEDULA en search_fields
    ordering = ['-created_at']
    
    fieldsets = (
        ('Información Personal', {
            'fields': ('email', 'cedula', 'phone', 'first_name', 'last_name', # <-- CEDULA en fieldsets
                       'birth_date', 'gender')
        }),
        ('Información de Contacto', {
            'fields': ('address', 'city', 'state', 'zip_code', 'country')
        }),
        ('Tipo y Estado', {
            'fields': ('customer_type', 'is_active', 'is_vip')
        }),
        ('Preferencias', {
            'fields': ('preferences', 'newsletter_subscribed',
                       'marketing_emails', 'marketing_sms')
        }),
        ('Estadísticas', {
            'fields': ('total_orders', 'total_spent', 'last_order_date',
                       'average_order_value'),
            'classes': ('collapse',)
        }),
        ('Auditoría', {
            'fields': ('registered_ip', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    readonly_fields = ['total_orders', 'total_spent', 'last_order_date',
                       'average_order_value', 'registered_ip',
                       'created_at', 'updated_at']
    
    inlines = [CustomerAddressInline, CustomerNoteInline, CustomerLoyaltyInline]
    
    def full_name(self, obj):
        return obj.get_full_name()
    full_name.short_description = 'Nombre Completo'
    
    def total_spent_display(self, obj):
        return f'${obj.total_spent:,.2f}'
    total_spent_display.short_description = 'Total Gastado'
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.prefetch_related('loyalty')

@admin.register(CustomerAddress)
class CustomerAddressAdmin(admin.ModelAdmin):
    list_display = ['customer', 'address_type', 'is_default', 'city', 
                     'state', 'country', 'created_at']
    list_filter = ['address_type', 'is_default', 'city', 'state', 'country']
    search_fields = ['customer__email', 'customer__first_name', 
                     'customer__last_name', 'street', 'city']
    raw_id_fields = ['customer']
    
    fieldsets = (
        ('Información del Cliente', {
            'fields': ('customer',)
        }),
        ('Tipo de Dirección', {
            'fields': ('address_type', 'is_default')
        }),
        ('Dirección', {
            'fields': ('street', 'apartment', 'city', 'state', 'zip_code', 'country')
        }),
        ('Instrucciones Especiales', {
            'fields': ('special_instructions',),
            'classes': ('collapse',)
        }),
        ('Coordenadas', {
            'fields': ('latitude', 'longitude'),
            'classes': ('collapse',)
        }),
        ('Auditoría', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    readonly_fields = ['created_at', 'updated_at']

@admin.register(CustomerNote)
class CustomerNoteAdmin(admin.ModelAdmin):
    list_display = ['customer', 'note_type', 'created_by_name', 'is_archived',
                     'created_at']
    list_filter = ['note_type', 'is_archived', 'created_at']
    search_fields = ['customer__email', 'customer__first_name', 
                     'customer__last_name', 'content', 'created_by_name']
    raw_id_fields = ['customer']
    
    fieldsets = (
        ('Información de la Nota', {
            'fields': ('customer', 'note_type', 'content', 'created_by_name')
        }),
        ('Estado', {
            'fields': ('is_archived',)
        }),
        ('Auditoría', {
            'fields': ('created_at', 'updated_at')
        }),
    )
    
    readonly_fields = ['created_at', 'updated_at']
    
    def has_add_permission(self, request):
        # No permitir agregar manualmente, son manejadas por el sistema
        return False
    
    def has_change_permission(self, request, obj=None):
        # No permitir edición, son registros de auditoría
        return False

@admin.register(CustomerLoyalty)
class CustomerLoyaltyAdmin(admin.ModelAdmin):
    list_display = ['customer', 'current_tier', 'points_balance',
                     'total_points_earned', 'discount_rate', 'free_delivery']
    list_filter = ['current_tier', 'free_delivery', 'priority_service']
    search_fields = ['customer__email', 'customer__first_name', 'customer__last_name']
    raw_id_fields = ['customer']
    
    fieldsets = (
        ('Información del Cliente', {
            'fields': ('customer',)
        }),
        ('Nivel y Puntos', {
            'fields': ('current_tier', 'points_balance', 'total_points_earned',
                       'total_points_redeemed')
        }),
        ('Progreso', {
            'fields': ('tier_achieved_date', 'next_tier_progress')
        }),
        ('Beneficios', {
            'fields': ('discount_rate', 'free_delivery', 'priority_service')
        }),
        ('Fechas', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    readonly_fields = ['current_tier', 'points_balance', 'total_points_earned',
                       'total_points_redeemed', 'next_tier_progress',
                       'discount_rate', 'free_delivery', 'priority_service',
                       'created_at', 'updated_at']
    
    def has_add_permission(self, request):
        return False

@admin.register(CustomerLoyaltyHistory)
class CustomerLoyaltyHistoryAdmin(admin.ModelAdmin):
    list_display = ['loyalty', 'transaction_type', 'points_change',
                     'balance_after', 'reason', 'created_at']
    list_filter = ['transaction_type', 'created_at']
    search_fields = ['loyalty__customer__email', 'reason', 'order_reference']
    raw_id_fields = ['loyalty']
    
    fieldsets = (
        ('Transacción', {
            'fields': ('loyalty', 'transaction_type', 'points_change',
                       'balance_after', 'reason', 'order_reference')
        }),
        ('Fecha', {
            'fields': ('created_at',)
        }),
    )
    
    readonly_fields = ['created_at']
    
    def has_add_permission(self, request):
        return False
    
    def has_change_permission(self, request, obj=None):
        return False

@admin.register(CustomerDevice)
class CustomerDeviceAdmin(admin.ModelAdmin):
    list_display = ['customer', 'device_type', 'is_active', 'last_used',
                     'created_at']
    list_filter = ['device_type', 'is_active', 'created_at']
    search_fields = ['customer__email', 'device_token', 'device_id']
    raw_id_fields = ['customer']
    
    fieldsets = (
        ('Información del Cliente', {
            'fields': ('customer',)
        }),
        ('Información del Dispositivo', {
            'fields': ('device_type', 'device_token', 'device_id')
        }),
        ('Detalles Técnicos', {
            'fields': ('app_version', 'os_version', 'model'),
            'classes': ('collapse',)
        }),
        ('Estado', {
            'fields': ('is_active', 'last_used')
        }),
        ('Fecha', {
            'fields': ('created_at',)
        }),
    )
    
    readonly_fields = ['last_used', 'created_at']