"""
apps/pos/models.py

Módulo POS para CommerceBox - Sistema de Punto de Venta
Incluye: Turnos, Descuentos, Mesas, Reportes

Se integra con:
- apps.customers (Customer)
- apps.menu (Product, Category)
- apps.orders (Order)
- apps.payments (Payment, CashRegister)
- apps.printing (PrintJob)

NO duplica información de auth-service.
Info de empleados viene del JWT y se consulta vía API cuando sea necesario.
"""
from django.db import models
from django.utils import timezone
from django.core.validators import MinValueValidator, MaxValueValidator
from decimal import Decimal
import uuid
from datetime import timedelta, datetime, date 
import calendar    

# <<<< CORRECCIÓN: IMPORTAR FUNCIONES DE AGREGACIÓN >>>>
from django.db.models import Sum, Count, Avg, F, Q


# ============================================================================
# TURNOS DE CAJA (SHIFTS)
# ============================================================================

class Shift(models.Model):
    """
    Turno de trabajo en el POS.
    Asociado a una caja registradora y un empleado (del JWT).
    """
    SHIFT_STATUS = [
        ('open', 'Abierto'),
        ('closed', 'Cerrado'),
        ('suspended', 'Suspendido'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    shift_number = models.CharField(
        max_length=20,
        unique=True,
        verbose_name='Número de Turno',
        db_index=True
    )
    
    # ============ EMPLEADO (del JWT al abrir turno) ============
    user_id = models.CharField(
        max_length=50,
        verbose_name='ID del Usuario',
        help_text='UUID del usuario desde auth-service',
        db_index=True
    )
    user_name = models.CharField(
        max_length=200,
        verbose_name='Nombre del Usuario',
        help_text='Nombre completo del empleado'
    )
    user_role = models.CharField(
        max_length=50,
        blank=True,
        verbose_name='Rol del Usuario',
        help_text='CASHIER, WAITER, MANAGER, etc.'
    )
    
    # ============ CAJA REGISTRADORA ============
    cash_register = models.ForeignKey(
        'payments.CashRegister',
        on_delete=models.PROTECT,
        related_name='shifts',
        verbose_name='Caja Registradora'
    )
    
    # ============ ESTADO ============
    status = models.CharField(
        max_length=20,
        choices=SHIFT_STATUS,
        default='open',
        verbose_name='Estado',
        db_index=True
    )
    
    # ============ MONTOS ============
    opening_cash = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
        verbose_name='Efectivo Inicial'
    )
    
    closing_cash = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(0)],
        verbose_name='Efectivo Final'
    )
    
    # ============ TOTALES (calculados al cerrar) ============
    total_sales = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        verbose_name='Total de Ventas'
    )
    
    total_cash_sales = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        verbose_name='Ventas en Efectivo'
    )
    
    total_card_sales = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        verbose_name='Ventas con Tarjeta'
    )
    
    total_other_sales = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        verbose_name='Otras Formas de Pago'
    )
    
    total_transactions = models.PositiveIntegerField(
        default=0,
        verbose_name='Total de Transacciones'
    )
    
    cash_difference = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        verbose_name='Diferencia en Caja',
        help_text='Diferencia entre efectivo esperado y real'
    )
    
    # ============ NOTAS ============
    opening_notes = models.TextField(
        blank=True,
        verbose_name='Notas de Apertura'
    )
    closing_notes = models.TextField(
        blank=True,
        verbose_name='Notas de Cierre'
    )
    
    # ============ TIMESTAMPS ============
    opened_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='Fecha de Apertura',
        db_index=True
    )
    closed_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='Fecha de Cierre'
    )
    
    class Meta:
        verbose_name = 'Turno'
        verbose_name_plural = 'Turnos'
        ordering = ['-opened_at']
        indexes = [
            models.Index(fields=['shift_number']),
            models.Index(fields=['user_id', 'opened_at']),
            models.Index(fields=['status', 'opened_at']),
            models.Index(fields=['cash_register', 'status']),
        ]
    
    def __str__(self):
        return f'Turno {self.shift_number} - {self.user_name}'
    
    def save(self, *args, **kwargs):
        if not self.shift_number:
            self.shift_number = self.generate_shift_number()
        super().save(*args, **kwargs)
    
    @staticmethod
    def generate_shift_number():
        """Genera un número de turno único (Max 20 chars)"""
        from datetime import datetime
        # Usamos %y (2 digitos año) y quitamos segundos para ahorrar espacio
        # Formato: SHF-YYMMDDHHMM-XXX (Total 18 chars)
        timestamp = datetime.now().strftime('%y%m%d%H%M') 
        random_suffix = str(uuid.uuid4().hex[:3]).upper()
        return f'SHF-{timestamp}-{random_suffix}'
    
    def close_shift(self, closing_cash, closing_notes=''):
        """Cierra el turno y calcula totales"""
        if self.status == 'closed':
            return False, 'El turno ya está cerrado'
        
        from apps.payments.models import Payment
        # Calcular totales usando Órdenes, al igual que los reportes
        from apps.orders.models import Order
        from django.db.models import Sum
        from django.utils import timezone

        close_time = timezone.now()

        orders = Order.objects.filter(
            created_at__gte=self.opened_at,
            created_at__lte=close_time,
            status__in=['delivered', 'completed']
        )
        
        total_calculated = orders.aggregate(sum=Sum('total'))['sum'] or 0
        self.total_sales = total_calculated
        
        # Para compatibilidad, si se necesita desglose cash/card, se puede mantener la consulta de payments
        # pero para el total general, usamos Order para consistencia.     
        payments = Payment.objects.filter(
            created_at__gte=self.opened_at,
            created_at__lte=close_time,
            status='completed'
        )

        self.total_cash_sales = payments.filter(
            payment_method__method_type='cash'
        ).aggregate(total=models.Sum('amount'))['total'] or Decimal('0')
        
        self.total_card_sales = payments.filter(
            payment_method__method_type__in=['credit_card', 'debit_card']
        ).aggregate(total=models.Sum('amount'))['total'] or Decimal('0')
        
        self.total_other_sales = payments.exclude(
            payment_method__method_type__in=['cash', 'credit_card', 'debit_card']
        ).aggregate(total=models.Sum('amount'))['total'] or Decimal('0')
        
        # self.total_sales = self.total_cash_sales + self.total_card_sales + self.total_other_sales
        # MANTENER el total calculado por Órdenes
        
        self.total_transactions = orders.count()
        
        # Calcular diferencia de caja
        expected_cash = self.opening_cash + self.total_cash_sales
        self.closing_cash = closing_cash
        self.cash_difference = self.closing_cash - expected_cash
        self.closing_notes = closing_notes
        
        # Cerrar turno
        self.status = 'closed'
        self.closed_at = timezone.now()
        self.save()
        
        return True, 'Turno cerrado exitosamente'
    
    @property
    def duration(self):
        """Duración del turno en horas"""
        if self.closed_at:
            delta = self.closed_at - self.opened_at
        else:
            delta = timezone.now() - self.opened_at
        return delta.total_seconds() / 3600
    
    @property
    def is_active(self):
        """Verifica si el turno está activo"""
        return self.status == 'open'
