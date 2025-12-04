from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from apps.users.models import User
from apps.users.serializers import UserSerializer


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        
        # Agregar datos personalizados al token
        token['user_id'] = user.id
        token['username'] = user.username
        token['email'] = user.email
        token['full_name'] = user.get_full_name()
        token['role'] = user.role.name if user.role else None
        token['role_id'] = user.role.id if user.role else None
        token['is_staff'] = user.is_staff
        token['is_superuser'] = user.is_superuser
        
        return token
    
    def validate(self, attrs):
        data = super().validate(attrs)
        
        # Agregar información del usuario a la respuesta
        data['user'] = UserSerializer(self.user).data
        
        return data


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True)
    
    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'password_confirm', 'first_name', 'last_name', 'phone']
    
    def validate(self, data):
        if data['password'] != data['password_confirm']:
            raise serializers.ValidationError({"password": "Las contraseñas no coinciden"})
        data.pop('password_confirm')
        return data
    
    def create(self, validated_data):
        user = User.objects.create_user(**validated_data)
        return user


class VerifyTokenSerializer(serializers.Serializer):
    token = serializers.CharField(required=True)