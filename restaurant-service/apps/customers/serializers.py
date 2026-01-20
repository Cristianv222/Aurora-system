from rest_framework import serializers
from django.contrib.auth import authenticate
from django.utils import timezone
from .models import (
    Customer, CustomerAddress, CustomerNote, 
    CustomerLoyalty, CustomerLoyaltyHistory, CustomerDevice
)

class CustomerSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    loyalty_points = serializers.SerializerMethodField()
    customer_since_days = serializers.SerializerMethodField()
    
    class Meta:
        model = Customer
        fields = [
            'id', 'email', 'phone', 'cedula', 'first_name', 'last_name', 'full_name', # <-- CEDULA AÑADIDA
            'birth_date', 'gender', 'address', 'city', 'state', 'zip_code', 'country',
            'customer_type', 'is_active', 'is_vip', 'preferences',
            'total_orders', 'total_spent', 'last_order_date', 'average_order_value',
            'newsletter_subscribed', 'marketing_emails', 'marketing_sms',
            'loyalty_points', 'customer_since_days',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'total_orders', 'total_spent', 'last_order_date', 
            'average_order_value', 'created_at', 'updated_at'
        ]
        extra_kwargs = {
            'email': {'required': True},
            'phone': {'required': True},
            'first_name': {'required': True},
            'last_name': {'required': True},
            # CEDULA NO DEBE SER REQUERIDA AQUÍ si se maneja como opcional/nulleable
        }
    
    def get_full_name(self, obj):
        return obj.get_full_name()
    
    def get_loyalty_points(self, obj):
        try:
            return obj.loyalty.points_balance
        except CustomerLoyalty.DoesNotExist:
            return 0
    
    def get_customer_since_days(self, obj):
        return obj.customer_since

class CustomerCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8, style={'input_type': 'password'}, required=False)
    password_confirmation = serializers.CharField(write_only=True, style={'input_type': 'password'}, required=False)
    
    class Meta:
        model = Customer
        fields = [
            'email', 'phone', 'cedula', 'first_name', 'last_name', 'birth_date', 'gender', # <-- CEDULA AÑADIDA
            'password', 'password_confirmation', 'newsletter_subscribed',
            'marketing_emails', 'marketing_sms'
        ]
        extra_kwargs = {
            'password': {'write_only': True}
        }
    
    def validate(self, data):
        # Validar contraseñas solo si se proporcionan
        if data.get('password') and data.get('password') != data.get('password_confirmation'):
            raise serializers.ValidationError({'password': 'Las contraseñas no coinciden'})
        
        # Validar que el email no exista
        if Customer.objects.filter(email=data['email']).exists():
            raise serializers.ValidationError({'email': 'Este email ya está registrado'})
        
        # Validar que el teléfono no exista
        if Customer.objects.filter(phone=data['phone']).exists():
            raise serializers.ValidationError({'phone': 'Este teléfono ya está registrado'})
        
        # Validar unicidad de cédula si se proporciona
        cedula = data.get('cedula')
        if cedula and Customer.objects.filter(cedula=cedula).exists():
             raise serializers.ValidationError({'cedula': 'Esta cédula/RUC ya está registrado'})
             
        return data
    
    def create(self, validated_data):
        password = validated_data.pop('password', None)
        # Remover confirmación si existe
        validated_data.pop('password_confirmation', None)
        
        if not password:
            password = 'DefaultPassword123!'
            
        customer = Customer.objects.create_user(**validated_data, password=password)
        
        # El programa de lealtad se crea automáticamente por señal (signals.py)
        
        return customer

class CustomerUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = [
            'first_name', 'last_name', 'cedula', 'birth_date', 'gender', # <-- CEDULA AÑADIDA
            'address', 'city', 'state', 'zip_code', 'country',
            'preferences', 'newsletter_subscribed',
            'marketing_emails', 'marketing_sms'
        ]
        
    def validate(self, data):
        # Validar unicidad de cédula en la actualización (excluyendo al cliente actual)
        cedula = data.get('cedula')
        if cedula and self.instance and Customer.objects.filter(cedula=cedula).exclude(pk=self.instance.pk).exists():
             raise serializers.ValidationError({'cedula': 'Esta cédula/RUC ya pertenece a otro cliente'})
        
        return data

class CustomerLoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(style={'input_type': 'password'})
    
    def validate(self, data):
        email = data.get('email')
        password = data.get('password')
        
        if email and password:
            customer = authenticate(email=email, password=password)
            if customer:
                if not customer.is_active:
                    raise serializers.ValidationError('Cuenta desactivada')
                data['customer'] = customer
            else:
                raise serializers.ValidationError('Email o contraseña incorrectos')
        else:
            raise serializers.ValidationError('Debe proporcionar email y contraseña')
        
        return data

class CustomerAddressSerializer(serializers.ModelSerializer):
    customer = serializers.PrimaryKeyRelatedField(read_only=True)
    
    class Meta:
        model = CustomerAddress
        fields = [
            'id', 'customer', 'address_type', 'is_default',
            'street', 'apartment', 'city', 'state', 'zip_code', 'country',
            'special_instructions', 'latitude', 'longitude',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'customer', 'created_at', 'updated_at']
    
    def validate(self, data):
        # Si esta dirección se marca como default, desmarcar otras
        if data.get('is_default', False):
            CustomerAddress.objects.filter(
                customer=self.context['request'].user,
                address_type=data.get('address_type')
            ).update(is_default=False)
        
        return data

class CustomerNoteSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()
    
    class Meta:
        model = CustomerNote
        fields = [
            'id', 'customer', 'note_type', 'content',
            'created_by', 'created_by_name', 'is_archived',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'customer', 'created_by', 'created_at', 'updated_at']
    
    def get_created_by_name(self, obj):
        if obj.created_by:
            # Asumiendo que obj.created_by es una instancia de Customer o User con get_full_name()
            return obj.created_by.get_full_name() 
        return None

class CustomerLoyaltySerializer(serializers.ModelSerializer):
    customer_name = serializers.SerializerMethodField()
    next_tier_name = serializers.SerializerMethodField()
    next_tier_points_needed = serializers.SerializerMethodField()
    
    class Meta:
        model = CustomerLoyalty
        fields = [
            'id', 'customer', 'customer_name', 'current_tier',
            'points_balance', 'total_points_earned', 'total_points_redeemed',
            'tier_achieved_date', 'next_tier_progress',
            'next_tier_name', 'next_tier_points_needed',
            'discount_rate', 'free_delivery', 'priority_service'
        ]
        read_only_fields = fields
    
    def get_customer_name(self, obj):
        return obj.customer.get_full_name()
    
    def get_next_tier_name(self, obj):
        tiers = {'bronze': 'Plata', 'silver': 'Oro', 'gold': 'Platino', 'platinum': None}
        return tiers.get(obj.current_tier)
    
    def get_next_tier_points_needed(self, obj):
        thresholds = {'bronze': 1000, 'silver': 5000, 'gold': 15000, 'platinum': None}
        threshold = thresholds.get(obj.current_tier)
        if threshold:
            return max(0, threshold - obj.points_balance)
        return 0

class CustomerLoyaltyHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomerLoyaltyHistory
        fields = [
            'id', 'loyalty', 'transaction_type', 'points_change',
            'balance_after', 'reason', 'order_reference', 'created_at'
        ]
        read_only_fields = fields

class CustomerDeviceSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomerDevice
        fields = [
            'id', 'customer', 'device_type', 'device_token', 'device_id',
            'app_version', 'os_version', 'model', 'is_active', 'last_login',
            'created_at'
        ]
        read_only_fields = ['id', 'customer', 'created_at']

class CustomerStatsSerializer(serializers.Serializer):
    total_customers = serializers.IntegerField()
    active_customers = serializers.IntegerField()
    vip_customers = serializers.IntegerField()
    new_customers_today = serializers.IntegerField()
    average_order_value = serializers.DecimalField(max_digits=10, decimal_places=2)
    total_revenue = serializers.DecimalField(max_digits=15, decimal_places=2)
    
    # Distribución por tipo
    regular_count = serializers.IntegerField()
    vip_count = serializers.IntegerField()
    corporate_count = serializers.IntegerField()
    student_count = serializers.IntegerField()

class CustomerSearchSerializer(serializers.Serializer):
    query = serializers.CharField(max_length=255, required=True)
    
    def validate_query(self, value):
        if len(value.strip()) < 2:
            raise serializers.ValidationError('La búsqueda debe tener al menos 2 caracteres')
        return value.strip()