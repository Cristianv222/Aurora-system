from django.core.management.base import BaseCommand
from apps.roles.models import Role, Permission


class Command(BaseCommand):
    help = 'Crear roles y permisos iniciales'

    def handle(self, *args, **kwargs):
        self.stdout.write('Creando permisos...')
        
        # Crear permisos
        permissions_data = [
            # Fast Food
            ('fast_food.view_menu', 'Ver menú comida rápida'),
            ('fast_food.manage_menu', 'Gestionar menú comida rápida'),
            ('fast_food.view_orders', 'Ver pedidos comida rápida'),
            ('fast_food.manage_orders', 'Gestionar pedidos comida rápida'),
            ('fast_food.view_reports', 'Ver reportes comida rápida'),
            
            # Restaurant
            ('restaurant.view_menu', 'Ver menú restaurante'),
            ('restaurant.manage_menu', 'Gestionar menú restaurante'),
            ('restaurant.view_tables', 'Ver mesas'),
            ('restaurant.manage_tables', 'Gestionar mesas'),
            ('restaurant.view_orders', 'Ver pedidos restaurante'),
            ('restaurant.manage_orders', 'Gestionar pedidos restaurante'),
            ('restaurant.view_reports', 'Ver reportes restaurante'),
            
            # Reporting
            ('reporting.view_all', 'Ver todos los reportes'),
            ('reporting.view_fast_food', 'Ver reportes comida rápida'),
            ('reporting.view_restaurant', 'Ver reportes restaurante'),
            ('reporting.export', 'Exportar reportes'),
        ]
        
        for code, description in permissions_data:
            Permission.objects.get_or_create(
                code=code,
                defaults={'description': description}
            )
        
        self.stdout.write(self.style.SUCCESS(f'✓ {len(permissions_data)} permisos creados'))
        
        # Crear roles
        self.stdout.write('Creando roles...')
        
        roles_data = [
            {
                'name': 'SUPER_ADMIN',
                'description': 'Acceso total al sistema',
                'permissions': {'codes': [p[0] for p in permissions_data]}
            },
            {
                'name': 'ADMIN_FAST_FOOD',
                'description': 'Administrador de comida rápida',
                'permissions': {
                    'codes': [
                        'fast_food.view_menu', 'fast_food.manage_menu',
                        'fast_food.view_orders', 'fast_food.manage_orders',
                        'fast_food.view_reports'
                    ]
                }
            },
            {
                'name': 'ADMIN_RESTAURANT',
                'description': 'Administrador del restaurante',
                'permissions': {
                    'codes': [
                        'restaurant.view_menu', 'restaurant.manage_menu',
                        'restaurant.view_tables', 'restaurant.manage_tables',
                        'restaurant.view_orders', 'restaurant.manage_orders',
                        'restaurant.view_reports'
                    ]
                }
            },
            {
                'name': 'CASHIER',
                'description': 'Cajero',
                'permissions': {
                    'codes': [
                        'fast_food.view_orders', 'fast_food.manage_orders',
                        'restaurant.view_orders', 'restaurant.manage_orders'
                    ]
                }
            },
            {
                'name': 'COOK',
                'description': 'Cocinero',
                'permissions': {
                    'codes': [
                        'fast_food.view_orders',
                        'restaurant.view_orders'
                    ]
                }
            },
            {
                'name': 'WAITER',
                'description': 'Mesero',
                'permissions': {
                    'codes': [
                        'restaurant.view_menu', 'restaurant.view_tables',
                        'restaurant.view_orders', 'restaurant.manage_orders'
                    ]
                }
            },
        ]
        
        for role_data in roles_data:
            Role.objects.get_or_create(
                name=role_data['name'],
                defaults={
                    'description': role_data['description'],
                    'permissions': role_data['permissions']
                }
            )
        
        self.stdout.write(self.style.SUCCESS(f'✓ {len(roles_data)} roles creados'))
        self.stdout.write(self.style.SUCCESS('¡Datos iniciales creados exitosamente!'))