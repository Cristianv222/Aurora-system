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
    
    def get_status(self, obj):
        """Obtiene el estado de conexión de la impresora"""
        from .print_manager import PrinterManager
        return PrinterManager.check_connection(obj)
    
    def validate(self, data):
        connection_type = data.get('connection_type', self.instance.connection_type if self.instance else 'usb')
        
        if connection_type == 'network':
            port = data.get('port')
            if not port:
                raise serializers.ValidationError({
                    'port': 'El puerto es requerido para impresoras de red'
                })
        
        return data


class PrintJobSerializer(serializers.ModelSerializer):
    printer_name = serializers.CharField(source='printer.name', read_only=True)
    
    class Meta:
        model = PrintJob
        fields = [
            'id', 'job_number', 'printer', 'printer_name', 'document_type', 
            'order', 'payment', 'cash_register', 'content', 'data',
            'open_cash_drawer', 'cash_drawer_opened', 'status',
            'copies', 'error_message', 'created_by', 'created_at',
            'started_at', 'completed_at'
        ]
        read_only_fields = [
            'job_number', 'status', 'error_message', 'started_at',
            'completed_at', 'cash_drawer_opened'
        ]
    
    def create(self, validated_data):
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            validated_data['created_by'] = request.user.username
        
        validated_data['job_number'] = PrintJob.generate_job_number()
        return super().create(validated_data)


class CashDrawerEventSerializer(serializers.ModelSerializer):
    printer_name = serializers.CharField(source='printer.name', read_only=True)
    
    class Meta:
        model = CashDrawerEvent
        fields = [
            'id', 'printer', 'printer_name', 'print_job', 'cash_register',
            'event_type', 'success', 'notes', 'triggered_by', 'created_at'
        ]
        read_only_fields = ['created_at']


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


class PrintRequestSerializer(serializers.Serializer):
    """Serializer para solicitudes de impresión directa"""
    printer_id = serializers.UUIDField(required=True)
    content = serializers.CharField(required=True)
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
    copies = serializers.IntegerField(min_value=1, default=1)
    
    def validate(self, data):
        printer_id = data.get('printer_id')
        
        try:
            printer = Printer.objects.get(pk=printer_id, is_active=True)
            data['printer'] = printer
        except Printer.DoesNotExist:
            raise serializers.ValidationError({
                'printer_id': 'Impresora no encontrada o inactiva'
            })
        
        return data


class TestConnectionSerializer(serializers.Serializer):
    """Serializer para pruebas de conexión"""
    connection_type = serializers.ChoiceField(choices=Printer.CONNECTION_TYPES)
    connection_string = serializers.CharField()
    port = serializers.IntegerField(required=False)