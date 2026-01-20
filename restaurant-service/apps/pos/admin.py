"""
apps/pos/admin.py

Configuración del admin para el módulo POS
"""

from django.contrib import admin
from django.utils.html import format_html
from .models import Shift, Discount, DiscountUsage, Table, DailySummary


@admin.register(Shift)
class ShiftAdmin(admin.ModelAdmin):
    """Admin para turnos"""
    list_display = [
        'shift_number',
        'user_name',
        'user_role',
        'cash_register',
        'status_badge',
        'opening_cash',
        'total_sales',
        'cash_difference',
        'opened_at',
        'closed_at',
    ]
    list_filter = ['status', 'user_role', 'opened_at', 'cash_register']
    search_fields = ['shift_number', 'user_name', 'user_id']
    readonly_fields = [
        'shift_number',
        'total_sales',
        'total_cash_sales',
        'total_card_sales',
        'total_other_sales',
        'total_transactions',
        'cash_difference',
        'closed_at',
    ]
    
    fieldsets = (
        ('Información del Turno', {
            'fields': ('shift_number', 'status', 'cash_register')
        }),
        ('Empleado', {
            'fields': ('user_id', 'user_name', 'user_role')
        }),
        ('Montos de Apertura', {
            'fields': ('opening_cash', 'opening_notes')
        }),
        ('Montos de Cierre', {
            'fields': ('closing_cash', 'closing_notes', 'cash_difference')
        }),
        ('Totales', {
            'fields': (
                'total_sales',
                'total_cash_sales',
                'total_card_sales',
                'total_other_sales',
                'total_transactions',
            )
        }),
        ('Fechas', {
            'fields': ('opened_at', 'closed_at')
        }),
    )
    
    def status_badge(self, obj):
        """Badge de estado con colores"""
        colors = {
            'open': 'green',
            'closed': 'gray',
            'suspended': 'orange',
        }
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 10px; border-radius: 3px;">{}</span>',
            colors.get(obj.status, 'gray'),
            obj.get_status_display()
        )
    status_badge.short_description = 'Estado'


@admin.register(Discount)
class DiscountAdmin(admin.ModelAdmin):
    """Admin para descuentos"""
    list_display = [
        'code',
        'name',
        'discount_type',
        'discount_value',
        'is_active_badge',
        'valid_from',
        'valid_until',
        'current_uses',
        'max_uses',
    ]
    list_filter = ['is_active', 'discount_type', 'apply_to', 'is_public']
    search_fields = ['code', 'name']
    filter_horizontal = ['applicable_products', 'applicable_categories']
    
    fieldsets = (
        ('Información Básica', {
            'fields': ('code', 'name', 'description')
        }),
        ('Configuración del Descuento', {
            'fields': (
                'discount_type',
                'apply_to',
                'discount_value',
                'minimum_purchase',
                'maximum_discount',
            )
        }),
        ('Límites de Uso', {
            'fields': (
                'max_uses',
                'max_uses_per_customer',
                'current_uses',
            )
        }),
        ('Período de Validez', {
            'fields': (
                'valid_from',
                'valid_until',
                'valid_days',
                'valid_hours',
            )
        }),
        ('Aplicabilidad', {
            'fields': (
                'applicable_products',
                'applicable_categories',
            )
        }),
        ('Estado', {
            'fields': ('is_active', 'is_public')
        }),
        ('Auditoría', {
            'fields': ('created_by', 'created_at', 'updated_at')
        }),
    )
    
    readonly_fields = ['current_uses', 'created_at', 'updated_at']
    
    def is_active_badge(self, obj):
        """Badge de activo/inactivo"""
        if obj.is_active:
            return format_html(
                '<span style="background-color: green; color: white; padding: 3px 10px; border-radius: 3px;">Activo</span>'
            )
        return format_html(
            '<span style="background-color: red; color: white; padding: 3px 10px; border-radius: 3px;">Inactivo</span>'
        )
    is_active_badge.short_description = 'Estado'


@admin.register(DiscountUsage)
class DiscountUsageAdmin(admin.ModelAdmin):
    """Admin para uso de descuentos"""
    list_display = [
        'discount',
        'order',
        'customer',
        'discount_amount',
        'original_amount',
        'created_at',
    ]
    list_filter = ['created_at', 'discount']
    search_fields = ['discount__code', 'order__order_number', 'customer__email']
    readonly_fields = ['created_at']
    
    fieldsets = (
        ('Relaciones', {
            'fields': ('discount', 'order', 'customer')
        }),
        ('Montos', {
            'fields': ('discount_amount', 'original_amount')
        }),
        ('Auditoría', {
            'fields': ('applied_by', 'created_at')
        }),
    )


