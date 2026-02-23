from django.db import models
from django.utils import timezone
import uuid


class Reservation(models.Model):
    """Reservación de mesa en el restaurante"""

    STATUS_CHOICES = [
        ('pending',   'Pendiente'),
        ('confirmed', 'Confirmada'),
        ('seated',    'En Mesa'),
        ('completed', 'Completada'),
        ('cancelled', 'Cancelada'),
        ('no_show',   'No se presentó'),
    ]

    OCCASION_CHOICES = [
        ('none',        'Sin ocasión especial'),
        ('birthday',    'Cumpleaños'),
        ('anniversary', 'Aniversario'),
        ('business',    'Reunión de negocios'),
        ('graduation',  'Graduación'),
        ('other',       'Otro'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reservation_number = models.CharField(
        max_length=25,
        unique=True,
        verbose_name='Número de Reservación',
        db_index=True
    )

    # ── Cliente (opcional — puede ser invitado sin cuenta) ──
    customer = models.ForeignKey(
        'customers.Customer',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reservations',
        verbose_name='Cliente'
    )
    # Datos del invitado si no hay cuenta registrada
    guest_name = models.CharField(max_length=150, verbose_name='Nombre del invitado')
    guest_phone = models.CharField(max_length=25, verbose_name='Teléfono del invitado')
    guest_email = models.EmailField(blank=True, verbose_name='Email del invitado')

    # ── Mesa (FK a pos.Table, asignación opcional) ──
    table = models.ForeignKey(
        'pos.Table',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reservations',
        verbose_name='Mesa'
    )

    # ── Datos de la reserva ──
    party_size = models.PositiveIntegerField(
        default=1,
        verbose_name='Número de personas'
    )
    reservation_date = models.DateField(verbose_name='Fecha de la reserva')
    reservation_time = models.TimeField(verbose_name='Hora de la reserva')
    duration_minutes = models.PositiveIntegerField(
        default=90,
        verbose_name='Duración (minutos)',
        help_text='Duración estimada de la visita'
    )

    # ── Estado ──
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending',
        verbose_name='Estado',
        db_index=True
    )

    # ── Información adicional ──
    special_requests = models.TextField(
        blank=True,
        verbose_name='Solicitudes especiales',
        help_text='Alergias, preferencias, necesidades especiales'
    )
    occasion = models.CharField(
        max_length=20,
        choices=OCCASION_CHOICES,
        default='none',
        verbose_name='Ocasión'
    )

    # ── Quién gestionó (viene del JWT — sin FK a auth-service) ──
    created_by_id = models.CharField(
        max_length=50,
        blank=True,
        verbose_name='ID del usuario que creó'
    )
    created_by_name = models.CharField(
        max_length=200,
        blank=True,
        verbose_name='Nombre del usuario que creó'
    )

    # ── Motivo de cancelación ──
    cancellation_reason = models.TextField(
        blank=True,
        verbose_name='Motivo de cancelación'
    )

    # ── Timestamps ──
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Creado el')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Actualizado el')
    confirmed_at = models.DateTimeField(null=True, blank=True, verbose_name='Confirmado el')
    seated_at = models.DateTimeField(null=True, blank=True, verbose_name='Sentado el')
    completed_at = models.DateTimeField(null=True, blank=True, verbose_name='Completado el')
    cancelled_at = models.DateTimeField(null=True, blank=True, verbose_name='Cancelado el')

    class Meta:
        verbose_name = 'Reservación'
        verbose_name_plural = 'Reservaciones'
        ordering = ['reservation_date', 'reservation_time']
        indexes = [
            models.Index(fields=['reservation_number']),
            models.Index(fields=['reservation_date', 'status']),
            models.Index(fields=['guest_phone']),
            models.Index(fields=['table', 'reservation_date']),
            models.Index(fields=['status', 'reservation_date']),
        ]

    def __str__(self):
        return f'Reserva {self.reservation_number} — {self.guest_name}'

    def save(self, *args, **kwargs):
        if not self.reservation_number:
            self.reservation_number = self._generate_number()
        super().save(*args, **kwargs)

    @staticmethod
    def _generate_number():
        from datetime import datetime
        ts = datetime.now().strftime('%y%m%d%H%M')
        suffix = uuid.uuid4().hex[:4].upper()
        return f'RSV-{ts}-{suffix}'

    # ── Métodos de negocio ──
    def confirm(self):
        if self.status in ('pending',):
            self.status = 'confirmed'
            self.confirmed_at = timezone.now()
            self.save(update_fields=['status', 'confirmed_at', 'updated_at'])
            # Marcar mesa como reservada si está asignada
            if self.table:
                self.table.status = 'reserved'
                self.table.save(update_fields=['status'])
            return True, 'Reservación confirmada'
        return False, f'No se puede confirmar desde el estado "{self.get_status_display()}"'

    def seat(self):
        if self.status in ('pending', 'confirmed'):
            self.status = 'seated'
            self.seated_at = timezone.now()
            self.save(update_fields=['status', 'seated_at', 'updated_at'])
            # Mantenemos la mesa como 'reserved' (no 'occupied') para que el
            # POS pueda abrirla y tomar el pedido del cliente.
            if self.table and self.table.status in ('available',):
                self.table.status = 'reserved'
                self.table.save(update_fields=['status'])
            return True, 'Cliente sentado — puede tomar el pedido desde el POS'
        return False, f'No se puede sentar desde el estado "{self.get_status_display()}"'

    def complete(self):
        if self.status in ('seated',):
            self.status = 'completed'
            self.completed_at = timezone.now()
            self.save(update_fields=['status', 'completed_at', 'updated_at'])
            if self.table:
                self.table.status = 'available'
                self.table.save(update_fields=['status'])
            return True, 'Reservación completada'
        return False, f'No se puede completar desde el estado "{self.get_status_display()}"'

    def cancel(self, reason=''):
        if self.status not in ('cancelled', 'completed', 'no_show'):
            self.status = 'cancelled'
            self.cancelled_at = timezone.now()
            self.cancellation_reason = reason
            self.save(update_fields=['status', 'cancelled_at', 'cancellation_reason', 'updated_at'])
            # Liberar mesa
            if self.table and self.table.status == 'reserved':
                self.table.status = 'available'
                self.table.save(update_fields=['status'])
            return True, 'Reservación cancelada'
        return False, f'No se puede cancelar desde el estado "{self.get_status_display()}"'

    def mark_no_show(self):
        if self.status in ('pending', 'confirmed'):
            self.status = 'no_show'
            self.save(update_fields=['status', 'updated_at'])
            if self.table and self.table.status == 'reserved':
                self.table.status = 'available'
                self.table.save(update_fields=['status'])
            return True, 'Marcado como no se presentó'
        return False, f'No se puede marcar como no-show desde "{self.get_status_display()}"'


class ReservationNote(models.Model):
    """Notas internas sobre una reservación"""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reservation = models.ForeignKey(
        Reservation,
        on_delete=models.CASCADE,
        related_name='notes',
        verbose_name='Reservación'
    )
    content = models.TextField(verbose_name='Contenido')
    created_by = models.CharField(
        max_length=200,
        blank=True,
        verbose_name='Creado por'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Nota de Reservación'
        verbose_name_plural = 'Notas de Reservaciones'
        ordering = ['-created_at']

    def __str__(self):
        return f'Nota — {self.reservation.reservation_number}'
