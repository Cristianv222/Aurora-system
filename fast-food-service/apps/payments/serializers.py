from rest_framework import serializers
from django.db import transaction
from decimal import Decimal

from .models import (
    Currency, ExchangeRate, PaymentMethod, Payment, 
    SplitPayment, Refund, CashRegister, CashMovement
)
from apps.orders.serializers import OrderListSerializer


class CurrencySerializer(serializers.ModelSerializer):
    """Serializer para monedas"""
    
    class Meta:
        model = Currency
        fields = [
            'id', 'code', 'name', 'symbol', 'is_default',
            'is_active', 'decimal_places', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def validate(self, data):
        """Validar que solo haya una moneda por defecto"""
        if data.get('is_default'):
            # Si ya existe otra moneda por defecto, dar advertencia
            existing_default = Currency.objects.filter(
                is_default=True
            ).exclude(pk=self.instance.pk if self.instance else None).first()
            
            if existing_default:
                # El save() del modelo ya maneja esto, pero informamos
                pass
        
        return data


class ExchangeRateSerializer(serializers.ModelSerializer):
    """Serializer para tasas de cambio"""
    from_currency_code = serializers.CharField(source='from_currency.code', read_only=True)
    to_currency_code = serializers.CharField(source='to_currency.code', read_only=True)
    from_currency_name = serializers.CharField(source='from_currency.name', read_only=True)
    to_currency_name = serializers.CharField(source='to_currency.name', read_only=True)
    
    class Meta:
        model = ExchangeRate
        fields = [
            'id', 'from_currency', 'from_currency_code', 'from_currency_name',
            'to_currency', 'to_currency_code', 'to_currency_name',
            'rate', 'source', 'is_active', 'notes', 'updated_by',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class ExchangeRateCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer para crear/actualizar tasas de cambio"""
    
    class Meta:
        model = ExchangeRate
        fields = [
            'from_currency', 'to_currency', 'rate', 
            'source', 'is_active', 'notes', 'updated_by'
        ]
    
    def validate(self, data):
        """Validar que las monedas sean diferentes"""
        if data['from_currency'] == data['to_currency']:
            raise serializers.ValidationError(
                'Las monedas de origen y destino deben ser diferentes'
            )
        return data


class CurrencyConversionSerializer(serializers.Serializer):
    """Serializer para convertir montos entre monedas"""
    amount = serializers.DecimalField(max_digits=10, decimal_places=2)
    from_currency = serializers.CharField(max_length=3)
    to_currency = serializers.CharField(max_length=3)
    
    def validate_from_currency(self, value):
        """Validar que la moneda de origen exista"""
        if not Currency.objects.filter(code=value, is_active=True).exists():
            raise serializers.ValidationError(f'La moneda {value} no existe o no está activa')
        return value
    
    def validate_to_currency(self, value):
        """Validar que la moneda de destino exista"""
        if not Currency.objects.filter(code=value, is_active=True).exists():
            raise serializers.ValidationError(f'La moneda {value} no existe o no está activa')
        return value
    
    def convert(self):
        """Realiza la conversión"""
        amount = self.validated_data['amount']
        from_currency = self.validated_data['from_currency']
        to_currency = self.validated_data['to_currency']
        
        try:
            converted_amount = ExchangeRate.convert(amount, from_currency, to_currency)
            rate = ExchangeRate.get_rate(from_currency, to_currency)
            
            return {
                'original_amount': float(amount),
                'from_currency': from_currency,
                'to_currency': to_currency,
                'exchange_rate': float(rate) if rate else None,
                'converted_amount': float(converted_amount),
            }
        except ValueError as e:
            raise serializers.ValidationError(str(e))


class PaymentMethodSerializer(serializers.ModelSerializer):
    """Serializer para métodos de pago"""
    method_type_display = serializers.CharField(
        source='get_method_type_display',
        read_only=True
    )
    
    class Meta:
        model = PaymentMethod
        fields = [
            'id', 'name', 'method_type', 'method_type_display',
            'is_active', 'requires_authorization', 'gateway_name',
            'gateway_config', 'minimum_amount', 'maximum_amount',
            'display_order', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class PaymentListSerializer(serializers.ModelSerializer):
    """Serializer simplificado para listados de pagos"""
    order_number = serializers.CharField(source='order.order_number', read_only=True)
    payment_method_name = serializers.CharField(source='payment_method.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    currency_code = serializers.CharField(source='currency.code', read_only=True)
    currency_symbol = serializers.CharField(source='currency.symbol', read_only=True)
    
    class Meta:
        model = Payment
        fields = [
            'id', 'payment_number', 'order', 'order_number',
            'payment_method', 'payment_method_name', 'currency',
            'currency_code', 'currency_symbol', 'amount',
            'status', 'status_display', 'created_at'
        ]
        read_only_fields = ['id', 'payment_number', 'created_at']


class PaymentDetailSerializer(serializers.ModelSerializer):
    """Serializer completo para detalle de pagos"""
    order = OrderListSerializer(read_only=True)
    payment_method = PaymentMethodSerializer(read_only=True)
    currency = CurrencySerializer(read_only=True)
    original_currency = CurrencySerializer(read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    # Montos convertidos
    amount_in_default_currency = serializers.SerializerMethodField()
    
    class Meta:
        model = Payment
        fields = [
            'id', 'payment_number', 'order', 'payment_method',
            'currency', 'amount', 'amount_received', 'change_amount',
            'original_amount', 'original_currency', 'exchange_rate',
            'amount_in_default_currency', 'status', 'status_display',
            'transaction_id', 'authorization_code', 'reference_number',
            'notes', 'card_last_four', 'card_brand', 'gateway_response',
            'cash_register', 'created_at', 'updated_at',
            'processed_at', 'completed_at'
        ]
        read_only_fields = [
            'id', 'payment_number', 'created_at', 'updated_at',
            'processed_at', 'completed_at'
        ]
    
    def get_amount_in_default_currency(self, obj):
        """Convierte el monto a la moneda por defecto"""
        default_currency = Currency.get_default()
        if not default_currency or obj.currency.code == default_currency.code:
            return float(obj.amount)
        
        try:
            converted = obj.get_amount_in_currency(default_currency.code)
            return float(converted)
        except ValueError:
            return None


class PaymentCreateSerializer(serializers.Serializer):
    """Serializer para crear pagos"""
    order_id = serializers.UUIDField()
    payment_method_id = serializers.UUIDField()
    currency_code = serializers.CharField(max_length=3)
    amount = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        required=False,
        help_text='Opcional: si no se envía, se usa el total de la orden'
    )
    amount_received = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        required=False,
        default=0
    )
    notes = serializers.CharField(required=False, allow_blank=True)
    card_last_four = serializers.CharField(max_length=4, required=False, allow_blank=True)
    card_brand = serializers.CharField(max_length=20, required=False, allow_blank=True)
    cash_register_id = serializers.UUIDField(required=False, allow_null=True)
    
    def validate_order_id(self, value):
        """Validar que la orden exista"""
        from apps.orders.models import Order
        try:
            order = Order.objects.get(id=value)
            # Validar que la orden no esté ya pagada
            if order.payment_status == 'paid':
                raise serializers.ValidationError('Esta orden ya está pagada')
            return value
        except Order.DoesNotExist:
            raise serializers.ValidationError('Orden no encontrada')
    
    def validate_payment_method_id(self, value):
        """Validar que el método de pago exista y esté activo"""
        try:
            method = PaymentMethod.objects.get(id=value)
            if not method.is_active:
                raise serializers.ValidationError('Este método de pago no está disponible')
            return value
        except PaymentMethod.DoesNotExist:
            raise serializers.ValidationError('Método de pago no encontrado')
    
    def validate_currency_code(self, value):
        """Validar que la moneda exista y esté activa"""
        try:
            currency = Currency.objects.get(code=value)
            if not currency.is_active:
                raise serializers.ValidationError('Esta moneda no está activa')
            return value
        except Currency.DoesNotExist:
            raise serializers.ValidationError('Moneda no encontrada')
    
    def validate_cash_register_id(self, value):
        """Validar que la caja registradora exista y esté abierta"""
        if value:
            try:
                register = CashRegister.objects.get(id=value)
                if register.status != 'open':
                    raise serializers.ValidationError('La caja registradora no está abierta')
                return value
            except CashRegister.DoesNotExist:
                raise serializers.ValidationError('Caja registradora no encontrada')
        return value
    
    @transaction.atomic
    def create(self, validated_data):
        """Crea el pago con conversión de moneda si es necesario"""
        from apps.orders.models import Order
        
        order = Order.objects.get(id=validated_data['order_id'])
        payment_method = PaymentMethod.objects.get(id=validated_data['payment_method_id'])
        currency = Currency.objects.get(code=validated_data['currency_code'])
        
        # Obtener moneda por defecto (moneda de la orden)
        default_currency = Currency.get_default()
        
        # Monto a pagar (puede ser diferente al total de la orden si es pago parcial)
        amount = validated_data.get('amount')
        if not amount:
            # Si no se especifica monto, usar el total de la orden
            if currency.code == default_currency.code:
                amount = order.total
            else:
                # Convertir el total de la orden a la moneda del pago
                amount = ExchangeRate.convert(
                    order.total,
                    default_currency.code,
                    currency.code
                )
        
        # Calcular tasa de cambio y monto original
        if currency.code == default_currency.code:
            # No hay conversión
            exchange_rate = Decimal('1.0000')
            original_amount = amount
        else:
            # Obtener tasa de cambio
            exchange_rate = ExchangeRate.get_rate(default_currency.code, currency.code)
            # Calcular monto original (en moneda de la orden)
            original_amount = ExchangeRate.convert(
                amount,
                currency.code,
                default_currency.code
            )
        
        # Crear el pago
        payment = Payment.objects.create(
            order=order,
            payment_method=payment_method,
            currency=currency,
            amount=amount,
            amount_received=validated_data.get('amount_received', 0),
            original_amount=original_amount,
            original_currency=default_currency,
            exchange_rate=exchange_rate,
            notes=validated_data.get('notes', ''),
            card_last_four=validated_data.get('card_last_four', ''),
            card_brand=validated_data.get('card_brand', ''),
            cash_register_id=validated_data.get('cash_register_id'),
            status='pending'
        )
        
        return payment


class RefundSerializer(serializers.ModelSerializer):
    """Serializer para reembolsos"""
    payment_number = serializers.CharField(source='payment.payment_number', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    currency_code = serializers.CharField(source='currency.code', read_only=True)
    currency_symbol = serializers.CharField(source='currency.symbol', read_only=True)
    
    class Meta:
        model = Refund
        fields = [
            'id', 'refund_number', 'payment', 'payment_number',
            'amount', 'currency', 'currency_code', 'currency_symbol',
            'status', 'status_display', 'reason', 'refund_transaction_id',
            'gateway_response', 'approved_by', 'created_at',
            'processed_at', 'completed_at'
        ]
        read_only_fields = [
            'id', 'refund_number', 'created_at',
            'processed_at', 'completed_at'
        ]


class RefundCreateSerializer(serializers.Serializer):
    """Serializer para crear reembolsos"""
    payment_id = serializers.UUIDField()
    amount = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        required=False,
        help_text='Opcional: si no se envía, se reembolsa el monto completo'
    )
    reason = serializers.CharField()
    approved_by = serializers.CharField(required=False, allow_blank=True)
    
    def validate_payment_id(self, value):
        """Validar que el pago exista y esté completado"""
        try:
            payment = Payment.objects.get(id=value)
            if payment.status != 'completed':
                raise serializers.ValidationError(
                    'Solo se pueden reembolsar pagos completados'
                )
            return value
        except Payment.DoesNotExist:
            raise serializers.ValidationError('Pago no encontrado')
    
    def validate(self, data):
        """Validar el monto del reembolso"""
        payment = Payment.objects.get(id=data['payment_id'])
        amount = data.get('amount', payment.amount)
        
        if amount > payment.amount:
            raise serializers.ValidationError(
                'El monto de reembolso no puede ser mayor al pago'
            )
        
        # Verificar reembolsos previos
        previous_refunds = payment.refunds.filter(
            status='completed'
        ).aggregate(total=models.Sum('amount'))['total'] or 0
        
        if previous_refunds + amount > payment.amount:
            raise serializers.ValidationError(
                'El monto total de reembolsos excede el monto del pago'
            )
        
        data['amount'] = amount
        return data
    
    @transaction.atomic
    def create(self, validated_data):
        """Crea el reembolso"""
        payment = Payment.objects.get(id=validated_data['payment_id'])
        
        success, result = payment.process_refund(
            amount=validated_data.get('amount'),
            reason=validated_data['reason']
        )
        
        if not success:
            raise serializers.ValidationError(result)
        
        # Actualizar campo approved_by si se proporcionó
        if validated_data.get('approved_by'):
            result.approved_by = validated_data['approved_by']
            result.save()
        
        return result


class CashRegisterSerializer(serializers.ModelSerializer):
    """Serializer para cajas registradoras"""
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    currency_code = serializers.CharField(source='currency.code', read_only=True)
    currency_symbol = serializers.CharField(source='currency.symbol', read_only=True)
    
    class Meta:
        model = CashRegister
        fields = [
            'id', 'register_number', 'cashier_name', 'status',
            'status_display', 'currency', 'currency_code', 'currency_symbol',
            'opening_cash', 'closing_cash', 'expected_cash',
            'cash_difference', 'total_sales', 'total_cash',
            'total_card', 'total_other', 'transaction_count',
            'opening_notes', 'closing_notes', 'opened_at', 'closed_at'
        ]
        read_only_fields = [
            'id', 'closing_cash', 'expected_cash', 'cash_difference',
            'total_sales', 'total_cash', 'total_card', 'total_other',
            'transaction_count', 'opened_at', 'closed_at'
        ]


class CashRegisterOpenSerializer(serializers.Serializer):
    """Serializer para abrir caja registradora"""
    register_number = serializers.CharField(max_length=20)
    cashier_name = serializers.CharField(max_length=100)
    currency_code = serializers.CharField(max_length=3)
    opening_cash = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0
    )
    opening_notes = serializers.CharField(required=False, allow_blank=True)
    
    def validate_currency_code(self, value):
        """Validar que la moneda exista"""
        try:
            Currency.objects.get(code=value, is_active=True)
            return value
        except Currency.DoesNotExist:
            raise serializers.ValidationError('Moneda no encontrada o inactiva')
    
    def create(self, validated_data):
        """Crea y abre una caja registradora"""
        currency = Currency.objects.get(code=validated_data['currency_code'])
        
        cash_register = CashRegister.objects.create(
            register_number=validated_data['register_number'],
            cashier_name=validated_data['cashier_name'],
            currency=currency,
            opening_cash=validated_data['opening_cash'],
            opening_notes=validated_data.get('opening_notes', ''),
            status='open'
        )
        
        return cash_register


class CashRegisterCloseSerializer(serializers.Serializer):
    """Serializer para cerrar caja registradora"""
    closing_cash = serializers.DecimalField(max_digits=10, decimal_places=2)
    closing_notes = serializers.CharField(required=False, allow_blank=True)
    
    def validate_closing_cash(self, value):
        """Validar que el monto sea positivo"""
        if value < 0:
            raise serializers.ValidationError('El monto no puede ser negativo')
        return value


class CashMovementSerializer(serializers.ModelSerializer):
    """Serializer para movimientos de efectivo"""
    movement_type_display = serializers.CharField(
        source='get_movement_type_display',
        read_only=True
    )
    reason_display = serializers.CharField(
        source='get_reason_display',
        read_only=True
    )
    
    class Meta:
        model = CashMovement
        fields = [
            'id', 'cash_register', 'movement_type', 'movement_type_display',
            'reason', 'reason_display', 'amount', 'description',
            'performed_by', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']
    
    def validate(self, data):
        """Validar que la caja esté abierta"""
        if data['cash_register'].status != 'open':
            raise serializers.ValidationError(
                'No se pueden registrar movimientos en una caja cerrada'
            )
        return data