from django.db import models
from django.utils import timezone
from django.core.validators import MinValueValidator
from decimal import Decimal
import uuid


class Currency(models.Model):
    """Monedas disponibles en el sistema"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(
        max_length=3,
        unique=True,
        verbose_name='Código ISO',
        help_text='USD, COP, EUR, etc.'
    )
    name = models.CharField(max_length=50, verbose_name='Nombre')
    symbol = models.CharField(
        max_length=10,
        verbose_name='Símbolo',
        help_text='$, COP$, €, etc.'
    )
    
    is_default = models.BooleanField(
        default=False,
        verbose_name='Moneda por Defecto',
        help_text='La moneda base del sistema (generalmente USD)'
    )
    is_active = models.BooleanField(default=True, verbose_name='Activa')
    
    # Decimales para esta moneda
    decimal_places = models.PositiveIntegerField(
        default=2,
        verbose_name='Decimales',
        help_text='Cantidad de decimales (USD=2, JPY=0, etc.)'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Moneda'
        verbose_name_plural = 'Monedas'
        ordering = ['name']
    
    def __str__(self):
        return f'{self.code} - {self.name}'
    
    def save(self, *args, **kwargs):
        # Solo puede haber una moneda por defecto
        if self.is_default:
            Currency.objects.filter(is_default=True).exclude(pk=self.pk).update(is_default=False)
        super().save(*args, **kwargs)
    
    @classmethod
    def get_default(cls):
        """Obtiene la moneda por defecto del sistema"""
        return cls.objects.filter(is_default=True, is_active=True).first()


class ExchangeRate(models.Model):
    """Tasas de cambio entre monedas"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    from_currency = models.ForeignKey(
        Currency,
        on_delete=models.CASCADE,
        related_name='rates_from',
        verbose_name='Desde'
    )
    
    to_currency = models.ForeignKey(
        Currency,
        on_delete=models.CASCADE,
        related_name='rates_to',
        verbose_name='Hacia'
    )
    
    rate = models.DecimalField(
        max_digits=12,
        decimal_places=4,
        validators=[MinValueValidator(0.0001)],
        verbose_name='Tasa de Cambio',
        help_text='1 unidad de "Desde" = X unidades de "Hacia". Ej: 1 USD = 4200 COP'
    )
    
    # Para tracking y auditoría
    source = models.CharField(
        max_length=50,
        blank=True,
        verbose_name='Fuente',
        help_text='Manual, API, Banco, etc.'
    )
    
    is_active = models.BooleanField(default=True, verbose_name='Activa')
    
    # Auditoría
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.CharField(
        max_length=100,
        blank=True,
        verbose_name='Actualizado por'
    )
    
    notes = models.TextField(blank=True, verbose_name='Notas')
    
    class Meta:
        verbose_name = 'Tasa de Cambio'
        verbose_name_plural = 'Tasas de Cambio'
        ordering = ['-updated_at']
        unique_together = ['from_currency', 'to_currency']
        indexes = [
            models.Index(fields=['from_currency', 'to_currency', 'is_active']),
            models.Index(fields=['updated_at']),
        ]
    
    def __str__(self):
        return f'1 {self.from_currency.code} = {self.rate} {self.to_currency.code}'
    
    @classmethod
    def convert(cls, amount, from_currency_code, to_currency_code):
        """
        Convierte un monto de una moneda a otra
        
        Args:
            amount: Monto a convertir
            from_currency_code: Código de moneda origen (ej: 'USD')
            to_currency_code: Código de moneda destino (ej: 'COP')
        
        Returns:
            Monto convertido
        
        Raises:
            ValueError: Si no existe tasa de cambio
        """
        # Si son la misma moneda, no hay conversión
        if from_currency_code == to_currency_code:
            return Decimal(amount)
        
        try:
            # Intentar conversión directa
            rate = cls.objects.get(
                from_currency__code=from_currency_code,
                to_currency__code=to_currency_code,
                is_active=True
            )
            return Decimal(amount) * rate.rate
        
        except cls.DoesNotExist:
            # Intentar conversión inversa
            try:
                rate = cls.objects.get(
                    from_currency__code=to_currency_code,
                    to_currency__code=from_currency_code,
                    is_active=True
                )
                return Decimal(amount) / rate.rate
            
            except cls.DoesNotExist:
                raise ValueError(
                    f'No hay tasa de cambio disponible de {from_currency_code} a {to_currency_code}'
                )
    
    @classmethod
    def get_rate(cls, from_currency_code, to_currency_code):
        """
        Obtiene la tasa de cambio activa entre dos monedas
        
        Returns:
            Decimal: Tasa de cambio o None si no existe
        """
        if from_currency_code == to_currency_code:
            return Decimal('1.0000')
        
        try:
            rate = cls.objects.get(
                from_currency__code=from_currency_code,
                to_currency__code=to_currency_code,
                is_active=True
            )
            return rate.rate
        except cls.DoesNotExist:
            try:
                rate = cls.objects.get(
                    from_currency__code=to_currency_code,
                    to_currency__code=from_currency_code,
                    is_active=True
                )
                return Decimal('1') / rate.rate
            except cls.DoesNotExist:
                return None


