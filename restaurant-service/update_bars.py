import os
import django
from django.conf import settings

# This script is meant to be run via `python manage.py shell < update_bars.py`
from apps.pos.models import Table

def update_bars():
    # Desactivar 'Barra A'
    old_barras = Table.objects.filter(number='Barra A')
    for b in old_barras:
        b.is_active = False
        b.save()
        print(f"Desactivada: {b.number}")

    # Crear 'Barra 1', 'Barra 2', 'Barra 3'
    for i in range(1, 4):
        num = f'Barra {i}'
        t, created = Table.objects.update_or_create(
            number=num,
            defaults={
                'name': num,
                'capacity': 2,
                'section': 'Barra',
                'is_active': True,
                'status': 'available'
            }
        )
        if created:
            print(f"Creada: {num}")
        else:
            print(f"Actualizada: {num}")

    print("Migracion completada exitosamente.")

if __name__ == '__main__':
    update_bars()