@admin.register(Table)
class TableAdmin(admin.ModelAdmin):
    """Admin para mesas"""
    list_display = [
        'number',
        'name',
        'section',
        'capacity',
        'status_badge',
        'is_vip',
        'waiter_name',
        'is_active',
    ]
    list_filter = ['status', 'section', 'is_vip', 'is_active', 'floor']
    search_fields = ['number', 'name', 'qr_code']
    
    fieldsets = (
        ('Identificación', {
            'fields': ('number', 'name', 'qr_code')
        }),
        ('Ubicación', {
            'fields': ('section', 'floor', 'capacity')
        }),
        ('Estado', {
            'fields': ('status', 'is_active', 'is_vip')
        }),
        ('Orden Actual', {
            'fields': ('current_order', 'waiter_id', 'waiter_name')
        }),
        ('Notas', {
            'fields': ('notes',)
        }),
        ('Fechas', {
            'fields': ('created_at', 'updated_at')
        }),
    )
    
    readonly_fields = ['qr_code', 'created_at', 'updated_at']
    
    def status_badge(self, obj):
        """Badge de estado con colores"""
        colors = {
            'available': 'green',
            'occupied': 'red',
            'reserved': 'orange',
            'cleaning': 'blue',
            'maintenance': 'gray',
        }
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 10px; border-radius: 3px;">{}</span>',
            colors.get(obj.status, 'gray'),
            obj.get_status_display()
        )
    status_badge.short_description = 'Estado'


@admin.register(DailySummary)
class DailySummaryAdmin(admin.ModelAdmin):
    """Admin para resúmenes diarios"""
    
    # Lista actualizada de columnas a mostrar en el listado de registros
    list_display = [
        'date',
        'total_sales',
        'total_orders',
        'total_items_sold', # <-- Campo que causaba el UndefinedColumn
        'average_order_value',
        'cash_sales',       # <-- Nuevos campos de pago
        'dine_in_sales',    # <-- Nuevos campos de tipo
        'total_discounts',
        'generated_at',
    ]
    
    list_filter = ['date', 'is_closed', 'generated_at'] # Agregué 'is_closed'
    search_fields = ['date']
    
    fieldsets = (
        ('Fecha y Estado', { # Modificado el título para incluir el estado
            'fields': ('date', 'is_closed', 'closing_notes')
        }),
        ('Totales Generales y Promedios', {
            'fields': (
                'total_sales',
                'total_orders',
                'total_items_sold',
                'total_customers',
                'average_order_value',
                'average_items_per_order', # <-- Agregado
                'total_shifts',
                'closed_shifts',
            )
        }),
        ('Por Método de Pago', {
            'fields': (
                'cash_sales',
                'card_sales',
                'other_sales',
            )
        }),
        ('Por Tipo de Orden', {
            'fields': (
                'dine_in_sales',
                'takeout_sales',
                'delivery_sales',
            )
        }),
        ('Descuentos y Propinas', {
            'fields': (
                'total_discounts',
                'total_tips',
            )
        }),
        ('Datos Detallados (JSON)', {
            'fields': ('top_products', 'sales_by_hour'),
            'classes': ('collapse',), # Opcional: para que se colapse por defecto
        }),
        ('Auditoría', {
            'fields': ('generated_at', 'generated_by')
        }),
    )
    
    # Campos que Django no debe permitir editar
    readonly_fields = [
        'is_closed', # También solo de lectura
        'total_sales',
        'total_orders',
        'total_items_sold',
        'total_customers',
        'cash_sales',
        'card_sales',
        'other_sales',
        'dine_in_sales',
        'takeout_sales',
        'delivery_sales',
        'total_discounts',
        'total_tips',
        'average_order_value',
        'average_items_per_order',
        'total_shifts',
        'closed_shifts',
        'top_products',
        'sales_by_hour',
        'generated_at',
        'generated_by',
    ]
    
    def has_add_permission(self, request):
        """No permitir agregar manualmente"""
        return False
    
    def has_delete_permission(self, request, obj=None):
        """Solo admins pueden eliminar"""
        return request.user.is_superuser