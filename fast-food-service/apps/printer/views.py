from django.shortcuts import get_object_or_404
from rest_framework import viewsets, status, generics, mixins
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny, IsAdminUser
from rest_framework.views import APIView
from django.utils import timezone
from django.db import transaction
from django.core.cache import cache
import json
import logging
import base64
from io import BytesIO
from PIL import Image

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
            # Usar el método mejorado del PrinterManager
            success, message = PrinterManager.print_test_page(
                printer,
                user=request.user.username if request.user.is_authenticated else 'system'
            )
            
            if success:
                return Response({
                    'status': 'success',
                    'message': message
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
                    'message': message
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
        
        # ✅ CORRECCIÓN: Rate limiting para evitar spam
        cache_key = f'print_retry_{print_job.id}_{request.user.id}'
        if cache.get(cache_key):
            return Response({
                'error': 'Debe esperar 30 segundos antes de reintentar'
            }, status=status.HTTP_429_TOO_MANY_REQUESTS)
        
        try:
            print_job.status = 'pending'
            print_job.error_message = ''
            print_job.save(update_fields=['status', 'error_message'])
            
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
        finally:
            # Establecer rate limit de 30 segundos
            cache.set(cache_key, True, 30)


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
        # ✅ VALIDACIÓN: Verificar que vengan los datos necesarios
        order_data = request.data.get('order')
        if not order_data:
            return Response({
                'error': 'Debe proporcionar datos de la orden'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Validar items
        items = order_data.get('items', [])
        if not items:
            return Response({
                'error': 'La orden debe tener al menos un producto'
            }, status=status.HTTP_400_BAD_REQUEST)
        
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
            # ✅ Parámetro para controlar si imprimir logo
            print_logo = request.data.get('print_logo', True)
            
            # Generar contenido del ticket
            content, logo_path = self.generate_receipt_content(printer, order_data, print_logo)
            
            # Crear trabajo de impresión
            print_job = PrintJob.objects.create(
                printer=printer,
                document_type='receipt',
                content=content,
                data={
                    **order_data,
                    'logo_path': logo_path  # ← Pasar path del logo
                },
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
                    'job_id': str(print_job.id),
                    'job_number': print_job.job_number
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
    
    def generate_receipt_content(self, printer, order_data, print_logo=True):
        """
        Genera el contenido formateado para el ticket
        
        Args:
            printer: Objeto Printer
            order_data: Diccionario con datos de la orden
            print_logo: Boolean para incluir logo (default: True)
            
        Returns:
            tuple: (content: str, logo_path: str|None)
        """
        settings = PrinterSettings.get_settings()
        chars_per_line = printer.characters_per_line or 42
        
        lines = []
        logo_path = None
        
        # ===== 🖼️ LOGO DE LA EMPRESA =====
        if print_logo:
            company_logo = settings.get_company_logo()
            if company_logo:
                try:
                    logo_path = self._process_logo_for_thermal(
                        company_logo,
                        printer
                    )
                    if logo_path:
                        # Solo agregamos texto indicando que hay logo
                        # La imagen real se imprime en print_manager.py
                        lines.append("[LOGO]")
                        lines.append("")  # Línea en blanco después del logo
                except Exception as e:
                    logger.warning(f"No se pudo procesar logo: {e}")
                    # Continuar sin logo si hay error
        
        # ===== ENCABEZADO =====
        lines.append(settings.get_company_name().center(chars_per_line))
        
        address = settings.get_company_address()
        if address:
            # Dividir dirección si es muy larga
            address_lines = self._wrap_text(address, chars_per_line)
            for addr_line in address_lines:
                lines.append(addr_line.center(chars_per_line))
        
        phone = settings.get_company_phone()
        if phone:
            lines.append(f"Tel: {phone}".center(chars_per_line))
        
        tax_id = settings.get_tax_id()
        if tax_id:
            lines.append(f"RUC: {tax_id}".center(chars_per_line))
        
        lines.append("=" * chars_per_line)
        
        # ===== ENCABEZADO PERSONALIZADO =====
        receipt_header = settings.get_receipt_header()
        if receipt_header:
            header_lines = self._wrap_text(receipt_header, chars_per_line)
            for header_line in header_lines:
                lines.append(header_line.center(chars_per_line))
            lines.append("-" * chars_per_line)
        
        # ===== INFORMACIÓN DEL TICKET =====
        lines.append("TICKET DE VENTA".center(chars_per_line))
        lines.append(f"Fecha: {timezone.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"Ticket #: {order_data.get('order_number', 'N/A')}")
        lines.append(f"Cliente: {order_data.get('customer_name', 'CONTADO')}")
        
        # Mesa solo si existe
        table = order_data.get('table_number')
        if table:
            lines.append(f"Mesa: {table}")
        
        lines.append("-" * chars_per_line)
        
        # ===== PRODUCTOS =====
        lines.append("PRODUCTO       CANT  PRECIO  TOTAL")
        lines.append("-" * chars_per_line)
        
        items = order_data.get('items', [])
        for item in items:
            # Truncar nombre del producto si es muy largo
            name = str(item.get('name', 'Sin nombre'))[:14]
            qty = str(item.get('quantity', 0))
            price = float(item.get('price', 0))
            total = float(item.get('total', 0))
            
            # Formatear línea de producto
            lines.append(f"{name:14} {qty:>4} {price:>7.2f} {total:>8.2f}")
            
            # Si el producto tiene notas/modificadores
            notes = item.get('notes', '').strip()
            if notes:
                # Dividir notas en líneas si son largas
                note_lines = self._wrap_text(f"  * {notes}", chars_per_line - 2)
                lines.extend(note_lines)
        
        lines.append("-" * chars_per_line)
        
        # ===== TOTALES =====
        subtotal = float(order_data.get('subtotal', 0))
        discount = float(order_data.get('discount', 0))
        tax = float(order_data.get('tax', 0))
        total = float(order_data.get('total', 0))
        
        lines.append(f"{'Subtotal:':30} ${subtotal:>10.2f}")
        
        if discount > 0:
            lines.append(f"{'Descuento:':30} ${discount:>10.2f}")
        
        lines.append(f"{'IVA ({tax_rate}%):':30} ${tax:>10.2f}".format(
            tax_rate=order_data.get('tax_rate', 12)
        ))
        
        lines.append("=" * chars_per_line)
        lines.append(f"{'TOTAL:':30} ${total:>10.2f}")
        lines.append("=" * chars_per_line)
        
        # ===== INFORMACIÓN DE PAGO =====
        payment_method = order_data.get('payment_method', 'Efectivo')
        lines.append(f"Forma de pago: {payment_method}")
        
        if payment_method.lower() == 'efectivo':
            cash = float(order_data.get('cash_received', 0))
            change = float(order_data.get('change', 0))
            lines.append(f"Recibido: ${cash:.2f}")
            lines.append(f"Cambio: ${change:.2f}")
        
        lines.append("")
        
        # ===== PIE DE PÁGINA =====
        receipt_footer = settings.get_receipt_footer()
        if receipt_footer:
            footer_lines = self._wrap_text(receipt_footer, chars_per_line)
            for footer_line in footer_lines:
                lines.append(footer_line.center(chars_per_line))
        
        lines.append(f"Atendido por: {order_data.get('server', 'Sistema')}")
        
        # ===== CÓDIGO QR (Opcional) =====
        # Si en el futuro quieres agregar QR, lo haces aquí
        # qr_code = self._generate_qr_code(order_data)
        
        lines.append("\n" * 3)  # Espacio para cortar
        
        return "\n".join(lines), logo_path
    
    def _process_logo_for_thermal(self, logo_data, printer):
        """
        Procesa el logo para impresoras térmicas
        
        Args:
            logo_data: Base64 string o path de la imagen
            printer: Objeto Printer
            
        Returns:
            str: Path temporal de la imagen procesada (o None si falla)
        """
        try:
            import tempfile
            
            # Detectar si es base64 o path
            if logo_data.startswith('data:image'):
                # Formato: data:image/png;base64,iVBORw0KG...
                base64_data = logo_data.split(',')[1]
                image_data = base64.b64decode(base64_data)
            elif logo_data.startswith('/') or logo_data.startswith('./'):
                # Es un path de archivo
                with open(logo_data, 'rb') as f:
                    image_data = f.read()
            else:
                # Asumimos que es base64 puro
                image_data = base64.b64decode(logo_data)
            
            # Abrir imagen con PIL
            image = Image.open(BytesIO(image_data))
            
            # Convertir a escala de grises (requerido para térmicas)
            image = image.convert('L')
            
            # Redimensionar según ancho de impresora
            # Las térmicas usualmente son 576px para 80mm, 384px para 58mm
            if printer.paper_width >= 80:
                max_width = 512  # Un poco menos que 576 para margenes
            elif printer.paper_width >= 58:
                max_width = 360  # Un poco menos que 384
            else:
                max_width = 256
            
            # Mantener proporción
            if image.width > max_width:
                aspect_ratio = image.height / image.width
                new_width = max_width
                new_height = int(new_width * aspect_ratio)
                image = image.resize((new_width, new_height), Image.LANCZOS)
            
            # Convertir a 1-bit (blanco y negro) para mejor impresión
            # Threshold para binarización
            image = image.point(lambda x: 0 if x < 128 else 255, '1')
            
            # Guardar en archivo temporal
            temp_file = tempfile.NamedTemporaryFile(
                delete=False,
                suffix='.png',
                prefix=f'logo_printer_{printer.id}_'
            )
            image.save(temp_file.name, 'PNG')
            temp_file.close()
            
            logger.info(f"Logo procesado y guardado en: {temp_file.name}")
            return temp_file.name
            
        except Exception as e:
            logger.error(f"Error procesando logo: {str(e)}")
            return None
    
    def _wrap_text(self, text, max_width):
        """
        Divide texto largo en múltiples líneas
        
        Args:
            text: Texto a dividir
            max_width: Ancho máximo en caracteres
            
        Returns:
            list: Lista de líneas
        """
        if len(text) <= max_width:
            return [text]
        
        words = text.split()
        lines = []
        current_line = []
        current_length = 0
        
        for word in words:
            word_length = len(word) + 1  # +1 por el espacio
            
            if current_length + word_length <= max_width:
                current_line.append(word)
                current_length += word_length
            else:
                if current_line:
                    lines.append(' '.join(current_line))
                current_line = [word]
                current_length = len(word) + 1
        
        if current_line:
            lines.append(' '.join(current_line))
        
        return lines


class PrintInvoiceView(APIView):
    """API para imprimir facturas"""
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        # TODO: Implementar formato de factura
        # Similar a PrintReceiptView pero con requisitos fiscales
        return Response({
            'error': 'Funcionalidad de factura en desarrollo'
        }, status=status.HTTP_501_NOT_IMPLEMENTED)


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
    
    if not printer:
        return Response({
            'error': 'No hay impresora configurada'
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
                'message': message
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