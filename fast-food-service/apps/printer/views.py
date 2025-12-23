from django.shortcuts import get_object_or_404
from rest_framework import viewsets, status, generics, mixins
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny, IsAdminUser
from rest_framework.views import APIView
from django.utils import timezone
from django.db import transaction
from django.core.cache import cache
from django.contrib.auth import get_user_model
import json
import logging
import base64
from io import BytesIO
from PIL import Image

from .models import Printer, PrintJob, CashDrawerEvent, PrinterSettings
from .serializers import (
    PrinterSerializer, PrintJobSerializer,
    CashDrawerEventSerializer, PrinterSettingsSerializer,
    PrintRequestSerializer, TestConnectionSerializer,
    # Serializers del agente
    AgenteRegistroSerializer,
    AgenteResultadoSerializer,
)
from .print_manager import PrinterManager

User = get_user_model()
logger = logging.getLogger(__name__)


# ============================================================================
# VIEWSETS ESTÁNDAR (CRUD)
# ============================================================================

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
        
        # Rate limiting para evitar spam
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
    
    @action(detail=False, methods=['get'])
    def estadisticas(self, request):
        """Estadísticas de trabajos de impresión"""
        from datetime import timedelta
        from django.db.models import Count
        
        # Últimas 24 horas
        hace_24h = timezone.now() - timedelta(hours=24)
        
        stats = {
            'total': PrintJob.objects.count(),
            'pendientes': PrintJob.objects.filter(status='pending').count(),
            'completados': PrintJob.objects.filter(status='completed').count(),
            'fallidos': PrintJob.objects.filter(status='failed').count(),
            'ultimas_24h': PrintJob.objects.filter(created_at__gte=hace_24h).count(),
            'ultimas_24h_completados': PrintJob.objects.filter(
                created_at__gte=hace_24h,
                status='completed'
            ).count(),
            'por_impresora': list(
                PrintJob.objects.values('printer__name')
                .annotate(total=Count('id'))
                .order_by('-total')
            )
        }
        
        return Response(stats)


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


