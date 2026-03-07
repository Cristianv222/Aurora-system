import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'restaurant_service.settings')
django.setup()

from apps.pos.models import Table

# Delete all existing tables to avoid conflict
Table.objects.all().delete()

# Exact tables defined in TableCroquis.js
TABLES_DATA = [
    # Top Left
    {'number': 'Mesa 7 B', 'capacity': 4, 'section': 'Principal'},
    {'number': 'Mesa 7', 'capacity': 4, 'section': 'Principal'},
    # Top Center
    {'number': 'Mesa 5', 'capacity': 4, 'section': 'Principal'},
    {'number': 'Mesa 4', 'capacity': 4, 'section': 'Principal'},
    # Delivery
    {'number': 'Domicilio', 'capacity': 1, 'section': 'Entregas', 'status': 'available'},
    # Middle row
    {'number': 'Mesa 7 C', 'capacity': 6, 'section': 'Principal'},
    {'number': 'Mesa 8', 'capacity': 6, 'section': 'Principal'},
    # Center
    {'number': 'Mesa 9', 'capacity': 6, 'section': 'Principal'},
    {'number': 'Mesa 6', 'capacity': 4, 'section': 'Principal'},
    # Right column
    {'number': 'Mesa 3', 'capacity': 4, 'section': 'Principal'},
    {'number': 'Mesa 2', 'capacity': 4, 'section': 'Principal'},
    {'number': 'Mesa 1', 'capacity': 4, 'section': 'Principal'},
    # Bar
    {'number': 'Barra A', 'capacity': 10, 'section': 'Bar'}
]

created_count = 0
for data in TABLES_DATA:
    Table.objects.create(**data)
    created_count += 1

print(f"Tables successfully replaced. Total created matching Croquis: {created_count}")