from rest_framework import viewsets, status, filters
from rest_framework.decorators import action, api_view
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticatedOrReadOnly, AllowAny
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Sum, Count, Q, Avg
from django.utils import timezone
from datetime import datetime, timedelta

from core.permissions import require_authentication, require_staff
from .models import (
    Currency, ExchangeRate, PaymentMethod, Payment,
    Refund, CashRegister, CashMovement
)
from .serializers import (
    CurrencySerializer,
    ExchangeRateSerializer,
    ExchangeRateCreateUpdateSerializer,
    CurrencyConversionSerializer,
    PaymentMethodSerializer,
    PaymentListSerializer,
    PaymentDetailSerializer,
    PaymentCreateSerializer,
    RefundSerializer,
    RefundCreateSerializer,
    CashRegisterSerializer,
    CashRegisterOpenSerializer,
    CashRegisterCloseSerializer,
    CashMovementSerializer,
)


# ============================================================================
# VIEWS DE PRUEBA Y HEALTH CHECK
# ============================================================================

@api_view(['GET'])
def health_check(request):
    """
    Health check endpoint (sin autenticación)
    GET /api/payments/health/
    """
    return Response({
        'status': 'ok',
        'service': 'payments-service'
    })


# ============================================================================
# VIEWSETS DE MONEDAS Y TASAS DE CAMBIO
# ============================================================================

