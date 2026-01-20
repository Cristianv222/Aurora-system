from django.db import models
from django.utils import timezone
import uuid

from django.contrib.auth.models import BaseUserManager

class CustomerManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('El email es obligatorio')
        email = self.normalize_email(email)
        customer = self.model(email=email, **extra_fields)
        if password:
            customer.set_password(password)
        customer.save(using=self._db)
        return customer

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_active', True)
        extra_fields.setdefault('is_vip', True)
        return self.create_user(email, password, **extra_fields)

class Customer(models.Model):
    """Cliente sin autenticación - solo información de contacto para pedidos"""
    CUSTOMER_TYPES = [
        ('regular', 'Cliente Regular'),
        ('vip', 'Cliente VIP'),
        ('corporate', 'Cliente Corporativo'),
        ('student', 'Estudiante'),
        ('first_time', 'Primera Vez'),
    ]
    
    GENDER_CHOICES = [
        ('M', 'Masculino'),
        ('F', 'Femenino'),
        ('O', 'Otro'),
        ('N', 'Prefiero no decirlo'),
    ]
    
    # Información básica
   # Información básica
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True, verbose_name='Correo electrónico')
    phone = models.CharField(max_length=20, unique=True, verbose_name='Teléfono')
    
    # NUEVO CAMPO CEDULA
    cedula = models.CharField(
        max_length=20,
        unique=True,
        blank=True,
        null=True, # Puede ser null temporalmente, aunque debería ser único
        verbose_name='Cédula / RUC',
        help_text='Documento de identificación único'
    )
    
    first_name = models.CharField(max_length=50, verbose_name='Nombres')
    last_name = models.CharField(max_length=50, verbose_name='Apellidos')
    birth_date = models.DateField(null=True, blank=True, verbose_name='Fecha de nacimiento')
    gender = models.CharField(max_length=1, choices=GENDER_CHOICES, null=True, blank=True)
    
    # Información de contacto
    address = models.TextField(blank=True, verbose_name='Dirección')
    city = models.CharField(max_length=100, blank=True, verbose_name='Ciudad')
    state = models.CharField(max_length=100, blank=True, verbose_name='Estado/Provincia')
    zip_code = models.CharField(max_length=20, blank=True, verbose_name='Código postal')
    country = models.CharField(max_length=100, blank=True, default='Ecuador', verbose_name='País')
    
    # Tipo y estado del cliente
    customer_type = models.CharField(max_length=20, choices=CUSTOMER_TYPES, default='regular')
    is_active = models.BooleanField(default=True, verbose_name='Activo')
    is_vip = models.BooleanField(default=False, verbose_name='Cliente VIP')
    
    # Preferencias
    preferences = models.JSONField(default=dict, blank=True, verbose_name='Preferencias')
    
    # Métricas del cliente
    total_orders = models.PositiveIntegerField(default=0, verbose_name='Total de pedidos')
    total_spent = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name='Total gastado')
    last_order_date = models.DateTimeField(null=True, blank=True, verbose_name='Último pedido')
    average_order_value = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name='Valor promedio de pedido')
    
    # Marketing
    newsletter_subscribed = models.BooleanField(default=True, verbose_name='Suscrito al newsletter')
    marketing_emails = models.BooleanField(default=True, verbose_name='Acepta emails de marketing')
    marketing_sms = models.BooleanField(default=True, verbose_name='Acepta SMS de marketing')
    
    # Auditoría
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Fecha de creación')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Fecha de actualización')
    registered_ip = models.GenericIPAddressField(null=True, blank=True, verbose_name='IP de registro')
    
    # Auth fields
    password = models.CharField(max_length=128, verbose_name='Contraseña', default='')
    last_login = models.DateTimeField(blank=True, null=True, verbose_name='Último inicio de sesión')
    
    objects = CustomerManager()
    
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['first_name', 'last_name', 'phone']
    
    class Meta:
        verbose_name = 'Cliente'
        verbose_name_plural = 'Clientes'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['email']),
            models.Index(fields=['phone']),
            models.Index(fields=['customer_type']),
            models.Index(fields=['is_vip']),
            models.Index(fields=['created_at']),
        ]
    
    def __str__(self):
        return f'{self.first_name} {self.last_name} ({self.email})'
    
    def get_full_name(self):
        return f'{self.first_name} {self.last_name}'.strip()
    
    def get_short_name(self):
        return self.first_name

    # Métodos de autenticación
    @property
    def is_anonymous(self):
        return False

    @property
    def is_authenticated(self):
        return True
        
    def check_password(self, raw_password):
        from django.contrib.auth.hashers import check_password
        return check_password(raw_password, self.password)

    def set_password(self, raw_password):
        from django.contrib.auth.hashers import make_password
        self.password = make_password(raw_password)
    
    def update_order_stats(self, order_amount):
        """Actualiza estadísticas después de un pedido"""
        self.total_orders += 1
        self.total_spent += order_amount
        self.last_order_date = timezone.now()
        self.average_order_value = self.total_spent / self.total_orders if self.total_orders > 0 else 0
        self.save(update_fields=['total_orders', 'total_spent', 'last_order_date', 'average_order_value'])
    
    def calculate_loyalty_points(self):
        """Calcula puntos de lealtad basados en compras"""
        return int(self.total_spent * 10)  # 10 puntos por cada dólar gastado
    
    @property
    def customer_since(self):
        """Días desde que es cliente"""
        if self.created_at:
            return (timezone.now() - self.created_at).days
        return 0
    
    @property
    def days_since_last_order(self):
        """Días desde el último pedido"""
        if self.last_order_date:
            return (timezone.now() - self.last_order_date).days
        return None