# ============================================================================
# DESCUENTOS Y PROMOCIONES
# ============================================================================

class Discount(models.Model):
    """
    Descuentos y promociones aplicables a órdenes o productos.
    Se valida en tiempo real al aplicar.
    """
    DISCOUNT_TYPES = [
        ('percentage', 'Porcentaje'),
        ('fixed_amount', 'Monto Fijo'),
        ('buy_x_get_y', 'Compra X lleva Y'),
    ]
    
    APPLY_TO = [
        ('order', 'Orden Completa'),
        ('product', 'Producto Específico'),
        ('category', 'Categoría'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # ============ INFORMACIÓN BÁSICA ============
    code = models.CharField(
        max_length=50,
        unique=True,
        verbose_name='Código',
        help_text='Código único del descuento (ej: HAPPY_HOUR)',
        db_index=True
    )
    name = models.CharField(
        max_length=200,
        verbose_name='Nombre',
        help_text='Nombre descriptivo del descuento'
    )
    description = models.TextField(
        blank=True,
        verbose_name='Descripción'
    )
    
    # ============ TIPO Y APLICACIÓN ============
    discount_type = models.CharField(
        max_length=20,
        choices=DISCOUNT_TYPES,
        verbose_name='Tipo de Descuento'
    )
    
    apply_to = models.CharField(
        max_length=20,
        choices=APPLY_TO,
        default='order',
        verbose_name='Aplicar a'
    )
    
    # ============ VALOR DEL DESCUENTO ============
    discount_value = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)],
        verbose_name='Valor del Descuento',
        help_text='Porcentaje (0-100) o monto fijo según tipo'
    )
    
    # ============ LÍMITES ============
    minimum_purchase = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(0)],
        verbose_name='Compra Mínima',
        help_text='Monto mínimo de compra para aplicar descuento'
    )
    
    maximum_discount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(0)],
        verbose_name='Descuento Máximo',
        help_text='Monto máximo de descuento a aplicar'
    )
    
    # ============ LÍMITES DE USO ============
    max_uses = models.PositiveIntegerField(
        null=True,
        blank=True,
        verbose_name='Usos Máximos Totales',
        help_text='Límite total de usos. Null = ilimitado'
    )
    
    max_uses_per_customer = models.PositiveIntegerField(
        null=True,
        blank=True,
        verbose_name='Usos Máximos por Cliente',
        help_text='Límite de usos por cliente. Null = ilimitado'
    )
    
    current_uses = models.PositiveIntegerField(
        default=0,
        verbose_name='Usos Actuales'
    )
    
    # ============ PERÍODO DE VALIDEZ ============
    valid_from = models.DateTimeField(
        verbose_name='Válido Desde'
    )
    valid_until = models.DateTimeField(
        verbose_name='Válido Hasta'
    )
    
    # ============ RESTRICCIONES TEMPORALES ============
    valid_days = models.JSONField(
        default=list,
        blank=True,
        verbose_name='Días Válidos',
        help_text='Lista de días de la semana: [0=Lun, 1=Mar, ..., 6=Dom]. Vacío = todos los días'
    )
    
    valid_hours = models.JSONField(
        default=dict,
        blank=True,
        verbose_name='Horas Válidas',
        help_text='Rango de horas: {"start": "10:00", "end": "14:00"}. Vacío = todo el día'
    )
    
    # ============ PRODUCTOS/CATEGORÍAS APLICABLES ============
    applicable_products = models.ManyToManyField(
        'menu.Product',
        blank=True,
        related_name='discounts',
        verbose_name='Productos Aplicables',
        help_text='Productos a los que aplica el descuento'
    )
    
    applicable_categories = models.ManyToManyField(
        'menu.Category',
        blank=True,
        related_name='discounts',
        verbose_name='Categorías Aplicables',
        help_text='Categorías a las que aplica el descuento'
    )
    
    # ============ ESTADO ============
    is_active = models.BooleanField(
        default=True,
        verbose_name='Activo',
        db_index=True
    )
    is_public = models.BooleanField(
        default=True,
        verbose_name='Público',
        help_text='Si aparece en el catálogo o requiere código'
    )
    
    # ============ AUDITORÍA ============
    created_by = models.CharField(
        max_length=50,
        blank=True,
        verbose_name='Creado por',
        help_text='User ID de quien creó el descuento'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Descuento'
        verbose_name_plural = 'Descuentos'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['code']),
            models.Index(fields=['is_active', 'valid_from', 'valid_until']),
            models.Index(fields=['discount_type']),
        ]
    
    def __str__(self):
        return f'{self.code} - {self.name}'
    
    def is_valid(self, for_customer=None):
        """
        Verifica si el descuento es válido actualmente.
        
        Args:
            for_customer: Customer instance (opcional) para validar usos por cliente
            
        Returns:
            tuple: (bool, str) - (es_válido, mensaje)
        """
        now = timezone.now()
        
        # Verificar si está activo
        if not self.is_active:
            return False, 'Descuento inactivo'
        
        # Verificar período de validez
        if now < self.valid_from:
            return False, 'Descuento aún no válido'
        
        if now > self.valid_until:
            return False, 'Descuento expirado'
        
        # Verificar límite de usos totales
        if self.max_uses and self.current_uses >= self.max_uses:
            return False, 'Descuento agotado'
        
        # Verificar límite de usos por cliente
        if for_customer and self.max_uses_per_customer:
            customer_uses = self.usages.filter(customer=for_customer).count()
            if customer_uses >= self.max_uses_per_customer:
                return False, 'Has alcanzado el límite de usos de este descuento'
        
        # Verificar día de la semana
        if self.valid_days:
            current_day = now.weekday()
            if current_day not in self.valid_days:
                return False, 'Descuento no válido hoy'
        
        # Verificar hora del día
        if self.valid_hours and 'start' in self.valid_hours and 'end' in self.valid_hours:
            current_time = now.time().strftime('%H:%M')
            start_time = self.valid_hours['start']
            end_time = self.valid_hours['end']
            
            if not (start_time <= current_time <= end_time):
                return False, f'Descuento válido solo de {start_time} a {end_time}'
        
        return True, 'Descuento válido'
    
    def calculate_discount(self, amount):
        """
        Calcula el monto del descuento a aplicar.
        
        Args:
            amount: Monto sobre el cual calcular el descuento
            
        Returns:
            Decimal: Monto del descuento
        """
        if self.discount_type == 'percentage':
            discount = amount * (self.discount_value / 100)
        elif self.discount_type == 'fixed_amount':
            discount = self.discount_value
        else:
            # Para buy_x_get_y se calcula en el view según lógica específica
            discount = Decimal('0')
        
        # Aplicar límite máximo si existe
        if self.maximum_discount:
            discount = min(discount, self.maximum_discount)
        
        # No puede ser mayor al monto
        discount = min(discount, amount)
        
        return discount
    
    def use_discount(self):
        """Incrementa el contador de usos"""
        self.current_uses += 1
        self.save(update_fields=['current_uses'])
    
    def applies_to_product(self, product):
        """
        Verifica si el descuento aplica a un producto específico.
        
        Args:
            product: Product instance
            
        Returns:
            bool: True si aplica
        """
        if self.apply_to == 'order':
            return True
        
        if self.apply_to == 'product':
            return self.applicable_products.filter(id=product.id).exists()
        
        if self.apply_to == 'category':
            return self.applicable_categories.filter(id=product.category.id).exists()
        
        return False


