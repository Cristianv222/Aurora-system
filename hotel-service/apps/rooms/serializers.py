from rest_framework import serializers
from .models import Floor, Room, RoomType

class RoomTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = RoomType
        fields = [
            'id', 'name', 'price_per_adult', 'price_per_child', 
            'adult_capacity', 'child_capacity'
        ]

class RoomSerializer(serializers.ModelSerializer):
    room_type_display = serializers.CharField(source='room_type.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    price_per_adult = serializers.ReadOnlyField()
    price_per_child = serializers.ReadOnlyField()
    price_per_night = serializers.ReadOnlyField()
    adult_capacity = serializers.ReadOnlyField()
    child_capacity = serializers.ReadOnlyField()

    class Meta:
        model = Room
        fields = [
            'id', 'floor', 'room_number', 'room_type', 
            'room_type_display', 'price_per_adult', 'price_per_child',
            'price_per_night', 'adult_capacity', 'child_capacity', 
            'status', 'status_display'
        ]

class FloorSerializer(serializers.ModelSerializer):
    rooms = RoomSerializer(many=True, read_only=True)

    class Meta:
        model = Floor
        fields = ['id', 'name', 'order', 'rooms']