# ============================================================================
# ENDPOINTS PARA EL AGENTE DE WINDOWS
# ============================================================================

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def agente_registrar(request):
    """
    Endpoint para registro del agente de Windows
    
    POST /api/hardware/agente/registrar/
    {
        "computadora": "PC-CAJA-01",
        "usuario": "usuario_windows",
        "version_agente": "3.0.1",
        "impresoras": [...]
    }
    """
    logger.info(f"🔍 Headers recibidos: {request.META.get('HTTP_AUTHORIZATION', 'NO HAY HEADER')}")
    logger.info(f"🔍 Usuario autenticado: {request.user}")
    logger.info(f"🔍 Is authenticated: {request.user.is_authenticated}")

    serializer = AgenteRegistroSerializer(data=request.data)
    
    if not serializer.is_valid():
        return Response(
            {'error': 'Datos inválidos', 'detalles': serializer.errors},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    data = serializer.validated_data
    
    # Guardar información del agente en cache
    cache_key = f"agente_{request.user.username}_{data['computadora']}"
    cache.set(cache_key, {
        'computadora': data['computadora'],
        'usuario': data['usuario'],
        'version_agente': data['version_agente'],
        'impresoras': data['impresoras'],
        'ultima_conexion': timezone.now().isoformat(),
        'user_id': request.user.id,
        'username': request.user.username
    }, timeout=3600)  # 1 hora
    
    logger.info(
        f"✅ Agente registrado: {data['computadora']} "
        f"(Usuario: {data['usuario']}, Version: {data['version_agente']}, "
        f"Impresoras: {len(data['impresoras'])})"
    )
    
    # Verificar si el usuario es superusuario o staff (modo SISTEMA)
    es_sistema = request.user.is_superuser or request.user.is_staff
    
    return Response({
        'message': 'Agente registrado exitosamente',
        'es_sistema': es_sistema,
        'usuario': request.user.username,
        'impresoras_detectadas': len(data['impresoras']),
        'servidor_time': timezone.now().isoformat()
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def agente_trabajos_pendientes(request):
    """
    Endpoint para obtener trabajos pendientes
    
    GET /api/hardware/agente/trabajos/
    """
    # Determinar si es usuario sistema (puede ver todos los trabajos)
    es_sistema = request.user.is_superuser or request.user.is_staff
    
    # Obtener trabajos pendientes
    if es_sistema:
        # Usuario sistema: todos los trabajos pendientes
        trabajos = PrintJob.objects.filter(
            status='pending'
        ).select_related('printer').order_by('created_at')[:10]
    else:
        # Usuario normal: solo sus propios trabajos
        trabajos = PrintJob.objects.filter(
            status='pending',
            created_by=request.user.username
        ).select_related('printer').order_by('created_at')[:10]
    
    # Convertir a formato para el agente
    trabajos_data = []
    for trabajo in trabajos:
        try:
            # Validar que tenga impresora asignada
            if not trabajo.printer:
                logger.warning(f"⚠️ Trabajo {trabajo.id} sin impresora asignada, marcando como fallido")
                trabajo.mark_as_failed("Impresora no asignada")
                continue
            
            # Marcar como "printing"
            trabajo.mark_as_printing()
            
            # Generar comandos ESC/POS en hex
            comandos_hex = generar_comandos_escpos(trabajo)
            
            trabajos_data.append({
                'id': str(trabajo.id),
                'impresora': trabajo.printer.name,
                'comandos': comandos_hex,
                'tipo': trabajo.document_type,
                'copias': trabajo.copies,
                'usuario': trabajo.created_by or 'Sistema',
                'abrir_caja': trabajo.open_cash_drawer
            })
            
        except Exception as e:
            logger.error(f"❌ Error procesando trabajo {trabajo.id}: {e}")
            # Marcar trabajo como fallido
            trabajo.mark_as_failed(f"Error al preparar impresión: {str(e)}")
            continue
    
    logger.info(
        f"📥 Agente {request.user.username} consultó trabajos: "
        f"{len(trabajos_data)} pendientes [{'SISTEMA' if es_sistema else 'NORMAL'}]"
    )
    
    return Response({
        'es_sistema': es_sistema,
        'trabajos': trabajos_data
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def agente_reportar_resultado(request):
    """
    Endpoint para reportar resultado de impresión
    
    POST /api/hardware/agente/resultado/
    {
        "trabajo_id": "uuid",
        "success": true,
        "mensaje": "Impresión exitosa",
        "detalles": {}
    }
    """
    serializer = AgenteResultadoSerializer(data=request.data)
    
    if not serializer.is_valid():
        return Response(
            {'error': 'Datos inválidos', 'detalles': serializer.errors},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    data = serializer.validated_data
    
    try:
        trabajo = PrintJob.objects.get(id=data['trabajo_id'])
    except PrintJob.DoesNotExist:
        return Response(
            {'error': 'Trabajo no encontrado'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Actualizar estado del trabajo
    if data['success']:
        trabajo.mark_as_completed()
        logger.info(f"✅ Trabajo {trabajo.job_number} completado exitosamente")
    else:
        trabajo.mark_as_failed(data.get('mensaje', 'Error desconocido'))
        logger.error(f"❌ Trabajo {trabajo.job_number} falló: {data.get('mensaje')}")
    
    # Registrar evento de caja si se abrió
    if trabajo.open_cash_drawer and data['success'] and trabajo.printer:
        trabajo.cash_drawer_opened = True
        trabajo.save(update_fields=['cash_drawer_opened'])
        
        CashDrawerEvent.objects.create(
            printer=trabajo.printer,
            print_job=trabajo,
            event_type='print',
            success=True,
            triggered_by=request.user.username,
            notes=f"Apertura automática - Trabajo #{trabajo.job_number}"
        )
    
    return Response({
        'message': 'Resultado registrado exitosamente',
        'trabajo_id': str(trabajo.id),
        'job_number': trabajo.job_number,
        'status': trabajo.status
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def agente_estado(request):
    """
    Endpoint para obtener estado del sistema
    
    GET /api/hardware/agente/estado/
    """
    # Obtener info del agente desde cache
    computadora = request.query_params.get('computadora', 'unknown')
    cache_key = f"agente_{request.user.username}_{computadora}"
    agente_data = cache.get(cache_key, {})
    
    # Estadísticas
    trabajos_pendientes = PrintJob.objects.filter(status='pending').count()
    trabajos_completados_hoy = PrintJob.objects.filter(
        status='completed',
        completed_at__date=timezone.now().date()
    ).count()
    
    impresoras_activas = Printer.objects.filter(is_active=True).count()
    
    return Response({
        'agente_conectado': bool(agente_data),
        'ultima_conexion': agente_data.get('ultima_conexion'),
        'version_agente': agente_data.get('version_agente', 'N/A'),
        'computadora': agente_data.get('computadora', 'N/A'),
        'usuario': agente_data.get('usuario', 'N/A'),
        'trabajos_pendientes': trabajos_pendientes,
        'trabajos_completados_hoy': trabajos_completados_hoy,
        'impresoras_activas': impresoras_activas,
        'servidor_time': timezone.now().isoformat()
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def agente_abrir_caja(request):
    """
    Endpoint para abrir caja registradora manualmente
    
    POST /api/hardware/agente/abrir-caja/
    {
        "printer_id": "uuid",
        "notas": "Apertura manual"
    }
    """
    printer_id = request.data.get('printer_id')
    notas = request.data.get('notas', '')
    
    if not printer_id:
        return Response(
            {'error': 'printer_id es requerido'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        printer = Printer.objects.get(id=printer_id, is_active=True)
    except Printer.DoesNotExist:
        return Response(
            {'error': 'Impresora no encontrada o inactiva'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    if not printer.has_cash_drawer:
        return Response(
            {'error': 'Esta impresora no tiene caja registradora'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Crear trabajo de impresión para abrir caja
    comandos_hex = generar_comando_abrir_caja(printer)
    
    job = PrintJob.objects.create(
        printer=printer,
        document_type='other',
        content='Apertura manual de caja',
        data={'accion': 'abrir_caja', 'notas': notas},
        open_cash_drawer=True,
        status='pending',
        created_by=request.user.username
    )
    
    # Registrar evento
    CashDrawerEvent.objects.create(
        printer=printer,
        print_job=job,
        event_type='manual',
        success=True,
        notes=notas,
        triggered_by=request.user.username
    )
    
    logger.info(f"🔓 Caja abierta manualmente por {request.user.username} - Impresora: {printer.name}")
    
    return Response({
        'message': 'Solicitud de apertura de caja enviada',
        'job_id': str(job.id),
        'job_number': job.job_number
    })


# ============================================================================
# FUNCIONES AUXILIARES PARA COMANDOS ESC/POS - CORREGIDAS ✅
# ============================================================================

def generar_comandos_escpos(trabajo):
    """
    Genera comandos ESC/POS en hexadecimal para el trabajo de impresión
    
    Esta es una función básica - expándela según tus necesidades
    """
    try:
        # Comandos ESC/POS básicos
        ESC = b'\x1b'
        GS = b'\x1d'
        
        comandos = bytearray()
        
        # Inicializar impresora
        comandos.extend(ESC + b'@')
        
        # Configurar alineación al centro
        comandos.extend(ESC + b'a' + b'\x01')
        
        # Texto en negrita
        comandos.extend(ESC + b'E' + b'\x01')
        
        # Contenido del trabajo (manejo seguro de encoding)
        try:
            contenido = trabajo.content.encode('utf-8', errors='ignore')
        except Exception as e:
            logger.warning(f"Error en encoding de contenido: {e}")
            contenido = b'Error en contenido\n'
        
        comandos.extend(contenido)
        
        # Desactivar negrita
        comandos.extend(ESC + b'E' + b'\x00')
        
        # Saltos de línea
        comandos.extend(b'\n\n\n')
        
        # Cortar papel (si la impresora lo soporta)
        comandos.extend(GS + b'V' + b'\x41' + b'\x00')
        
        # Abrir caja si está configurado
        if trabajo.open_cash_drawer and trabajo.printer and trabajo.printer.has_cash_drawer:
            try:
                pin = trabajo.printer.cash_drawer_pin if trabajo.printer.cash_drawer_pin is not None else 0
                on_time = trabajo.printer.cash_drawer_on_time if trabajo.printer.cash_drawer_on_time is not None else 50
                off_time = trabajo.printer.cash_drawer_off_time if trabajo.printer.cash_drawer_off_time is not None else 50
                
                # Validar rangos (0-255)
                pin = max(0, min(255, pin))
                on_time = max(0, min(255, on_time))
                off_time = max(0, min(255, off_time))
                
                comandos.extend(ESC + b'p' + bytes([pin, on_time, off_time]))
                logger.debug(f"Comando abrir caja agregado: pin={pin}, on={on_time}, off={off_time}")
                
            except Exception as e:
                logger.warning(f"⚠️ No se pudo agregar comando de caja: {e}")
        
        # Convertir a hexadecimal
        return comandos.hex()
        
    except Exception as e:
        logger.error(f"❌ Error generando comandos ESC/POS: {e}")
        # Retornar comando básico de emergencia
        ESC = b'\x1b'
        comando_emergencia = ESC + b'@' + b'Error generando ticket\n\n\n'
        return comando_emergencia.hex()


def generar_comando_abrir_caja(printer):
    """Genera comando ESC/POS para abrir caja registradora"""
    try:
        ESC = b'\x1b'
        
        # Obtener parámetros con valores por defecto seguros
        pin = printer.cash_drawer_pin if hasattr(printer, 'cash_drawer_pin') and printer.cash_drawer_pin is not None else 0
        on_time = printer.cash_drawer_on_time if hasattr(printer, 'cash_drawer_on_time') and printer.cash_drawer_on_time is not None else 50
        off_time = printer.cash_drawer_off_time if hasattr(printer, 'cash_drawer_off_time') and printer.cash_drawer_off_time is not None else 50
        
        # Validar rangos (0-255)
        pin = max(0, min(255, pin))
        on_time = max(0, min(255, on_time))
        off_time = max(0, min(255, off_time))
        
        comando = ESC + b'p' + bytes([pin, on_time, off_time])
        
        logger.debug(f"Comando caja generado: pin={pin}, on={on_time}, off={off_time}")
        
        return comando.hex()
        
    except Exception as e:
        logger.error(f"❌ Error generando comando de caja: {e}")
        # Retornar comando por defecto seguro (pin 0, 50ms, 50ms)
        return b'\x1bp\x00\x32\x32'.hex()


# ============================================================================
# OTRAS APIs DE IMPRESIÓN
# ============================================================================

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
            
            # El agente lo detectará y procesará automáticamente
            return Response({
                'status': 'success',
                'message': 'Trabajo de impresión creado',
                'job_id': str(print_job.id),
                'job_number': print_job.job_number
            })
                
        except Exception as e:
            logger.error(f"Error en impresión: {str(e)}")
            return Response({
                'status': 'error',
                'message': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class PrintReceiptView(APIView):
    """API para imprimir tickets de venta preformateados"""
    permission_classes = [AllowAny]
    
    def post(self, request):
        # Validar datos
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
            
            return Response({
                'status': 'success',
                'message': 'Ticket creado, el agente lo imprimirá',
                'job_id': str(print_job.id),
                'job_number': print_job.job_number
            })
                
        except Exception as e:
            logger.error(f"Error al crear ticket: {str(e)}")
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
        lines.append(settings.get_company_name().center(chars_per_line))
        lines.append(settings.get_company_address().center(chars_per_line))
        lines.append(f"RUC: {settings.get_tax_id()}".center(chars_per_line))
        lines.append("=" * chars_per_line)
        
        # Info del ticket
        lines.append("TICKET DE VENTA".center(chars_per_line))
        lines.append(f"Fecha: {timezone.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"Ticket #: {order_data.get('order_number', 'N/A')}")
        lines.append(f"Cliente: {order_data.get('customer_name', 'CONTADO')}")
        lines.append("-" * chars_per_line)
        
        # Productos
        lines.append("PRODUCTO       CANT  PRECIO  TOTAL")
        lines.append("-" * chars_per_line)
        
        items = order_data.get('items', [])
        for item in items:
            name = str(item.get('name', 'Sin nombre'))[:14]
            qty = str(item.get('quantity', 0))
            price = float(item.get('price', 0))
            total = float(item.get('total', 0))
            
            lines.append(f"{name:14} {qty:>4} {price:>7.2f} {total:>8.2f}")
        
        lines.append("-" * chars_per_line)
        
        # Totales
        subtotal = float(order_data.get('subtotal', 0))
        tax = float(order_data.get('tax', 0))
        total = float(order_data.get('total', 0))
        
        lines.append(f"{'Subtotal:':30} ${subtotal:>10.2f}")
        lines.append(f"{'IVA (12%):':30} ${tax:>10.2f}")
        lines.append("=" * chars_per_line)
        lines.append(f"{'TOTAL:':30} ${total:>10.2f}")
        lines.append("=" * chars_per_line)
        
        # Pie de página
        footer = settings.get_receipt_footer()
        if footer:
            lines.append("")
            lines.append(footer.center(chars_per_line))
        
        lines.append("\n" * 3)  # Espacio para cortar
        
        return "\n".join(lines)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def print_status(request):
    """Estado del sistema de impresión"""
    try:
        from django.db.models import Count
        
        # Estadísticas básicas
        total_jobs = PrintJob.objects.count()
        pending_jobs = PrintJob.objects.filter(status='pending').count()
        today_jobs = PrintJob.objects.filter(
            created_at__date=timezone.now().date()
        ).count()
        
        # Impresoras activas
        active_printers = Printer.objects.filter(is_active=True)
        
        return Response({
            'system': 'online',
            'printers_active': active_printers.count(),
            'jobs_total': total_jobs,
            'jobs_pending': pending_jobs,
            'jobs_today': today_jobs,
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
        # Crear trabajo para abrir caja
        job = PrintJob.objects.create(
            printer=printer,
            document_type='other',
            content='Apertura manual de caja',
            open_cash_drawer=True,
            status='pending',
            created_by=request.user.username
        )
        
        return Response({
            'status': 'success',
            'message': 'Solicitud de apertura enviada',
            'job_id': str(job.id)
        })
            
    except Exception as e:
        logger.error(f"Error al abrir caja: {str(e)}")
        return Response({
            'status': 'error',
            'message': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)