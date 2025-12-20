"""
apps/pos/views.py

ViewSets para el módulo POS (Punto de Venta) - Versión simplificada
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.utils import timezone
from django.db.models import Sum, Count, Prefetch 
from datetime import datetime, timedelta, date
from decimal import Decimal
import calendar

# <<<< IMPORTACIONES CRÍTICAS DE ÓRDENES Y SERIALIZER >>>>
from apps.orders.models import Order, OrderItem 
from apps.orders.serializers import OrderReportDetailSerializer

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
    ReportRequestSerializer,
    CloseDaySerializer,
    DateRangeSerializer,
)


# ============================================================================
# VIEWSETS EXISTENTES
# ============================================================================

class ShiftViewSet(viewsets.ModelViewSet):
    """
    Viewset para gestionar turnos de caja.
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
        queryset = super().get_queryset()
        
        if not (self.request.user.is_staff or self.request.user.is_superuser):
            return queryset.filter(user_id=str(self.request.user.id))
        
        return queryset
    
    def create(self, request, *args, **kwargs):
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
        shift = self.get_object()
        
        if str(shift.user_id) != str(request.user.id) and not request.user.is_staff:
            return Response({
                'error': 'No tienes permiso para cerrar este turno'
            }, status=status.HTTP_403_FORBIDDEN)
        
        if shift.status != 'open':
            return Response({
                'error': f'El turno ya está {shift.get_status_display()}'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        serializer = ShiftCloseSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
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
        date_str = request.query_params.get('date')
        if not date_str:
            return Response({
                'error': 'Debes proporcionar el parámetro date (YYYY-MM-DD)'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response({
                'error': 'Formato de fecha inválido. Usa YYYY-MM-DD'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        shifts = self.get_queryset().filter(opened_at__date=target_date)
        serializer = ShiftSerializer(shifts, many=True)
        
        return Response({
            'date': date_str,
            'count': shifts.count(),
            'shifts': serializer.data
        })


class DiscountViewSet(viewsets.ModelViewSet):
    # ... (código DiscountViewSet existente) ...
    queryset = Discount.objects.all()
    permission_classes = [IsAuthenticated]
    
    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return DiscountCreateUpdateSerializer
        elif self.action == 'validate':
            return DiscountValidateSerializer
        return DiscountSerializer
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')
        
        discount_type = self.request.query_params.get('discount_type')
        if discount_type:
            queryset = queryset.filter(discount_type=discount_type)
        
        is_public = self.request.query_params.get('is_public')
        if is_public is not None:
            queryset = queryset.filter(is_public=is_public.lower() == 'true')
        
        return queryset
    
    @action(detail=False, methods=['post'])
    def validate(self, request):
        serializer = DiscountValidateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        code = serializer.validated_data['discount_code']
        customer_id = serializer.validated_data.get('customer_id')
        order_amount = serializer.validated_data['order_amount']
        
        try:
            discount = Discount.objects.get(code__iexact=code)
        except Discount.DoesNotExist:
            return Response({
                'valid': False,
                'error': 'Descuento no encontrado'
            }, status=status.HTTP_404_NOT_FOUND)
        
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
        
        if discount.minimum_purchase and order_amount < discount.minimum_purchase:
            return Response({
                'valid': False,
                'error': f'Compra mínima requerida: ${discount.minimum_purchase}',
                'discount': None
            })
        
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
        now = timezone.now()
        
        discounts = Discount.objects.filter(
            is_active=True,
            valid_from__lte=now,
            valid_until__gte=now
        )
        
        if not request.user.is_staff:
            discounts = discounts.filter(is_public=True)
        
        serializer = DiscountSerializer(discounts, many=True)
        return Response({
            'count': discounts.count(),
            'discounts': serializer.data
        })


class TableViewSet(viewsets.ModelViewSet):
    # ... (código TableViewSet existente) ...
    queryset = Table.objects.all()
    permission_classes = [IsAuthenticated]
    
    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return TableCreateUpdateSerializer
        elif self.action == 'occupy':
            return TableOccupySerializer
        return TableSerializer
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        table_status = self.request.query_params.get('status')
        if table_status:
            queryset = queryset.filter(status=table_status)
        
        section = self.request.query_params.get('section')
        if section:
            queryset = queryset.filter(section=section)
        
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')
        
        return queryset.select_related('current_order')
    
    @action(detail=True, methods=['post'])
    def occupy(self, request, pk=None):
        table = self.get_object()
        
        serializer = TableOccupySerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        from apps.orders.models import Order
        try:
            order = Order.objects.get(id=serializer.validated_data['order_id'])
        except Order.DoesNotExist:
            return Response({
                'error': 'Orden no encontrada'
            }, status=status.HTTP_404_NOT_FOUND)
        
        waiter_id = serializer.validated_data.get('waiter_id') or str(request.user.id)
        waiter_name = serializer.validated_data.get('waiter_name') or request.user.get_full_name()
        
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
    
    @action(detail=False, methods=['get'])
    def available(self, request):
        tables = Table.objects.filter(status='available', is_active=True)
        
        section = request.query_params.get('section')
        if section:
            tables = tables.filter(section=section)
        
        serializer = TableSerializer(tables, many=True)
        return Response({
            'count': tables.count(),
            'tables': serializer.data
        })


class DailySummaryViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet para reportes diarios (solo lectura).
    """
    queryset = DailySummary.objects.all()
    serializer_class = DailySummarySerializer
    permission_classes = [IsAuthenticated]
    
    # FUNCIÓN PARA OBTENER EL DETALLE DE ÓRDENES
    def _get_orders_detail(self, start_date, end_date):
    
    # Convierte las fechas a objetos datetime con zona horaria
        start_dt = datetime.combine(start_date, datetime.min.time(), tzinfo=timezone.get_current_timezone())
        end_dt = datetime.combine(end_date, datetime.max.time(), tzinfo=timezone.get_current_timezone())

        orders = Order.objects.filter(
            created_at__gte=start_dt,  # <-- Usamos GTE y LTE con el objeto datetime completo
            created_at__lte=end_dt,
        ).select_related(
            'customer'
        ).prefetch_related(
            Prefetch('items', 
                    queryset=OrderItem.objects.select_related('product', 'size')
                                            .prefetch_related('extras', 'extras__extra')), 
        ).order_by('created_at')
            # Usar el Serializer de Órdenes para formatear el detalle
        serializer = OrderReportDetailSerializer(orders, many=True)
        
        return serializer.data

    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        is_closed = self.request.query_params.get('is_closed')
        if is_closed is not None:
            queryset = queryset.filter(is_closed=is_closed.lower() == 'true')
        
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        
        if start_date:
            try:
                start = datetime.strptime(start_date, '%Y-%m-%d').date()
                queryset = queryset.filter(date__gte=start)
            except ValueError:
                pass
        
        if end_date:
            try:
                end = datetime.strptime(end_date, '%Y-%m-%d').date()
                queryset = queryset.filter(date__lte=end)
            except ValueError:
                pass
        
        return queryset
    
    @action(detail=False, methods=['post'])
    def generate(self, request):
        """
        Generar o actualizar reporte diario, con opción a incluir detalle de órdenes.
        """
        serializer = DailySummaryGenerateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        date_obj = serializer.validated_data['date']
        detailed = serializer.validated_data.get('detailed', True)
        include_orders_detail = request.data.get('include_orders_detail', False) # <-- Capturar la bandera
        
        summary = DailySummary.generate_for_date(
            date=date_obj,
            generated_by=str(request.user.id),
            detailed=detailed
        )
        
        summary_data = DailySummarySerializer(summary).data
        
        # 1. Si se pide detalle, adjuntarlo
        if include_orders_detail:
            # Obtener el detalle de órdenes para el día
            summary_data['orders_detail'] = self._get_orders_detail(date_obj, date_obj) 
        
        return Response({
            'message': 'Reporte generado exitosamente',
            'summary': summary_data # Devolvemos el dict con orders_detail si existe
        })
    
    @action(detail=False, methods=['post'])
    def get_report(self, request):
        """
        Obtener reporte por tipo (diario, semanal, mensual), con opción a detalle.
        """
        serializer = ReportRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        data = serializer.validated_data
        report_type = data['report_type']
        
        include_orders_detail = request.data.get('include_orders_detail', False) # <-- Capturar la bandera
        start_date = None
        end_date = None
        
        try:
            if report_type == 'daily':
                start_date = data['date']
                end_date = data['date']
                
                # ... [Lógica de get_or_create y generate_for_date para el daily summary] ...
                summary, created = DailySummary.objects.get_or_create(
                    date=data['date'],
                    defaults={'generated_by': str(request.user.id)}
                )
                
                if not summary.top_products or not summary.sales_by_hour:
                    summary = DailySummary.generate_for_date(
                        date=data['date'],
                        generated_by=str(request.user.id),
                        detailed=True
                    )
                
                summary_data = DailySummarySerializer(summary).data
                
                if include_orders_detail:
                    summary_data['orders_detail'] = self._get_orders_detail(start_date, end_date)

                return Response({
                    'report_type': 'daily',
                    'period_name': data['date'].strftime('%d/%m/%Y'),
                    'data': summary_data
                })
            
            elif report_type == 'weekly' or report_type == 'monthly' or report_type == 'range': 
                
                if report_type == 'weekly':
                    start_date = data['start_date']
                    end_date = data['end_date']
                    period_name = f'Semana {start_date.strftime("%d/%m")} - {end_date.strftime("%d/%m/%Y")}'
                
                elif report_type == 'monthly':
                    year = data['year']
                    month = data['month']
                    _, last_day = calendar.monthrange(year, month)
                    start_date = date(year, month, 1)
                    end_date = date(year, month, last_day)
                    period_name = f'{calendar.month_name[month]} {year}'
                
                # Generación rápida para días faltantes
                current_date = start_date
                while current_date <= end_date:
                    DailySummary.generate_for_date(
                        date=current_date,
                        generated_by=str(request.user.id),
                        detailed=False
                    )
                    current_date += timedelta(days=1)
                
                # Reconsultar
                summaries = DailySummary.objects.filter(
                    date__gte=start_date,
                    date__lte=end_date
                ).order_by('date')
                
                # Consolidar
                consolidated = {
                    'total_sales': sum(float(s.total_sales) for s in summaries),
                    'total_orders': sum(s.total_orders for s in summaries),
                    'total_items_sold': sum(s.total_items_sold for s in summaries),
                    'total_discounts': sum(float(s.total_discounts) for s in summaries),
                    'total_tips': sum(float(s.total_tips) for s in summaries),
                    'average_order_value': 0,
                    'daily_summaries': DailySummarySerializer(summaries, many=True).data,
                    'start_date': start_date,
                    'end_date': end_date,
                    'is_closed': all(s.is_closed for s in summaries) if summaries.exists() else False
                }
                
                if consolidated['total_orders'] > 0:
                    consolidated['average_order_value'] = consolidated['total_sales'] / consolidated['total_orders']
                
                # 2. Si se pide detalle, adjuntarlo
                if include_orders_detail:
                    consolidated['orders_detail'] = self._get_orders_detail(start_date, end_date)
                
                return Response({
                    'report_type': report_type,
                    'period_name': period_name,
                    'start_date': start_date,
                    'end_date': end_date,
                    'data': consolidated
                })
            
            # ... (Lógica de otros reportes) ...
            
        except Exception as e:
            return Response({
                'error': f'Error al generar reporte: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=False, methods=['get'])
    def today(self, request):
        """
        Reporte del día actual.
        """
        today = timezone.now().date()
        
        try:
            summary = DailySummary.objects.get(date=today)
        except DailySummary.DoesNotExist:
            # Si no existe, generarlo inmediatamente
            summary = DailySummary.generate_for_date(
                date=today,
                generated_by=str(request.user.id),
                detailed=True
            )
        
        # Nota: Aquí no se incluye orders_detail por defecto, solo en generate/ o get_report/
        
        return Response(DailySummarySerializer(summary).data)
    
    @action(detail=False, methods=['post'])
    def close_day(self, request):
        # ... (Lógica de close_day existente) ...
        
        ALLOWED_ROLES_TO_CLOSE_DAY = ['SUPER_ADMIN', 'ADMIN_FAST_FOOD', 'ADMIN_RESTAURANT', 'MANAGER']
        user_role_name = 'USER_UNKNOWN'
        
        # --- Manejo seguro del rol para evitar AttributeError: 'str' object has no attribute 'get' ---
        try:
            role_attribute = getattr(request.user, 'role', None) 
            
            if isinstance(role_attribute, dict):
                user_role_name = role_attribute.get('name', 'USER_DEFAULT')
            elif request.user.is_superuser:
                user_role_name = 'SUPER_ADMIN'
            elif isinstance(request.user, str) and request.user.lower() in ['admin', 'alexandermy']:
                # Caso de emergencia si el middleware solo adjunta el username/ID como string
                user_role_name = 'SUPER_ADMIN'
            
        except Exception:
            pass
            
        # 2. Comprobación de permisos
        is_allowed = (
            request.user.is_staff or 
            request.user.is_superuser or
            user_role_name in ALLOWED_ROLES_TO_CLOSE_DAY
        )
        
        if not is_allowed:
            return Response({
                'error': f'No tienes permiso para cerrar el día. Rol actual detectado: {user_role_name}'
            }, status=status.HTTP_403_FORBIDDEN)
        
        # --- Lógica de Cierre ---
        serializer = CloseDaySerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        data = serializer.validated_data
        
        try:
            result = DailySummary.close_day(
                date=data['date'],
                closing_notes=data.get('closing_notes', ''),
                generated_by=str(request.user.id)
            )
            
            return Response(result)
            
        except Exception as e:
            return Response({
                'error': f'Error al cerrar el día: {str(e)}. Intenta generar el reporte primero.'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'])
    def range(self, request):
        # ... (código range existente) ...
        serializer = DateRangeSerializer(data=request.query_params)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        data = serializer.validated_data
        summaries = DailySummary.objects.filter(
            date__gte=data['start_date'],
            date__lte=data['end_date']
        ).order_by('date')
        
        serializer = DailySummarySerializer(summaries, many=True)
        
        totals = summaries.aggregate(
            total_sales=Sum('total_sales'),
            total_orders=Sum('total_orders'),
            total_customers=Sum('total_customers'),
            total_discounts=Sum('total_discounts'),
            total_tips=Sum('total_tips'),
        )
        
        return Response({
            'start_date': data['start_date'],
            'end_date': data['end_date'],
            'count': summaries.count(),
            'totals': totals,
            'summaries': serializer.data
        })
    
    @action(detail=False, methods=['get'])
    def dashboard(self, request):
        # ... (código dashboard existente) ...
        today = timezone.now().date()
        yesterday = today - timedelta(days=1)
        
        from apps.orders.models import Order
        from .models import Shift 
        
        # Hoy
        orders_today = Order.objects.filter(
            created_at__date=today,
            status__in=['delivered', 'completed']
        )
        
        # Ayer
        orders_yesterday = Order.objects.filter(
            created_at__date=yesterday,
            status__in=['delivered', 'completed']
        )
        
        # Turnos activos
        active_shifts = Shift.objects.filter(status='open').count()
        
        # Calcular
        sales_today = orders_today.aggregate(
            total=Sum('total')
        )['total'] or Decimal('0')
        
        sales_yesterday = orders_yesterday.aggregate(
            total=Sum('total')
        )['total'] or Decimal('0')
        
        # Porcentaje de cambio
        if sales_yesterday > 0:
            change_percentage = ((sales_today - sales_yesterday) / sales_yesterday) * 100
        else:
            change_percentage = 100 if sales_today > 0 else 0
        
        # Ventas de los últimos 7 días
        sales_last_7_days = []
        for i in range(7):
            day = today - timedelta(days=i)
            
            orders = Order.objects.filter(
                created_at__date=day,
                status__in=['delivered', 'completed']
            )
            
            total_sales = orders.aggregate(
                total=Sum('total')
            )['total'] or Decimal('0')
            
            sales_last_7_days.insert(0, {
                'date': day.strftime('%Y-%m-%d'),
                'day_name': day.strftime('%a'),
                'total_sales': float(total_sales),
                'total_orders': orders.count(),
            })
        
        return Response({
            'date': today.strftime('%Y-%m-%d'),
            'sales': {
                'today': float(sales_today),
                'yesterday': float(sales_yesterday),
                'change_percentage': round(change_percentage, 2),
                'trend': 'up' if change_percentage > 0 else 'down' if change_percentage < 0 else 'stable'
            },
            'orders': {
                'today': orders_today.count(),
                'yesterday': orders_yesterday.count(),
            },
            'shifts': {
                'active': active_shifts,
            },
            'last_7_days': sales_last_7_days
        })
    @action(detail=True, methods=['get'])
    def detail_with_orders(self, request, pk=None):
        """
        Obtiene el detalle completo de un reporte existente por su UUID.
        """
        try:
            summary = self.get_object()
            summary_data = DailySummarySerializer(summary).data
            
            # Reutilizamos tu lógica existente para obtener órdenes
            summary_data['orders_detail'] = self._get_orders_detail(summary.date, summary.date)
            
            return Response(summary_data)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)