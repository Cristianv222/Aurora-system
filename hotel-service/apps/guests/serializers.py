from rest_framework import serializers
from .models import Guest

class GuestSerializer(serializers.ModelSerializer):
    identification_type_display = serializers.CharField(source='get_identification_type_display', read_only=True)

    class Meta:
        model = Guest
        fields = [
            'id', 'identification_type', 'identification_type_display',
            'identification', 'name', 'email', 'phone', 'address',
            'nationality', 'origin_city',
            'created_at', 'updated_at'
        ]
