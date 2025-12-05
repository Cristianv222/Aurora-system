from django.db import models
from django.utils import timezone
from django.core.validators import MinValueValidator
from decimal import Decimal
import uuid


class Order(models.Model):
    """Pedido principal"""
    ORDER_STATUS = [
        ('pending', 'Pendiente'),
        ('confirmed', 'Confirmado'),
        ('preparing', 'En Preparación'),
        ('ready', 'Listo'),
        ('delivering', 'En Camino'),
        ('delivered', 'Entregado'),
        ('completed', 'Completado'),
        ('cancelled', 'Cancelado'),
        ('rejected', 'Rechazado'),
    ]
    
    ORDER_TYPE = [
        ('dine_in', 'Comer Aquí'),
        ('takeout', 'Para Llevar'),
        ('delivery', 'Delivery'),
        ('drive_thru', 'Drive-Thru'),
    ]
    
    PAYMENT_STATUS = [
        ('pending', 'Pendiente'),
        ('paid', 'Pagado'),
        ('failed', 'Fallido'),
        ('refunded', 'Reembolsado'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order_number = models.CharField(
        max_length=20, 
        unique=True, 
        verbose_name='Número de Orden'
    )
    
    # Cliente
    customer = models.ForeignKey(
        'customers.Customer',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='orders',
        verbose_name='Cliente'
    )
    
    # Información básica
    order_type = models.CharField(
        max_length=20,
        choices=ORDER_TYPE,
        default='dine_in',
        verbose_name='Tipo de Orden'
    )
    
    status = models.CharField(
        max_length=20,
        choices=ORDER_STATUS,
        default='pending',
        verbose_name='Estado'
    )
    
    payment_status = models.CharField(
        max_length=20,
        choices=PAYMENT_STATUS,
        default='pending',
        verbose_name='Estado de Pago'
    )
    
    # Totales
    subtotal = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
        verbose_name='Subtotal'
    )
    
    tax_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
        verbose_name='Impuestos'
    )
    
    discount_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
        verbose_name='Descuento'
    )
    
    delivery_fee = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
        verbose_name='Costo de Envío'
    )
    
    tip_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
        verbose_name='Propina'
    )
    
    total = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
        verbose_name='Total'
    )
    
    # Información adicional
    notes = models.TextField(blank=True, verbose_name='Notas')
    special_instructions = models.TextField(
        blank=True,
        verbose_name='Instrucciones Especiales'
    )
    
    # Mesa/ubicación (para dine-in)
    table_number = models.CharField(
        max_length=10,
        blank=True,
        verbose_name='Número de Mesa'
    )
    
    # Tiempos
    estimated_prep_time = models.PositiveIntegerField(
        default=15,
        verbose_name='Tiempo estimado de preparación (min)'
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Fecha de Creación')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Última Actualización')
    confirmed_at = models.DateTimeField(null=True, blank=True, verbose_name='Confirmado')
    ready_at = models.DateTimeField(null=True, blank=True, verbose_name='Listo')
    delivered_at = models.DateTimeField(null=True, blank=True, verbose_name='Entregado')
    cancelled_at = models.DateTimeField(null=True, blank=True, verbose_name='Cancelado')
    
    class Meta:
        verbose_name = 'Orden'
        verbose_name_plural = 'Órdenes'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['order_number']),
            models.Index(fields=['customer', 'created_at']),
            models.Index(fields=['status', 'created_at']),
            models.Index(fields=['order_type']),
        ]
    
    def __str__(self):
        return f'Orden #{self.order_number}'
    
    def save(self, *args, **kwargs):
        # Generar número de orden si no existe
        if not self.order_number:
            self.order_number = self.generate_order_number()
        
        # Calcular total si no se proporciona
        if self.pk:
            self.calculate_totals()
        
        super().save(*args, **kwargs)
    
    @staticmethod
    def generate_order_number():
        """Genera un número de orden único"""
        from datetime import datetime
        timestamp = datetime.now().strftime('%y%m%d%H%M%S')
        random_suffix = str(uuid.uuid4().hex[:3]).upper()
        return f'ORD-{timestamp}-{random_suffix}'
    
    def calculate_totals(self):
        """Calcula los totales de la orden"""
        # Calcular subtotal de items
        items_total = sum(item.line_total for item in self.items.all())
        self.subtotal = items_total
        
        # Calcular impuestos (ejemplo: 12%)
        tax_rate = Decimal('0.00')
        self.tax_amount = self.subtotal * tax_rate
        
        # Calcular total
        self.total = (
            self.subtotal + 
            self.tax_amount + 
            self.delivery_fee + 
            self.tip_amount - 
            self.discount_amount
        )
    
    def calculate_estimated_time(self):
        """Calcula el tiempo estimado basado en los items"""
        max_prep_time = max(
            (item.product.prep_time for item in self.items.all()),
            default=15
        )
        self.estimated_prep_time = max_prep_time
    
    def can_be_modified(self):
        """Verifica si la orden puede ser modificada"""
        return self.status == 'pending'
    
    def mark_as_confirmed(self):
        """Marca la orden como confirmada"""
        if self.status == 'pending':
            self.status = 'confirmed'
            self.confirmed_at = timezone.now()
            self.save()
            return True
        return False

    def mark_as_preparing(self):
        """Marca la orden como en preparación"""
        if self.status in ['pending', 'confirmed']:
            self.status = 'preparing'
            self.save()
            return True
        return False
    
    def mark_as_ready(self):
        """Marca la orden como lista"""
        if self.status == 'preparing':
            self.status = 'ready'
            self.ready_at = timezone.now()
            self.save()
            return True
        return False
    
    def mark_as_delivered(self):
        """Marca la orden como entregada"""
        if self.status in ['ready', 'delivering']:
            self.status = 'delivered'
            self.delivered_at = timezone.now()
            self.save()
            return True
        return False
    
    def mark_as_cancelled(self, reason=''):
        """Cancela la orden"""
        if self.can_be_cancelled():
            self.status = 'cancelled'
            self.cancelled_at = timezone.now()
            if reason:
                self.notes = f'{self.notes}\nCancelación: {reason}'.strip()
            self.save()
            return True
        return False

    def can_be_cancelled(self):
        """Verifica si la orden puede ser cancelada"""
        return self.status in ['pending', 'confirmed', 'preparing']


