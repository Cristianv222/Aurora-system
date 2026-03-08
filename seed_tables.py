import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'restaurant_service.settings')
django.setup()

from apps.pos.models import Table

created_count = 0
for i in range(1, 21):
    table, created = Table.objects.get_or_create(
        number=str(i),
        defaults={
            'capacity': 4,
            'section': 'Principal',
            'status': 'available'
        }
    )
    if created:
        created_count += 1

print(f"Tables seeded: {created_count} new tables created.")