class CurrencyViewSet(viewsets.ModelViewSet):
    """
    ViewSet para monedas
    
    list: Lista todas las monedas
    retrieve: Obtiene detalle de una moneda
    create: Crea una nueva moneda
    update: Actualiza una moneda
    partial_update: Actualiza parcialmente una moneda
    destroy: Elimina una moneda
    """
    queryset = Currency.objects.all()
    serializer_class = CurrencySerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter, filters.SearchFilter]
    filterset_fields = ['is_active', 'is_default']
    search_fields = ['code', 'name']
    ordering_fields = ['name', 'code']
    ordering = ['name']
    lookup_field = 'code'
    
    @action(detail=False, methods=['get'])
    def active(self, request):
        """
        Obtiene monedas activas
        GET /api/payments/currencies/active/
        """
        currencies = self.get_queryset().filter(is_active=True)
        serializer = self.get_serializer(currencies, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def default(self, request):
        """
        Obtiene la moneda por defecto
        GET /api/payments/currencies/default/
        """
        currency = Currency.get_default()
        if not currency:
            return Response(
                {'error': 'No hay moneda por defecto configurada'},
                status=status.HTTP_404_NOT_FOUND
            )
        serializer = self.get_serializer(currency)
        return Response(serializer.data)


class ExchangeRateViewSet(viewsets.ModelViewSet):
    """
    ViewSet para tasas de cambio
    
    list: Lista todas las tasas
    retrieve: Obtiene detalle de una tasa
    create: Crea una nueva tasa
    update: Actualiza una tasa
    partial_update: Actualiza parcialmente una tasa
    destroy: Elimina una tasa
    """
    queryset = ExchangeRate.objects.all()
    permission_classes = [IsAuthenticatedOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['from_currency', 'to_currency', 'is_active']
    ordering_fields = ['updated_at', 'rate']
    ordering = ['-updated_at']
    
    def get_queryset(self):
        """Optimiza queries"""
        return super().get_queryset().select_related('from_currency', 'to_currency')
    
    def get_serializer_class(self):
        """Retorna el serializer apropiado"""
        if self.action in ['create', 'update', 'partial_update']:
            return ExchangeRateCreateUpdateSerializer
        return ExchangeRateSerializer
    
    @action(detail=False, methods=['get'])
    def active(self, request):
        """
        Obtiene tasas de cambio activas
        GET /api/payments/exchange-rates/active/
        """
        rates = self.get_queryset().filter(is_active=True)
        serializer = ExchangeRateSerializer(rates, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def get_rate(self, request):
        """
        Obtiene la tasa de cambio entre dos monedas
        GET /api/payments/exchange-rates/get_rate/?from=USD&to=COP
        """
        from_currency = request.query_params.get('from')
        to_currency = request.query_params.get('to')
        
        if not from_currency or not to_currency:
            return Response(
                {'error': 'Parámetros "from" y "to" son requeridos'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        rate = ExchangeRate.get_rate(from_currency, to_currency)
        
        if rate is None:
            return Response(
                {'error': f'No hay tasa de cambio disponible de {from_currency} a {to_currency}'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        return Response({
            'from_currency': from_currency,
            'to_currency': to_currency,
            'rate': float(rate)
        })
    
    @action(detail=False, methods=['post'])
    def convert(self, request):
        """
        Convierte un monto entre dos monedas
        POST /api/payments/exchange-rates/convert/
        Body: {"amount": 100, "from_currency": "USD", "to_currency": "COP"}
        """
        serializer = CurrencyConversionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        result = serializer.convert()
        return Response(result)
    
    @action(detail=False, methods=['post'])
    def update_rate(self, request):
        """
        Actualiza o crea una tasa de cambio
        POST /api/payments/exchange-rates/update_rate/
        Body: {
            "from_currency_code": "USD",
            "to_currency_code": "COP",
            "rate": 4250.00,
            "source": "Manual",
            "updated_by": "Admin"
        }
        """
        from_code = request.data.get('from_currency_code')
        to_code = request.data.get('to_currency_code')
        rate_value = request.data.get('rate')
        source = request.data.get('source', 'Manual')
        updated_by = request.data.get('updated_by', '')
        
        if not from_code or not to_code or not rate_value:
            return Response(
                {'error': 'from_currency_code, to_currency_code y rate son requeridos'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            from_currency = Currency.objects.get(code=from_code)
            to_currency = Currency.objects.get(code=to_code)
        except Currency.DoesNotExist as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Actualizar o crear
        rate, created = ExchangeRate.objects.update_or_create(
            from_currency=from_currency,
            to_currency=to_currency,
            defaults={
                'rate': rate_value,
                'source': source,
                'updated_by': updated_by,
                'is_active': True
            }
        )
        
        serializer = ExchangeRateSerializer(rate)
        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK
        )


# ============================================================================
# VIEWSETS DE MÉTODOS DE PAGO
# ============================================================================

class PaymentMethodViewSet(viewsets.ModelViewSet):
    """
    ViewSet para métodos de pago
    
    list: Lista todos los métodos de pago
    retrieve: Obtiene detalle de un método
    create: Crea un nuevo método
    update: Actualiza un método
    partial_update: Actualiza parcialmente un método
    destroy: Elimina un método
    """
    queryset = PaymentMethod.objects.all()
    serializer_class = PaymentMethodSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter, filters.SearchFilter]
    filterset_fields = ['method_type', 'is_active']
    search_fields = ['name']
    ordering_fields = ['display_order', 'name']
    ordering = ['display_order', 'name']
    
    @action(detail=False, methods=['get'])
    def active(self, request):
        """
        Obtiene métodos de pago activos
        GET /api/payments/payment-methods/active/
        """
        methods = self.get_queryset().filter(is_active=True)
        serializer = self.get_serializer(methods, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def by_type(self, request):
        """
        Obtiene métodos de pago por tipo
        GET /api/payments/payment-methods/by_type/?type=cash
        """
        method_type = request.query_params.get('type')
        
        if not method_type:
            return Response(
                {'error': 'El parámetro "type" es requerido'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        methods = self.get_queryset().filter(
            method_type=method_type,
            is_active=True
        )
        
        serializer = self.get_serializer(methods, many=True)
        return Response(serializer.data)


# ============================================================================
# VIEWSETS DE PAGOS
# ============================================================================

class PaymentViewSet(viewsets.ModelViewSet):
    """
    ViewSet para pagos
    
    list: Lista todos los pagos
    retrieve: Obtiene detalle de un pago
    create: Crea un nuevo pago
    update: Actualiza un pago
    partial_update: Actualiza parcialmente un pago
    destroy: Elimina un pago
    """
    queryset = Payment.objects.all()
    permission_classes = [IsAuthenticatedOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter, filters.SearchFilter]
    filterset_fields = ['status', 'payment_method', 'currency', 'order']
    search_fields = ['payment_number', 'transaction_id', 'reference_number']
    ordering_fields = ['created_at', 'amount']
    ordering = ['-created_at']
    lookup_field = 'payment_number'
    
    def get_queryset(self):
        """Optimiza queries"""
        queryset = super().get_queryset().select_related(
            'order',
            'payment_method',
            'currency',
            'original_currency',
            'cash_register'
        )
        
        # Filtros adicionales
        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')
        
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
        
        return queryset
    
    def get_serializer_class(self):
        """Retorna el serializer apropiado"""
        if self.action == 'list':
            return PaymentListSerializer
        elif self.action == 'create':
            return PaymentCreateSerializer
        return PaymentDetailSerializer
    
    def create(self, request, *args, **kwargs):
        """Crea un nuevo pago"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payment = serializer.save()
        
        # Retornar con el serializer de detalle
        detail_serializer = PaymentDetailSerializer(payment)
        return Response(
            detail_serializer.data,
            status=status.HTTP_201_CREATED
        )
    
    @action(detail=True, methods=['post'])
    def complete(self, request, payment_number=None):
        """
        Marca un pago como completado
        POST /api/payments/payments/{payment_number}/complete/
        """
        payment = self.get_object()
        
        if payment.mark_as_completed():
            detail_serializer = PaymentDetailSerializer(payment)
            return Response(detail_serializer.data)
        
        return Response(
            {'error': 'No se puede completar el pago en su estado actual'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    @action(detail=True, methods=['post'])
    def fail(self, request, payment_number=None):
        """
        Marca un pago como fallido
        POST /api/payments/payments/{payment_number}/fail/
        Body: {"reason": "..."}
        """
        payment = self.get_object()
        reason = request.data.get('reason', '')
        
        if payment.mark_as_failed(reason):
            detail_serializer = PaymentDetailSerializer(payment)
            return Response(detail_serializer.data)
        
        return Response(
            {'error': 'No se puede marcar el pago como fallido'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    @action(detail=True, methods=['post'])
    def refund(self, request, payment_number=None):
        """
        Procesa un reembolso
        POST /api/payments/payments/{payment_number}/refund/
        Body: {"amount": 10.00, "reason": "...", "approved_by": "..."}
        """
        payment = self.get_object()
        
        # Crear serializer de reembolso
        refund_data = {
            'payment_id': payment.id,
            'amount': request.data.get('amount'),
            'reason': request.data.get('reason', ''),
            'approved_by': request.data.get('approved_by', '')
        }
        
        serializer = RefundCreateSerializer(data=refund_data)
        serializer.is_valid(raise_exception=True)
        refund = serializer.save()
        
        refund_serializer = RefundSerializer(refund)
        return Response(refund_serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=False, methods=['get'])
    def by_order(self, request):
        """
        Obtiene pagos de una orden
        GET /api/payments/payments/by_order/?order_id=xxx
        """
        order_id = request.query_params.get('order_id')
        
        if not order_id:
            return Response(
                {'error': 'El parámetro "order_id" es requerido'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        payments = self.get_queryset().filter(order_id=order_id)
        serializer = PaymentListSerializer(payments, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def completed(self, request):
        """
        Obtiene pagos completados
        GET /api/payments/payments/completed/
        """
        payments = self.get_queryset().filter(status='completed')
        serializer = PaymentListSerializer(payments, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def pending(self, request):
        """
        Obtiene pagos pendientes
        GET /api/payments/payments/pending/
        """
        payments = self.get_queryset().filter(status='pending')
        serializer = PaymentListSerializer(payments, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def today(self, request):
        """
        Obtiene pagos de hoy
        GET /api/payments/payments/today/
        """
        today = timezone.now().date()
        payments = self.get_queryset().filter(created_at__date=today)
        serializer = PaymentListSerializer(payments, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def stats(self, request):
        """
        Obtiene estadísticas de pagos
        GET /api/payments/payments/stats/?date_from=...&date_to=...&currency=USD
        """
        queryset = self.get_queryset()
        
        # Filtrar por fechas
        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')
        currency_code = request.query_params.get('currency')
        
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
        
        # Filtrar por moneda si se especifica
        if currency_code:
            queryset = queryset.filter(currency__code=currency_code)
        
        # Calcular estadísticas
        stats = {
            'total_payments': queryset.count(),
            'completed_payments': queryset.filter(status='completed').count(),
            'pending_payments': queryset.filter(status='pending').count(),
            'failed_payments': queryset.filter(status='failed').count(),
        }
        
        # Totales por moneda
        by_currency = queryset.filter(
            status='completed'
        ).values('currency__code', 'currency__symbol').annotate(
            total_amount=Sum('amount'),
            count=Count('id')
        )
        
        stats['by_currency'] = list(by_currency)
        
        # Total en moneda específica o por defecto
        if currency_code:
            total_data = queryset.filter(
                status='completed',
                currency__code=currency_code
            ).aggregate(
                total_amount=Sum('amount'),
                average_amount=Avg('amount')
            )
        else:
            # Usar moneda por defecto
            default_currency = Currency.get_default()
            if default_currency:
                total_data = queryset.filter(
                    status='completed',
                    original_currency=default_currency
                ).aggregate(
                    total_amount=Sum('original_amount'),
                    average_amount=Avg('original_amount')
                )
            else:
                total_data = {'total_amount': 0, 'average_amount': 0}
        
        stats['total_amount'] = float(total_data['total_amount'] or 0)
        stats['average_amount'] = float(total_data['average_amount'] or 0)
        
        return Response(stats)
    
    @action(detail=True, methods=['get'])
    def convert_to(self, request, payment_number=None):
        """
        Convierte el monto del pago a otra moneda
        GET /api/payments/payments/{payment_number}/convert_to/?currency=COP
        """
        payment = self.get_object()
        target_currency = request.query_params.get('currency')
        
        if not target_currency:
            return Response(
                {'error': 'El parámetro "currency" es requerido'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            converted_amount = payment.get_amount_in_currency(target_currency)
            rate = ExchangeRate.get_rate(payment.currency.code, target_currency)
            
            return Response({
                'original_amount': float(payment.amount),
                'original_currency': payment.currency.code,
                'target_currency': target_currency,
                'exchange_rate': float(rate) if rate else None,
                'converted_amount': float(converted_amount)
            })
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


# ============================================================================
# VIEWSETS DE REEMBOLSOS
# ============================================================================

class RefundViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet para reembolsos (solo lectura, se crean desde Payment)
    
    list: Lista todos los reembolsos
    retrieve: Obtiene detalle de un reembolso
    """
    queryset = Refund.objects.all()
    serializer_class = RefundSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['status', 'payment']
    ordering_fields = ['created_at', 'amount']
    ordering = ['-created_at']
    lookup_field = 'refund_number'
    
    def get_queryset(self):
        """Optimiza queries"""
        return super().get_queryset().select_related('payment', 'currency')
    
    @action(detail=True, methods=['post'])
    def complete(self, request, refund_number=None):
        """
        Marca un reembolso como completado
        POST /api/payments/refunds/{refund_number}/complete/
        """
        refund = self.get_object()
        
        if refund.mark_as_completed():
            serializer = self.get_serializer(refund)
            return Response(serializer.data)
        
        return Response(
            {'error': 'No se puede completar el reembolso en su estado actual'},
            status=status.HTTP_400_BAD_REQUEST
        )


# ============================================================================
# VIEWSETS DE CAJA REGISTRADORA
# ============================================================================

class CashRegisterViewSet(viewsets.ModelViewSet):
    """
    ViewSet para cajas registradoras
    
    list: Lista todas las cajas
    retrieve: Obtiene detalle de una caja
    create: Abre una nueva caja
    update: Actualiza una caja
    """
    queryset = CashRegister.objects.all()
    serializer_class = CashRegisterSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['status', 'register_number', 'currency']
    ordering_fields = ['opened_at', 'closed_at']
    ordering = ['-opened_at']
    
    def get_queryset(self):
        """Optimiza queries"""
        return super().get_queryset().select_related('currency')
    
    def get_serializer_class(self):
        """Retorna el serializer apropiado"""
        if self.action == 'create':
            return CashRegisterOpenSerializer
        return CashRegisterSerializer
    
    def create(self, request, *args, **kwargs):
        """Abre una nueva caja registradora"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        cash_register = serializer.save()
        
        detail_serializer = CashRegisterSerializer(cash_register)
        return Response(
            detail_serializer.data,
            status=status.HTTP_201_CREATED
        )
    
    @action(detail=True, methods=['post'])
    def close(self, request, pk=None):
        """
        Cierra una caja registradora
        POST /api/payments/cash-registers/{id}/close/
        Body: {"closing_cash": 500.00, "closing_notes": "..."}
        """
        cash_register = self.get_object()
        
        serializer = CashRegisterCloseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        success, message = cash_register.close_register(
            closing_cash=serializer.validated_data['closing_cash'],
            closing_notes=serializer.validated_data.get('closing_notes', '')
        )
        
        if success:
            detail_serializer = CashRegisterSerializer(cash_register)
            return Response(detail_serializer.data)
        
        return Response(
            {'error': message},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    @action(detail=False, methods=['get'])
    def open_registers(self, request):
        """
        Obtiene cajas abiertas
        GET /api/payments/cash-registers/open_registers/
        """
        registers = self.get_queryset().filter(status='open')
        serializer = self.get_serializer(registers, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def today(self, request):
        """
        Obtiene cajas de hoy
        GET /api/payments/cash-registers/today/
        """
        today = timezone.now().date()
        registers = self.get_queryset().filter(opened_at__date=today)
        serializer = self.get_serializer(registers, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def summary(self, request, pk=None):
        """
        Obtiene resumen de la caja
        GET /api/payments/cash-registers/{id}/summary/
        """
        cash_register = self.get_object()
        
        # Recalcular totales
        cash_register.calculate_totals()
        cash_register.save()
        
        serializer = self.get_serializer(cash_register)
        return Response(serializer.data)


# ============================================================================
# VIEWSETS DE MOVIMIENTOS DE EFECTIVO
# ============================================================================

class CashMovementViewSet(viewsets.ModelViewSet):
    """
    ViewSet para movimientos de efectivo
    
    list: Lista todos los movimientos
    retrieve: Obtiene detalle de un movimiento
    create: Crea un nuevo movimiento
    """
    queryset = CashMovement.objects.all()
    serializer_class = CashMovementSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['cash_register', 'movement_type', 'reason']
    ordering_fields = ['created_at', 'amount']
    ordering = ['-created_at']
    
    def get_queryset(self):
        """Optimiza queries"""
        return super().get_queryset().select_related('cash_register')
    
    @action(detail=False, methods=['get'])
    def by_register(self, request):
        """
        Obtiene movimientos de una caja específica
        GET /api/payments/cash-movements/by_register/?register_id=xxx
        """
        register_id = request.query_params.get('register_id')
        
        if not register_id:
            return Response(
                {'error': 'El parámetro "register_id" es requerido'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        movements = self.get_queryset().filter(cash_register_id=register_id)
        serializer = self.get_serializer(movements, many=True)
        return Response(serializer.data)