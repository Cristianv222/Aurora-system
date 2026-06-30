from rest_framework import serializers
from .models import Shift
from django.utils import timezone
from decimal import Decimal

class ShiftSerializer(serializers.ModelSerializer):
    duration_hours = serializers.SerializerMethodField()
    is_active = serializers.ReadOnlyField()
    total_sales_live = serializers.SerializerMethodField()

    class Meta:
        model = Shift
        fields = [
            'id',
            'shift_number',
            'user_id',
            'user_name',
            'user_role',
            'status',
            'scheduled_start',
            'scheduled_end',
            'opening_cash',
            'closing_cash',
            'total_sales',
            'total_sales_live',
            'total_cash_sales',
            'total_card_sales',
            'total_transfer_sales',
            'total_transactions',
            'cash_difference',
            'opening_notes',
            'closing_notes',
            'opened_at',
            'closed_at',
            'duration_hours',
            'is_active',
        ]
        read_only_fields = [
            'id',
            'shift_number',
            'total_sales',
            'total_cash_sales',
            'total_card_sales',
            'total_transfer_sales',
            'total_transactions',
            'cash_difference',
            'closed_at',
        ]

    def get_duration_hours(self, obj):
        return round(obj.duration, 2)

    def get_total_sales_live(self, obj):
        if obj.status == 'closed':
            return float(obj.total_sales)
        
        # Calculate in real time if open
        if not obj.opened_at:
            return 0.00
        payments = obj.payments.all()
        total = sum(float(p.amount) for p in payments)
        return round(total, 2)


class ShiftCreateSerializer(serializers.ModelSerializer):
    opening_cash = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, default=0.00)
    user_id = serializers.CharField(required=False)
    user_name = serializers.CharField(required=False)
    user_role = serializers.CharField(required=False)
    status = serializers.CharField(required=False, default='open')

    class Meta:
        model = Shift
        fields = [
            'id',
            'shift_number',
            'status',
            'user_id',
            'user_name',
            'user_role',
            'scheduled_start',
            'scheduled_end',
            'opening_cash',
            'opening_notes',
            'opened_at',
        ]
        read_only_fields = [
            'id',
            'shift_number',
            'opened_at',
        ]

    def create(self, validated_data):
        request = self.context.get('request')
        
        # Default user fields from request JWT if not explicitly provided (e.g. when scheduling)
        if 'user_id' not in validated_data:
            validated_data['user_id'] = getattr(request, 'user_id', '') or 'unknown'
        if 'user_name' not in validated_data:
            validated_data['user_name'] = getattr(request, 'username', '') or 'Sistema'
        if 'user_role' not in validated_data:
            validated_data['user_role'] = getattr(request, 'user_role', '') or 'receptionist'
            
        status = validated_data.get('status', 'open')
        if status == 'open':
            validated_data['opened_at'] = timezone.now()
            
        return super().create(validated_data)


class ShiftCloseSerializer(serializers.Serializer):
    closing_cash = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        min_value=0,
        required=False,
        default=0.00,
        help_text='Efectivo contado al cerrar caja'
    )
    closing_notes = serializers.CharField(
        required=False,
        allow_blank=True,
        help_text='Notas adicionales al cerrar'
    )