class PaymentMethod(models.Model):
    """Métodos de pago disponibles"""
    METHOD_TYPES = [
        ('cash', 'Efectivo'),
        ('credit_card', 'Tarjeta de Crédito'),
        ('debit_card', 'Tarjeta de Débito'),
        ('bank_transfer', 'Transferencia Bancaria'),
        ('mobile_payment', 'Pago Móvil'),
        ('gift_card', 'Tarjeta de Regalo'),
        ('voucher', 'Vale'),
        ('online', 'Pago en Línea'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, verbose_name='Nombre')
    method_type = models.CharField(
        max_length=20,
        choices=METHOD_TYPES,
        verbose_name='Tipo de Método'
    )
    
    # Configuración
    is_active = models.BooleanField(default=True, verbose_name='Activo')
    requires_authorization = models.BooleanField(
        default=False,
        verbose_name='Requiere Autorización',
        help_text='Si requiere aprobación bancaria/procesador'
    )
    
    # Para integraciones externas
    gateway_name = models.CharField(
        max_length=50,
        blank=True,
        verbose_name='Nombre del Gateway',
        help_text='Ej: stripe, paypal, payphone'
    )
    
    gateway_config = models.JSONField(
        default=dict,
        blank=True,
        verbose_name='Configuración del Gateway',
        help_text='API keys, webhooks, etc.'
    )
    
    # Límites opcionales
    minimum_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name='Monto Mínimo'
    )
    
    maximum_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name='Monto Máximo'
    )
    
    # Orden de visualización
    display_order = models.PositiveIntegerField(default=0, verbose_name='Orden')
    
    # Auditoría
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Método de Pago'
        verbose_name_plural = 'Métodos de Pago'
        ordering = ['display_order', 'name']
    
    def __str__(self):
        return f'{self.name} ({self.get_method_type_display()})'
    
    def is_available_for_amount(self, amount):
        """Verifica si el método está disponible para un monto específico"""
        if not self.is_active:
            return False
        
        if self.minimum_amount and amount < self.minimum_amount:
            return False
        
        if self.maximum_amount and amount > self.maximum_amount:
            return False
        
        return True


