from rest_framework import serializers
from .models import Reservation, Payment, SRIConfiguration, HotelSettings
from apps.rooms.serializers import RoomSerializer
from apps.guests.serializers import GuestSerializer
from apps.rooms.models import Room
from apps.guests.models import Guest

class PaymentSerializer(serializers.ModelSerializer):
    payment_method_display = serializers.CharField(source='get_payment_method_display', read_only=True)
    sri_status_display = serializers.CharField(source='get_sri_status_display', read_only=True)

    class Meta:
        model = Payment
        fields = [
            'id', 'reservation', 'amount', 'payment_method', 
            'payment_method_display', 'sri_access_key', 
            'sri_number', 'sri_status', 'sri_status_display', 'is_deposit', 'created_at'
        ]

class ReservationSerializer(serializers.ModelSerializer):
    room_details = RoomSerializer(source='room', read_only=True)
    guest_details = GuestSerializer(source='guest', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    payments = PaymentSerializer(many=True, read_only=True)
    nights_count = serializers.SerializerMethodField()
    total_estimated = serializers.SerializerMethodField()

    class Meta:
        model = Reservation
        fields = [
            'id', 'room', 'room_details', 'guest', 'guest_details', 
            'check_in_date', 'check_out_date', 'planned_check_out',
            'number_of_adults', 'number_of_children', 'total_amount', 
            'deposit_amount', 'deposit_paid', 'reservation_code', 'notes',
            'status', 'status_display', 'payments', 'nights_count', 'total_estimated',
            'created_at', 'updated_at'
        ]

    def get_nights_count(self, obj):
        check_in = obj.check_in_date
        check_out = obj.planned_check_out or obj.check_out_date
        if check_in and check_out:
            delta = check_out - check_in
            nights = delta.days
            if nights <= 0:
                nights = 1
            return nights
        return 0

    def get_total_estimated(self, obj):
        nights = self.get_nights_count(obj)
        return float(obj.room.price_per_night) * nights

    def validate(self, data):
        # Validate room capacity
        room = data.get('room')
        if not room:
            room = self.instance.room if self.instance else None

        if room:
            adults = data.get('number_of_adults', 1 if not self.instance else self.instance.number_of_adults)
            children = data.get('number_of_children', 0 if not self.instance else self.instance.number_of_children)
            if adults > room.adult_capacity:
                raise serializers.ValidationError(
                    f"El número de adultos ({adults}) supera la capacidad máxima de la habitación ({room.adult_capacity})."
                )
            if children > room.child_capacity:
                raise serializers.ValidationError(
                    f"El número de niños ({children}) supera la capacidad máxima de la habitación ({room.child_capacity})."
                )

        # Validate date overlap
        check_in = data.get('check_in_date')
        planned_check_out = data.get('planned_check_out')
        status = data.get('status', 'active')

        if not check_in:
            check_in = self.instance.check_in_date if self.instance else None
        if not planned_check_out:
            planned_check_out = self.instance.planned_check_out if self.instance else None

        if check_in and planned_check_out:
            if check_in >= planned_check_out:
                raise serializers.ValidationError(
                    "La fecha de entrada debe ser anterior a la fecha de salida planeada."
                )

            # Find overlapping reservations
            overlapping = Reservation.objects.filter(
                room=room,
                status__in=['active', 'reserved']
            )
            if self.instance:
                overlapping = overlapping.exclude(id=self.instance.id)

            for res in overlapping:
                res_end = res.planned_check_out or res.check_out_date
                if not res_end:
                    continue
                if check_in < res_end and planned_check_out > res.check_in_date:
                    raise serializers.ValidationError(
                        f"La habitación {room.room_number} ya está reservada u ocupada del {res.check_in_date.strftime('%Y-%m-%d %H:%M')} al {res_end.strftime('%Y-%m-%d %H:%M')}."
                    )

        return data

class SRIConfigurationSerializer(serializers.ModelSerializer):
    vsr_token = serializers.CharField(write_only=True, required=False, allow_blank=True)
    has_token = serializers.SerializerMethodField()

    class Meta:
        model = SRIConfiguration
        fields = [
            'id', 'is_active', 'vsr_token', 'has_token', 
            'environment', 'establishment_code', 'emission_point'
        ]

    def get_has_token(self, obj):
        return bool(obj.encrypted_vsr_token)

    def update(self, instance, validated_data):
        vsr_token = validated_data.pop('vsr_token', None)
        if vsr_token is not None:
            instance.vsr_token = vsr_token
        return super().update(instance, validated_data)

    def create(self, validated_data):
        vsr_token = validated_data.pop('vsr_token', None)
        instance = super().create(validated_data)
        if vsr_token is not None:
            instance.vsr_token = vsr_token
            instance.save()
        return instance

class HotelSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = HotelSettings
        fields = '__all__'

