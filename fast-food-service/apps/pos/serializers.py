"""
apps/pos/serializers.py

Serializers para el módulo POS (Punto de Venta)
"""

from rest_framework import serializers
from .models import Shift, Discount, DiscountUsage, Table, DailySummary
from datetime import timedelta, date 
from decimal import Decimal # Mantener esta importación si se usa en lógica de validación, aunque no en la serialización simple.

# ============================================================================
# SHIFT SERIALIZERS
# ============================================================================

class ShiftSerializer(serializers.ModelSerializer):
    """Serializer para lectura de turnos"""
    
    duration_hours = serializers.SerializerMethodField()
    is_active = serializers.ReadOnlyField()
    cash_register_name = serializers.CharField(
        source='cash_register.register_number',
        read_only=True
    )
    total_sales = serializers.SerializerMethodField()
    
    class Meta:
        model = Shift
        fields = [
            'id',
            'shift_number',
            'user_id',
            'user_name',
            'user_role',
            'cash_register',
            'cash_register_name',
            'status',
            'opening_cash',
            'closing_cash',
            'total_sales',
            'total_cash_sales',
            'total_card_sales',
            'total_other_sales',
            'total_transactions',
            'cash_difference',
            'opening_notes',
            'closing_notes',
            'opened_at',
            'closed_at',
            'duration_hours',
            'is_active',
        ]
        # REVISADO: Se mantiene como lista, que es correcto.
        read_only_fields = [
            'id',
            'shift_number',
            'status',
            'total_sales',
            'total_cash_sales',
            'total_card_sales',
            'total_other_sales',
            'total_transactions',
            'cash_difference',
            'closed_at',
        ]
    
    def get_total_sales(self, obj):
        """
        Calcula las ventas totales.
        - Si está CERRADO: Devuelve el valor guardado en DB.
        - Si está ABIERTO: Calcula la suma de pagos desde la apertura hasta ahora (en tiempo real).
        """
        if obj.status == 'closed':
            return obj.total_sales
        
        # Si está abierto, calculamos al vuelo
        from django.utils import timezone
        from django.db.models import Sum
        from apps.orders.models import Order
        
        # Calcular ventas desde la apertura hasta ahora, usando Órdenes como el reporte diario
        total = Order.objects.filter(
            created_at__gte=obj.opened_at,
            status__in=['delivered', 'completed']
        ).aggregate(sum=Sum('total'))['sum'] or 0
        
        return total

    def get_duration_hours(self, obj):
        """Duración del turno en horas"""
        return round(obj.duration, 2)


class ShiftCreateSerializer(serializers.ModelSerializer):
    """Serializer para crear turno (abrir turno)"""
    manager_name = serializers.CharField(required=False, write_only=True)
    cash_register = serializers.PrimaryKeyRelatedField(
        queryset=Shift.cash_register.field.related_model.objects.all(),
        required=False
    )
    opening_cash = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, default=0)

    class Meta:
        model = Shift
        fields = [
            'cash_register',
            'opening_cash',
            'opening_notes',
            'manager_name',
        ]
    
    def validate(self, data):
        # Si no se envía caja, intentaremos asignar una por defecto en create()
        # Si se envía, validamos que no tenga turno abierto
        if 'cash_register' in data and data['cash_register']:
            if Shift.objects.filter(cash_register=data['cash_register'], status='open').exists():
                raise serializers.ValidationError(
                    'Ya existe un turno abierto en esta caja registradora'
                )
        return data

    def create(self, validated_data):
        """Crear turno con info del usuario del JWT y lógica de caja por defecto"""
        request = self.context.get('request')
        
        # 1. Manejo de Cash Register Automático
        cash_register = validated_data.get('cash_register')
        if not cash_register:
            from apps.payments.models import CashRegister, Currency
            # Buscar cualquier caja existente
            cash_register = CashRegister.objects.first()
            
            if not cash_register:
                # Crear caja por defecto si no existe ninguna
                try:
                    default_currency = Currency.objects.get(code='USD')
                except Currency.DoesNotExist:
                    # Fallback extremo si no hay monedas
                    default_currency = Currency.objects.create(code='USD', name='Dólar Americano', symbol='$')

                cash_register = CashRegister.objects.create(
                    register_number='CAJA-01',
                    cashier_name='Sistema',
                    currency=default_currency,
                    status='open'
                )
            
            validated_data['cash_register'] = cash_register

        # Validar nuevamente que la caja asignada no tenga turno abierto (por si se auto-asignó)
        if Shift.objects.filter(cash_register=validated_data['cash_register'], status='open').exists():
             raise serializers.ValidationError(
                {'cash_register': 'La caja automática asignada ya tiene un turno abierto.'}
            )

        # 2. Asignar datos de usuario
        # Si viene manager_name, usamos ese. Si no, el del token.
        manager_name = validated_data.pop('manager_name', None)
        
        validated_data['user_id'] = str(request.user.id)
        validated_data['user_name'] = manager_name if manager_name else request.user.get_full_name()
        validated_data['user_role'] = getattr(request.user, 'role', {}).get('name', '') if hasattr(request.user, 'role') else ''
        
        return super().create(validated_data)


