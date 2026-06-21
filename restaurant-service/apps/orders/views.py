from rest_framework import viewsets, status, filters
from rest_framework.decorators import action, api_view
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticatedOrReadOnly, AllowAny
from django_filters.rest_framework import DjangoFilterBackend
from django.db import transaction
from django.db.models import Q, Count, Sum, Avg, Prefetch
from django.utils import timezone
from datetime import datetime, timedelta
import uuid
import logging
from decimal import Decimal

# Configurar logger
logger = logging.getLogger(__name__)

from core.permissions import require_authentication, require_staff
from .models import Order, OrderItem, OrderItemExtra, DeliveryInfo, OrderStatusHistory
from .serializers import (
    OrderListSerializer,
    OrderDetailSerializer,
    OrderCreateSerializer,
    OrderUpdateSerializer,
    OrderStatusUpdateSerializer,
    OrderCancelSerializer,
    OrderStatsSerializer,
    DeliveryInfoSerializer,
    OrderStatusHistorySerializer,
)


# ============================================================================
# VIEWS DE PRUEBA Y HEALTH CHECK
# ============================================================================

@api_view(['GET'])
def health_check(request):
    """
    Health check endpoint (sin autenticación)
    GET /api/orders/health/
    """
    return Response({
        'status': 'ok',
        'service': 'orders-service'
    })


# ============================================================================
# VIEWSETS DE ÓRDENES
# ============================================================================