class Payment(models.Model):
    """Pago de una orden"""
    PAYMENT_STATUS = [
        ('pending', 'Pendiente'),
        ('processing', 'Procesando'),
        ('completed', 'Completado'),
        ('failed', 'Fallido'),
        ('cancelled', 'Cancelado'),
        ('refunded', 'Reembolsado'),
        ('partially_refunded', 'Parcialmente Reembolsado'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    payment_number = models.CharField(
        max_length=20,
        unique=True,
        verbose_name='Número de Pago'
    )
    
    # Relación con la orden
    order = models.ForeignKey(
        'orders.Order',
        on_delete=models.PROTECT,
        related_name='payments',
        verbose_name='Orden'
    )
    
    # Método de pago
    payment_method = models.ForeignKey(
        PaymentMethod,
        on_delete=models.PROTECT,
        verbose_name='Método de Pago'
    )
    
    # === MONEDA Y CONVERSIÓN ===
    
    # Moneda en la que se realizó el pago
    currency = models.ForeignKey(
        Currency,
        on_delete=models.PROTECT,
        related_name='payments',
        verbose_name='Moneda del Pago'
    )
    
    # Monto en la moneda del pago
    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)],
        verbose_name='Monto'
    )
    
    # Monto recibido (para efectivo)
    amount_received = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
        verbose_name='Monto Recibido',
        help_text='Para efectivo, el monto que entregó el cliente'
    )
    
    # Cambio (para efectivo)
    change_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
        verbose_name='Cambio'
    )
    
    # === INFORMACIÓN DE CONVERSIÓN ===
    
    # Monto original (en moneda de la orden, generalmente USD)
    original_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)],
        verbose_name='Monto Original',
        help_text='Monto en la moneda base de la orden'
    )
    
    # Moneda original de la orden
    original_currency = models.ForeignKey(
        Currency,
        on_delete=models.PROTECT,
        related_name='original_payments',
        verbose_name='Moneda Original'
    )
    
    # Tasa de cambio utilizada
    exchange_rate = models.DecimalField(
        max_digits=12,
        decimal_places=4,
        null=True,
        blank=True,
        verbose_name='Tasa de Cambio Aplicada',
        help_text='Tasa usada en el momento del pago'
    )
    
    # === ESTADO Y TRANSACCIÓN ===
    
    status = models.CharField(
        max_length=20, 
        choices=PAYMENT_STATUS,
        default='pending',
        verbose_name='Estado'
    )
    
    # Información de transacción
    transaction_id = models.CharField(
        max_length=100,
        blank=True,
        verbose_name='ID de Transacción',
        help_text='ID del procesador de pagos'
    )
    
    authorization_code = models.CharField(
        max_length=50,
        blank=True,
        verbose_name='Código de Autorización'
    )
    
    reference_number = models.CharField(
        max_length=100,
        blank=True,
        verbose_name='Número de Referencia'
    )
    
    # Información adicional
    notes = models.TextField(blank=True, verbose_name='Notas')
    
    # Información de tarjeta (últimos 4 dígitos)
    card_last_four = models.CharField(
        max_length=4,
        blank=True,
        verbose_name='Últimos 4 dígitos'
    )
    
    card_brand = models.CharField(
        max_length=20,
        blank=True,
        verbose_name='Marca de Tarjeta',
        help_text='Visa, Mastercard, etc.'
    )
    
    # Respuesta del gateway (para debugging)
    gateway_response = models.JSONField(
        default=dict,
        blank=True,
        verbose_name='Respuesta del Gateway'
    )
    
    # Caja registradora asociada
    cash_register = models.ForeignKey(
        'CashRegister',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='payments',
        verbose_name='Caja Registradora'
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Fecha de Creación')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Última Actualización')
    processed_at = models.DateTimeField(null=True, blank=True, verbose_name='Procesado')
    completed_at = models.DateTimeField(null=True, blank=True, verbose_name='Completado')
    
    class Meta:
        verbose_name = 'Pago'
        verbose_name_plural = 'Pagos'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['payment_number']),
            models.Index(fields=['order', 'status']),
            models.Index(fields=['payment_method', 'status']),
            models.Index(fields=['currency']),
            models.Index(fields=['created_at']),
        ]
    
    def __str__(self):
        return f'Pago #{self.payment_number} - {self.currency.symbol}{self.amount}'
    
    def save(self, *args, **kwargs):
        # Generar número de pago si no existe
        if not self.payment_number:
            self.payment_number = self.generate_payment_number()
        
        # Calcular cambio para efectivo
        if self.payment_method.method_type == 'cash':
            self.change_amount = max(0, self.amount_received - self.amount)
        
        super().save(*args, **kwargs)
    
    @staticmethod
    def generate_payment_number():
        """Genera un número de pago único"""
        from datetime import datetime
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        random_suffix = str(uuid.uuid4().hex[:4]).upper()
        return f'PAY-{timestamp}-{random_suffix}'
    
    def mark_as_completed(self):
        """Marca el pago como completado"""
        if self.status in ['pending', 'processing']:
            self.status = 'completed'
            self.completed_at = timezone.now()
            self.save()
            
            # Actualizar estado de pago de la orden
            self.order.payment_status = 'paid'
            self.order.save()
            
            return True
        return False
    
    def mark_as_failed(self, reason=''):
        """Marca el pago como fallido"""
        self.status = 'failed'
        if reason:
            self.notes = f'{self.notes}\nFallo: {reason}'.strip()
        self.save()
        
        # Actualizar estado de pago de la orden
        self.order.payment_status = 'failed'
        self.order.save()
        
        return True
    
    def get_amount_in_currency(self, target_currency_code):
        """
        Convierte el monto del pago a otra moneda
        
        Args:
            target_currency_code: Código de moneda destino
        
        Returns:
            Monto convertido
        """
        return ExchangeRate.convert(
            self.amount,
            self.currency.code,
            target_currency_code
        )
    
    def process_refund(self, amount=None, reason=''):
        """Procesa un reembolso"""
        if self.status != 'completed':
            return False, 'Solo se pueden reembolsar pagos completados'
        
        refund_amount = amount if amount else self.amount
        
        if refund_amount > self.amount:
            return False, 'El monto de reembolso no puede ser mayor al pago'
        
        # Crear registro de reembolso
        refund = Refund.objects.create(
            payment=self,
            amount=refund_amount,
            currency=self.currency,
            reason=reason
        )
        
        # Actualizar estado del pago
        if refund_amount == self.amount:
            self.status = 'refunded'
        else:
            self.status = 'partially_refunded'
        
        self.save()
        
        return True, refund