class ShiftCloseSerializer(serializers.Serializer):
    """Serializer para cerrar turno"""
    
    closing_cash = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        min_value=0,
        required=True,
        help_text='Efectivo contado al cerrar caja'
    )
    closing_notes = serializers.CharField(
        required=False,
        allow_blank=True,
        help_text='Notas adicionales al cerrar'
    )


# ============================================================================
# DISCOUNT SERIALIZERS
# ============================================================================

class DiscountSerializer(serializers.ModelSerializer):
    """Serializer completo para descuentos"""
    
    is_currently_valid = serializers.SerializerMethodField()
    applicable_products_count = serializers.SerializerMethodField()
    applicable_categories_count = serializers.SerializerMethodField()
    usage_percentage = serializers.SerializerMethodField()
    
    class Meta:
        model = Discount
        fields = [
            'id',
            'code',
            'name',
            'description',
            'discount_type',
            'apply_to',
            'discount_value',
            'minimum_purchase',
            'maximum_discount',
            'max_uses',
            'max_uses_per_customer',
            'current_uses',
            'valid_from',
            'valid_until',
            'valid_days',
            'valid_hours',
            'applicable_products',
            'applicable_categories',
            'is_active',
            'is_public',
            'created_by',
            'created_at',
            'updated_at',
            'is_currently_valid',
            'applicable_products_count',
            'applicable_categories_count',
            'usage_percentage',
        ]
        # REVISADO: Correcto como lista
        read_only_fields = ['id', 'current_uses', 'created_at', 'updated_at']
    
    def get_is_currently_valid(self, obj):
        """Verifica si el descuento es válido ahora"""
        is_valid, _ = obj.is_valid()
        return is_valid
    
    def get_applicable_products_count(self, obj):
        """Cantidad de productos aplicables"""
        return obj.applicable_products.count()
    
    def get_applicable_categories_count(self, obj):
        """Cantidad de categorías aplicables"""
        return obj.applicable_categories.count()
    
    def get_usage_percentage(self, obj):
        """Porcentaje de uso si tiene límite"""
        if obj.max_uses:
            return round((obj.current_uses / obj.max_uses) * 100, 2)
        return None


class DiscountCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer para crear/actualizar descuentos"""
    
    class Meta:
        model = Discount
        fields = [
            'code',
            'name',
            'description',
            'discount_type',
            'apply_to',
            'discount_value',
            'minimum_purchase',
            'maximum_discount',
            'max_uses',
            'max_uses_per_customer',
            'valid_from',
            'valid_until',
            'valid_days',
            'valid_hours',
            'applicable_products',
            'applicable_categories',
            'is_active',
            'is_public',
        ]
    
    def validate_code(self, value):
        """Validar que el código sea único (case-insensitive)"""
        if self.instance:
            # Actualización: excluir el propio registro
            if Discount.objects.exclude(pk=self.instance.pk).filter(code__iexact=value).exists():
                raise serializers.ValidationError('Ya existe un descuento con este código')
        else:
            # Creación
            if Discount.objects.filter(code__iexact=value).exists():
                raise serializers.ValidationError('Ya existe un descuento con este código')
        return value.upper()
    
    def validate(self, data):
        """Validaciones cruzadas"""
        # Validar fechas
        if data.get('valid_from') and data.get('valid_until'):
            if data['valid_from'] >= data['valid_until']:
                raise serializers.ValidationError({
                    'valid_until': 'La fecha de fin debe ser posterior a la fecha de inicio'
                })
        
        # Validar valor del descuento según tipo
        if data.get('discount_type') == 'percentage':
            if data.get('discount_value', 0) > 100:
                raise serializers.ValidationError({
                    'discount_value': 'El porcentaje no puede ser mayor a 100'
                })
        
        # Validar que tenga productos o categorías si aplica
        if data.get('apply_to') in ['product', 'category']:
            products = data.get('applicable_products', [])
            categories = data.get('applicable_categories', [])
            
            if data['apply_to'] == 'product' and not products:
                raise serializers.ValidationError({
                    'applicable_products': 'Debe seleccionar al menos un producto'
                })
            
            if data['apply_to'] == 'category' and not categories:
                raise serializers.ValidationError({
                    'applicable_categories': 'Debe seleccionar al menos una categoría'
                })
        
        return data
    
    def create(self, validated_data):
        """Crear descuento con info del usuario"""
        request = self.context.get('request')
        if request and request.user:
            validated_data['created_by'] = str(request.user.id)
        return super().create(validated_data)


class DiscountValidateSerializer(serializers.Serializer):
    """Serializer para validar un descuento"""
    
    discount_code = serializers.CharField(max_length=50, required=True)
    customer_id = serializers.UUIDField(required=False, allow_null=True)
    order_amount = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        required=True,
        min_value=0
    )


# ============================================================================
# DISCOUNT USAGE SERIALIZERS
# ============================================================================

class DiscountUsageSerializer(serializers.ModelSerializer):
    """Serializer para registro de uso de descuentos"""
    
    discount_code = serializers.CharField(source='discount.code', read_only=True)
    discount_name = serializers.CharField(source='discount.name', read_only=True)
    order_number = serializers.CharField(source='order.order_number', read_only=True)
    customer_name = serializers.SerializerMethodField()
    
    class Meta:
        model = DiscountUsage
        fields = [
            'id',
            'discount',
            'discount_code',
            'discount_name',
            'order',
            'order_number',
            'customer',
            'customer_name',
            'discount_amount',
            'original_amount',
            'applied_by',
            'created_at',
        ]
        # REVISADO: Correcto como lista
        read_only_fields = ['id', 'created_at']
    
    def get_customer_name(self, obj):
        """Nombre del cliente"""
        if obj.customer:
            return obj.customer.get_full_name()
        return None


# ============================================================================
# TABLE SERIALIZERS
# ============================================================================

class TableSerializer(serializers.ModelSerializer):
    """Serializer para mesas"""
    
    is_available = serializers.ReadOnlyField()
    current_order_number = serializers.CharField(
        source='current_order.order_number',
        read_only=True
    )
    
    class Meta:
        model = Table
        fields = [
            'id',
            'number',
            'name',
            'capacity',
            'status',
            'section',
            'floor',
            'current_order',
            'current_order_number',
            'waiter_id',
            'waiter_name',
            'is_active',
            'is_vip',
            'qr_code',
            'notes',
            'is_available',
            'created_at',
            'updated_at',
        ]
        # REVISADO: Correcto como lista
        read_only_fields = ['id', 'qr_code', 'created_at', 'updated_at']


class TableCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer para crear/actualizar mesas"""
    
    class Meta:
        model = Table
        fields = [
            'number',
            'name',
            'capacity',
            'section',
            'floor',
            'is_active',
            'is_vip',
            'notes',
        ]
    
    def validate_number(self, value):
        """Validar que el número sea único"""
        if self.instance:
            if Table.objects.exclude(pk=self.instance.pk).filter(number=value).exists():
                raise serializers.ValidationError('Ya existe una mesa con este número')
        else:
            if Table.objects.filter(number=value).exists():
                raise serializers.ValidationError('Ya existe una mesa con este número')
        return value


class TableOccupySerializer(serializers.Serializer):
    """Serializer para ocupar una mesa"""
    
    order_id = serializers.UUIDField(required=True)
    waiter_id = serializers.CharField(max_length=50, required=False, allow_blank=True)
    waiter_name = serializers.CharField(max_length=200, required=False, allow_blank=True)


# ============================================================================
# DAILY SUMMARY SERIALIZERS (MEJORADOS)
# ============================================================================

