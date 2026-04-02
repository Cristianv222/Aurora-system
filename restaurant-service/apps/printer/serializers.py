from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Printer, PrintJob, CashDrawerEvent, PrinterSettings

User = get_user_model()


# ============================================================================
# SERIALIZERS ESTÁNDAR (CRUD)
# ============================================================================

class PrinterSerializer(serializers.ModelSerializer):
    """Serializer para impresoras"""
    printer_type_display = serializers.CharField(source='get_printer_type_display', read_only=True)
    connection_type_display = serializers.CharField(source='get_connection_type_display', read_only=True)
    role_display = serializers.CharField(source='get_role_display', read_only=True)  # ← NUEVO

    class Meta:
        model = Printer
        fields = [
            'id', 'name', 'printer_type', 'printer_type_display',
            'role', 'role_display',                                  # ← NUEVO
            'connection_type', 'connection_type_display',
            'connection_string', 'port', 'paper_width',
            'characters_per_line', 'has_cash_drawer',
            'cash_drawer_pin', 'cash_drawer_on_time',
            'cash_drawer_off_time', 'is_active', 'is_default',
            'config', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class PrintJobSerializer(serializers.ModelSerializer):
    """Serializer para trabajos de impresión"""
    printer_name = serializers.CharField(source='printer.name', read_only=True)
    printer_role = serializers.CharField(source='printer.role', read_only=True)  # ← NUEVO
    document_type_display = serializers.CharField(source='get_document_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = PrintJob
        fields = [
            'id', 'job_number', 'printer', 'printer_name',
            'printer_role',                                          # ← NUEVO
            'document_type', 'document_type_display',
            'content', 'data', 'open_cash_drawer', 'cash_drawer_opened',
            'status', 'status_display', 'copies', 'error_message',
            'created_by', 'created_at', 'started_at', 'completed_at'
        ]
        read_only_fields = [
            'id', 'job_number', 'created_at',
            'started_at', 'completed_at'
        ]


class CashDrawerEventSerializer(serializers.ModelSerializer):
    """Serializer para eventos de caja registradora"""
    printer_name = serializers.CharField(source='printer.name', read_only=True)
    event_type_display = serializers.CharField(source='get_event_type_display', read_only=True)

    class Meta:
        model = CashDrawerEvent
        fields = [
            'id', 'printer', 'printer_name', 'print_job',
            'event_type', 'event_type_display', 'success',
            'notes', 'triggered_by', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class PrinterSettingsSerializer(serializers.ModelSerializer):
    """Serializer para configuración global"""

    class Meta:
        model = PrinterSettings
        fields = [
            'id', 'company_logo', 'company_name', 'company_address',
            'company_phone', 'company_email', 'company_website',
            'tax_id', 'receipt_header', 'receipt_footer',
            'auto_print_receipt', 'auto_print_kitchen',
            'auto_open_drawer_on_payment',
            'require_confirmation_to_open_drawer',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


# ============================================================================
# SERIALIZERS PARA PETICIONES DE IMPRESIÓN
# ============================================================================

class PrintRequestSerializer(serializers.Serializer):
    """Serializer para solicitudes de impresión directa"""
    printer = serializers.PrimaryKeyRelatedField(
        queryset=Printer.objects.filter(is_active=True)
    )
    content = serializers.CharField()
    document_type = serializers.ChoiceField(
        choices=PrintJob.DOCUMENT_TYPES,
        default='other'
    )
    open_cash_drawer = serializers.BooleanField(default=False)
    copies = serializers.IntegerField(default=1, min_value=1, max_value=10)


class TestConnectionSerializer(serializers.Serializer):
    """Serializer para prueba de conexión"""
    connection_type = serializers.ChoiceField(
        choices=Printer.CONNECTION_TYPES
    )
    connection_string = serializers.CharField(max_length=255)
    port = serializers.IntegerField(required=False, allow_null=True)


# ============================================================================
# SERIALIZERS PARA LA API DEL AGENTE DE WINDOWS
# ============================================================================

class AgenteImpresoraSerializer(serializers.Serializer):
    """Serializer para información de impresoras detectadas por el agente"""
    nombre = serializers.CharField(max_length=255)
    puerto = serializers.CharField(max_length=100, allow_blank=True, default='N/A')
    driver = serializers.CharField(max_length=255, allow_blank=True, default='N/A')
    estado = serializers.CharField(max_length=50, default='Disponible')


class AgenteRegistroSerializer(serializers.Serializer):
    """Serializer para registro del agente"""
    computadora = serializers.CharField(max_length=100)
    usuario = serializers.CharField(max_length=100)
    version_agente = serializers.CharField(max_length=20)
    impresoras = AgenteImpresoraSerializer(many=True)


class AgenteResultadoSerializer(serializers.Serializer):
    """Serializer para reporte de resultados del agente"""
    trabajo_id = serializers.UUIDField()
    success = serializers.BooleanField()
    mensaje = serializers.CharField(max_length=500, allow_blank=True, default='')
    detalles = serializers.JSONField(default=dict)


class AgenteEstadoSerializer(serializers.Serializer):
    """Serializer para estado del agente"""
    ejecutando = serializers.BooleanField()
    trabajos_exitosos = serializers.IntegerField()
    trabajos_fallidos = serializers.IntegerField()
    ultima_conexion = serializers.DateTimeField(allow_null=True)
    version_agente = serializers.CharField(max_length=20)
    computadora = serializers.CharField(max_length=100)
    usuario = serializers.CharField(max_length=100)


# ============================================================================
# SERIALIZERS PARA ENDPOINTS MANUALES DE IMPRESIÓN  ← NUEVO
# ============================================================================

class PrintOrderItemSerializer(serializers.Serializer):
    """Ítem individual dentro de una orden a imprimir"""
    name = serializers.CharField()
    quantity = serializers.IntegerField(min_value=1)
    price = serializers.FloatField(min_value=0, required=False, default=0)
    total = serializers.FloatField(min_value=0, required=False, default=0)
    note = serializers.CharField(required=False, allow_blank=True, default='')
    # product_id es necesario para detectar si el ítem va a cocina
    product_id = serializers.CharField(required=False, allow_blank=True, default='')


class PaymentSplitSerializer(serializers.Serializer):
    """Entrada de pago individual (split payment)"""
    payment_method_id = serializers.CharField(required=False, allow_blank=True, default='')
    method_name       = serializers.CharField(required=False, allow_blank=True, default='Pago')
    amount_applied    = serializers.FloatField(min_value=0)
    amount_received   = serializers.FloatField(required=False, default=0, min_value=0)
    currency_code     = serializers.CharField(required=False, default='USD')
    change_amount     = serializers.FloatField(required=False, default=0, min_value=0)


class PrintOrderSerializer(serializers.Serializer):
    """
    Serializer para los 3 endpoints manuales de impresión:

      POST /print/order/pos/      → ticket de venta en impresora POS
      POST /print/order/kitchen/  → ticket de cocina en impresora KITCHEN
      POST /print/order/both/     → ambas impresoras a la vez

    Payload de ejemplo:
    {
        "order_number": "ORD-001",
        "customer_name": "CONSUMIDOR FINAL",
        "table_number": "5",
        "items": [
            {
                "product_id": "uuid-del-producto",
                "name": "Hamburguesa",
                "quantity": 1,
                "price": 8.00,
                "total": 8.00,
                "note": "sin cebolla"
            }
        ],
        "subtotal": 8.00,
        "discount": 0,
        "total": 8.00,
        "notes": "Pago con $10 - Cambio $2",
        "printed_at": "2026-03-06T20:43:37-05:00"
    }

    El campo printer_id es OPCIONAL. Si no se envía, el sistema
    busca automáticamente la impresora por su rol (pos/kitchen).
    """
    order_number = serializers.CharField(required=False, default="")
    customer_name = serializers.CharField(default='CONSUMIDOR FINAL')
    table_number = serializers.CharField(default='N/A')
    items = serializers.ListField(
        child=PrintOrderItemSerializer(),
        min_length=1
    )
    subtotal = serializers.FloatField(min_value=0, required=False, default=0)
    discount = serializers.FloatField(default=0, min_value=0)
    total = serializers.FloatField(min_value=0, required=False, default=0)
    notes = serializers.CharField(required=False, allow_blank=True, default='')
    printed_at = serializers.CharField(required=False, allow_blank=True, default='')

    # Opcional: destino de impresión para separar Cocina vs Fortaleza
    destination = serializers.CharField(required=False, allow_blank=True, default='kitchen')

    # Opcional: forzar una impresora específica por su UUID
    printer_id = serializers.UUIDField(required=False, allow_null=True, default=None)

    # Pagos múltiples (split payment) — opcional
    payments_list = PaymentSplitSerializer(many=True, required=False, default=list)