class SplitPayment(models.Model):
    """División de pagos (cuando una orden se paga con múltiples métodos)"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.ForeignKey(
        'orders.Order',
        on_delete=models.CASCADE,
        related_name='split_payments',
        verbose_name='Orden'
    )
    
    payment = models.ForeignKey(
        Payment,
        on_delete=models.CASCADE,
        related_name='splits',
        verbose_name='Pago'
    )
    
    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)],
        verbose_name='Monto'
    )
    
    description = models.CharField(
        max_length=255,
        blank=True,
        verbose_name='Descripción'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = 'División de Pago'
        verbose_name_plural = 'Divisiones de Pago'
        ordering = ['created_at']
    
    def __str__(self):
        return f'{self.order.order_number} - ${self.amount}'


class Refund(models.Model):
    """Reembolsos de pagos"""
    REFUND_STATUS = [
        ('pending', 'Pendiente'),
        ('processing', 'Procesando'),
        ('completed', 'Completado'),
        ('failed', 'Fallido'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    refund_number = models.CharField(
        max_length=20,
        unique=True,
        verbose_name='Número de Reembolso'
    )
    
    payment = models.ForeignKey(
        Payment,
        on_delete=models.PROTECT,
        related_name='refunds',
        verbose_name='Pago'
    )
    
    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)],
        verbose_name='Monto'
    )
    
    currency = models.ForeignKey(
        Currency,
        on_delete=models.PROTECT,
        verbose_name='Moneda'
    )
    
    status = models.CharField(
        max_length=20,
        choices=REFUND_STATUS,
        default='pending',
        verbose_name='Estado'
    )
    
    reason = models.TextField(verbose_name='Razón')
    
    # Información de transacción del reembolso
    refund_transaction_id = models.CharField(
        max_length=100,
        blank=True,
        verbose_name='ID de Transacción de Reembolso'
    )
    
    gateway_response = models.JSONField(
        default=dict,
        blank=True,
        verbose_name='Respuesta del Gateway'
    )
    
    # Usuario que aprobó el reembolso
    approved_by = models.CharField(
        max_length=100,
        blank=True,
        verbose_name='Aprobado por'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        verbose_name = 'Reembolso'
        verbose_name_plural = 'Reembolsos'
        ordering = ['-created_at']
    
    def __str__(self):
        return f'Reembolso #{self.refund_number} - {self.currency.symbol}{self.amount}'
    
    def save(self, *args, **kwargs):
        if not self.refund_number:
            self.refund_number = self.generate_refund_number()
        super().save(*args, **kwargs)
    
    @staticmethod
    def generate_refund_number():
        """Genera un número de reembolso único"""
        from datetime import datetime
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        random_suffix = str(uuid.uuid4().hex[:4]).upper()
        return f'REF-{timestamp}-{random_suffix}'
    
    def mark_as_completed(self):
        """Marca el reembolso como completado"""
        if self.status in ['pending', 'processing']:
            self.status = 'completed'
            self.completed_at = timezone.now()
            self.save()
            return True
        return False


class CashRegister(models.Model):
    """Caja registradora / Turno de caja"""
    REGISTER_STATUS = [
        ('open', 'Abierta'),
        ('closed', 'Cerrada'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    register_number = models.CharField(
        max_length=20,
        verbose_name='Número de Caja'
    )
    
    # Usuario responsable
    cashier_name = models.CharField(
        max_length=100,
        verbose_name='Nombre del Cajero'
    )
    
    # Estado
    status = models.CharField(
        max_length=20,
        choices=REGISTER_STATUS,
        default='open',
        verbose_name='Estado'
    )
    
    # Moneda de la caja
    currency = models.ForeignKey(
        Currency,
        on_delete=models.PROTECT,
        verbose_name='Moneda'
    )
    
    # Montos de apertura
    opening_cash = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
        verbose_name='Efectivo Inicial'
    )
    
    # Montos de cierre
    closing_cash = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(0)],
        verbose_name='Efectivo Final'
    )
    
    expected_cash = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(0)],
        verbose_name='Efectivo Esperado'
    )
    
    cash_difference = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        verbose_name='Diferencia'
    )
    
    # Totales
    total_sales = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        verbose_name='Total de Ventas'
    )
    
    total_cash = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        verbose_name='Total en Efectivo'
    )
    
    total_card = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        verbose_name='Total en Tarjeta'
    )
    
    total_other = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        verbose_name='Total Otros Métodos'
    )
    
    # Conteo de transacciones
    transaction_count = models.PositiveIntegerField(
        default=0,
        verbose_name='Número de Transacciones'
    )
    
    # Notas
    opening_notes = models.TextField(blank=True, verbose_name='Notas de Apertura')
    closing_notes = models.TextField(blank=True, verbose_name='Notas de Cierre')
    
    # Timestamps
    opened_at = models.DateTimeField(auto_now_add=True, verbose_name='Abierta')
    closed_at = models.DateTimeField(null=True, blank=True, verbose_name='Cerrada')
    
    class Meta:
        verbose_name = 'Caja Registradora'
        verbose_name_plural = 'Cajas Registradoras'
        ordering = ['-opened_at']
        indexes = [
            models.Index(fields=['register_number', 'opened_at']),
            models.Index(fields=['status']),
        ]
    
    def __str__(self):
        return f'Caja {self.register_number} - {self.cashier_name}'
    
    def calculate_totals(self):
        """Calcula los totales de la caja"""
        from django.db.models import Sum, Count
        
        # Obtener pagos completados de esta caja
        payments = self.payments.filter(status='completed')
        
        # Totales por método de pago
        self.total_cash = payments.filter(
            payment_method__method_type='cash'
        ).aggregate(total=Sum('amount'))['total'] or 0
        
        self.total_card = payments.filter(
            payment_method__method_type__in=['credit_card', 'debit_card']
        ).aggregate(total=Sum('amount'))['total'] or 0
        
        self.total_other = payments.exclude(
            payment_method__method_type__in=['cash', 'credit_card', 'debit_card']
        ).aggregate(total=Sum('amount'))['total'] or 0
        
        # Total general
        self.total_sales = self.total_cash + self.total_card + self.total_other
        
        # Contar transacciones
        self.transaction_count = payments.count()
        
        # Efectivo esperado
        self.expected_cash = self.opening_cash + self.total_cash
    
    def close_register(self, closing_cash, closing_notes=''):
        """Cierra la caja registradora"""
        if self.status == 'closed':
            return False, 'La caja ya está cerrada'
        
        # Calcular totales
        self.calculate_totals()
        
        # Registrar efectivo final
        self.closing_cash = closing_cash
        self.cash_difference = self.closing_cash - self.expected_cash
        self.closing_notes = closing_notes
        
        # Cerrar caja
        self.status = 'closed'
        self.closed_at = timezone.now()
        self.save()
        
        return True, 'Caja cerrada exitosamente'


class CashMovement(models.Model):
    """Movimientos de efectivo en caja (entradas/salidas)"""
    MOVEMENT_TYPES = [
        ('in', 'Entrada'),
        ('out', 'Salida'),
    ]
    
    MOVEMENT_REASONS = [
        ('change_fund', 'Fondo de Cambio'),
        ('bank_deposit', 'Depósito Bancario'),
        ('withdrawal', 'Retiro'),
        ('expense', 'Gasto'),
        ('adjustment', 'Ajuste'),
        ('tip', 'Propina'),
        ('other', 'Otro'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    cash_register = models.ForeignKey(
        CashRegister,
        on_delete=models.CASCADE,
        related_name='cash_movements',
        verbose_name='Caja Registradora'
    )
    
    movement_type = models.CharField(
        max_length=10,
        choices=MOVEMENT_TYPES,
        verbose_name='Tipo de Movimiento'
    )
    
    reason = models.CharField(
        max_length=20,
        choices=MOVEMENT_REASONS,
        verbose_name='Razón'
    )
    
    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)],
        verbose_name='Monto'
    )
    
    description = models.TextField(verbose_name='Descripción')
    
    performed_by = models.CharField(
        max_length=100,
        verbose_name='Realizado por'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = 'Movimiento de Efectivo'
        verbose_name_plural = 'Movimientos de Efectivo'
        ordering = ['-created_at']
    
    def __str__(self):
        sign = '+' if self.movement_type == 'in' else '-'
        return f'{sign}${self.amount} - {self.get_reason_display()}'