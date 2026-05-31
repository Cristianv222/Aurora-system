from rest_framework import serializers
from .models import Floor, Room

class RoomSerializer(serializers.ModelSerializer):
    room_type_display = serializers.CharField(source='get_room_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = Room
        fields = [
            'id', 'floor', 'room_number', 'room_type', 
            'room_type_display', 'price_per_night', 
            'adult_capacity', 'child_capacity', 'status', 'status_display'
        ]

class FloorSerializer(serializers.ModelSerializer):
    rooms = RoomSerializer(many=True, read_only=True)

    class Meta:
        model = Floor
        fields = ['id', 'name', 'order', 'rooms']
