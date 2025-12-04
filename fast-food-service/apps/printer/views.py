from django.shortcuts import get_object_or_404
from rest_framework import viewsets, status, generics, mixins
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny, IsAdminUser
from rest_framework.views import APIView
from django.utils import timezone
from django.db import transaction
import json
import logging

from .models import Printer, PrintJob, CashDrawerEvent, PrinterSettings
from .serializers import (
    PrinterSerializer, PrintJobSerializer,
    CashDrawerEventSerializer, PrinterSettingsSerializer,
    PrintRequestSerializer, TestConnectionSerializer
)
from .print_manager import PrinterManager

logger = logging.getLogger(__name__)


class PrinterViewSet(viewsets.ModelViewSet):
    """API para gestión de impresoras"""
    queryset = Printer.objects.all()
    serializer_class = PrinterSerializer
    permission_classes = [IsAuthenticated]
    
    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'test_connection', 'test_print']:
            return [IsAuthenticated()]
        return [IsAdminUser()]
    
    @action(detail=True, methods=['post'])
    def test_print(self, request, pk=None):
        """Prueba de impresión simple"""
        printer = self.get_object()
        
        try:
            # Contenido de prueba simple
            test_content = """
========================================
        PRUEBA DE IMPRESION
========================================
Nombre: {printer_name}
Tipo: {printer_type}
Conexión: {connection_type}
Fecha: {date}
========================================
¡Esta es una página de prueba!
Impreso desde el sistema de gestión.
========================================

""".format(
                printer_name=printer.name,
                printer_type=printer.get_printer_type_display(),
                connection_type=printer.get_connection_type_display(),
                date=timezone.now().strftime('%Y-%m-%d %H:%M:%S')
            )
            
            # Crear trabajo de impresión
            print_job = PrintJob.objects.create(
                printer=printer,
                document_type='other',
                content=test_content,
                data={'test': True},
                created_by=request.user.username if request.user.is_authenticated else 'system'
            )
            
            # Imprimir directamente
            success, message = PrinterManager.print_job(print_job)
            
            if success:
                return Response({
                    'status': 'success',
                    'message': 'Prueba de impresión enviada',
                    'job_id': str(print_job.id)
                })
            else:
                return Response({
                    'status': 'error',
                    'message': message
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
                
        except Exception as e:
            logger.error(f"Error en prueba de impresión: {str(e)}")
            return Response({
                'status': 'error',
                'message': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=True, methods=['post'])
    def test_cash_drawer(self, request, pk=None):
        """Prueba de apertura de caja registradora"""
        printer = self.get_object()
        
        try:
            success, message = PrinterManager.open_cash_drawer(printer)
            
            if success:
                # Registrar evento
                CashDrawerEvent.objects.create(
                    printer=printer,
                    event_type='test',
                    success=True,
                    notes='Prueba manual de caja registradora',
                    triggered_by=request.user.username if request.user.is_authenticated else 'system'
                )
                
                return Response({
                    'status': 'success',
                    'message': 'Caja registradora abierta'
                })
            else:
                return Response({
                    'status': 'error',
                    'message': message
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
                
        except Exception as e:
            logger.error(f"Error en prueba de caja: {str(e)}")
            return Response({
                'status': 'error',
                'message': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=False, methods=['post'])
    def test_connection(self, request):
        """Prueba de conexión a impresora"""
        serializer = TestConnectionSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        data = serializer.validated_data
        
        try:
            success, message = PrinterManager.test_connection(
                data['connection_type'],
                data['connection_string'],
                data.get('port')
            )
            
            return Response({
                'success': success,
                'message': message
            })
            
        except Exception as e:
            return Response({
                'success': False,
                'message': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=False, methods=['get'])
    def default(self, request):
        """Obtener impresora por defecto"""
        printer = Printer.get_default()
        if printer:
            serializer = self.get_serializer(printer)
            return Response(serializer.data)
        return Response({'detail': 'No hay impresora por defecto'}, 
                       status=status.HTTP_404_NOT_FOUND)


class PrintJobViewSet(mixins.ListModelMixin,
                     mixins.RetrieveModelMixin,
                     mixins.DestroyModelMixin,
                     viewsets.GenericViewSet):
    """API para historial de trabajos de impresión"""
    queryset = PrintJob.objects.all().order_by('-created_at')
    serializer_class = PrintJobSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Filtrar por estado si se proporciona
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        # Filtrar por impresora
        printer_id = self.request.query_params.get('printer_id')
        if printer_id:
            queryset = queryset.filter(printer_id=printer_id)
        
        # Filtrar por fecha
        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')
        
        if date_from:
            queryset = queryset.filter(created_at__date__gte=date_from)
        if date_to:
            queryset = queryset.filter(created_at__date__lte=date_to)
        
        return queryset
    
    @action(detail=True, methods=['post'])
    def retry(self, request, pk=None):
        """Reintentar un trabajo fallido"""
        print_job = self.get_object()
        
        if print_job.status != 'failed':
            return Response({
                'error': 'Solo se pueden reintentar trabajos fallidos'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            print_job.status = 'pending'
            print_job.error_message = ''
            print_job.save()
            
            # Reimprimir
            success, message = PrinterManager.print_job(print_job)
            
            if success:
                return Response({
                    'status': 'success',
                    'message': 'Trabajo reimpreso exitosamente',
                    'job_id': str(print_job.id)
                })
            else:
                print_job.mark_as_failed(message)
                return Response({
                    'status': 'error',
                    'message': message
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
                
        except Exception as e:
            logger.error(f"Error al reintentar impresión: {str(e)}")
            return Response({
                'status': 'error',
                'message': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class CashDrawerEventViewSet(mixins.ListModelMixin,
                            mixins.RetrieveModelMixin,
                            viewsets.GenericViewSet):
    """API para historial de eventos de caja"""
    queryset = CashDrawerEvent.objects.all().order_by('-created_at')
    serializer_class = CashDrawerEventSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Filtrar por impresora
        printer_id = self.request.query_params.get('printer_id')
        if printer_id:
            queryset = queryset.filter(printer_id=printer_id)
        
        # Filtrar por fecha
        date = self.request.query_params.get('date')
        if date:
            queryset = queryset.filter(created_at__date=date)
        
        # Filtrar por éxito
        success = self.request.query_params.get('success')
        if success is not None:
            queryset = queryset.filter(success=success.lower() == 'true')
        
        return queryset


class PrinterSettingsView(generics.RetrieveUpdateAPIView):
    """API para configuración global de impresión"""
    queryset = PrinterSettings.objects.all()
    serializer_class = PrinterSettingsSerializer
    permission_classes = [IsAdminUser]
    
    def get_object(self):
        return PrinterSettings.get_settings()


class PrintAPIView(APIView):
    """API principal para impresión directa"""
    permission_classes = [IsAuthenticated]
    
    @transaction.atomic
    def post(self, request):
        serializer = PrintRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        data = serializer.validated_data
        
        try:
            printer = data['printer']
            content = data['content']
            document_type = data['document_type']
            open_cash_drawer = data['open_cash_drawer']
            copies = data['copies']
            
            # Crear trabajo de impresión
            print_job = PrintJob.objects.create(
                printer=printer,
                document_type=document_type,
                content=content,
                data={'request_data': request.data},
                open_cash_drawer=open_cash_drawer,
                copies=copies,
                created_by=request.user.username if request.user.is_authenticated else 'system',
                status='pending'
            )
            
            # Imprimir inmediatamente
            success, message = PrinterManager.print_job(print_job)
            
            if success:
                return Response({
                    'status': 'success',
                    'message': 'Documento enviado a impresión',
                    'job_id': str(print_job.id),
                    'job_number': print_job.job_number
                })
            else:
                return Response({
                    'status': 'error',
                    'message': message,
                    'job_id': str(print_job.id)
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
                
        except Exception as e:
            logger.error(f"Error en impresión: {str(e)}")
            return Response({
                'status': 'error',
                'message': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class PrintReceiptView(APIView):
    """API para imprimir tickets de venta preformateados"""
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        # Obtener datos del ticket
        order_data = request.data.get('order', {})
        printer_id = request.data.get('printer_id')
        
        if not printer_id:
            # Usar impresora por defecto
            printer = Printer.get_default()
            if not printer:
                return Response({
                    'error': 'No hay impresora configurada por defecto'
                }, status=status.HTTP_400_BAD_REQUEST)
        else:
            try:
                printer = Printer.objects.get(pk=printer_id, is_active=True)
            except Printer.DoesNotExist:
                return Response({
                    'error': 'Impresora no encontrada o inactiva'
                }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # Generar contenido del ticket
            content = self.generate_receipt_content(printer, order_data)
            
            # Crear trabajo de impresión
            print_job = PrintJob.objects.create(
                printer=printer,
                document_type='receipt',
                content=content,
                data=order_data,
                open_cash_drawer=True,  # Siempre abrir caja para ventas
                created_by=request.user.username,
                status='pending'
            )
            
            # Imprimir
            success, message = PrinterManager.print_job(print_job)
            
            if success:
                return Response({
                    'status': 'success',
                    'message': 'Ticket impreso',
                    'job_id': str(print_job.id)
                })
            else:
                return Response({
                    'status': 'error',
                    'message': message
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
                
        except Exception as e:
            logger.error(f"Error al imprimir ticket: {str(e)}")
            return Response({
                'status': 'error',
                'message': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def generate_receipt_content(self, printer, order_data):
        """Genera el contenido formateado para el ticket"""
        settings = PrinterSettings.get_settings()
        chars_per_line = printer.characters_per_line or 42
        
        lines = []
        
        # Encabezado
        lines.append(settings.company_name.center(chars_per_line))
        if settings.company_address:
            lines.append(settings.company_address.center(chars_per_line))
        if settings.tax_id:
            lines.append(f"RUC: {settings.tax_id}".center(chars_per_line))
        lines.append("=" * chars_per_line)
        
        # Información del ticket
        lines.append("TICKET DE VENTA".center(chars_per_line))
        lines.append(f"Fecha: {timezone.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"Cliente: {order_data.get('customer_name', 'CONTADO')}")
        lines.append(f"Mesa: {order_data.get('table_number', 'SIN MESA')}")
        lines.append("-" * chars_per_line)
        
        # Ítems
        lines.append("PRODUCTO       CANT  PRECIO  TOTAL")
        lines.append("-" * chars_per_line)
        
        items = order_data.get('items', [])
        for item in items:
            name = item.get('name', '')[:14]
            qty = str(item.get('quantity', 0))
            price = f"{item.get('price', 0):.2f}"
            total = f"{item.get('total', 0):.2f}"
            lines.append(f"{name:14} {qty:>4} {price:>7} {total:>8}")
        
        lines.append("-" * chars_per_line)
        
        # Totales
        subtotal = order_data.get('subtotal', 0)
        tax = order_data.get('tax', 0)
        total = order_data.get('total', 0)
        
        lines.append(f"Subtotal: ${subtotal:.2f}")
        lines.append(f"IVA: ${tax:.2f}")
        lines.append(f"TOTAL: ${total:.2f}")
        
        # Información de pago
        payment_method = order_data.get('payment_method', 'Efectivo')
        lines.append(f"Forma de pago: {payment_method}")
        
        if payment_method.lower() == 'efectivo':
            cash = order_data.get('cash_received', 0)
            change = order_data.get('change', 0)
            lines.append(f"Recibido: ${cash:.2f}")
            lines.append(f"Cambio: ${change:.2f}")
        
        # Pie
        lines.append("\n" + settings.receipt_footer.center(chars_per_line))
        lines.append(f"Atendido por: {order_data.get('server', 'Sistema')}")
        lines.append("\n" * 3)  # Espacio para cortar
        
        return "\n".join(lines)


class PrintInvoiceView(APIView):
    """API para imprimir facturas"""
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        # Similar a PrintReceiptView pero con formato de factura
        pass


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def print_status(request):
    """Estado del sistema de impresión"""
    try:
        from django.db.models import Count, Q
        
        # Estadísticas básicas
        total_jobs = PrintJob.objects.count()
        pending_jobs = PrintJob.objects.filter(status='pending').count()
        today_jobs = PrintJob.objects.filter(
            created_at__date=timezone.now().date()
        ).count()
        
        # Impresoras activas
        active_printers = Printer.objects.filter(is_active=True)
        printer_status = {}
        
        for printer in active_printers:
            printer_status[printer.name] = {
                'status': PrinterManager.check_connection(printer),
                'type': printer.printer_type,
                'connection': printer.connection_type
            }
        
        return Response({
            'system': 'online',
            'printers_active': active_printers.count(),
            'jobs_total': total_jobs,
            'jobs_pending': pending_jobs,
            'jobs_today': today_jobs,
            'printers': printer_status,
            'default_printer': Printer.get_default().name if Printer.get_default() else None
        })
        
    except Exception as e:
        return Response({
            'system': 'error',
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def open_cash_drawer(request):
    """Abrir caja registradora manualmente"""
    printer_id = request.data.get('printer_id')
    
    if not printer_id:
        printer = Printer.get_default()
    else:
        try:
            printer = Printer.objects.get(pk=printer_id, is_active=True)
        except Printer.DoesNotExist:
            return Response({
                'error': 'Impresora no encontrada'
            }, status=status.HTTP_400_BAD_REQUEST)
    
    if not printer.has_cash_drawer:
        return Response({
            'error': 'Esta impresora no tiene caja registradora'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        success, message = PrinterManager.open_cash_drawer(printer)
        
        if success:
            # Registrar evento
            CashDrawerEvent.objects.create(
                printer=printer,
                event_type='manual',
                success=True,
                notes='Apertura manual de caja',
                triggered_by=request.user.username
            )
            
            return Response({
                'status': 'success',
                'message': 'Caja abierta exitosamente'
            })
        else:
            CashDrawerEvent.objects.create(
                printer=printer,
                event_type='manual',
                success=False,
                notes=message,
                triggered_by=request.user.username
            )
            
            return Response({
                'status': 'error',
                'message': message
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
    except Exception as e:
        logger.error(f"Error al abrir caja: {str(e)}")
        return Response({
            'status': 'error',
            'message': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)