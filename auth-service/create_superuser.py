import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'auth_service.settings')
django.setup()

from django.contrib.auth import get_user_model

User = get_user_model()

# Eliminar usuario admin si existe por email o username
User.objects.filter(email='admin@aurora.com').delete()
User.objects.filter(username='admin').delete()

# Crear nuevo superusuario
user = User.objects.create_superuser(
    username='admin',
    email='admin@aurora.com',
    password='admin123',
    first_name='Admin',
    last_name='Sistema'
)

print(f'✅ Superusuario creado exitosamente!')
print(f'Username: admin')
print(f'Email: admin@aurora.com')
print(f'Password: admin123')
