from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from core.permissions import IsJWTAuthenticated
from .models import Floor, Room
from .serializers import FloorSerializer, RoomSerializer
from django.utils import timezone
from django.utils.dateparse import parse_datetime

class FloorViewSet(viewsets.ModelViewSet):
    queryset = Floor.objects.all()
    serializer_class = FloorSerializer
    permission_classes = [IsJWTAuthenticated]

class RoomViewSet(viewsets.ModelViewSet):
    queryset = Room.objects.all()
    serializer_class = RoomSerializer
    permission_classes = [IsJWTAuthenticated]

    @action(detail=True, methods=['post'], url_path='set-cleaning')
    def set_cleaning(self, request, pk=None):
        """Cambia el estado de la habitación a Limpieza"""
        room = self.get_object()
        room.status = 'cleaning'
        room.save()
        return Response({
            'status': 'success',
            'message': f'Habitación {room.room_number} marcada en limpieza.'
        })

    @action(detail=True, methods=['post'], url_path='set-available')
    def set_available(self, request, pk=None):
        """Cambia el estado de la habitación a Disponible"""
        room = self.get_object()
        room.status = 'available'
        room.save()
        return Response({
            'status': 'success',
            'message': f'Habitación {room.room_number} marcada como disponible.'
        })

    @action(detail=False, methods=['get'], url_path='availability')
    def availability(self, request):
        """
        Retorna las habitaciones disponibles en un rango de fechas.
        """
        check_in_str = request.query_params.get('check_in')
        check_out_str = request.query_params.get('check_out')

        if not check_in_str or not check_out_str:
            return Response({'error': 'Parámetros check_in y check_out son requeridos.'}, status=status.HTTP_400_BAD_REQUEST)

        dt_in = parse_datetime(check_in_str)
        dt_out = parse_datetime(check_out_str)

        if not dt_in or not dt_out:
            return Response({'error': 'Fechas con formato inválido.'}, status=status.HTTP_400_BAD_REQUEST)

        if timezone.is_naive(dt_in):
            dt_in = timezone.make_aware(dt_in)
        if timezone.is_naive(dt_out):
            dt_out = timezone.make_aware(dt_out)

        from apps.reservations.models import Reservation
        overlapping_reservations = Reservation.objects.filter(
            status__in=['active', 'reserved']
        ).filter(
            check_in_date__lt=dt_out
        )

        overlapping_room_ids = []
        for res in overlapping_reservations:
            res_end = res.planned_check_out or res.check_out_date
            if res_end:
                if dt_in < res_end and dt_out > res.check_in_date:
                    overlapping_room_ids.append(res.room_id)

        rooms = Room.objects.exclude(id__in=overlapping_room_ids)
        serializer = RoomSerializer(rooms, many=True)
        return Response(serializer.data)

