from django.db import models
from django.utils import timezone
from django.core.validators import MinValueValidator
import uuid
import json


class Printer(models.Model):
    """Impresoras configuradas en el sistema"""
    PRINTER_TYPES = [
        ('thermal', 'Térmica (Tickets)'),
        ('laser', 'Láser (Facturas)'),
        ('matrix', 'Matriz de Puntos'),
    ]
    
    CONNECTION_TYPES = [
        ('usb', 'USB'),
        ('network', 'Red/IP'),
        ('bluetooth', 'Bluetooth'),
        ('serial', 'Serial/COM'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, verbose_name='Nombre')
    printer_type = models.CharField(
        max_length=20,
        choices=PRINTER_TYPES,
        default='thermal',
        verbose_name='Tipo de Impresora'
    )
    
    # Conexión
    connection_type = models.CharField(
        max_length=20,
        choices=CONNECTION_TYPES,
        default='usb',
        verbose_name='Tipo de Conexión'
    )
    
    connection_string = models.CharField(
        max_length=255,
        verbose_name='Cadena de Conexión',
        help_text='USB: /dev/usb/lp0 | Red: 192.168.1.100 | COM: COM1'
    )
    
    port = models.IntegerField(
        null=True,
        blank=True,
        verbose_name='Puerto',
        help_text='Puerto de red (ej: 9100 para impresoras ESC/POS)'
    )
    
    # Configuración
    paper_width = models.IntegerField(
        default=80,
        verbose_name='Ancho de Papel (mm)',
        help_text='58mm o 80mm típicamente'
    )
    
    characters_per_line = models.IntegerField(
        default=42,
        verbose_name='Caracteres por Línea'
    )
    
    # Control de caja registradora
    has_cash_drawer = models.BooleanField(
        default=True,
        verbose_name='Tiene Caja Registradora',
        help_text='Si la impresora tiene caja de dinero conectada'
    )
    
    cash_drawer_pin = models.IntegerField(
        default=0,
        verbose_name='Pin de Caja',
        help_text='0 = Pin 2, 1 = Pin 5'
    )
    
    cash_drawer_on_time = models.IntegerField(
        default=100,
        verbose_name='Tiempo ON (ms)',
        help_text='Tiempo que el pulso está activo'
    )
    
    cash_drawer_off_time = models.IntegerField(
        default=100,
        verbose_name='Tiempo OFF (ms)',
        help_text='Tiempo que el pulso está inactivo'
    )
    
    # Estado
    is_active = models.BooleanField(default=True, verbose_name='Activa')
    is_default = models.BooleanField(default=False, verbose_name='Impresora por Defecto')
    
    # Configuración adicional (JSON)
    config = models.JSONField(
        default=dict,
        blank=True,
        verbose_name='Configuración Adicional',
        help_text='Configuración específica del driver'
    )
    
    # Auditoría
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Impresora'
        verbose_name_plural = 'Impresoras'
        ordering = ['name']
    
    def __str__(self):
        return f'{self.name} ({self.get_printer_type_display()})'
    
    def save(self, *args, **kwargs):
        # Solo puede haber una impresora por defecto
        if self.is_default:
            Printer.objects.filter(is_default=True).exclude(pk=self.pk).update(is_default=False)
        super().save(*args, **kwargs)
    
    @classmethod
    def get_default(cls):
        """Obtiene la impresora por defecto"""
        return cls.objects.filter(is_default=True, is_active=True).first()


class PrintTemplate(models.Model):
    """Plantillas de impresión"""
    TEMPLATE_TYPES = [
        ('receipt', 'Ticket de Venta'),
        ('invoice', 'Factura'),
        ('order_kitchen', 'Orden de Cocina'),
        ('order_bar', 'Orden de Bar'),
        ('daily_report', 'Reporte Diario'),
        ('cash_report', 'Reporte de Caja'),
        ('refund', 'Reembolso'),
        ('custom', 'Personalizado'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, verbose_name='Nombre')
    template_type = models.CharField(
        max_length=20,
        choices=TEMPLATE_TYPES,
        verbose_name='Tipo de Plantilla'
    )
    
    # Contenido de la plantilla (puede ser Jinja2, HTML, o formato específico)
    content = models.TextField(
        verbose_name='Contenido de la Plantilla',
        help_text='Plantilla con variables como {{order_number}}, {{total}}, etc.'
    )
    
    # Configuración de impresión
    print_logo = models.BooleanField(default=True, verbose_name='Imprimir Logo')
    print_qr = models.BooleanField(default=False, verbose_name='Imprimir QR')
    
    auto_cut = models.BooleanField(
        default=True,
        verbose_name='Corte Automático',
        help_text='Cortar papel automáticamente después de imprimir'
    )
    
    copies = models.IntegerField(
        default=1,
        validators=[MinValueValidator(1)],
        verbose_name='Número de Copias'
    )
    
    # Estado
    is_active = models.BooleanField(default=True, verbose_name='Activa')
    is_default = models.BooleanField(
        default=False,
        verbose_name='Plantilla por Defecto',
        help_text='Plantilla por defecto para este tipo'
    )
    
    # Auditoría
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Plantilla de Impresión'
        verbose_name_plural = 'Plantillas de Impresión'
        ordering = ['template_type', 'name']
        unique_together = ['template_type', 'is_default']
    
    def __str__(self):
        return f'{self.name} ({self.get_template_type_display()})'
    
    def save(self, *args, **kwargs):
        # Solo puede haber una plantilla por defecto por tipo
        if self.is_default:
            PrintTemplate.objects.filter(
                template_type=self.template_type,
                is_default=True
            ).exclude(pk=self.pk).update(is_default=False)
        super().save(*args, **kwargs)


class PrintJob(models.Model):
    """Trabajos de impresión (historial)"""
    JOB_STATUS = [
        ('pending', 'Pendiente'),
        ('printing', 'Imprimiendo'),
        ('completed', 'Completado'),
        ('failed', 'Fallido'),
        ('cancelled', 'Cancelado'),
    ]
    
    DOCUMENT_TYPES = [
        ('receipt', 'Ticket'),
        ('invoice', 'Factura'),
        ('order', 'Orden'),
        ('report', 'Reporte'),
        ('other', 'Otro'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    job_number = models.CharField(
        max_length=20,
        unique=True,
        verbose_name='Número de Trabajo'
    )
    
    # Impresora utilizada
    printer = models.ForeignKey(
        Printer,
        on_delete=models.PROTECT,
        related_name='print_jobs',
        verbose_name='Impresora'
    )
    
    # Plantilla utilizada
    template = models.ForeignKey(
        PrintTemplate,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='print_jobs',
        verbose_name='Plantilla'
    )
    
    # Tipo de documento
    document_type = models.CharField(
        max_length=20,
        choices=DOCUMENT_TYPES,
        verbose_name='Tipo de Documento'
    )
    
    # Relaciones opcionales con otros modelos
    order = models.ForeignKey(
        'orders.Order',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='print_jobs',
        verbose_name='Orden'
    )
    
    payment = models.ForeignKey(
        'payments.Payment',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='print_jobs',
        verbose_name='Pago'
    )
    
    cash_register = models.ForeignKey(
        'payments.CashRegister',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='print_jobs',
        verbose_name='Caja Registradora'
    )
    
    # Contenido a imprimir (ya renderizado)
    content = models.TextField(verbose_name='Contenido')
    
    # Datos adicionales (JSON)
    data = models.JSONField(
        default=dict,
        verbose_name='Datos',
        help_text='Datos usados para generar el contenido'
    )
    
    # Control de caja registradora
    open_cash_drawer = models.BooleanField(
        default=False,
        verbose_name='Abrir Caja',
        help_text='Si se debe abrir la caja registradora al imprimir'
    )
    
    cash_drawer_opened = models.BooleanField(
        default=False,
        verbose_name='Caja Abierta',
        help_text='Si la caja fue abierta exitosamente'
    )
    
    # Estado
    status = models.CharField(
        max_length=20,
        choices=JOB_STATUS,
        default='pending',
        verbose_name='Estado'
    )
    
    # Número de copias
    copies = models.IntegerField(
        default=1,
        validators=[MinValueValidator(1)],
        verbose_name='Copias'
    )
    
    # Error si falla
    error_message = models.TextField(
        blank=True,
        verbose_name='Mensaje de Error'
    )
    
    # Auditoría
    created_by = models.CharField(
        max_length=100,
        blank=True,
        verbose_name='Creado por'
    )
    
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Creado')
    started_at = models.DateTimeField(null=True, blank=True, verbose_name='Iniciado')
    completed_at = models.DateTimeField(null=True, blank=True, verbose_name='Completado')
    
    class Meta:
        verbose_name = 'Trabajo de Impresión'
        verbose_name_plural = 'Trabajos de Impresión'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['job_number']),
            models.Index(fields=['printer', 'status']),
            models.Index(fields=['created_at']),
            models.Index(fields=['order']),
        ]
    
    def __str__(self):
        return f'Job #{self.job_number} - {self.get_document_type_display()}'
    
    def save(self, *args, **kwargs):
        # Generar número de trabajo si no existe
        if not self.job_number:
            self.job_number = self.generate_job_number()
        super().save(*args, **kwargs)
    
    @staticmethod
    def generate_job_number():
        """Genera un número de trabajo único"""
        from datetime import datetime
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        random_suffix = str(uuid.uuid4().hex[:4]).upper()
        return f'PRINT-{timestamp}-{random_suffix}'
    
    def mark_as_printing(self):
        """Marca el trabajo como en impresión"""
        if self.status == 'pending':
            self.status = 'printing'
            self.started_at = timezone.now()
            self.save()
            return True
        return False
    
    def mark_as_completed(self):
        """Marca el trabajo como completado"""
        if self.status == 'printing':
            self.status = 'completed'
            self.completed_at = timezone.now()
            self.save()
            return True
        return False
    
    def mark_as_failed(self, error_message=''):
        """Marca el trabajo como fallido"""
        self.status = 'failed'
        self.error_message = error_message
        self.completed_at = timezone.now()
        self.save()
        return True


class CashDrawerEvent(models.Model):
    """Historial de aperturas de caja registradora"""
    EVENT_TYPES = [
        ('print', 'Apertura por Impresión'),
        ('manual', 'Apertura Manual'),
        ('register_open', 'Apertura de Turno'),
        ('register_close', 'Cierre de Turno'),
        ('test', 'Prueba'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Impresora que abrió la caja
    printer = models.ForeignKey(
        Printer,
        on_delete=models.PROTECT,
        related_name='cash_drawer_events',
        verbose_name='Impresora'
    )
    
    # Trabajo de impresión asociado (si aplica)
    print_job = models.ForeignKey(
        PrintJob,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='cash_drawer_events',
        verbose_name='Trabajo de Impresión'
    )
    
    # Caja registradora asociada
    cash_register = models.ForeignKey(
        'payments.CashRegister',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='drawer_events',
        verbose_name='Caja Registradora'
    )
    
    # Tipo de evento
    event_type = models.CharField(
        max_length=20,
        choices=EVENT_TYPES,
        default='print',
        verbose_name='Tipo de Evento'
    )
    
    # Éxito
    success = models.BooleanField(default=True, verbose_name='Exitoso')
    
    # Notas
    notes = models.TextField(blank=True, verbose_name='Notas')
    
    # Auditoría
    triggered_by = models.CharField(
        max_length=100,
        blank=True,
        verbose_name='Activado por'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = 'Evento de Caja'
        verbose_name_plural = 'Eventos de Caja'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['printer', 'created_at']),
            models.Index(fields=['cash_register', 'created_at']),
        ]
    
    def __str__(self):
        return f'{self.get_event_type_display()} - {self.created_at.strftime("%Y-%m-%d %H:%M")}'


class PrinterSettings(models.Model):
    """Configuración global del sistema de impresión"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Logo de la empresa (imagen en base64 o ruta)
    company_logo = models.TextField(
        blank=True,
        verbose_name='Logo de la Empresa',
        help_text='Imagen en base64 o ruta al archivo'
    )
    
    # Información de la empresa
    company_name = models.CharField(
        max_length=200,
        verbose_name='Nombre de la Empresa'
    )
    
    company_address = models.TextField(verbose_name='Dirección')
    company_phone = models.CharField(max_length=50, verbose_name='Teléfono')
    company_email = models.EmailField(blank=True, verbose_name='Email')
    company_website = models.URLField(blank=True, verbose_name='Sitio Web')
    
    # Información fiscal
    tax_id = models.CharField(
        max_length=50,
        blank=True,
        verbose_name='RUC/NIT/RFC',
        help_text='Identificación fiscal'
    )
    
    # Mensajes personalizados
    receipt_header = models.TextField(
        blank=True,
        verbose_name='Encabezado de Ticket',
        help_text='Texto personalizado al inicio del ticket'
    )
    
    receipt_footer = models.TextField(
        blank=True,
        verbose_name='Pie de Ticket',
        help_text='Texto personalizado al final del ticket (ej: "Gracias por su compra")'
    )
    
    # Configuración de impresión automática
    auto_print_receipt = models.BooleanField(
        default=True,
        verbose_name='Imprimir Ticket Automáticamente',
        help_text='Imprimir ticket al completar pago'
    )
    
    auto_print_kitchen = models.BooleanField(
        default=True,
        verbose_name='Imprimir Orden de Cocina Automáticamente',
        help_text='Imprimir orden de cocina al confirmar orden'
    )
    
    # Control de caja automático
    auto_open_drawer_on_payment = models.BooleanField(
        default=True,
        verbose_name='Abrir Caja Automáticamente al Pagar',
        help_text='Abrir caja al imprimir ticket de venta'
    )
    
    require_confirmation_to_open_drawer = models.BooleanField(
        default=False,
        verbose_name='Requiere Confirmación para Abrir Caja',
        help_text='Preguntar antes de abrir la caja'
    )
    
    # Auditoría
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Configuración de Impresión'
        verbose_name_plural = 'Configuraciones de Impresión'
    
    def __str__(self):
        return f'Configuración de {self.company_name}'
    
    @classmethod
    def get_settings(cls):
        """Obtiene la configuración global (singleton)"""
        settings, created = cls.objects.get_or_create(
            pk='00000000-0000-0000-0000-000000000001',
            defaults={
                'company_name': 'Mi Restaurante',
                'company_address': 'Dirección no configurada',
                'company_phone': '000-0000',
            }
        )
        return settings