import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fast_food_service.settings')
django.setup()

from apps.pos.models import Table

created_count = 0
for i in range(1, 16):
    table, created = Table.objects.get_or_create(
        number=f"FF-{i}",
        defaults={
            'capacity': 4,
            'section': 'Comedor Rápido',
            'status': 'available'
        }
    )
    if created:
        created_count += 1

print(f"Fast Food Tables seeded: {created_count} new tables created.")