class OrderItem(models.Model):
    """Items de la orden"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name='items',
        verbose_name='Orden'
    )
    
    product = models.ForeignKey(
        'menu.Product',
        on_delete=models.PROTECT,
        verbose_name='Producto'
    )
    
    # Si seleccionó un tamaño específico
    size = models.ForeignKey(
        'menu.Size',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name='Tamaño'
    )
    
    quantity = models.PositiveIntegerField(
        default=1,
        validators=[MinValueValidator(1)],
        verbose_name='Cantidad'
    )
    
    # Precios al momento de la orden (históricos)
    unit_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)],
        verbose_name='Precio Unitario'
    )
    
    line_total = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
        verbose_name='Total de Línea'
    )
    
    # Notas específicas del item
    notes = models.TextField(blank=True, verbose_name='Notas')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Item de Orden'
        verbose_name_plural = 'Items de Orden'
        ordering = ['created_at']
    
    def __str__(self):
        return f'{self.quantity}x {self.product.name}'
    
    def save(self, *args, **kwargs):
        # Calcular precio unitario si no se proporciona
        if not self.unit_price:
            self.unit_price = self.product.price
            if self.size:
                self.unit_price = self.size.get_final_price()
        
        # Calcular total de extras
        # Nota: esto requiere que la instancia ya tenga ID para acceder a m2m
        # Se maneja mejor en señales o en el viewset
        
        # Calcular total de línea
        self.line_total = self.unit_price * self.quantity
        
        super().save(*args, **kwargs)
        
        # Recalcular totales de la orden
        if self.order_id:
            self.order.calculate_totals()
            self.order.save()
    
    def get_total_with_extras(self):
        """Calcula el total incluyendo extras"""
        extras_total = sum(extra.extra.price for extra in self.extras.all())
        return (self.unit_price + extras_total) * self.quantity


class OrderItemExtra(models.Model):
    """Extras agregados a un item de la orden"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order_item = models.ForeignKey(
        OrderItem,
        on_delete=models.CASCADE,
        related_name='extras',
        verbose_name='Item de Orden'
    )
    
    extra = models.ForeignKey(
        'menu.Extra',
        on_delete=models.PROTECT,
        verbose_name='Extra'
    )
    
    # Precio histórico del extra
    price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)],
        verbose_name='Precio'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = 'Extra de Item'
        verbose_name_plural = 'Extras de Items'
    
    def __str__(self):
        return f'{self.extra.name} - ${self.price}'
    
    def save(self, *args, **kwargs):
        # Guardar precio histórico del extra
        if not self.price:
            self.price = self.extra.price
        
        super().save(*args, **kwargs)
        
        # Recalcular totales del item
        if self.order_item_id:
            self.order_item.save()