class CustomerAddress(models.Model):
    """Direcciones adicionales del cliente"""
    ADDRESS_TYPES = [
        ('home', 'Casa'),
        ('work', 'Trabajo'),
        ('billing', 'Facturación'),
        ('shipping', 'Envío'),
        ('other', 'Otro'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='addresses')
    address_type = models.CharField(max_length=20, choices=ADDRESS_TYPES, default='home')
    is_default = models.BooleanField(default=False, verbose_name='Dirección principal')
    
    # Dirección
    street = models.CharField(max_length=255, verbose_name='Calle y número')
    apartment = models.CharField(max_length=100, blank=True, verbose_name='Departamento/Oficina')
    city = models.CharField(max_length=100, verbose_name='Ciudad')
    state = models.CharField(max_length=100, verbose_name='Estado/Provincia')
    zip_code = models.CharField(max_length=20, verbose_name='Código postal')
    country = models.CharField(max_length=100, default='Ecuador', verbose_name='País')
    
    # Instrucciones especiales
    special_instructions = models.TextField(blank=True, verbose_name='Instrucciones especiales')
    
    # Coordenadas (para delivery)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    
    # Auditoría
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Dirección del cliente'
        verbose_name_plural = 'Direcciones de clientes'
        ordering = ['-is_default', 'address_type']
    
    def __str__(self):
        return f'{self.get_address_type_display()} - {self.customer.get_full_name()}'


class CustomerNote(models.Model):
    """Notas internas sobre el cliente"""
    NOTE_TYPES = [
        ('general', 'General'),
        ('preference', 'Preferencia'),
        ('issue', 'Problema'),
        ('complaint', 'Queja'),
        ('praise', 'Elogio'),
        ('allergy', 'Alergia'),
        ('reminder', 'Recordatorio'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='notes')
    note_type = models.CharField(max_length=20, choices=NOTE_TYPES, default='general')
    content = models.TextField(verbose_name='Contenido de la nota')
    # Removido created_by porque apuntaba a 'self' incorrectamente
    created_by_name = models.CharField(max_length=100, blank=True, verbose_name='Creado por')
    
    # Auditoría
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_archived = models.BooleanField(default=False, verbose_name='Archivada')
    
    class Meta:
        verbose_name = 'Nota del cliente'
        verbose_name_plural = 'Notas de clientes'
        ordering = ['-created_at']
    
    def __str__(self):
        return f'Nota {self.get_note_type_display()} - {self.customer.get_full_name()}'


class CustomerLoyalty(models.Model):
    """Programa de lealtad del cliente"""
    TIERS = [
        ('bronze', 'Bronce (0-999 puntos)'),
        ('silver', 'Plata (1000-4999 puntos)'),
        ('gold', 'Oro (5000-14999 puntos)'),
        ('platinum', 'Platino (15000+ puntos)'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    customer = models.OneToOneField(Customer, on_delete=models.CASCADE, related_name='loyalty')
    current_tier = models.CharField(max_length=20, choices=TIERS, default='bronze')
    points_balance = models.PositiveIntegerField(default=0, verbose_name='Puntos actuales')
    total_points_earned = models.PositiveIntegerField(default=0, verbose_name='Puntos totales ganados')
    total_points_redeemed = models.PositiveIntegerField(default=0, verbose_name='Puntos totales canjeados')
    
    # Fechas importantes
    tier_achieved_date = models.DateTimeField(null=True, blank=True)
    next_tier_progress = models.DecimalField(max_digits=5, decimal_places=2, default=0, verbose_name='Progreso al siguiente nivel (%)')
    
    # Beneficios del nivel actual
    discount_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0, verbose_name='Descuento (%)')
    free_delivery = models.BooleanField(default=False, verbose_name='Envío gratis')
    priority_service = models.BooleanField(default=False, verbose_name='Servicio prioritario')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Programa de lealtad'
        verbose_name_plural = 'Programas de lealtad'
    
    def __str__(self):
        return f'{self.get_current_tier_display()} - {self.customer.get_full_name()}'
    
    def update_tier(self):
        """Actualiza el tier basado en puntos"""
        old_tier = self.current_tier
        
        if self.points_balance >= 15000:
            self.current_tier = 'platinum'
            self.discount_rate = 15
            self.free_delivery = True
            self.priority_service = True
        elif self.points_balance >= 5000:
            self.current_tier = 'gold'
            self.discount_rate = 10
            self.free_delivery = True
            self.priority_service = False
        elif self.points_balance >= 1000:
            self.current_tier = 'silver'
            self.discount_rate = 5
            self.free_delivery = False
            self.priority_service = False
        else:
            self.current_tier = 'bronze'
            self.discount_rate = 0
            self.free_delivery = False
            self.priority_service = False
        
        # Calcular progreso al siguiente tier
        self.calculate_next_tier_progress()
        
        # Si cambió de tier, registrar fecha
        if old_tier != self.current_tier:
            self.tier_achieved_date = timezone.now()
    
    def calculate_next_tier_progress(self):
        """Calcula progreso al siguiente tier"""
        if self.current_tier == 'platinum':
            self.next_tier_progress = 100
        elif self.current_tier == 'gold':
            self.next_tier_progress = min(100, (self.points_balance / 15000) * 100)
        elif self.current_tier == 'silver':
            self.next_tier_progress = min(100, (self.points_balance / 5000) * 100)
        else:  # bronze
            self.next_tier_progress = min(100, (self.points_balance / 1000) * 100)
    
    def add_points(self, points, reason=''):
        """Añade puntos al programa de lealtad"""
        self.points_balance += points
        self.total_points_earned += points
        self.update_tier()
        self.save()
        
        # Crear historial
        CustomerLoyaltyHistory.objects.create(
            loyalty=self,
            transaction_type='earn',
            points_change=points,
            balance_after=self.points_balance,
            reason=reason
        )


class CustomerLoyaltyHistory(models.Model):
    """Historial de cambios en puntos de lealtad"""
    TRANSACTION_TYPES = [
        ('earn', 'Ganancia'),
        ('redeem', 'Canje'),
        ('adjustment', 'Ajuste'),
        ('expiration', 'Expiración'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    loyalty = models.ForeignKey(CustomerLoyalty, on_delete=models.CASCADE, related_name='history')
    transaction_type = models.CharField(max_length=20, choices=TRANSACTION_TYPES)
    points_change = models.IntegerField(verbose_name='Cambio de puntos')  # Puede ser positivo o negativo
    balance_after = models.PositiveIntegerField(verbose_name='Saldo después')
    reason = models.CharField(max_length=255, blank=True, verbose_name='Razón')
    order_reference = models.CharField(max_length=50, blank=True, verbose_name='Referencia de pedido')
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = 'Historial de lealtad'
        verbose_name_plural = 'Historiales de lealtad'
        ordering = ['-created_at']
    
    def __str__(self):
        return f'{self.get_transaction_type_display()} - {self.points_change} puntos'


class CustomerDevice(models.Model):
    """Dispositivos del cliente para notificaciones push"""
    DEVICE_TYPES = [
        ('ios', 'iOS'),
        ('android', 'Android'),
        ('web', 'Web'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='devices')
    device_type = models.CharField(max_length=20, choices=DEVICE_TYPES)
    device_token = models.CharField(max_length=255, unique=True, verbose_name='Token del dispositivo')
    device_id = models.CharField(max_length=255, blank=True, verbose_name='ID del dispositivo')
    
    # Información del dispositivo
    app_version = models.CharField(max_length=20, blank=True, verbose_name='Versión de la app')
    os_version = models.CharField(max_length=20, blank=True, verbose_name='Versión del SO')
    model = models.CharField(max_length=100, blank=True, verbose_name='Modelo del dispositivo')
    
    # Estado
    is_active = models.BooleanField(default=True, verbose_name='Activo')
    last_used = models.DateTimeField(auto_now=True, verbose_name='Último uso')
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = 'Dispositivo del cliente'
        verbose_name_plural = 'Dispositivos de clientes'
        unique_together = ['customer', 'device_token']
    
    def __str__(self):
        return f'{self.get_device_type_display()} - {self.customer.get_full_name()}'