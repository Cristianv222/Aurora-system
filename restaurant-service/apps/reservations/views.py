from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone
from django.db.models import Q, Count
from datetime import date, datetime, timedelta
import logging

from .models import Reservation, ReservationNote
from .serializers import (
    ReservationSerializer,
    ReservationListSerializer,
    ReservationCreateSerializer,
    ReservationUpdateSerializer,
    ReservationNoteSerializer,
)

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────
# LISTADO Y CREACIÓN
# ─────────────────────────────────────────────

@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def reservation_list_create(request):
    """
    GET  /restaurant/api/reservations/          — Listar reservaciones (con filtros)
    POST /restaurant/api/reservations/          — Crear nueva reservación
    """
    if request.method == 'GET':
        queryset = Reservation.objects.select_related('table', 'customer').all()

        # Filtros opcionales
        filter_date = request.query_params.get('date')
        filter_status = request.query_params.get('status')
        filter_table = request.query_params.get('table')
        search = request.query_params.get('search')

        if filter_date:
            queryset = queryset.filter(reservation_date=filter_date)
        if filter_status:
            queryset = queryset.filter(status=filter_status)
        if filter_table:
            queryset = queryset.filter(table__number__icontains=filter_table)
        if search:
            queryset = queryset.filter(
                Q(guest_name__icontains=search) |
                Q(guest_phone__icontains=search) |
                Q(reservation_number__icontains=search)
            )

        queryset = queryset.order_by('reservation_date', 'reservation_time')
        serializer = ReservationListSerializer(queryset, many=True)
        return Response({'status': 'success', 'data': serializer.data})

    # POST — Crear
    serializer = ReservationCreateSerializer(data=request.data, context={'request': request})
    if serializer.is_valid():
        reservation = serializer.save()
        return Response(
            {'status': 'success', 'message': 'Reservación creada exitosamente',
             'data': ReservationSerializer(reservation).data},
            status=status.HTTP_201_CREATED
        )
    return Response(
        {'status': 'error', 'message': 'Error al crear la reservación', 'errors': serializer.errors},
        status=status.HTTP_400_BAD_REQUEST
    )


# ─────────────────────────────────────────────
# DETALLE, ACTUALIZACIÓN Y ELIMINACIÓN
# ─────────────────────────────────────────────

