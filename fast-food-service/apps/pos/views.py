"""
apps/pos/views.py

ViewSets para el módulo POS (Punto de Venta)
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.utils import timezone
from django.db.models import Sum, Count, Q
from datetime import datetime, timedelta
import requests

from .models import Shift, Discount, DiscountUsage, Table, DailySummary
from .serializers import (
    ShiftSerializer,
    ShiftCreateSerializer,
    ShiftCloseSerializer,
    DiscountSerializer,
    DiscountCreateUpdateSerializer,
    DiscountValidateSerializer,
    DiscountUsageSerializer,
    TableSerializer,
    TableCreateUpdateSerializer,
    TableOccupySerializer,
    DailySummarySerializer,
    DailySummaryGenerateSerializer,
)


# ============================================================================
# SHIFT VIEWSET
# ============================================================================

class ShiftViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestionar turnos de caja.
    
    Endpoints:
    - GET /api/pos/shifts/ - Listar turnos
    - POST /api/pos/shifts/ - Abrir turno
    - GET /api/pos/shifts/{id}/ - Detalle de turno
    - POST /api/pos/shifts/{id}/close/ - Cerrar turno
    - GET /api/pos/shifts/current/ - Turno actual del usuario
    - GET /api/pos/shifts/by_date/ - Turnos por fecha
    """
    queryset = Shift.objects.all().select_related('cash_register')
    permission_classes = [IsAuthenticated]
    
    def get_serializer_class(self):
        if self.action == 'create':
            return ShiftCreateSerializer
        elif self.action == 'close':
            return ShiftCloseSerializer
        return ShiftSerializer
    
    def get_queryset(self):
        """
        Filtrar turnos según permisos del usuario.
        Admin ve todos, usuario normal solo los suyos.
        """
        queryset = super().get_queryset()
        
        # Si es admin/staff, ve todos
        if self.request.user.is_staff or self.request.user.is_superuser:
            return queryset
        
        # Usuario normal solo ve sus propios turnos
        return queryset.filter(user_id=str(self.request.user.id))
    
    def create(self, request, *args, **kwargs):
        """Abrir un nuevo turno"""
        # Verificar que el usuario no tenga un turno abierto
        open_shift = Shift.objects.filter(
            user_id=str(request.user.id),
            status='open'
        ).first()
        
        if open_shift:
            return Response({
                'error': 'Ya tienes un turno abierto',
                'shift': ShiftSerializer(open_shift).data
            }, status=status.HTTP_400_BAD_REQUEST)
        
        return super().create(request, *args, **kwargs)
    
    @action(detail=True, methods=['post'])
    def close(self, request, pk=None):
        """
        Cerrar un turno.
        POST /api/pos/shifts/{id}/close/
        Body: {
            "closing_cash": 850.00,
            "closing_notes": "Todo correcto"
        }
        """
        shift = self.get_object()
        
        # Verificar que sea el mismo usuario o admin
        if str(shift.user_id) != str(request.user.id) and not request.user.is_staff:
            return Response({
                'error': 'No tienes permiso para cerrar este turno'
            }, status=status.HTTP_403_FORBIDDEN)
        
        # Verificar que el turno esté abierto
        if shift.status != 'open':
            return Response({
                'error': f'El turno ya está {shift.get_status_display()}'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Validar datos
        serializer = ShiftCloseSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        # Cerrar turno
        success, message = shift.close_shift(
            closing_cash=serializer.validated_data['closing_cash'],
            closing_notes=serializer.validated_data.get('closing_notes', '')
        )
        
        if not success:
            return Response({
                'error': message
            }, status=status.HTTP_400_BAD_REQUEST)
        
        return Response({
            'message': message,
            'shift': ShiftSerializer(shift).data
        })
    
    @action(detail=False, methods=['get'])
    def current(self, request):
        """
        Obtener el turno actual (abierto) del usuario.
        GET /api/pos/shifts/current/
        """
        shift = Shift.objects.filter(
            user_id=str(request.user.id),
            status='open'
        ).select_related('cash_register').first()
        
        if not shift:
            return Response({
                'message': 'No tienes un turno abierto',
                'shift': None
            })
        
        return Response({
            'shift': ShiftSerializer(shift).data
        })
    
    @action(detail=False, methods=['get'])
    def by_date(self, request):
        """
        Listar turnos por fecha.
        GET /api/pos/shifts/by_date/?date=2025-01-15
        """
        date_str = request.query_params.get('date')
        if not date_str:
            return Response({
                'error': 'Debes proporcionar el parámetro date (YYYY-MM-DD)'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            date = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response({
                'error': 'Formato de fecha inválido. Usa YYYY-MM-DD'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        shifts = self.get_queryset().filter(opened_at__date=date)
        serializer = ShiftSerializer(shifts, many=True)
        
        return Response({
            'date': date_str,
            'count': shifts.count(),
            'shifts': serializer.data
        })
    
    @action(detail=False, methods=['get'])
    def stats(self, request):
        """
        Estadísticas de turnos del usuario.
        GET /api/pos/shifts/stats/
        """
        user_id = str(request.user.id)
        
        # Total de turnos
        total_shifts = Shift.objects.filter(user_id=user_id).count()
        
        # Turnos cerrados
        closed_shifts = Shift.objects.filter(user_id=user_id, status='closed')
        
        # Totales
        stats = closed_shifts.aggregate(
            total_sales=Sum('total_sales'),
            total_transactions=Sum('total_transactions'),
            avg_sales_per_shift=Sum('total_sales') / Count('id') if closed_shifts.count() > 0 else 0
        )
        
        # Turno actual
        current_shift = Shift.objects.filter(user_id=user_id, status='open').first()
        
        return Response({
            'total_shifts': total_shifts,
            'total_sales': stats['total_sales'] or 0,
            'total_transactions': stats['total_transactions'] or 0,
            'average_sales_per_shift': stats['avg_sales_per_shift'] or 0,
            'has_open_shift': current_shift is not None,
            'current_shift': ShiftSerializer(current_shift).data if current_shift else None
        })


# ============================================================================
# DISCOUNT VIEWSET
# ============================================================================

class DiscountViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestionar descuentos y promociones.
    
    Endpoints:
    - GET /api/pos/discounts/ - Listar descuentos
    - POST /api/pos/discounts/ - Crear descuento
    - GET /api/pos/discounts/{id}/ - Detalle de descuento
    - PUT /api/pos/discounts/{id}/ - Actualizar descuento
    - DELETE /api/pos/discounts/{id}/ - Eliminar descuento
    - POST /api/pos/discounts/validate/ - Validar descuento
    - GET /api/pos/discounts/active/ - Descuentos activos
    - GET /api/pos/discounts/by_code/ - Buscar por código
    """
    queryset = Discount.objects.all()
    permission_classes = [IsAuthenticated]
    
    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return DiscountCreateUpdateSerializer
        elif self.action == 'validate':
            return DiscountValidateSerializer
        return DiscountSerializer
    
    def get_queryset(self):
        """Filtrar descuentos según query params"""
        queryset = super().get_queryset()
        
        # Filtrar por activo
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')
        
        # Filtrar por tipo
        discount_type = self.request.query_params.get('discount_type')
        if discount_type:
            queryset = queryset.filter(discount_type=discount_type)
        
        # Filtrar por público
        is_public = self.request.query_params.get('is_public')
        if is_public is not None:
            queryset = queryset.filter(is_public=is_public.lower() == 'true')
        
        return queryset
    
    @action(detail=False, methods=['post'])
    def validate(self, request):
        """
        Validar un descuento antes de aplicarlo.
        POST /api/pos/discounts/validate/
        Body: {
            "discount_code": "HAPPY_HOUR",
            "customer_id": "uuid-customer",
            "order_amount": 50.00
        }
        """
        serializer = DiscountValidateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        code = serializer.validated_data['discount_code']
        customer_id = serializer.validated_data.get('customer_id')
        order_amount = serializer.validated_data['order_amount']
        
        # Buscar descuento
        try:
            discount = Discount.objects.get(code__iexact=code)
        except Discount.DoesNotExist:
            return Response({
                'valid': False,
                'error': 'Descuento no encontrado'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Validar descuento
        customer = None
        if customer_id:
            from apps.customers.models import Customer
            try:
                customer = Customer.objects.get(id=customer_id)
            except Customer.DoesNotExist:
                pass
        
        is_valid, message = discount.is_valid(for_customer=customer)
        
        if not is_valid:
            return Response({
                'valid': False,
                'error': message,
                'discount': None
            })
        
        # Verificar compra mínima
        if discount.minimum_purchase and order_amount < discount.minimum_purchase:
            return Response({
                'valid': False,
                'error': f'Compra mínima requerida: ${discount.minimum_purchase}',
                'discount': None
            })
        
        # Calcular descuento
        discount_amount = discount.calculate_discount(order_amount)
        
        return Response({
            'valid': True,
            'message': message,
            'discount': DiscountSerializer(discount).data,
            'discount_amount': float(discount_amount),
            'final_amount': float(order_amount - discount_amount)
        })
    
    @action(detail=False, methods=['get'])
    def active(self, request):
        """
        Listar solo descuentos activos y válidos.
        GET /api/pos/discounts/active/
        """
        now = timezone.now()
        
        discounts = Discount.objects.filter(
            is_active=True,
            valid_from__lte=now,
            valid_until__gte=now
        )
        
        # Filtrar por públicos si no es admin
        if not request.user.is_staff:
            discounts = discounts.filter(is_public=True)
        
        serializer = DiscountSerializer(discounts, many=True)
        return Response({
            'count': discounts.count(),
            'discounts': serializer.data
        })
    
    @action(detail=False, methods=['get'])
    def by_code(self, request):
        """
        Buscar descuento por código.
        GET /api/pos/discounts/by_code/?code=HAPPY_HOUR
        """
        code = request.query_params.get('code')
        if not code:
            return Response({
                'error': 'Debes proporcionar el parámetro code'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            discount = Discount.objects.get(code__iexact=code)
            return Response(DiscountSerializer(discount).data)
        except Discount.DoesNotExist:
            return Response({
                'error': 'Descuento no encontrado'
            }, status=status.HTTP_404_NOT_FOUND)
    
    @action(detail=True, methods=['get'])
    def usages(self, request, pk=None):
        """
        Historial de usos de un descuento.
        GET /api/pos/discounts/{id}/usages/
        """
        discount = self.get_object()
        usages = DiscountUsage.objects.filter(discount=discount).order_by('-created_at')
        
        # Paginación
        page = self.paginate_queryset(usages)
        if page is not None:
            serializer = DiscountUsageSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = DiscountUsageSerializer(usages, many=True)
        return Response(serializer.data)


# ============================================================================
# TABLE VIEWSET
# ============================================================================

class TableViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestionar mesas del restaurante.
    
    Endpoints:
    - GET /api/pos/tables/ - Listar mesas
    - POST /api/pos/tables/ - Crear mesa
    - GET /api/pos/tables/{id}/ - Detalle de mesa
    - PUT /api/pos/tables/{id}/ - Actualizar mesa
    - DELETE /api/pos/tables/{id}/ - Eliminar mesa
    - POST /api/pos/tables/{id}/occupy/ - Ocupar mesa
    - POST /api/pos/tables/{id}/free/ - Liberar mesa
    - GET /api/pos/tables/available/ - Mesas disponibles
    - GET /api/pos/tables/by_status/ - Filtrar por estado
    """
    queryset = Table.objects.all()
    permission_classes = [IsAuthenticated]
    
    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return TableCreateUpdateSerializer
        elif self.action == 'occupy':
            return TableOccupySerializer
        return TableSerializer
    
    def get_queryset(self):
        """Filtrar mesas según query params"""
        queryset = super().get_queryset()
        
        # Filtrar por estado
        table_status = self.request.query_params.get('status')
        if table_status:
            queryset = queryset.filter(status=table_status)
        
        # Filtrar por sección
        section = self.request.query_params.get('section')
        if section:
            queryset = queryset.filter(section=section)
        
        # Filtrar por activas
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')
        
        return queryset.select_related('current_order')
    
    @action(detail=True, methods=['post'])
    def occupy(self, request, pk=None):
        """
        Ocupar una mesa con una orden.
        POST /api/pos/tables/{id}/occupy/
        Body: {
            "order_id": "uuid-orden",
            "waiter_id": "uuid-mesero",  // Opcional, se toma del JWT si no se envía
            "waiter_name": "Juan Pérez"   // Opcional
        }
        """
        table = self.get_object()
        
        serializer = TableOccupySerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        # Obtener orden
        from apps.orders.models import Order
        try:
            order = Order.objects.get(id=serializer.validated_data['order_id'])
        except Order.DoesNotExist:
            return Response({
                'error': 'Orden no encontrada'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Waiter info (del JWT si no se proporciona)
        waiter_id = serializer.validated_data.get('waiter_id') or str(request.user.id)
        waiter_name = serializer.validated_data.get('waiter_name') or request.user.get_full_name()
        
        # Ocupar mesa
        success, message = table.occupy(order, waiter_id, waiter_name)
        
        if not success:
            return Response({
                'error': message
            }, status=status.HTTP_400_BAD_REQUEST)
        
        return Response({
            'message': message,
            'table': TableSerializer(table).data
        })
    
    @action(detail=True, methods=['post'])
    def free(self, request, pk=None):
        """
        Liberar una mesa.
        POST /api/pos/tables/{id}/free/
        """
        table = self.get_object()
        
        success, message = table.free()
        
        if not success:
            return Response({
                'error': message
            }, status=status.HTTP_400_BAD_REQUEST)
        
        return Response({
            'message': message,
            'table': TableSerializer(table).data
        })
    
    @action(detail=True, methods=['post'])
    def set_cleaning(self, request, pk=None):
        """Marcar mesa en limpieza"""
        table = self.get_object()
        table.set_cleaning()
        
        return Response({
            'message': 'Mesa marcada para limpieza',
            'table': TableSerializer(table).data
        })
    
    @action(detail=False, methods=['get'])
    def available(self, request):
        """
        Listar mesas disponibles.
        GET /api/pos/tables/available/
        """
        tables = Table.objects.filter(status='available', is_active=True)
        
        # Filtrar por sección si se proporciona
        section = request.query_params.get('section')
        if section:
            tables = tables.filter(section=section)
        
        serializer = TableSerializer(tables, many=True)
        return Response({
            'count': tables.count(),
            'tables': serializer.data
        })
    
    @action(detail=False, methods=['get'])
    def by_section(self, request):
        """
        Agrupar mesas por sección.
        GET /api/pos/tables/by_section/
        """
        tables = self.get_queryset()
        
        # Agrupar por sección
        sections = {}
        for table in tables:
            section = table.section or 'Sin sección'
            if section not in sections:
                sections[section] = []
            sections[section].append(TableSerializer(table).data)
        
        return Response(sections)
    
    @action(detail=False, methods=['get'])
    def stats(self, request):
        """
        Estadísticas de mesas.
        GET /api/pos/tables/stats/
        """
        tables = Table.objects.filter(is_active=True)
        
        stats = {
            'total': tables.count(),
            'available': tables.filter(status='available').count(),
            'occupied': tables.filter(status='occupied').count(),
            'reserved': tables.filter(status='reserved').count(),
            'cleaning': tables.filter(status='cleaning').count(),
            'maintenance': tables.filter(status='maintenance').count(),
        }
        
        stats['occupancy_rate'] = round(
            (stats['occupied'] / stats['total'] * 100) if stats['total'] > 0 else 0,
            2
        )
        
        return Response(stats)


# ============================================================================
# DAILY SUMMARY VIEWSET
# ============================================================================

class DailySummaryViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet para reportes diarios (solo lectura).
    
    Endpoints:
    - GET /api/pos/daily-summaries/ - Listar reportes
    - GET /api/pos/daily-summaries/{id}/ - Detalle de reporte
    - POST /api/pos/daily-summaries/generate/ - Generar reporte
    - GET /api/pos/daily-summaries/by_date/ - Reporte por fecha
    - GET /api/pos/daily-summaries/range/ - Reportes por rango
    """
    queryset = DailySummary.objects.all()
    serializer_class = DailySummarySerializer
    permission_classes = [IsAuthenticated]
    
    @action(detail=False, methods=['post'])
    def generate(self, request):
        """
        Generar o actualizar reporte diario.
        POST /api/pos/daily-summaries/generate/
        Body: {
            "date": "2025-01-15"
        }
        """
        serializer = DailySummaryGenerateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        date = serializer.validated_data['date']
        
        # Generar reporte
        summary = DailySummary.generate_for_date(
            date=date,
            generated_by=str(request.user.id)
        )
        
        return Response({
            'message': 'Reporte generado exitosamente',
            'summary': DailySummarySerializer(summary).data
        })
    
    @action(detail=False, methods=['get'])
    def by_date(self, request):
        """
        Obtener reporte de una fecha específica.
        GET /api/pos/daily-summaries/by_date/?date=2025-01-15
        """
        date_str = request.query_params.get('date')
        if not date_str:
            return Response({
                'error': 'Debes proporcionar el parámetro date (YYYY-MM-DD)'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            date = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response({
                'error': 'Formato de fecha inválido. Usa YYYY-MM-DD'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            summary = DailySummary.objects.get(date=date)
            return Response(DailySummarySerializer(summary).data)
        except DailySummary.DoesNotExist:
            return Response({
                'error': 'No existe reporte para esta fecha',
                'date': date_str
            }, status=status.HTTP_404_NOT_FOUND)
    
    @action(detail=False, methods=['get'])
    def range(self, request):
        """
        Obtener reportes en un rango de fechas.
        GET /api/pos/daily-summaries/range/?start_date=2025-01-01&end_date=2025-01-31
        """
        start_date_str = request.query_params.get('start_date')
        end_date_str = request.query_params.get('end_date')
        
        if not start_date_str or not end_date_str:
            return Response({
                'error': 'Debes proporcionar start_date y end_date (YYYY-MM-DD)'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
            end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response({
                'error': 'Formato de fecha inválido. Usa YYYY-MM-DD'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        summaries = DailySummary.objects.filter(
            date__gte=start_date,
            date__lte=end_date
        ).order_by('date')
        
        serializer = DailySummarySerializer(summaries, many=True)
        
        # Calcular totales del período
        totals = summaries.aggregate(
            total_sales=Sum('total_sales'),
            total_orders=Sum('total_orders'),
            total_customers=Sum('total_customers'),
            total_discounts=Sum('total_discounts'),
            total_tips=Sum('total_tips'),
        )
        
        return Response({
            'start_date': start_date_str,
            'end_date': end_date_str,
            'count': summaries.count(),
            'totals': totals,
            'summaries': serializer.data
        })
    
    @action(detail=False, methods=['get'])
    def today(self, request):
        """
        Reporte del día actual.
        GET /api/pos/daily-summaries/today/
        """
        today = timezone.now().date()
        
        try:
            summary = DailySummary.objects.get(date=today)
        except DailySummary.DoesNotExist:
            # Generar si no existe
            summary = DailySummary.generate_for_date(
                date=today,
                generated_by=str(request.user.id)
            )
        
        return Response(DailySummarySerializer(summary).data)