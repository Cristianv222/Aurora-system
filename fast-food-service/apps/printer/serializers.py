from rest_framework import serializers
from .models import Printer, PrintJob, CashDrawerEvent, PrinterSettings
import uuid


class PrinterSerializer(serializers.ModelSerializer):
    status = serializers.SerializerMethodField(read_only=True)
    
    class Meta:
        model = Printer
        fields = [
            'id', 'name', 'printer_type', 'connection_type', 'connection_string',
            'port', 'paper_width', 'characters_per_line', 'has_cash_drawer',
            'cash_drawer_pin', 'cash_drawer_on_time', 'cash_drawer_off_time',
            'is_active', 'is_default', 'config', 'status', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']
    
    def get_status(self, obj):
        """Obtiene el estado de conexión de la impresora"""
        from .print_manager import PrinterManager
        return PrinterManager.check_connection(obj)
    
    def validate_name(self, value):
        """Validar que el nombre no esté vacío"""
        if not value or not value.strip():
            raise serializers.ValidationError("El nombre no puede estar vacío")
        return value.strip()
    
    def validate_connection_string(self, value):
        """Validar cadena de conexión"""
        if not value or not value.strip():
            raise serializers.ValidationError("La cadena de conexión no puede estar vacía")
        return value.strip()
    
    def validate(self, data):
        """Validaciones a nivel de objeto"""
        connection_type = data.get('connection_type', self.instance.connection_type if self.instance else 'usb')
        
        # ✅ Validar puerto para conexiones de red
        if connection_type == 'network':
            port = data.get('port', self.instance.port if self.instance else None)
            if not port:
                raise serializers.ValidationError({
                    'port': 'El puerto es requerido para impresoras de red'
                })
            if not (1 <= port <= 65535):
                raise serializers.ValidationError({
                    'port': 'El puerto debe estar entre 1 y 65535'
                })
        
        # ✅ Validar paper_width
        paper_width = data.get('paper_width', self.instance.paper_width if self.instance else 80)
        if paper_width not in [58, 80]:
            raise serializers.ValidationError({
                'paper_width': 'El ancho de papel debe ser 58mm o 80mm'
            })
        
        return data


class PrintJobSerializer(serializers.ModelSerializer):
    printer_name = serializers.CharField(source='printer.name', read_only=True)
    printer_type = serializers.CharField(source='printer.printer_type', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    document_type_display = serializers.CharField(source='get_document_type_display', read_only=True)
    
    class Meta:
        model = PrintJob
        fields = [
            'id', 'job_number', 'printer', 'printer_name', 'printer_type',
            'document_type', 'document_type_display',
            'content', 'data',
            'open_cash_drawer', 'cash_drawer_opened', 
            'status', 'status_display',
            'copies', 'error_message', 'created_by', 
            'created_at', 'started_at', 'completed_at',
            'related_model', 'related_id'
        ]
        read_only_fields = [
            'id', 'job_number', 'status', 'status_display', 'error_message', 
            'started_at', 'completed_at', 'cash_drawer_opened',
            'printer_name', 'printer_type', 'document_type_display'
        ]
    
    def create(self, validated_data):
        """Crear trabajo de impresión con usuario actual"""
        request = self.context.get('request')
        if request and hasattr(request, 'user') and request.user.is_authenticated:
            validated_data['created_by'] = request.user.username
        
        # Generar job_number automáticamente
        validated_data['job_number'] = PrintJob.generate_job_number()
        
        return super().create(validated_data)
    
    def validate_copies(self, value):
        """Validar número de copias"""
        if value < 1:
            raise serializers.ValidationError("Debe ser al menos 1 copia")
        if value > 10:
            raise serializers.ValidationError("Máximo 10 copias permitidas")
        return value
    
    def validate_content(self, value):
        """Validar que hay contenido"""
        if not value or not value.strip():
            raise serializers.ValidationError("El contenido no puede estar vacío")
        return value


class CashDrawerEventSerializer(serializers.ModelSerializer):
    printer_name = serializers.CharField(source='printer.name', read_only=True)
    event_type_display = serializers.CharField(source='get_event_type_display', read_only=True)
    
    class Meta:
        model = CashDrawerEvent
        fields = [
            'id', 'printer', 'printer_name', 'print_job',
            'event_type', 'event_type_display', 
            'success', 'notes', 'triggered_by', 'created_at'
        ]
        read_only_fields = ['id', 'created_at', 'printer_name', 'event_type_display']


class PrinterSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = PrinterSettings
        fields = [
            'id', 'company_logo', 'company_name', 'company_address',
            'company_phone', 'company_email', 'company_website', 'tax_id',
            'receipt_header', 'receipt_footer', 'auto_print_receipt',
            'auto_print_kitchen', 'auto_open_drawer_on_payment',
            'require_confirmation_to_open_drawer', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def validate_company_name(self, value):
        """Validar nombre de empresa"""
        if not value or not value.strip():
            raise serializers.ValidationError("El nombre de la empresa es requerido")
        return value.strip()
    
    def validate_company_logo(self, value):
        """Validar formato del logo"""
        if not value:
            return value
        
        # Verificar que sea base64 válido o path
        if value.startswith('data:image'):
            # Validar formato base64
            try:
                header, data = value.split(',', 1)
                if 'base64' not in header:
                    raise serializers.ValidationError("El logo debe estar en formato base64")
            except ValueError:
                raise serializers.ValidationError("Formato de logo inválido")
        elif not (value.startswith('/') or value.startswith('./')):
            # Si no es path, debe ser base64 puro
            import base64
            try:
                base64.b64decode(value)
            except Exception:
                raise serializers.ValidationError(
                    "El logo debe ser base64 válido o un path de archivo"
                )
        
        return value


class PrintRequestSerializer(serializers.Serializer):
    """Serializer para solicitudes de impresión directa"""
    printer_id = serializers.UUIDField(required=True)
    content = serializers.CharField(required=True, min_length=1)
    document_type = serializers.ChoiceField(
        choices=[
            ('receipt', 'Ticket'),
            ('invoice', 'Factura'),
            ('order_kitchen', 'Orden Cocina'),
            ('order_bar', 'Orden Bar'),
            ('report', 'Reporte'),
            ('other', 'Otro')
        ],
        required=True
    )
    open_cash_drawer = serializers.BooleanField(default=False)
    copies = serializers.IntegerField(min_value=1, max_value=10, default=1)
    
    def validate_printer_id(self, value):
        """Validar que la impresora existe y está activa"""
        try:
            printer = Printer.objects.get(pk=value, is_active=True)
            return value
        except Printer.DoesNotExist:
            raise serializers.ValidationError('Impresora no encontrada o inactiva')
    
    def validate_content(self, value):
        """Validar contenido"""
        if not value or not value.strip():
            raise serializers.ValidationError('El contenido no puede estar vacío')
        
        # Validar longitud máxima (prevenir abuse)
        if len(value) > 50000:  # ~50KB
            raise serializers.ValidationError('El contenido es demasiado largo')
        
        return value.strip()
    
    def validate(self, data):
        """Validaciones a nivel de objeto"""
        # Obtener el objeto printer completo
        try:
            printer = Printer.objects.get(pk=data['printer_id'], is_active=True)
            data['printer'] = printer
        except Printer.DoesNotExist:
            raise serializers.ValidationError({
                'printer_id': 'Impresora no encontrada o inactiva'
            })
        
        # Validar que si quiere abrir caja, la impresora tenga caja
        if data.get('open_cash_drawer') and not printer.has_cash_drawer:
            raise serializers.ValidationError({
                'open_cash_drawer': 'Esta impresora no tiene caja registradora configurada'
            })
        
        return data


class TestConnectionSerializer(serializers.Serializer):
    """Serializer para pruebas de conexión"""
    connection_type = serializers.ChoiceField(
        choices=Printer.CONNECTION_TYPES,
        required=True
    )
    connection_string = serializers.CharField(
        required=True,
        min_length=1,
        max_length=255
    )
    port = serializers.IntegerField(
        required=False,
        min_value=1,
        max_value=65535,
        allow_null=True
    )
    
    def validate_connection_string(self, value):
        """Validar cadena de conexión"""
        if not value or not value.strip():
            raise serializers.ValidationError('La cadena de conexión no puede estar vacía')
        return value.strip()
    
    def validate(self, data):
        """Validaciones a nivel de objeto"""
        connection_type = data.get('connection_type')
        port = data.get('port')
        connection_string = data.get('connection_string')
        
        # ✅ Validar puerto requerido para red
        if connection_type == 'network':
            if not port:
                raise serializers.ValidationError({
                    'port': 'El puerto es requerido para conexiones de red'
                })
            
            # ✅ Validar formato de IP
            import socket
            try:
                socket.inet_aton(connection_string)
            except socket.error:
                raise serializers.ValidationError({
                    'connection_string': 'Dirección IP inválida'
                })
        
        # ✅ Validar que el puerto no sea común de otros servicios
        if port:
            forbidden_ports = [
                22,    # SSH
                80,    # HTTP
                443,   # HTTPS
                3306,  # MySQL
                5432,  # PostgreSQL
                8000,  # Django dev
                8080,  # HTTP alt
            ]
            if port in forbidden_ports:
                raise serializers.ValidationError({
                    'port': f'El puerto {port} es usado por otros servicios. '
                            f'Use puertos típicos de impresoras (9100, 9101, etc.)'
                })
        
        return data


class ReceiptDataSerializer(serializers.Serializer):
    """Serializer para validar datos de tickets de venta"""
    order_number = serializers.CharField(required=False, max_length=50)
    customer_name = serializers.CharField(default='CONTADO', max_length=100)
    table_number = serializers.CharField(default='', max_length=50)
    
    items = serializers.ListField(
        child=serializers.DictField(),
        min_length=1,
        error_messages={
            'min_length': 'Debe haber al menos un producto en la orden'
        }
    )
    
    subtotal = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=0)
    discount = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=0, default=0)
    tax = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=0)
    tax_rate = serializers.DecimalField(max_digits=5, decimal_places=2, default=12)
    total = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=0)
    
    payment_method = serializers.CharField(default='Efectivo', max_length=50)
    cash_received = serializers.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        required=False,
        allow_null=True
    )
    change = serializers.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        required=False,
        allow_null=True
    )
    
    server = serializers.CharField(default='Sistema', max_length=100)
    
    def validate_items(self, value):
        """Validar estructura de items"""
        required_fields = ['name', 'quantity', 'price', 'total']
        
        for i, item in enumerate(value):
            for field in required_fields:
                if field not in item:
                    raise serializers.ValidationError(
                        f"El item {i+1} debe tener el campo '{field}'"
                    )
            
            # Validar tipos
            try:
                qty = float(item['quantity'])
                price = float(item['price'])
                total = float(item['total'])
                
                if qty <= 0:
                    raise serializers.ValidationError(
                        f"El item {i+1} tiene cantidad inválida"
                    )
                if price < 0:
                    raise serializers.ValidationError(
                        f"El item {i+1} tiene precio inválido"
                    )
            except (ValueError, TypeError):
                raise serializers.ValidationError(
                    f"El item {i+1} tiene valores numéricos inválidos"
                )
        
        return value
    
    def validate(self, data):
        """Validaciones cruzadas"""
        # Validar que el total coincida
        calculated_total = data['subtotal'] - data.get('discount', 0) + data['tax']
        if abs(calculated_total - data['total']) > 0.01:  # Permitir diferencia de 1 centavo
            raise serializers.ValidationError({
                'total': f'El total no coincide. Esperado: {calculated_total:.2f}, Recibido: {data["total"]:.2f}'
            })
        
        # Validar efectivo y cambio
        if data['payment_method'].lower() == 'efectivo':
            cash = data.get('cash_received')
            if cash is None:
                raise serializers.ValidationError({
                    'cash_received': 'Debe especificar el efectivo recibido'
                })
            if cash < data['total']:
                raise serializers.ValidationError({
                    'cash_received': 'El efectivo recibido es menor que el total'
                })
        
        return data