class DailySummarySerializer(serializers.ModelSerializer):
    """Serializer para resúmenes diarios (incluye datos detallados)"""
    
    # 1. Definir campos DecimalField como FloatField para serialización segura
    total_sales = serializers.FloatField(read_only=True)
    total_discounts = serializers.FloatField(read_only=True)
    total_tips = serializers.FloatField(read_only=True)
    average_order_value = serializers.FloatField(read_only=True)
    average_items_per_order = serializers.FloatField(read_only=True)
    
    # Campo temporal para adjuntar la lista de órdenes detalladas para el reporte
    orders_detail = serializers.ListField(
        child=serializers.DictField(), 
        required=False, 
        allow_empty=True,
        write_only=False 
    )

    date_formatted = serializers.SerializerMethodField()
    cash_percentage = serializers.SerializerMethodField()
    card_percentage = serializers.SerializerMethodField()
    dine_in_percentage = serializers.SerializerMethodField()
    
    class Meta:
        model = DailySummary
        # 2. Asegúrate de que 'fields' es una lista []
        fields = [
            'id',
            'date',
            'date_formatted',
            'total_sales',
            'total_orders',
            'total_customers',
            'total_items_sold',
            'cash_sales',
            'card_sales',
            'other_sales',
            'cash_percentage',
            'card_percentage',
            'dine_in_sales',
            'takeout_sales',
            'delivery_sales',
            'dine_in_percentage',
            'total_discounts',
            'total_tips',
            'average_order_value',
            'average_items_per_order',
            'total_shifts',
            'closed_shifts',
            'top_products',
            'sales_by_hour',
            'is_closed',
            'closing_notes',
            'generated_at',
            'generated_by',
            'orders_detail', # <--- CAMPO AÑADIDO PARA EL DETALLE DE ÓRDENES
        ]
        read_only_fields = ('__all__',)

    
    def get_date_formatted(self, obj):
        """Fecha formateada"""
        return obj.date.strftime('%Y-%m-%d')
    
    def get_cash_percentage(self, obj):
        """Porcentaje de ventas en efectivo"""
        # Se accede a la propiedad del Modelo (models.py) que ya maneja la división por cero
        return float(obj.cash_percentage) if obj.cash_percentage is not None else 0
    
    def get_card_percentage(self, obj):
        """Porcentaje de ventas con tarjeta"""
        return float(obj.card_percentage) if obj.card_percentage is not None else 0
    
    def get_dine_in_percentage(self, obj):
        """Porcentaje de ventas dine-in"""
        return float(obj.dine_in_percentage) if obj.dine_in_percentage is not None else 0
class DailySummaryGenerateSerializer(serializers.Serializer):
    """Serializer para generar reporte diario"""
    
    date = serializers.DateField(required=True)
    detailed = serializers.BooleanField(default=True)


class ReportRequestSerializer(serializers.Serializer):
    """Serializer para solicitar reportes"""
    
    report_type = serializers.ChoiceField(
        choices=[('daily', 'Diario'), ('weekly', 'Semanal'), ('monthly', 'Mensual')],
        default='daily'
    )
    
    date = serializers.DateField(required=False)
    start_date = serializers.DateField(required=False)
    end_date = serializers.DateField(required=False)
    year = serializers.IntegerField(required=False, min_value=2000, max_value=2100)
    month = serializers.IntegerField(required=False, min_value=1, max_value=12)
    
    def validate(self, data):
        """Validar combinación de parámetros"""
        report_type = data.get('report_type')
        
        if report_type == 'daily':
            if not data.get('date'):
                from django.utils import timezone
                data['date'] = timezone.now().date()
        
        elif report_type == 'weekly':
            if not data.get('start_date'):
                # Por defecto, semana actual
                from django.utils import timezone
                today = timezone.now().date()
                data['start_date'] = today - timedelta(days=today.weekday())
                data['end_date'] = data['start_date'] + timedelta(days=6)
        
        elif report_type == 'monthly':
            if not data.get('year') or not data.get('month'):
                from django.utils import timezone
                today = timezone.now().date()
                data['year'] = today.year
                data['month'] = today.month
        
        return data

class CloseDaySerializer(serializers.Serializer):
    """Serializer para cerrar el día"""
    
    date = serializers.DateField(required=False)
    closing_notes = serializers.CharField(required=False, allow_blank=True)
    
    def validate(self, data):
        from django.utils import timezone
        if not data.get('date'):
            data['date'] = timezone.now().date()
        return data


class DateRangeSerializer(serializers.Serializer):
    """Serializer para rango de fechas"""
    
    start_date = serializers.DateField(required=True)
    end_date = serializers.DateField(required=True)
    
    def validate(self, data):
        if data['start_date'] > data['end_date']:
            raise serializers.ValidationError({
                'start_date': 'La fecha de inicio debe ser menor o igual a la fecha de fin'
            })
        
        # Limitar a 90 días máximo
        delta = data['end_date'] - data['start_date']
        if delta.days > 90:
            raise serializers.ValidationError({
                'range': 'El rango máximo permitido es de 90 días'
            })
        
        return data