class DeliveryInfo(models.Model):
    """Información de delivery"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.OneToOneField(
        Order,
        on_delete=models.CASCADE,
        related_name='delivery_info',
        verbose_name='Orden'
    )
    
    # Dirección de entrega
    address = models.TextField(verbose_name='Dirección')
    city = models.CharField(max_length=100, verbose_name='Ciudad')
    postal_code = models.CharField(max_length=20, blank=True, verbose_name='Código Postal')
    
    # Referencia de ubicación
    reference = models.TextField(
        blank=True,
        verbose_name='Referencia',
        help_text='Casa blanca, portón verde, etc.'
    )
    
    # Coordenadas GPS
    latitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        null=True,
        blank=True,
        verbose_name='Latitud'
    )
    longitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        null=True,
        blank=True,
        verbose_name='Longitud'
    )
    
    # Información de contacto
    contact_name = models.CharField(max_length=100, verbose_name='Nombre de Contacto')
    contact_phone = models.CharField(max_length=20, verbose_name='Teléfono de Contacto')
    
    # Información del repartidor (si aplica)
    driver_name = models.CharField(
        max_length=100,
        blank=True,
        verbose_name='Nombre del Repartidor'
    )
    driver_phone = models.CharField(
        max_length=20,
        blank=True,
        verbose_name='Teléfono del Repartidor'
    )
    
    # Tiempos
    estimated_delivery_time = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='Hora estimada de entrega'
    )
    picked_up_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='Recogido a las'
    )
    delivered_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='Entregado a las'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Información de Delivery'
        verbose_name_plural = 'Información de Deliveries'
    
    def __str__(self):
        return f'Delivery - {self.order.order_number}'


class OrderStatusHistory(models.Model):
    """Historial de cambios de estado de la orden"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name='status_history',
        verbose_name='Orden'
    )
    
    from_status = models.CharField(
        max_length=20,
        choices=Order.ORDER_STATUS,
        verbose_name='Estado Anterior'
    )
    
    to_status = models.CharField(
        max_length=20,
        choices=Order.ORDER_STATUS,
        verbose_name='Nuevo Estado'
    )
    
    notes = models.TextField(blank=True, verbose_name='Notas')
    
    # Usuario que hizo el cambio (opcional)
    changed_by = models.CharField(
        max_length=100,
        blank=True,
        verbose_name='Cambiado por'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = 'Historial de Estado'
        verbose_name_plural = 'Historiales de Estado'
        ordering = ['-created_at']
    
    def __str__(self):
        return f'{self.order.order_number}: {self.from_status} → {self.to_status}'