class OrderViewSet(viewsets.ModelViewSet):
    """
    ViewSet para órdenes
    
    list: Lista todas las órdenes
    retrieve: Obtiene detalle de una orden
    create: Crea una nueva orden
    update: Actualiza una orden
    partial_update: Actualiza parcialmente una orden
    destroy: Elimina una orden
    """
    queryset = Order.objects.all()
    permission_classes = [AllowAny]  # ← YA ESTÁ CORRECTO
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter, filters.SearchFilter]
    filterset_fields = ['status', 'order_type', 'payment_status', 'customer']
    search_fields = ['order_number', 'customer__first_name', 'customer__last_name', 'table_number']
    ordering_fields = ['created_at', 'total', 'status']
    ordering = ['-created_at']
    lookup_field = 'order_number'
    
    def get_queryset(self):
        """Optimiza queries con prefetch y filtros adicionales"""
        queryset = super().get_queryset().select_related(
            'customer'
        ).prefetch_related(
            Prefetch('items', queryset=OrderItem.objects.select_related('product', 'size')),
            'items__extras',
            'delivery_info',
            'status_history'
        )
        
        # Filtros adicionales por query params
        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')
        min_total = self.request.query_params.get('min_total')
        max_total = self.request.query_params.get('max_total')
        
        if date_from:
            try:
                date_from = datetime.fromisoformat(date_from)
                queryset = queryset.filter(created_at__gte=date_from)
            except ValueError:
                pass
        
        if date_to:
            try:
                date_to = datetime.fromisoformat(date_to)
                queryset = queryset.filter(created_at__lte=date_to)
            except ValueError:
                pass
        
        if min_total:
            queryset = queryset.filter(total__gte=min_total)
        if max_total:
            queryset = queryset.filter(total__lte=max_total)
        
        return queryset
    
    def get_serializer_class(self):
        """Retorna el serializer apropiado según la acción"""
        if self.action == 'list':
            return OrderListSerializer
        elif self.action == 'create':
            return OrderCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return OrderUpdateSerializer
        return OrderDetailSerializer

    def _create_payment_for_order(self, order, request_data):
        """Auxiliar para crear un pago o múltiples vinculados a la orden."""
        from apps.payments.models import Payment, PaymentMethod, Currency
        
        payments_from_request = []
        if 'payments_list' in request_data and isinstance(request_data['payments_list'], list) and len(request_data['payments_list']) > 0:
            payments_from_request = request_data.get('payments_list')
        else:
            # Fallback legacy para 1 solo pago
            payment_method_id = request_data.get('payment_method_id') or request_data.get('payment_method')
            if payment_method_id:
                amount_paid_raw = request_data.get('amount_paid')
                # CRITICO: Priorizar 'amount' si viene de un pago parcial, sino usar lo demás
                total_in_currency = (
                    request_data.get('total_in_currency')
                    or amount_paid_raw
                    or request_data.get('amount')
                    or order.total
                )
                amount_received = request_data.get('amount_received') or amount_paid_raw or total_in_currency
                payments_from_request.append({
                    'payment_method_id': payment_method_id,
                    'amount_applied': total_in_currency,
                    'amount_received': amount_received,
                    'currency_code': request_data.get('currency_code', 'USD')
                })

        if not payments_from_request:
            logger.warning(f"[PAYMENT_DEBUG] No payment instructions provided for order {order.order_number} — skipping payment creation")
            return
            
        usd_currency, _ = Currency.objects.get_or_create(
            code='USD',
            defaults={'name': 'Dólares', 'symbol': '$', 'is_active': True}
        )

        for p_data in payments_from_request:
            try:
                currency_code = p_data.get('currency_code', 'USD')
                currency, _ = Currency.objects.get_or_create(
                    code=currency_code,
                    defaults={'name': currency_code, 'symbol': '$', 'is_active': True}
                )
                
                # Robust payment method lookup (handle IDs and method_types)
                pm_id = p_data.get('payment_method_id')
                try:
                    # Validar si es un UUID válido
                    uuid.UUID(str(pm_id))
                    payment_method = PaymentMethod.objects.get(id=pm_id)
                except (ValueError, PaymentMethod.DoesNotExist, TypeError):
                    # No es UUID o no existe por ID, probar por method_type (ej: 'cash')
                    payment_method = PaymentMethod.objects.filter(
                        method_type=pm_id, 
                        is_active=True
                    ).first()
                    
                    if not payment_method:
                        # Fallback final: el primer método activo disponible
                        payment_method = PaymentMethod.objects.filter(is_active=True).first()
                        
                if not payment_method:
                    logger.error(f"[PAYMENT_ERROR] Could not find any valid payment method for {pm_id}")
                    continue
                
                amount_applied = Decimal(str(p_data.get('amount_applied', 0)))
                amount_received = Decimal(str(p_data.get('amount_received', amount_applied)))
                change = amount_received - amount_applied
                if change < 0: change = Decimal('0')
                
                payment = Payment.objects.create(
                    payment_number=f"PAY-{uuid.uuid4().hex[:8].upper()}",
                    order=order,
                    payment_method=payment_method,
                    currency=currency,
                    amount=amount_applied,
                    amount_received=amount_received,
                    change_amount=change,
                    original_amount=amount_applied,
                    original_currency=usd_currency,
                    status='completed'
                )
                logger.info(f"[PAYMENT_DEBUG] ✅ Payment created: {payment.payment_number} for order {order.order_number}")
            except Exception as e:
                import traceback
                logger.error(f"[PAYMENT_DEBUG] ❌ Error creando pago parcial para orden {order.order_number}: {str(e)}")
                logger.error(traceback.format_exc())
    
    def create(self, request, *args, **kwargs):
        """Crea una nueva orden"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order = serializer.save()
        
        # Crear pago si es necesario
        if order.payment_status == 'paid':
            self._create_payment_for_order(order, request.data)
        
        # Retornar con el serializer de detalle
        detail_serializer = OrderDetailSerializer(order)
        return Response(
            detail_serializer.data,
            status=status.HTTP_201_CREATED
        )
    
    @action(detail=True, methods=['post'])
    def sync_draft(self, request, order_number=None):
        """
        Sincroniza los items de una orden pendiente (Draft).
        POST /api/orders/{order_number}/sync_draft/
        Body: {"items": [...], "notes": "...", "discount_amount": 0}
        """
        from django.db import transaction
        from apps.menu.models import Product, Size, Extra
        order = self.get_object()
        
        if order.status != 'pending':
            return Response(
                {'error': 'Solo se pueden sincronizar órdenes en estado pendiente'},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        with transaction.atomic():
            # Actualizar notas y descuentos si vienen
            if 'notes' in request.data:
                order.notes = request.data.get('notes', '')
            if 'discount_amount' in request.data:
                order.discount_amount = request.data.get('discount_amount', 0)
                
            # Borrar items viejos (EXCEPTO los que ya han sido pagados previamente)
            order.items.filter(is_paid=False).delete()
            
            # Crear los nuevos items
            items_data = request.data.get('items', [])
            for item_data in items_data:
                if item_data.get('is_paid', False):
                    continue # Ignorar ítems que ya vienen como pagados desde el front (ya están en DB)

                product = Product.objects.get(id=item_data['product_id'])
                size = None
                if item_data.get('size_id'):
                    size = Size.objects.get(id=item_data['size_id'])
                
                extra_ids = item_data.get('extra_ids', [])
                
                order_item = OrderItem.objects.create(
                    order=order,
                    product=product,
                    size=size,
                    quantity=item_data.get('quantity', 1),
                    notes=item_data.get('notes', '')
                )
                
                if extra_ids:
                    extras = Extra.objects.filter(id__in=extra_ids)
                    for extra in extras:
                        OrderItemExtra.objects.create(
                            order_item=order_item,
                            extra=extra
                        )
            
            order.calculate_totals()
            order.save()
            
        detail_serializer = OrderDetailSerializer(order)
        return Response(detail_serializer.data)

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def checkout(self, request, order_number=None):
        """
        Procesa el pago y cobra una orden pendiente, liberando la mesa.
        POST /api/orders/{order_number}/checkout/
        """
        order = self.get_object()
        
        if order.status != 'pending':
            return Response(
                {'error': 'Solo se pueden cobrar órdenes en estado pendiente'},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        # Pasar a completado y pagado
        order.status = 'completed'
        order.payment_status = 'paid'
        order.confirmed_at = timezone.now()
        order.ready_at = timezone.now()
        order.delivered_at = timezone.now()
        order.save()
        
        # Crear pago desde los datos del frontend (si vienen en checkout)
        self._create_payment_for_order(order, request.data)
        
        # Liberar la mesa si tenía alguna
        from apps.pos.models import Table
        # 1. Por relación inversa
        if hasattr(order, 'table_assignment') and order.table_assignment.exists():
            for table in order.table_assignment.all():
                table.free()
                
        # 2. Por número de mesa (respaldo)
        if order.table_number:
            try:
                table_by_num = Table.objects.get(number=order.table_number)
                if table_by_num.status != 'available':
                    table_by_num.free()
            except Table.DoesNotExist:
                pass
                
        # ✅ Limpieza defensiva: liberar mesas trabadas sin orden activa
        Table.objects.filter(status='occupied', current_order=None).update(status='available')
        detail_serializer = OrderDetailSerializer(order)
        return Response(detail_serializer.data)
        
    @action(detail=True, methods=['post'])
    @transaction.atomic
    def partial_checkout(self, request, order_number=None):
        """
        Registra un pago parcial a la orden.
        POST /api/orders/{order_number}/partial_checkout/
        Body: {"amount": 25.00}
        """
        order = self.get_object()
        
        if order.status != 'pending':
            return Response(
                {'error': 'Solo se pueden agregar pagos a órdenes pendientes'},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        # Legacy fallback o list de payments
        amount_to_pay = Decimal('0')
        if 'payments_list' in request.data and isinstance(request.data['payments_list'], list):
            for p in request.data['payments_list']:
                amount_to_pay += Decimal(str(p.get('amount_applied', 0)))
        else:
            amount_to_pay = Decimal(str(request.data.get('amount', 0)))
            # También soportar amount_paid como fallback si no se especifican payments_list ni amount
            if amount_to_pay == 0 and request.data.get('amount_paid'):
                amount_to_pay = Decimal(str(request.data.get('amount_paid', 0)))

        if amount_to_pay <= 0:
            return Response(
                {'error': 'El monto a pagar debe ser mayor a 0'},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        order.amount_paid += amount_to_pay
        
        # Registrar el pago formalmente
        self._create_payment_for_order(order, request.data)
        
        # Verificar si ya se cubrió el total
        pending_balance = order.total - order.amount_paid
        if pending_balance <= 0:
            # Se ha pagado por completo
            order.status = 'completed'
            order.payment_status = 'paid'
            order.confirmed_at = timezone.now()
            order.ready_at = timezone.now()
            order.delivered_at = timezone.now()
            order.save()
            
            # Liberar la mesa
            from apps.pos.models import Table
            if hasattr(order, 'table_assignment') and order.table_assignment.exists():
                for table in order.table_assignment.all():
                    table.free()
            if order.table_number:
                try:
                    table_by_num = Table.objects.get(number=order.table_number)
                    if table_by_num.status != 'available':
                        table_by_num.free()
                except Table.DoesNotExist:
                    pass
        else:
            order.save()
            
        detail_serializer = OrderDetailSerializer(order)
        return Response(detail_serializer.data)
        
    @action(detail=True, methods=['post'])
    @transaction.atomic
    def split_checkout(self, request, order_number=None):
        """
        Separa items específicos para pagarlos en una orden nueva.
        POST /api/orders/{order_number}/split_checkout/
        Body: {
            "items": [
                {"product_id": "uuid...", "quantity": 1}, ...
            ]
        }
        """
        from django.db import transaction
        
        order = self.get_object()
        if order.status != 'pending':
            return Response({'error': 'Solo se pueden separar items de órdenes pendientes'}, status=status.HTTP_400_BAD_REQUEST)
            
        split_items_data = request.data.get('items', [])
        if not split_items_data:
            return Response({'error': 'No se especificaron items para separar'}, status=status.HTTP_400_BAD_REQUEST)
            
        with transaction.atomic():
            split_items_for_response = []

            for split_req in split_items_data:
                prod_id = split_req.get('product_id')
                qty_to_split = int(split_req.get('quantity', 0))
                if qty_to_split <= 0:
                    continue

                madre_items = order.items.filter(product_id=prod_id, is_paid=False)
                for m_item in madre_items:
                    if qty_to_split <= 0:
                        break
                    extract_qty = min(m_item.quantity, qty_to_split)
                    if extract_qty == m_item.quantity:
                        order.items.filter(id=m_item.id).update(is_paid=True)
                        m_item.refresh_from_db()
                        split_items_for_response.append({
                            'name': m_item.product.name,
                            'quantity': extract_qty,
                            'unit_price': float(m_item.unit_price),
                            'line_total': float(m_item.line_total)
                        })
                    else:
                        m_item.quantity -= extract_qty
                        m_item.line_total = m_item.unit_price * m_item.quantity
                        m_item.save()
                        paid_item = OrderItem.objects.create(
                            order=order,
                            product=m_item.product,
                            size=m_item.size,
                            quantity=extract_qty,
                            notes=m_item.notes,
                            unit_price=m_item.unit_price,
                            line_total=m_item.unit_price * extract_qty,
                            is_paid=True
                        )
                        split_items_for_response.append({
                            'name': paid_item.product.name,
                            'quantity': extract_qty,
                            'unit_price': float(paid_item.unit_price),
                            'line_total': float(paid_item.line_total)
                        })
                    qty_to_split -= extract_qty

            order.calculate_totals()
            
            # Aggregate the paid amount
            from decimal import Decimal
            split_subtotal = sum(i['line_total'] for i in split_items_for_response)
            order.amount_paid += Decimal(str(split_subtotal))
            
            if not order.items.filter(is_paid=False).exists():
                order.status = 'completed'
                order.payment_status = 'paid'
                from apps.pos.models import Table
                if order.table_number:
                    try:
                        t = Table.objects.get(number=order.table_number)
                        t.free()
                    except Table.DoesNotExist:
                        pass
            order.save()
            
            # Registrar pago
            req_data = request.data.copy()
            if 'amount_paid' not in req_data and 'amount' not in req_data and 'payments_list' not in req_data:
                 req_data['amount_paid'] = split_subtotal
            self._create_payment_for_order(order, req_data)

        split_subtotal = sum(i['line_total'] for i in split_items_for_response)
        return Response({
            'order_number': f"SPLIT-{order.order_number}",
            'table_number': order.table_number,
            'items': split_items_for_response,
            'subtotal': split_subtotal,
            'total': split_subtotal,
            'notes': f"Separada de la orden #{order.order_number}"
        }, status=status.HTTP_201_CREATED)
    @action(detail=True, methods=['post'])
    def update_status(self, request, order_number=None):
        """
        Actualiza el estado de una orden
        POST /api/orders/{order_number}/update_status/
        Body: {"status": "confirmed", "notes": "...", "changed_by": "..."}
        """
        order = self.get_object()
        serializer = OrderStatusUpdateSerializer(
            data=request.data,
            context={'order': order}
        )
        serializer.is_valid(raise_exception=True)
        updated_order = serializer.save()
        
        detail_serializer = OrderDetailSerializer(updated_order)
        return Response(detail_serializer.data)
    
    @action(detail=True, methods=['post'])
    def cancel(self, request, order_number=None):
        """
        Cancela una orden
        POST /api/orders/{order_number}/cancel/
        Body: {"reason": "Cliente canceló"}
        """
        order = self.get_object()
        serializer = OrderCancelSerializer(
            data=request.data,
            context={'order': order}
        )
        serializer.is_valid(raise_exception=True)
        cancelled_order = serializer.save()
        
        detail_serializer = OrderDetailSerializer(cancelled_order)
        return Response(detail_serializer.data)
    
    @action(detail=True, methods=['post'])
    def confirm(self, request, order_number=None):
        """
        Confirma una orden pendiente
        POST /api/orders/{order_number}/confirm/
        """
        order = self.get_object()
        
        if order.mark_as_confirmed():
            detail_serializer = OrderDetailSerializer(order)
            return Response(detail_serializer.data)
        
        return Response(
            {'error': 'No se puede confirmar esta orden en su estado actual'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    @action(detail=True, methods=['post'])
    def start_preparing(self, request, order_number=None):
        """
        Marca orden como en preparación
        POST /api/orders/{order_number}/start_preparing/
        """
        order = self.get_object()
        
        if order.mark_as_preparing():
            detail_serializer = OrderDetailSerializer(order)
            return Response(detail_serializer.data)
        
        return Response(
            {'error': 'No se puede iniciar preparación en el estado actual'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    @action(detail=True, methods=['post'])
    def mark_ready(self, request, order_number=None):
        """
        Marca orden como lista
        POST /api/orders/{order_number}/mark_ready/
        """
        order = self.get_object()
        
        if order.mark_as_ready():
            detail_serializer = OrderDetailSerializer(order)
            return Response(detail_serializer.data)
        
        return Response(
            {'error': 'No se puede marcar como lista en el estado actual'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    @action(detail=True, methods=['post'])
    def mark_delivered(self, request, order_number=None):
        """
        Marca orden como entregada
        POST /api/orders/{order_number}/mark_delivered/
        """
        order = self.get_object()
        
        if order.mark_as_delivered():
            detail_serializer = OrderDetailSerializer(order)
            return Response(detail_serializer.data)
        
        return Response(
            {'error': 'No se puede marcar como entregada en el estado actual'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    @action(detail=False, methods=['get'])
    def pending(self, request):
        """
        Obtiene órdenes pendientes
        GET /api/orders/pending/
        """
        orders = self.get_queryset().filter(status='pending')
        serializer = OrderListSerializer(orders, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def preparing(self, request):
        """
        Obtiene órdenes en preparación
        GET /api/orders/preparing/
        """
        orders = self.get_queryset().filter(status='preparing')
        serializer = OrderListSerializer(orders, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def ready(self, request):
        """
        Obtiene órdenes listas
        GET /api/orders/ready/
        """
        orders = self.get_queryset().filter(status='ready')
        serializer = OrderListSerializer(orders, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def active(self, request):
        """
        Obtiene todas las órdenes activas (no completadas ni canceladas)
        GET /api/orders/active/
        """
        orders = self.get_queryset().exclude(
            status__in=['delivered', 'cancelled', 'rejected']
        )
        serializer = OrderListSerializer(orders, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def today(self, request):
        """
        Obtiene órdenes de hoy
        GET /api/orders/today/
        """
        today = timezone.now().date()
        orders = self.get_queryset().filter(
            created_at__date=today
        )
        serializer = OrderListSerializer(orders, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def by_customer(self, request):
        """
        Obtiene órdenes de un cliente específico
        GET /api/orders/by_customer/?customer_id=xxx
        """
        customer_id = request.query_params.get('customer_id')
        
        if not customer_id:
            return Response(
                {'error': 'El parámetro customer_id es requerido'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        orders = self.get_queryset().filter(customer_id=customer_id)
        serializer = OrderListSerializer(orders, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def by_table(self, request):
        """
        Obtiene órdenes de una mesa específica
        GET /api/orders/by_table/?table_number=5
        """
        table_number = request.query_params.get('table_number')
        
        if not table_number:
            return Response(
                {'error': 'El parámetro table_number es requerido'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        orders = self.get_queryset().filter(
            table_number=table_number,
            order_type='dine_in'
        ).exclude(status__in=['delivered', 'cancelled'])
        
        serializer = OrderListSerializer(orders, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def stats(self, request):
        """
        Obtiene estadísticas de órdenes
        GET /api/orders/stats/?date_from=...&date_to=...
        """
        queryset = self.get_queryset()
        
        # Filtrar por fechas si se proporcionan
        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')
        
        if date_from:
            try:
                date_from = datetime.fromisoformat(date_from)
                queryset = queryset.filter(created_at__gte=date_from)
            except ValueError:
                pass
        
        if date_to:
            try:
                date_to = datetime.fromisoformat(date_to)
                queryset = queryset.filter(created_at__lte=date_to)
            except ValueError:
                pass
        
        # Calcular estadísticas
        stats = {
            'total_orders': queryset.count(),
            'pending_orders': queryset.filter(status='pending').count(),
            'preparing_orders': queryset.filter(status='preparing').count(),
            'ready_orders': queryset.filter(status='ready').count(),
            'completed_orders': queryset.filter(status='delivered').count(),
            'cancelled_orders': queryset.filter(status='cancelled').count(),
        }
        
        # Calcular ingresos
        revenue_data = queryset.filter(
            status='delivered',
            payment_status='paid'
        ).aggregate(
            total_revenue=Sum('total'),
            average_order_value=Avg('total')
        )
        
        stats['total_revenue'] = revenue_data['total_revenue'] or 0
        stats['average_order_value'] = revenue_data['average_order_value'] or 0
        
        serializer = OrderStatsSerializer(data=stats)
        serializer.is_valid()
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def sales_by_period(self, request):
        """
        Obtiene ventas agrupadas por período
        GET /api/orders/sales_by_period/?period=day&date_from=...&date_to=...
        period: day, week, month
        """
        from django.db.models.functions import TruncDate, TruncWeek, TruncMonth
        
        period = request.query_params.get('period', 'day')
        queryset = self.get_queryset().filter(
            status='delivered',
            payment_status='paid'
        )
        
        # Aplicar filtros de fecha
        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')
        
        if date_from:
            try:
                date_from = datetime.fromisoformat(date_from)
                queryset = queryset.filter(created_at__gte=date_from)
            except ValueError:
                pass
        
        if date_to:
            try:
                date_to = datetime.fromisoformat(date_to)
                queryset = queryset.filter(created_at__lte=date_to)
            except ValueError:
                pass
        
        # Agrupar por período
        if period == 'day':
            trunc_func = TruncDate
        elif period == 'week':
            trunc_func = TruncWeek
        elif period == 'month':
            trunc_func = TruncMonth
        else:
            trunc_func = TruncDate
        
        sales = queryset.annotate(
            period=trunc_func('created_at')
        ).values('period').annotate(
            total_orders=Count('id'),
            total_revenue=Sum('total'),
            average_order_value=Avg('total')
        ).order_by('period')
        
        return Response(sales)
    
    @action(detail=False, methods=['get'])
    def recent_completed(self, request):
        """
        Obtiene órdenes completadas recientes (últimas 24 horas)
        GET /api/orders/recent_completed/
        """
        since = timezone.now() - timedelta(hours=24)
        orders = self.get_queryset().filter(
            status='delivered',
            delivered_at__gte=since
        ).order_by('-delivered_at')[:50]
        
        serializer = OrderListSerializer(orders, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def history(self, request, order_number=None):
        """
        Obtiene el historial de cambios de estado de una orden
        GET /api/orders/{order_number}/history/
        """
        order = self.get_object()
        history = order.status_history.all()
        serializer = OrderStatusHistorySerializer(history, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def receipt(self, request, order_number=None):
        """
        Obtiene información formateada para recibo/ticket
        GET /api/orders/{order_number}/receipt/
        """
        order = self.get_object()
        
        receipt_data = {
            'order_number': order.order_number,
            'date': order.created_at,
            'order_type': order.get_order_type_display(),
            'table_number': order.table_number,
            'customer': {
                'name': order.customer.get_full_name() if order.customer else 'Cliente General',
                'phone': order.customer.phone if order.customer else '',
            },
            'items': [],
            'subtotal': float(order.subtotal),
            'tax': float(order.tax_amount),
            'discount': float(order.discount_amount),
            'delivery_fee': float(order.delivery_fee),
            'tip': float(order.tip_amount),
            'total': float(order.total),
            'payment_status': order.get_payment_status_display(),
            'notes': order.notes,
        }
        
        # Formatear items
        for item in order.items.all():
            item_data = {
                'name': item.product.name,
                'size': item.size.name if item.size else None,
                'quantity': item.quantity,
                'unit_price': float(item.unit_price),
                'line_total': float(item.line_total),
                'extras': [extra.extra.name for extra in item.extras.all()],
                'notes': item.notes,
            }
            receipt_data['items'].append(item_data)
        
        return Response(receipt_data)


class DeliveryInfoViewSet(viewsets.ModelViewSet):
    """
    ViewSet para información de delivery
    """
    queryset = DeliveryInfo.objects.all()
    serializer_class = DeliveryInfoSerializer
    permission_classes = [AllowAny]  # ← CAMBIADO
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['order']
    ordering = ['-created_at']
    
    def get_queryset(self):
        """Optimiza queries"""
        return super().get_queryset().select_related('order')
    
    @action(detail=True, methods=['post'])
    def assign_driver(self, request, pk=None):
        """
        Asigna un repartidor al delivery
        POST /api/deliveries/{id}/assign_driver/
        Body: {"driver_name": "...", "driver_phone": "..."}
        """
        delivery = self.get_object()
        
        driver_name = request.data.get('driver_name')
        driver_phone = request.data.get('driver_phone')
        
        if not driver_name or not driver_phone:
            return Response(
                {'error': 'driver_name y driver_phone son requeridos'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        delivery.driver_name = driver_name
        delivery.driver_phone = driver_phone
        delivery.save()
        
        serializer = self.get_serializer(delivery)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def mark_picked_up(self, request, pk=None):
        """
        Marca el delivery como recogido
        POST /api/deliveries/{id}/mark_picked_up/
        """
        delivery = self.get_object()
        delivery.picked_up_at = timezone.now()
        delivery.save()
        
        # Actualizar estado de la orden
        delivery.order.status = 'delivering'
        delivery.order.save()
        
        serializer = self.get_serializer(delivery)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def mark_delivered(self, request, pk=None):
        """
        Marca el delivery como entregado
        POST /api/deliveries/{id}/mark_delivered/
        """
        delivery = self.get_object()
        delivery.delivered_at = timezone.now()
        delivery.save()
        
        # Actualizar estado de la orden
        delivery.order.mark_as_delivered()
        
        serializer = self.get_serializer(delivery)
        return Response(serializer.data)