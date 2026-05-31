from django.db import models
from apps.rooms.models import Room
from apps.guests.models import Guest
import string
import random

def generate_reservation_code():
    chars = string.ascii_uppercase + string.digits
    while True:
        code = f"AUR-{''.join(random.choices(chars, k=4))}"
        if not Reservation.objects.filter(reservation_code=code).exists():
            return code

class Reservation(models.Model):
    """Reservación o estadía del hotel"""
    STATUS_CHOICES = [
        ('reserved', 'Reservada'),
        ('active', 'Activa'),
        ('checked_out', 'Completada (Check-out)'),
        ('cancelled', 'Cancelada'),
    ]

    room = models.ForeignKey(Room, on_delete=models.PROTECT, related_name="reservations", verbose_name="Habitación")
    guest = models.ForeignKey(Guest, on_delete=models.PROTECT, related_name="reservations", verbose_name="Huésped")
    check_in_date = models.DateTimeField(verbose_name="Fecha/Hora Check-in")
    check_out_date = models.DateTimeField(null=True, blank=True, verbose_name="Fecha/Hora Check-out")
    planned_check_out = models.DateTimeField(null=True, blank=True, verbose_name="Fecha/Hora Salida Planeada")
    number_of_adults = models.PositiveIntegerField(default=1, verbose_name="Número de Adultos")
    number_of_children = models.PositiveIntegerField(default=0, verbose_name="Número de Niños")
    total_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.0, verbose_name="Monto Total")
    deposit_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.0, verbose_name="Monto Depósito")
    deposit_paid = models.BooleanField(default=False, verbose_name="¿Depósito Pagado?")
    reservation_code = models.CharField(max_length=8, unique=True, null=True, blank=True, verbose_name="Código de Reserva")
    notes = models.TextField(blank=True, null=True, verbose_name="Notas")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active', verbose_name="Estado")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-check_in_date']
        verbose_name = "Reservación"
        verbose_name_plural = "Reservaciones"

    def __str__(self):
        return f"Reserva #{self.id} - Hab {self.room.room_number} ({self.guest.name})"

    def save(self, *args, **kwargs):
        if not self.reservation_code:
            self.reservation_code = generate_reservation_code()
        super().save(*args, **kwargs)

class Payment(models.Model):
    """Pagos y facturación vinculados a la estadía"""
    PAYMENT_METHODS = [
        ('cash', 'Efectivo'),
        ('card', 'Tarjeta'),
        ('transfer', 'Transferencia'),
    ]

    SRI_STATUS = [
        ('DRAFT', 'Borrador'),
        ('QUEUED', 'En Cola'),
        ('AUTHORIZED', 'Autorizado'),
        ('REJECTED', 'Rechazado'),
    ]

    reservation = models.ForeignKey(Reservation, on_delete=models.CASCADE, related_name="payments", verbose_name="Reservación")
    amount = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="Monto de Pago")
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHODS, default='cash', verbose_name="Método de Pago")
    is_deposit = models.BooleanField(default=False, verbose_name="¿Es Depósito?")
    
    # SRI integration fields
    sri_access_key = models.CharField(max_length=49, blank=True, null=True, verbose_name="Clave de Acceso SRI")
    sri_number = models.CharField(max_length=20, blank=True, null=True, verbose_name="Número de Factura SRI")
    sri_status = models.CharField(max_length=20, choices=SRI_STATUS, default='DRAFT', verbose_name="Estado SRI")
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = "Pago / Factura"
        verbose_name_plural = "Pagos / Facturas"

    def __str__(self):
        return f"Pago de ${self.amount} - Reserva #{self.reservation_id}"


class SRIConfiguration(models.Model):
    """Configuración de credenciales SRI encriptadas"""
    ENVIRONMENT_CHOICES = [
        ('TEST', 'Pruebas / Test'),
        ('PRODUCTION', 'Producción'),
    ]

    is_active = models.BooleanField(default=False, verbose_name="¿Activo?")
    encrypted_vsr_token = models.TextField(blank=True, null=True, verbose_name="Token VSR Encriptado")
    environment = models.CharField(
        max_length=20, 
        choices=ENVIRONMENT_CHOICES, 
        default='TEST',
        verbose_name="Ambiente"
    )
    establishment_code = models.CharField(max_length=3, default='001', verbose_name="Código de Establecimiento")
    emission_point = models.CharField(max_length=3, default='001', verbose_name="Punto de Emisión")

    class Meta:
        verbose_name = "Configuración SRI"
        verbose_name_plural = "Configuraciones SRI"

    def __str__(self):
        return f"Configuración SRI - {'Activa' if self.is_active else 'Inactiva'}"

    @property
    def vsr_token(self):
        from apps.reservations.utils import decrypt_token
        return decrypt_token(self.encrypted_vsr_token)

    @vsr_token.setter
    def vsr_token(self, value):
        from apps.reservations.utils import encrypt_token
        self.encrypted_vsr_token = encrypt_token(value)


class HotelSettings(models.Model):
    default_checkin_time = models.TimeField(default='14:00', verbose_name="Hora Check-in por Defecto")
    default_checkout_time = models.TimeField(default='12:00', verbose_name="Hora Check-out por Defecto")
    hotel_name = models.CharField(max_length=200, default="Hotel Aurora", verbose_name="Nombre del Hotel")
    hotel_address = models.TextField(blank=True, null=True, verbose_name="Dirección del Hotel")
    hotel_phone = models.CharField(max_length=50, blank=True, null=True, verbose_name="Teléfono del Hotel")

    class Meta:
        verbose_name = "Configuración del Hotel"
        verbose_name_plural = "Configuraciones del Hotel"

    def __str__(self):
        return self.hotel_name


