from rest_framework import serializers
from django.utils import timezone
from datetime import date, timedelta

from .models import Reservation, ReservationNote


class ReservationNoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReservationNote
        fields = ['id', 'reservation', 'content', 'created_by', 'created_at']
        read_only_fields = ['id', 'reservation', 'created_at']


class ReservationSerializer(serializers.ModelSerializer):
    """Serializador completo para lectura"""
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    occasion_display = serializers.CharField(source='get_occasion_display', read_only=True)
    table_number = serializers.SerializerMethodField()
    table_section = serializers.SerializerMethodField()
    customer_name = serializers.SerializerMethodField()
    notes = ReservationNoteSerializer(many=True, read_only=True)

    class Meta:
        model = Reservation
        fields = [
            'id', 'reservation_number',
            # Cliente
            'customer', 'customer_name',
            'guest_name', 'guest_phone', 'guest_email',
            # Mesa
            'table', 'table_number', 'table_section',
            # Datos
            'party_size', 'reservation_date', 'reservation_time', 'duration_minutes',
            # Estado
            'status', 'status_display',
            # Info adicional
            'special_requests', 'occasion', 'occasion_display',
            # Quién creó
            'created_by_id', 'created_by_name',
            # Cancelación
            'cancellation_reason',
            # Timestamps
            'created_at', 'updated_at', 'confirmed_at', 'seated_at',
            'completed_at', 'cancelled_at',
            # Notas
            'notes',
        ]
        read_only_fields = [
            'id', 'reservation_number', 'status_display', 'occasion_display',
            'table_number', 'table_section', 'customer_name', 'notes',
            'created_at', 'updated_at', 'confirmed_at', 'seated_at',
            'completed_at', 'cancelled_at',
        ]

    def get_table_number(self, obj):
        return obj.table.number if obj.table else None

    def get_table_section(self, obj):
        return obj.table.section if obj.table else None

    def get_customer_name(self, obj):
        if obj.customer:
            return obj.customer.get_full_name()
        return obj.guest_name


class ReservationCreateSerializer(serializers.ModelSerializer):
    """Serializador para crear una nueva reservación"""

    class Meta:
        model = Reservation
        fields = [
            'guest_name', 'guest_phone', 'guest_email',
            'customer',
            'table',
            'party_size', 'reservation_date', 'reservation_time', 'duration_minutes',
            'special_requests', 'occasion',
        ]

    def validate_reservation_date(self, value):
        if value < date.today():
            raise serializers.ValidationError('La fecha de reserva no puede ser en el pasado.')
        return value

    def validate(self, data):
        table = data.get('table')
        reservation_date = data.get('reservation_date')
        reservation_time = data.get('reservation_time')
        duration = data.get('duration_minutes', 90)
        party_size = data.get('party_size', 1)

        if table and reservation_date and reservation_time:
            # Verificar capacidad
            if table.capacity < party_size:
                raise serializers.ValidationError({
                    'table': f'La mesa {table.number} solo tiene capacidad para {table.capacity} personas.'
                })

            # Verificar conflicto de horario
            from datetime import datetime, timedelta
            req_start = datetime.combine(reservation_date, reservation_time)
            req_end = req_start + timedelta(minutes=duration)

            conflicting = Reservation.objects.filter(
                table=table,
                reservation_date=reservation_date,
                status__in=['pending', 'confirmed', 'seated']
            ).exclude(pk=self.instance.pk if self.instance else None)

            for existing in conflicting:
                ex_start = datetime.combine(existing.reservation_date, existing.reservation_time)
                ex_end = ex_start + timedelta(minutes=existing.duration_minutes)
                # Si hay solapamiento
                if req_start < ex_end and req_end > ex_start:
                    raise serializers.ValidationError({
                        'table': (
                            f'La mesa {table.number} ya tiene una reservación '
                            f'({existing.reservation_number}) entre las '
                            f'{existing.reservation_time.strftime("%H:%M")} y '
                            f'{ex_end.strftime("%H:%M")} ese día.'
                        )
                    })

        return data

    def create(self, validated_data):
        request = self.context.get('request')
        if request and getattr(request, 'user_data', None):
            validated_data['created_by_id'] = str(request.user_data.get('user_id', ''))
            validated_data['created_by_name'] = request.user_data.get('full_name', '')
        return super().create(validated_data)


class ReservationUpdateSerializer(serializers.ModelSerializer):
    """Serializador para actualizar datos básicos de una reservación"""

    class Meta:
        model = Reservation
        fields = [
            'guest_name', 'guest_phone', 'guest_email',
            'customer',
            'table',
            'party_size', 'reservation_date', 'reservation_time', 'duration_minutes',
            'special_requests', 'occasion',
        ]

    def validate_reservation_date(self, value):
        if value < date.today():
            raise serializers.ValidationError('La fecha de reserva no puede ser en el pasado.')
        return value


class ReservationListSerializer(serializers.ModelSerializer):
    """Versión ligera para listados"""
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    occasion_display = serializers.CharField(source='get_occasion_display', read_only=True)
    table_number = serializers.SerializerMethodField()

    class Meta:
        model = Reservation
        fields = [
            'id', 'reservation_number',
            'guest_name', 'guest_phone', 'guest_email',
            'party_size', 'reservation_date', 'reservation_time', 'duration_minutes',
            'table', 'table_number',
            'status', 'status_display',
            'occasion', 'occasion_display',
            'special_requests',
            'created_at',
        ]

    def get_table_number(self, obj):
        return obj.table.number if obj.table else None
