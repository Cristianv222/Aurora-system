import uuid
from django.db import models
from django.utils import timezone
from django.core.validators import MinValueValidator
from decimal import Decimal

class Shift(models.Model):
    SHIFT_STATUS = [
        ('scheduled', 'Programado'),
        ('open', 'Abierto'),
        ('closed', 'Cerrado'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    shift_number = models.CharField(
        max_length=20,
        unique=True,
        verbose_name='Número de Turno',
        db_index=True
    )
    
    # User info from JWT
    user_id = models.CharField(
        max_length=50,
        verbose_name='ID del Usuario',
        db_index=True
    )
    user_name = models.CharField(
        max_length=200,
        verbose_name='Nombre del Usuario'
    )
    user_role = models.CharField(
        max_length=50,
        blank=True,
        verbose_name='Rol del Usuario'
    )
    
    status = models.CharField(
        max_length=20,
        choices=SHIFT_STATUS,
        default='open',
        verbose_name='Estado',
        db_index=True
    )
    
    # Scheduling fields
    scheduled_start = models.DateTimeField(null=True, blank=True, verbose_name='Inicio Programado')
    scheduled_end = models.DateTimeField(null=True, blank=True, verbose_name='Fin Programado')
    
    # Cash amounts
    opening_cash = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0.00,
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
    
    # Calculated totals at closing
    total_sales = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0.00,
        verbose_name='Total Recaudado'
    )
    total_cash_sales = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0.00,
        verbose_name='Total Efectivo'
    )
    total_card_sales = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0.00,
        verbose_name='Total Tarjeta'
    )
    total_transfer_sales = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0.00,
        verbose_name='Total Transferencia'
    )
    total_transactions = models.PositiveIntegerField(
        default=0,
        verbose_name='Total Transacciones'
    )
    
    cash_difference = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0.00,
        verbose_name='Diferencia en Caja'
    )
    
    opening_notes = models.TextField(blank=True, verbose_name='Notas de Apertura')
    closing_notes = models.TextField(blank=True, verbose_name='Notas de Cierre')
    
    opened_at = models.DateTimeField(null=True, blank=True, verbose_name='Fecha de Apertura', db_index=True)
    closed_at = models.DateTimeField(null=True, blank=True, verbose_name='Fecha de Cierre')

    class Meta:
        verbose_name = 'Turno'
        verbose_name_plural = 'Turnos'
        ordering = ['-opened_at', '-scheduled_start']

    def __str__(self):
        return f"Turno {self.shift_number} - {self.user_name}"

    def save(self, *args, **kwargs):
        if not self.shift_number:
            self.shift_number = self.generate_shift_number()
        if self.status == 'open' and not self.opened_at:
            self.opened_at = timezone.now()
        super().save(*args, **kwargs)

    @staticmethod
    def generate_shift_number():
        import uuid
        from django.utils import timezone
        timestamp = timezone.localtime(timezone.now()).strftime('%y%m%d%H%M')
        random_suffix = str(uuid.uuid4().hex[:3]).upper()
        return f'HTL-{timestamp}-{random_suffix}'

    def close_shift(self, closing_cash, closing_notes=''):
        if self.status == 'closed':
            return False, 'El turno ya está cerrado'
            
        self.closing_cash = closing_cash
        self.closing_notes = closing_notes
        
        # Calculate totals from linked payments
        payments = self.payments.all()
        
        self.total_cash_sales = payments.filter(payment_method='cash').aggregate(s=models.Sum('amount'))['s'] or Decimal('0.00')
        self.total_card_sales = payments.filter(payment_method='card').aggregate(s=models.Sum('amount'))['s'] or Decimal('0.00')
        self.total_transfer_sales = payments.filter(payment_method='transfer').aggregate(s=models.Sum('amount'))['s'] or Decimal('0.00')
        
        self.total_sales = self.total_cash_sales + self.total_card_sales + self.total_transfer_sales
        self.total_transactions = payments.count()
        
        expected_cash = self.opening_cash + self.total_cash_sales
        self.cash_difference = self.closing_cash - expected_cash
        
        self.status = 'closed'
        self.closed_at = timezone.now()
        self.save()
        
        return True, 'Turno cerrado exitosamente'

    @property
    def duration(self):
        if not self.opened_at:
            return 0
        if self.closed_at:
            delta = self.closed_at - self.opened_at
        else:
            delta = timezone.now() - self.opened_at
        return delta.total_seconds() / 3600

    @property
    def is_active(self):
        return self.status == 'open'
