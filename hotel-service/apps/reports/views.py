from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.utils import timezone
from django.db import transaction
from django.db.models import Sum, Count
from datetime import datetime, timedelta
from decimal import Decimal
import logging

from .models import Shift
from .serializers import ShiftSerializer, ShiftCreateSerializer, ShiftCloseSerializer
from apps.reservations.models import Payment, Reservation
from apps.rooms.models import Room

logger = logging.getLogger(__name__)

class ShiftViewSet(viewsets.ModelViewSet):
    """
    Viewset para gestionar turnos de caja de hotel.
    """
    queryset = Shift.objects.all()
    permission_classes = [AllowAny] # For development / frontend requests
    
    def get_serializer_class(self):
        if self.action == 'create':
            return ShiftCreateSerializer
        elif self.action == 'close':
            return ShiftCloseSerializer
        return ShiftSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        # Non-staff/non-superusers see only their shifts
        request = self.request
        if request:
            user_id = getattr(request, 'user_id', None)
            is_staff = getattr(request, 'is_staff', False)
            is_superuser = getattr(request, 'is_superuser', False)
            if user_id and not (is_staff or is_superuser):
                queryset = queryset.filter(user_id=user_id)
        return queryset

    def create(self, request, *args, **kwargs):
        user_id = getattr(request, 'user_id', None)
        if not user_id:
            return Response({'error': 'No se detectó un usuario autenticado.'}, status=status.HTTP_401_UNAUTHORIZED)
            
        status_val = request.data.get('status', 'open')
        if status_val == 'open':
            with transaction.atomic():
                open_shift = Shift.objects.filter(
                    user_id=user_id,
                    status='open'
                ).first()
                
                if open_shift:
                    return Response({
                        'error': 'Ya tienes un turno abierto.',
                        'shift': ShiftSerializer(open_shift).data
                    }, status=status.HTTP_400_BAD_REQUEST)
            
        return super().create(request, *args, **kwargs)

    @action(detail=True, methods=['post'])
    def open_scheduled(self, request, pk=None):
        shift = self.get_object()
        if shift.status != 'scheduled':
            return Response({
                'error': 'Este turno no está programado o ya fue iniciado.'
            }, status=status.HTTP_400_BAD_REQUEST)
            
        opening_cash = request.data.get('opening_cash', 0.00)
        opening_notes = request.data.get('opening_notes', '')
        
        user_id = getattr(request, 'user_id', None)
        if not user_id:
            return Response({'error': 'No se detectó un usuario autenticado.'}, status=status.HTTP_401_UNAUTHORIZED)
            
        open_shift = Shift.objects.filter(
            user_id=user_id,
            status='open'
        ).first()
        
        if open_shift:
            return Response({
                'error': 'Ya tienes otro turno abierto.',
                'shift': ShiftSerializer(open_shift).data
            }, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            now = timezone.now()
            
            # Align the scheduled dates to today's date keeping the configured times from template
            new_sched_start = None
            if shift.scheduled_start:
                local_start = timezone.localtime(shift.scheduled_start)
                local_now = timezone.localtime(now)
                new_sched_start = local_start.replace(
                    year=local_now.year,
                    month=local_now.month,
                    day=local_now.day
                )
                
            new_sched_end = None
            if shift.scheduled_end:
                local_end = timezone.localtime(shift.scheduled_end)
                local_now = timezone.localtime(now)
                new_sched_end = local_end.replace(
                    year=local_now.year,
                    month=local_now.month,
                    day=local_now.day
                )
                if new_sched_start and new_sched_end < new_sched_start:
                    new_sched_end = new_sched_end + timezone.timedelta(days=1)

            # Create a brand new active shift, leaving the scheduled template untouched!
            new_shift = Shift(
                status='open',
                opened_at=now,
                opening_cash=Decimal(str(opening_cash)),
                opening_notes=opening_notes,
                user_id=user_id,
                user_name=getattr(request, 'username', '') or shift.user_name or 'Sistema',
                user_role=getattr(request, 'user_role', '') or shift.user_role or 'receptionist',
                scheduled_start=new_sched_start,
                scheduled_end=new_sched_end
            )
            new_shift.save()
            
            return Response({
                'message': 'Turno programado iniciado exitosamente.',
                'shift': ShiftSerializer(new_shift).data
            })

    @action(detail=True, methods=['post'])
    def close(self, request, pk=None):
        shift = self.get_object()
        
        user_id = getattr(request, 'user_id', None)
        is_staff = getattr(request, 'is_staff', False)
        if user_id and str(shift.user_id) != str(user_id) and not is_staff:
            return Response({
                'error': 'No tienes permiso para cerrar este turno.'
            }, status=status.HTTP_403_FORBIDDEN)
            
        if shift.status != 'open':
            return Response({
                'error': 'El turno ya está cerrado.'
            }, status=status.HTTP_400_BAD_REQUEST)

        serializer = ShiftCloseSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            success, message = shift.close_shift(
                closing_cash=serializer.validated_data['closing_cash'],
                closing_notes=serializer.validated_data.get('closing_notes', '')
            )
            
            if not success:
                return Response({'error': message}, status=status.HTTP_400_BAD_REQUEST)
                
            return Response({
                'message': message,
                'shift': ShiftSerializer(shift).data
            })

    @action(detail=False, methods=['get'])
    def current(self, request):
        user_id = getattr(request, 'user_id', None)
        if not user_id:
            return Response({
                'message': 'No autenticado',
                'shift': None
            })
            
        shift = Shift.objects.filter(
            user_id=user_id,
            status='open'
        ).first()
        
        if not shift:
            return Response({
                'message': 'No hay turnos abiertos',
                'shift': None
            })
            
        # CHECK FOR AUTO-CLOSE
        if shift.scheduled_end and timezone.now() >= shift.scheduled_end:
            with transaction.atomic():
                shift.close_shift(
                    closing_cash=Decimal('0.00'),
                    closing_notes='Cierre automático del sistema al finalizar el horario programado.'
                )
            return Response({
                'message': 'Su turno se ha cerrado automáticamente por finalización de horario.',
                'shift': None,
                'auto_closed': True,
                'closed_shift_id': shift.id
            })
            
        return Response({
            'shift': ShiftSerializer(shift).data
        })

    @action(detail=False, methods=['get'])
    def by_date(self, request):
        date_str = request.query_params.get('date')
        if not date_str:
            return Response({
                'error': 'Debes proporcionar la fecha en formato YYYY-MM-DD'
            }, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response({
                'error': 'Formato de fecha inválido. Usa YYYY-MM-DD'
            }, status=status.HTTP_400_BAD_REQUEST)
            
        shifts = self.get_queryset().filter(opened_at__date=target_date)
        return Response({
            'date': date_str,
            'count': shifts.count(),
            'shifts': ShiftSerializer(shifts, many=True).data
        })

    @action(detail=True, methods=['get'])
    def report(self, request, pk=None):
        shift = self.get_object()
        
        start_time = shift.opened_at
        end_time = shift.closed_at or timezone.now()
        
        payments = shift.payments.all().select_related('reservation', 'reservation__guest', 'reservation__room')
        
        # Payment details
        payment_list = []
        for p in payments:
            payment_list.append({
                'id': p.id,
                'reservation_code': p.reservation.reservation_code,
                'guest_name': p.reservation.guest.name,
                'room_number': p.reservation.room.room_number,
                'amount': float(p.amount),
                'payment_method': p.payment_method,
                'is_deposit': p.is_deposit,
                'created_at': p.created_at
            })
            
        # Calculation totals
        cash_sales = payments.filter(payment_method='cash').aggregate(s=Sum('amount'))['s'] or Decimal('0.00')
        card_sales = payments.filter(payment_method='card').aggregate(s=Sum('amount'))['s'] or Decimal('0.00')
        transfer_sales = payments.filter(payment_method='transfer').aggregate(s=Sum('amount'))['s'] or Decimal('0.00')
        
        total_sales = cash_sales + card_sales + transfer_sales
        
        report_data = {
            'shift_info': ShiftSerializer(shift).data,
            'summary': {
                'total_sales': float(total_sales),
                'cash_sales': float(cash_sales),
                'card_sales': float(card_sales),
                'transfer_sales': float(transfer_sales),
                'total_transactions': payments.count()
            },
            'payments': payment_list
        }
        return Response(report_data)


class HotelReportViewSet(viewsets.ViewSet):
    """
    ViewSet para reportes globales e indicadores de ocupación/ventas en el hotel.
    """
    permission_classes = [AllowAny]

    @action(detail=False, methods=['get'])
    def dashboard_stats(self, request):
        now_local = timezone.localtime(timezone.now())
        today = now_local.date()
        yesterday = today - timedelta(days=1)
        
        # Room status count
        rooms = Room.objects.all()
        total_rooms = rooms.count()
        rooms_available = rooms.filter(status='available').count()
        rooms_occupied = rooms.filter(status='occupied').count()
        rooms_cleaning = rooms.filter(status='cleaning').count()
        rooms_maintenance = rooms.filter(status='maintenance').count()
        
        occupancy_rate = (rooms_occupied / total_rooms * 100) if total_rooms > 0 else 0
        
        # Today's vs Yesterday's Sales
        payments_today = Payment.objects.filter(created_at__date=today)
        sales_today = payments_today.aggregate(s=Sum('amount'))['s'] or Decimal('0.00')
        transactions_today = payments_today.count()
        
        payments_yesterday = Payment.objects.filter(created_at__date=yesterday)
        sales_yesterday = payments_yesterday.aggregate(s=Sum('amount'))['s'] or Decimal('0.00')
        transactions_yesterday = payments_yesterday.count()
        
        active_shifts = Shift.objects.filter(status='open').count()
        
        # 7-day revenue trend
        sales_last_7_days = []
        for i in range(7):
            day = today - timedelta(days=i)
            day_p = Payment.objects.filter(created_at__date=day)
            day_sales = day_p.aggregate(s=Sum('amount'))['s'] or Decimal('0.00')
            sales_last_7_days.append({
                'date': day.strftime('%Y-%m-%d'),
                'sales': float(day_sales)
            })
            
        sales_last_7_days.reverse()
        
        stats = {
            'rooms': {
                'total': total_rooms,
                'available': rooms_available,
                'occupied': rooms_occupied,
                'cleaning': rooms_cleaning,
                'maintenance': rooms_maintenance,
                'occupancy_rate': round(occupancy_rate, 2)
            },
            'sales': {
                'today': float(sales_today),
                'today_transactions': transactions_today,
                'yesterday': float(sales_yesterday),
                'yesterday_transactions': transactions_yesterday,
                'active_shifts': active_shifts
            },
            'trend': sales_last_7_days
        }
        return Response(stats)

    @action(detail=False, methods=['get'])
    def occupancy(self, request):
        rooms = Room.objects.all().order_by('room_number')
        occupied_rooms_list = []
        
        active_reservations = Reservation.objects.filter(status='active').select_related('guest', 'room')
        for r in active_reservations:
            occupied_rooms_list.append({
                'room_number': r.room.room_number,
                'room_type': r.room.room_type.name if r.room.room_type else '',
                'guest_name': r.guest.name,
                'guest_nationality': r.guest.nationality,
                'check_in_date': r.check_in_date,
                'planned_check_out': r.planned_check_out,
                'nights_count': (timezone.localtime(r.planned_check_out).date() - timezone.localtime(r.check_in_date).date()).days if r.planned_check_out else 1,
                'checked_in_by': r.checked_in_by
            })
            
        return Response({
            'rooms_total': rooms.count(),
            'rooms_occupied': active_reservations.count(),
            'occupied_detail': occupied_rooms_list
        })

    @action(detail=False, methods=['get'])
    def revenue(self, request):
        start_date_str = request.query_params.get('start_date')
        end_date_str = request.query_params.get('end_date')
        
        now_local = timezone.localtime(timezone.now())
        today = now_local.date()
        
        if start_date_str and end_date_str:
            try:
                start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
                end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
            except ValueError:
                return Response({'error': 'Formatos de fecha inválidos (YYYY-MM-DD)'}, status=status.HTTP_400_BAD_REQUEST)
        else:
            # Last 30 days by default
            start_date = today - timedelta(days=30)
            end_date = today
            
        payments = Payment.objects.filter(created_at__date__gte=start_date, created_at__date__lte=end_date)
        
        # Group by method
        cash_sales = payments.filter(payment_method='cash').aggregate(s=Sum('amount'))['s'] or Decimal('0.00')
        card_sales = payments.filter(payment_method='card').aggregate(s=Sum('amount'))['s'] or Decimal('0.00')
        transfer_sales = payments.filter(payment_method='transfer').aggregate(s=Sum('amount'))['s'] or Decimal('0.00')
        
        total_sales = cash_sales + card_sales + transfer_sales
        
        # Revenue by Room Type (room_type is now a FK, filter by name)
        from apps.rooms.models import RoomType
        room_types_rev = {}
        for rt in RoomType.objects.all():
            type_payments = payments.filter(reservation__room__room_type=rt)
            type_rev = type_payments.aggregate(s=Sum('amount'))['s'] or Decimal('0.00')
            room_types_rev[rt.name] = float(type_rev)
            
        return Response({
            'start_date': start_date.strftime('%Y-%m-%d'),
            'end_date': end_date.strftime('%Y-%m-%d'),
            'total_sales': float(total_sales),
            'by_method': {
                'cash': float(cash_sales),
                'card': float(card_sales),
                'transfer': float(transfer_sales)
            },
            'by_room_type': room_types_rev
        })