class DiscountUsage(models.Model):
    """
    Registro de uso de descuentos.
    Permite auditoría y control de límites por cliente.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # ============ RELACIONES ============
    discount = models.ForeignKey(
        Discount,
        on_delete=models.PROTECT,
        related_name='usages',
        verbose_name='Descuento'
    )
    
    order = models.ForeignKey(
        'orders.Order',
        on_delete=models.CASCADE,
        related_name='discount_usages',
        verbose_name='Orden'
    )
    
    customer = models.ForeignKey(
        'customers.Customer',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='discount_usages',
        verbose_name='Cliente'
    )
    
    # ============ MONTOS ============
    discount_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)],
        verbose_name='Monto Descontado'
    )
    
    original_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)],
        verbose_name='Monto Original'
    )
    
    # ============ AUDITORÍA ============
    applied_by = models.CharField(
        max_length=50,
        blank=True,
        verbose_name='Aplicado por',
        help_text='User ID de quien aplicó el descuento'
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    
    class Meta:
        verbose_name = 'Uso de Descuento'
        verbose_name_plural = 'Usos de Descuentos'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['discount', 'customer']),
            models.Index(fields=['order']),
            models.Index(fields=['created_at']),
        ]
    
    def __str__(self):
        return f'{self.discount.code} - ${self.discount_amount}'


# ============================================================================
# MESAS (para restaurantes con servicio en mesa)
# ============================================================================

class Table(models.Model):
    """
    Mesas del restaurante.
    Permite gestionar disponibilidad y asignación de órdenes.
    """
    TABLE_STATUS = [
        ('available', 'Disponible'),
        ('occupied', 'Ocupada'),
        ('reserved', 'Reservada'),
        ('cleaning', 'Limpiando'),
        ('maintenance', 'Mantenimiento'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # ============ IDENTIFICACIÓN ============
    number = models.CharField(
        max_length=10,
        unique=True,
        verbose_name='Número de Mesa',
        db_index=True
    )
    
    name = models.CharField(
        max_length=100,
        blank=True,
        verbose_name='Nombre',
        help_text='Nombre descriptivo: "Mesa VIP", "Terraza 1"'
    )
    
    # ============ CAPACIDAD ============
    capacity = models.PositiveIntegerField(
        default=4,
        validators=[MinValueValidator(1)],
        verbose_name='Capacidad',
        help_text='Número de personas'
    )
    
    # ============ ESTADO ============
    status = models.CharField(
        max_length=20,
        choices=TABLE_STATUS,
        default='available',
        verbose_name='Estado',
        db_index=True
    )
    
    # ============ UBICACIÓN ============
    section = models.CharField(
        max_length=50,
        blank=True,
        verbose_name='Sección',
        help_text='Interior, Terraza, VIP, etc.'
    )
    
    floor = models.PositiveIntegerField(
        default=1,
        verbose_name='Piso'
    )
    
    # ============ ORDEN ACTUAL ============
    current_order = models.ForeignKey(
        'orders.Order',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='table_assignment',
        verbose_name='Orden Actual'
    )
    
    # ============ MESERO ASIGNADO (del JWT) ============
    waiter_id = models.CharField(
        max_length=50,
        blank=True,
        verbose_name='ID del Mesero',
        help_text='UUID del mesero asignado'
    )
    waiter_name = models.CharField(
        max_length=200,
        blank=True,
        verbose_name='Nombre del Mesero'
    )
    
    # ============ CONFIGURACIÓN ============
    is_active = models.BooleanField(
        default=True,
        verbose_name='Activa',
        db_index=True
    )
    is_vip = models.BooleanField(
        default=False,
        verbose_name='Mesa VIP'
    )
    
    # ============ QR CODE (para menú digital) ============
    qr_code = models.CharField(
        max_length=100,
        blank=True,
        unique=True,
        verbose_name='Código QR',
        help_text='Código único para el QR de la mesa',
        db_index=True
    )
    
    # ============ NOTAS ============
    notes = models.TextField(
        blank=True,
        verbose_name='Notas'
    )
    
    # ============ AUDITORÍA ============
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Mesa'
        verbose_name_plural = 'Mesas'
        ordering = ['section', 'number']
        indexes = [
            models.Index(fields=['number']),
            models.Index(fields=['status']),
            models.Index(fields=['section', 'status']),
            models.Index(fields=['qr_code']),
        ]
    
    def __str__(self):
        if self.name:
            return f'Mesa {self.number} - {self.name}'
        return f'Mesa {self.number}'
    
    def save(self, *args, **kwargs):
        # Generar QR code si no existe
        if not self.qr_code:
            self.qr_code = f'TBL-{self.number}-{uuid.uuid4().hex[:6].upper()}'
        super().save(*args, **kwargs)
    
    def occupy(self, order, waiter_id='', waiter_name=''):
        """
        Marca la mesa como ocupada y asigna una orden.
        
        Args:
            order: Order instance
            waiter_id: UUID del mesero
            waiter_name: Nombre del mesero
            
        Returns:
            tuple: (bool, str) - (éxito, mensaje)
        """
        if self.status != 'available':
            return False, f'La mesa está {self.get_status_display()}'
        
        self.status = 'occupied'
        self.current_order = order
        self.waiter_id = waiter_id
        self.waiter_name = waiter_name
        self.save()
        
        return True, 'Mesa ocupada exitosamente'
    
    def free(self):
        """
        Libera la mesa (marca como disponible).
        
        Returns:
            tuple: (bool, str) - (éxito, mensaje)
        """
        self.status = 'available'
        self.current_order = None
        self.waiter_id = ''
        self.waiter_name = ''
        self.save()
        
        return True, 'Mesa liberada'
    
    def set_cleaning(self):
        """Marca la mesa para limpieza"""
        self.status = 'cleaning'
        self.save()
    
    def set_maintenance(self):
        """Marca la mesa en mantenimiento"""
        self.status = 'maintenance'
        self.save()
    
    @property
    def is_available(self):
        """Verifica si la mesa está disponible"""
        return self.status == 'available' and self.is_active

# ============================================================================
# REPORTES DIARIOS MEJORADOS (DailySummary)
# ============================================================================

class DailySummary(models.Model):
    """
    Resumen diario de ventas y operaciones.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    date = models.DateField(
        unique=True,
        verbose_name='Fecha',
        db_index=True
    )
    
    # ============ VENTAS TOTALES ============
    total_sales = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name='Ventas Totales')
    total_orders = models.PositiveIntegerField(default=0, verbose_name='Total de Órdenes')
    total_customers = models.PositiveIntegerField(default=0, verbose_name='Total de Clientes Únicos')
    total_items_sold = models.PositiveIntegerField(default=0, verbose_name='Total de Productos Vendidos')
    
    # ============ POR MÉTODO DE PAGO ============
    cash_sales = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name='Ventas en Efectivo')
    card_sales = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name='Ventas con Tarjeta')
    other_sales = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name='Otras Formas de Pago')
    
    # ============ POR TIPO DE ORDEN ============
    dine_in_sales = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name='Ventas Dine-In')
    takeout_sales = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name='Ventas Takeout')
    delivery_sales = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name='Ventas Delivery')
    
    # ============ DESCUENTOS Y PROPINAS ============
    total_discounts = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name='Total en Descuentos')
    total_tips = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name='Total en Propinas')
    
    # ============ PROMEDIOS ============
    average_order_value = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name='Valor Promedio por Orden')
    average_items_per_order = models.DecimalField(max_digits=6, decimal_places=2, default=0, verbose_name='Productos Promedio por Orden')
    
    # ============ TURNOS ============
    total_shifts = models.PositiveIntegerField(default=0, verbose_name='Total de Turnos')
    closed_shifts = models.PositiveIntegerField(default=0, verbose_name='Turnos Cerrados')
    
    # ============ ESTADÍSTICAS DE PRODUCTOS (JSON Field) ============
    top_products = models.JSONField(default=list, blank=True, verbose_name='Productos Más Vendidos', help_text='Lista de productos más vendidos con cantidad y monto')
    sales_by_hour = models.JSONField(default=list, blank=True, verbose_name='Ventas por Hora', help_text='Ventas agrupadas por hora del día')
    
    # ============ CAMPOS DE CIERRE ============
    is_closed = models.BooleanField(default=False, verbose_name='Día Cerrado', help_text='Indica si el día ha sido cerrado oficialmente')
    closing_notes = models.TextField(blank=True, verbose_name='Notas de Cierre')
    
    # ============ AUDITORÍA ============
    generated_at = models.DateTimeField(auto_now=True, verbose_name='Generado el')
    generated_by = models.CharField(max_length=50, blank=True, verbose_name='Generado por', help_text='User ID o "system" si fue automático')
    
    
    class Meta:
        verbose_name = 'Resumen Diario'
        verbose_name_plural = 'Resúmenes Diarios'
        ordering = ['-date']
        indexes = [
            models.Index(fields=['date']),
            models.Index(fields=['is_closed']),
        ]
    
    def __str__(self):
        return f'Resumen {self.date.strftime("%Y-%m-%d")} - ${self.total_sales}'
    
    @classmethod
    def generate_for_date(cls, date, generated_by='system', detailed=True):
        """
        Genera o actualiza el resumen para una fecha específica.
        """
        from apps.orders.models import Order, OrderItem
        from apps.payments.models import Payment
        
        summary, created = cls.objects.get_or_create(
            date=date,
            defaults={'generated_by': generated_by}
        )
        
        # ============ CONSULTAR ÓRDENES DEL DÍA ============
        orders = Order.objects.filter(
            created_at__date=date,
            status__in=['delivered', 'completed']
        ).prefetch_related('items')
        
        summary.total_orders = orders.count()
        summary.total_customers = orders.values('customer').distinct().count()
        summary.total_sales = orders.aggregate(
            total=models.Sum('total')
        )['total'] or Decimal('0')
        
        # Calcular total de productos vendidos
        total_items = 0
        for order in orders:
            # Corregido: Sumar la cantidad de items en lugar de contarlos
            total_items += sum(item.quantity for item in order.items.all()) 
        summary.total_items_sold = total_items
        
        # ============ POR TIPO DE ORDEN ============
        summary.dine_in_sales = orders.filter(
            order_type='dine_in'
        ).aggregate(total=models.Sum('total'))['total'] or Decimal('0')
        
        summary.takeout_sales = orders.filter(
            order_type='takeout'
        ).aggregate(total=models.Sum('total'))['total'] or Decimal('0')
        
        summary.delivery_sales = orders.filter(
            order_type='delivery'
        ).aggregate(total=models.Sum('total'))['total'] or Decimal('0')
        
        # ============ DESCUENTOS Y PROPINAS ============
        summary.total_discounts = orders.aggregate(
            total=models.Sum('discount_amount')
        )['total'] or Decimal('0')
        
        summary.total_tips = orders.aggregate(
            total=models.Sum('tip_amount')
        )['total'] or Decimal('0')
        
        # ============ CONSULTAR PAGOS DEL DÍA Y TURNOS (Código omitido) ============
        
        # ============ CALCULAR PROMEDIOS ============
        if summary.total_orders > 0:
            summary.average_order_value = summary.total_sales / summary.total_orders
            summary.average_items_per_order = Decimal(summary.total_items_sold) / Decimal(summary.total_orders)
        else:
            summary.average_order_value = Decimal('0')
            summary.average_items_per_order = Decimal('0')
        
        # ============ DATOS DETALLADOS SI SE SOLICITAN ============
        if detailed:
            summary.top_products = cls._get_top_products(date)
            summary.sales_by_hour = cls._get_sales_by_hour(date)
        
        summary.generated_by = generated_by
        summary.save()
        
        return summary
    @staticmethod
    def _get_top_products(date, limit=None): # <-- CAMBIO: Hacemos 'limit' opcional
        """
        Obtiene *todos* los productos vendidos del día, ordenados por cantidad.
        """
        from apps.orders.models import Order, OrderItem
        from django.db.models import Sum, Avg
        
        orders = Order.objects.filter(
            created_at__date=date,
            status__in=['delivered', 'completed']
        )
        
        order_ids = orders.values_list('id', flat=True)
        
        # Agregación usando 'line_total'
        top_products = OrderItem.objects.filter(
            order__id__in=order_ids
        ).values(
            'product__id',
            'product__name',
            'product__category__name',
        ).annotate(
            quantity=Sum('quantity'),
            total_amount=Sum('line_total'),
            avg_price=Avg('unit_price'), 
        ).order_by('product__name')

        # Aplicamos el límite si se proporciona (en este caso, queremos que no haya límite)
        if limit:
            top_products = top_products[:limit]
        
        # Formatear respuesta y convertir UUID a string
        formatted = []
        for idx, product in enumerate(top_products, 1):
            if product['quantity'] is None or product['total_amount'] is None:
                continue # Evitar productos con datos nulos si es un problema de BD

            formatted.append({
                'rank': idx,
                'product_id': str(product['product__id']), 
                'product_name': product['product__name'],
                'category': product['product__category__name'] or 'Sin categoría',
                'quantity': product['quantity'] or 0,
                'total_amount': float(product['total_amount'] or 0),
                'average_price': float(product['avg_price'] or 0),
            })
        
        return formatted  
    @staticmethod
    def _get_sales_by_hour(date):
        """
        Obtiene ventas agrupadas por hora del día. (CÓDIGO FALTANTE)
        """
        from apps.orders.models import Order
        from django.db.models import Sum, Count # Aseguramos estas importaciones
        
        sales_by_hour = []
        
        for hour in range(24):
            hour_start = timezone.make_aware(datetime.combine(date, datetime.min.time()))
            hour_start = hour_start.replace(hour=hour)
            hour_end = hour_start + timedelta(hours=1)
            
            orders_in_hour = Order.objects.filter(
                created_at__gte=hour_start,
                created_at__lt=hour_end,
                status__in=['delivered', 'completed']
            )
            
            total_sales = orders_in_hour.aggregate(
                total=Sum('total')
            )['total'] or Decimal('0')
            
            total_orders = orders_in_hour.count()
            
            total_items = 0
            for order in orders_in_hour:
                total_items += sum(item.quantity for item in order.items.all())
            
            average_order_value = float(total_sales / total_orders) if total_orders > 0 else 0
            
            sales_by_hour.append({
                'hour': hour,
                'hour_label': f'{hour:02d}:00',
                'total_sales': float(total_sales),
                'total_orders': total_orders,
                'total_items': total_items,
                'average_order_value': average_order_value
            })
        
        return sales_by_hour
    @classmethod
    def close_day(cls, date, closing_notes='', generated_by='system'):
        """
        Cierra oficialmente el día de operaciones.
        
        Args:
            date: datetime.date - Fecha a cerrar
            closing_notes: str - Notas del cierre
            generated_by: str - User ID de quien cierra
            
        Returns:
            dict: Resultado del cierre
        """
        # Generar reporte detallado
        summary = cls.generate_for_date(date, generated_by, detailed=True)
        
        # Marcar como cerrado
        summary.is_closed = True
        summary.closing_notes = closing_notes
        summary.save()
        
        # Cerrar todos los turnos abiertos
        from .models import Shift
        open_shifts = Shift.objects.filter(status='open', opened_at__date=date)
        
        closed_shifts = []
        for shift in open_shifts:
            # Intentar cerrar con el efectivo actual
            success, message = shift.close_shift(
                closing_cash=shift.opening_cash + shift.total_cash_sales,
                closing_notes='Cierre automático por cierre de día'
            )
            if success:
                closed_shifts.append(shift.shift_number)
        
        return {
            'success': True,
            'message': f'Día {date} cerrado exitosamente',
            'summary_id': str(summary.id),
            'total_sales': float(summary.total_sales),
            'total_orders': summary.total_orders,
            'total_items_sold': summary.total_items_sold,
            'closed_shifts': closed_shifts,
        }
    
    @classmethod
    def get_report(cls, report_type, date=None, start_date=None, end_date=None, year=None, month=None):
        """
        Obtiene reportes por tipo.
        
        Args:
            report_type: str - 'daily', 'weekly', 'monthly'
            date: datetime.date - Para reporte diario
            start_date: datetime.date - Para reporte semanal
            end_date: datetime.date - Para reporte semanal
            year: int - Para reporte mensual
            month: int - Para reporte mensual
            
        Returns:
            dict: Datos del reporte
        """
        if report_type == 'daily':
            if not date:
                date = timezone.now().date()
            
            summary, _ = cls.objects.get_or_create(date=date)
            return {
                'type': 'daily',
                'date': date,
                'data': summary,
                'period_name': date.strftime('%d/%m/%Y')
            }
        
        elif report_type == 'weekly':
            if not start_date:
                # Semana actual
                today = timezone.now().date()
                start_date = today - timedelta(days=today.weekday())
                end_date = start_date + timedelta(days=6)
            
            # Obtener reportes diarios de la semana
            summaries = cls.objects.filter(
                date__gte=start_date,
                date__lte=end_date
            ).order_by('date')
            
            # Consolidar
            consolidated = {
                'type': 'weekly',
                'start_date': start_date,
                'end_date': end_date,
                'period_name': f'Semana {start_date.strftime("%d/%m")} - {end_date.strftime("%d/%m/%Y")}',
                'total_sales': sum(float(s.total_sales) for s in summaries),
                'total_orders': sum(s.total_orders for s in summaries),
                'total_items_sold': sum(s.total_items_sold for s in summaries),
                'daily_summaries': summaries
            }
            
            return consolidated
        
        elif report_type == 'monthly':
            if not year or not month:
                today = timezone.now().date()
                year = today.year
                month = today.month
            
            # Primer y último día del mes
            import calendar
            _, last_day = calendar.monthrange(year, month)
            start_date = date(year, month, 1)
            end_date = date(year, month, last_day)
            
            # Obtener reportes diarios del mes
            summaries = cls.objects.filter(
                date__gte=start_date,
                date__lte=end_date
            ).order_by('date')
            
            # Consolidar
            consolidated = {
                'type': 'monthly',
                'start_date': start_date,
                'end_date': end_date,
                'period_name': f'{calendar.month_name[month]} {year}',
                'total_sales': sum(float(s.total_sales) for s in summaries),
                'total_orders': sum(s.total_orders for s in summaries),
                'total_items_sold': sum(s.total_items_sold for s in summaries),
                'daily_summaries': summaries
            }
            
            return consolidated
        
        return None
    
    @property
    def cash_percentage(self):
        """Porcentaje de ventas en efectivo"""
        if self.total_sales > 0:
            return round((self.cash_sales / self.total_sales) * 100, 2)
        return 0
    
    @property
    def card_percentage(self):
        """Porcentaje de ventas con tarjeta"""
        if self.total_sales > 0:
            return round((self.card_sales / self.total_sales) * 100, 2)
        return 0
    
    @property
    def dine_in_percentage(self):
        """Porcentaje de ventas dine-in"""
        if self.total_sales > 0:
            return round((self.dine_in_sales / self.total_sales) * 100, 2)
        return 0