@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([AllowAny])
def reservation_detail(request, pk):
    """
    GET    /restaurant/api/reservations/{id}/   — Detalle
    PATCH  /restaurant/api/reservations/{id}/   — Actualizar datos
    DELETE /restaurant/api/reservations/{id}/   — Cancelar / eliminar
    """
    try:
        reservation = Reservation.objects.select_related('table', 'customer').get(pk=pk)
    except Reservation.DoesNotExist:
        return Response(
            {'status': 'error', 'message': 'Reservación no encontrada'},
            status=status.HTTP_404_NOT_FOUND
        )

    if request.method == 'GET':
        return Response({'status': 'success', 'data': ReservationSerializer(reservation).data})

    if request.method == 'PATCH':
        serializer = ReservationUpdateSerializer(reservation, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(
                {'status': 'success', 'message': 'Reservación actualizada',
                 'data': ReservationSerializer(reservation).data}
            )
        return Response(
            {'status': 'error', 'message': 'Error al actualizar', 'errors': serializer.errors},
            status=status.HTTP_400_BAD_REQUEST
        )

    if request.method == 'DELETE':
        ok, msg = reservation.cancel(reason='Eliminada por el sistema')
        if ok:
            return Response({'status': 'success', 'message': msg})
        return Response({'status': 'error', 'message': msg}, status=status.HTTP_400_BAD_REQUEST)


# ─────────────────────────────────────────────
# ACCIONES DE ESTADO
# ─────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([AllowAny])
def reservation_confirm(request, pk):
    """POST /restaurant/api/reservations/{id}/confirm/"""
    try:
        reservation = Reservation.objects.get(pk=pk)
    except Reservation.DoesNotExist:
        return Response({'status': 'error', 'message': 'Reservación no encontrada'}, status=404)

    ok, msg = reservation.confirm()
    if ok:
        return Response({'status': 'success', 'message': msg,
                         'data': ReservationSerializer(reservation).data})
    return Response({'status': 'error', 'message': msg}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([AllowAny])
def reservation_seat(request, pk):
    """POST /restaurant/api/reservations/{id}/seat/"""
    try:
        reservation = Reservation.objects.get(pk=pk)
    except Reservation.DoesNotExist:
        return Response({'status': 'error', 'message': 'Reservación no encontrada'}, status=404)

    ok, msg = reservation.seat()
    if ok:
        return Response({'status': 'success', 'message': msg,
                         'data': ReservationSerializer(reservation).data})
    return Response({'status': 'error', 'message': msg}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([AllowAny])
def reservation_complete(request, pk):
    """POST /restaurant/api/reservations/{id}/complete/"""
    try:
        reservation = Reservation.objects.get(pk=pk)
    except Reservation.DoesNotExist:
        return Response({'status': 'error', 'message': 'Reservación no encontrada'}, status=404)

    ok, msg = reservation.complete()
    if ok:
        return Response({'status': 'success', 'message': msg,
                         'data': ReservationSerializer(reservation).data})
    return Response({'status': 'error', 'message': msg}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([AllowAny])
def reservation_cancel(request, pk):
    """POST /restaurant/api/reservations/{id}/cancel/"""
    try:
        reservation = Reservation.objects.get(pk=pk)
    except Reservation.DoesNotExist:
        return Response({'status': 'error', 'message': 'Reservación no encontrada'}, status=404)

    reason = request.data.get('reason', '')
    ok, msg = reservation.cancel(reason=reason)
    if ok:
        return Response({'status': 'success', 'message': msg,
                         'data': ReservationSerializer(reservation).data})
    return Response({'status': 'error', 'message': msg}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([AllowAny])
def reservation_no_show(request, pk):
    """POST /restaurant/api/reservations/{id}/no-show/"""
    try:
        reservation = Reservation.objects.get(pk=pk)
    except Reservation.DoesNotExist:
        return Response({'status': 'error', 'message': 'Reservación no encontrada'}, status=404)

    ok, msg = reservation.mark_no_show()
    if ok:
        return Response({'status': 'success', 'message': msg,
                         'data': ReservationSerializer(reservation).data})
    return Response({'status': 'error', 'message': msg}, status=status.HTTP_400_BAD_REQUEST)


# ─────────────────────────────────────────────
# NOTAS
# ─────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([AllowAny])
def reservation_add_note(request, pk):
    """POST /restaurant/api/reservations/{id}/notes/"""
    try:
        reservation = Reservation.objects.get(pk=pk)
    except Reservation.DoesNotExist:
        return Response({'status': 'error', 'message': 'Reservación no encontrada'}, status=404)

    content = request.data.get('content', '').strip()
    if not content:
        return Response({'status': 'error', 'message': 'El contenido de la nota es requerido'},
                        status=status.HTTP_400_BAD_REQUEST)

    created_by = request.data.get('created_by', '')
    note = ReservationNote.objects.create(
        reservation=reservation,
        content=content,
        created_by=created_by
    )
    return Response(
        {'status': 'success', 'message': 'Nota agregada',
         'data': ReservationNoteSerializer(note).data},
        status=status.HTTP_201_CREATED
    )


# ─────────────────────────────────────────────
# RESERVAS DE HOY
# ─────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([AllowAny])
def reservations_today(request):
    """GET /restaurant/api/reservations/today/"""
    today = date.today()
    reservations = (
        Reservation.objects
        .select_related('table', 'customer')
        .filter(reservation_date=today)
        .order_by('reservation_time')
    )
    serializer = ReservationListSerializer(reservations, many=True)
    return Response({'status': 'success', 'data': serializer.data})


# ─────────────────────────────────────────────
# MESAS DISPONIBLES PARA UN HORARIO
# ─────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([AllowAny])
def available_tables(request):
    """
    GET /restaurant/api/reservations/available-tables/
    Query params: date, time, party_size, duration (minutos, opcional, default 90)

    Devuelve las mesas con capacidad suficiente y sin conflicto de horario
    para ser usadas en el croquis.
    """
    from apps.pos.models import Table

    req_date_str = request.query_params.get('date')
    req_time_str = request.query_params.get('time')
    party_size = int(request.query_params.get('party_size', 1))
    duration = int(request.query_params.get('duration', 90))

    # Obtener todas las mesas activas con capacidad suficiente
    all_tables = Table.objects.filter(is_active=True, capacity__gte=party_size)

    if not req_date_str or not req_time_str:
        # Sin filtro de horario, devolver todas las mesas activas
        tables_data = [
            {
                'id': str(t.id),
                'number': t.number,
                'name': t.name,
                'capacity': t.capacity,
                'status': t.status,
                'section': t.section,
            }
            for t in all_tables
        ]
        return Response({'status': 'success', 'data': tables_data})

    try:
        req_date = datetime.strptime(req_date_str, '%Y-%m-%d').date()
        req_time = datetime.strptime(req_time_str, '%H:%M').time()
    except ValueError:
        return Response(
            {'status': 'error', 'message': 'Formato de fecha/hora inválido. Use YYYY-MM-DD y HH:MM'},
            status=status.HTTP_400_BAD_REQUEST
        )

    req_start = datetime.combine(req_date, req_time)
    req_end = req_start + timedelta(minutes=duration)

    # Obtener mesas con reservas que se solapan con el horario pedido
    conflicting_reservations = Reservation.objects.filter(
        reservation_date=req_date,
        status__in=['pending', 'confirmed', 'seated']
    ).select_related('table')

    busy_table_ids = set()
    for res in conflicting_reservations:
        if res.table_id is None:
            continue
        ex_start = datetime.combine(res.reservation_date, res.reservation_time)
        ex_end = ex_start + timedelta(minutes=res.duration_minutes)
        if req_start < ex_end and req_end > ex_start:
            busy_table_ids.add(str(res.table_id))

    tables_data = []
    for t in all_tables:
        if str(t.id) in busy_table_ids:
            tbl_status = 'reserved'
        elif t.status == 'occupied':
            tbl_status = 'occupied'
        else:
            tbl_status = 'available'

        tables_data.append({
            'id': str(t.id),
            'number': t.number,
            'name': t.name,
            'capacity': t.capacity,
            'status': tbl_status,
            'section': t.section,
        })

    return Response({'status': 'success', 'data': tables_data})


# ─────────────────────────────────────────────
# ESTADO DEL CROQUIS (para la vista de reservaciones)
# ─────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([AllowAny])
def croquis_status(request):
    """
    GET /restaurant/api/reservations/croquis/
    Devuelve todas las mesas con su estado actual + info de reserva activa si existe.
    Incluye flag 'upcoming' cuando la reserva llega en menos de 2 horas.
    """
    from apps.pos.models import Table

    now = timezone.now()
    today = now.date()
    two_hours_later = now + timedelta(hours=2)

    all_tables = Table.objects.filter(is_active=True)

    # Reservas activas hoy (pendientes, confirmadas, sentadas)
    active_reservations = Reservation.objects.filter(
        reservation_date=today,
        status__in=['confirmed', 'seated', 'pending']
    ).select_related('table')

    # Construir mapa mesa -> reserva
    table_reservation_map = {}
    for res in active_reservations:
        if res.table_id:
            # Si la mesa ya tiene una reserva, priorizar la más próxima
            existing = table_reservation_map.get(str(res.table_id))
            if not existing:
                table_reservation_map[str(res.table_id)] = res
            else:
                # Quedarse con la reserva cuya hora de llegada sea más cercana al ahora
                existing_dt = timezone.make_aware(
                    datetime.combine(existing.reservation_date, existing.reservation_time)
                )
                res_dt = timezone.make_aware(
                    datetime.combine(res.reservation_date, res.reservation_time)
                )
                if abs((res_dt - now).total_seconds()) < abs((existing_dt - now).total_seconds()):
                    table_reservation_map[str(res.table_id)] = res

    tables_data = []
    for t in all_tables:
        res = table_reservation_map.get(str(t.id))
        table_info = {
            'id': str(t.id),
            'number': t.number,
            'name': t.name,
            'capacity': t.capacity,
            'section': t.section,
            'status': t.status,
            'reservation': None,
        }
        if res:
            # Calcular si la reserva llega en las próximas 2 horas
            res_datetime = timezone.make_aware(
                datetime.combine(res.reservation_date, res.reservation_time)
            )
            minutes_until = (res_datetime - now).total_seconds() / 60

            is_upcoming = (
                res.status in ('pending', 'confirmed')
                and 0 <= minutes_until <= 120
            )

            # Forzar estado visual
            if t.status == 'available':
                table_info['status'] = 'upcoming' if is_upcoming else 'reserved'
            elif is_upcoming and t.status == 'reserved':
                table_info['status'] = 'upcoming'

            table_info['reservation'] = {
                'id': str(res.id),
                'reservation_number': res.reservation_number,
                'guest_name': res.guest_name,
                'guest_phone': getattr(res, 'guest_phone', ''),
                'party_size': res.party_size,
                'reservation_time': res.reservation_time.strftime('%H:%M'),
                'reservation_date': res.reservation_date.strftime('%Y-%m-%d'),
                'status': res.status,
                'occasion': res.occasion,
                'minutes_until': round(minutes_until) if minutes_until >= 0 else None,
                'is_upcoming': is_upcoming,
            }
        tables_data.append(table_info)

    return Response({'status': 'success', 'data': tables_data})



# ─────────────────────────────────────────────
# ESTADÍSTICAS
# ─────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([AllowAny])
def reservation_stats(request):
    """GET /restaurant/api/reservations/stats/"""
    today = date.today()
    week_start = today - timedelta(days=today.weekday())
    month_start = today.replace(day=1)

    stats = {
        'today': {
            'total': Reservation.objects.filter(reservation_date=today).count(),
            'pending': Reservation.objects.filter(reservation_date=today, status='pending').count(),
            'confirmed': Reservation.objects.filter(reservation_date=today, status='confirmed').count(),
            'seated': Reservation.objects.filter(reservation_date=today, status='seated').count(),
            'completed': Reservation.objects.filter(reservation_date=today, status='completed').count(),
            'cancelled': Reservation.objects.filter(reservation_date=today, status='cancelled').count(),
            'no_show': Reservation.objects.filter(reservation_date=today, status='no_show').count(),
        },
        'this_week': {
            'total': Reservation.objects.filter(reservation_date__gte=week_start).count(),
            'completed': Reservation.objects.filter(
                reservation_date__gte=week_start, status='completed').count(),
            'cancelled': Reservation.objects.filter(
                reservation_date__gte=week_start, status='cancelled').count(),
            'no_show': Reservation.objects.filter(
                reservation_date__gte=week_start, status='no_show').count(),
        },
        'this_month': {
            'total': Reservation.objects.filter(reservation_date__gte=month_start).count(),
        },
        'all_time': {
            'total': Reservation.objects.count(),
        }
    }
    return Response({'status': 'success', 'data': stats})


# ─────────────────────────────────────────────
# HEALTH CHECK
# ─────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([AllowAny])
def health_check(request):
    """GET /restaurant/api/reservations/health/"""
    try:
        count = Reservation.objects.count()
        db_status = 'healthy'
    except Exception as e:
        count = 0
        db_status = f'error: {str(e)}'

    return Response({
        'status': 'ok',
        'service': 'restaurant-reservations',
        'timestamp': timezone.now().isoformat(),
        'database': {'status': db_status, 'reservations_count': count},
    })
