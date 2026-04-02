import os
import django

# Configuración del entorno de Django (necesario si se corre directamente con python sin manage.py shell)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'restaurant_service.settings')
django.setup()

from django.db import models
from apps.pos.models import Table

def run():
    print("\n--- Iniciando Actualización de Mesas (Barras) ---")
    
    # 1. Desactivar 'Barra A'
    old_barras = Table.objects.filter(number__iexact='Barra A')
    if old_barras.exists():
        for b in old_barras:
            b.is_active = False
            b.save()
            print(f"[OK] Desactivada la mesa antigua: {b.number}")
    else:
        print("[INFO] No se encontró 'Barra A', probablemente ya fue desactivada.")

    # 2. Crear o actualizar 'Barra 1', 'Barra 2', 'Barra 3'
    for i in range(1, 4):
        num = f'Barra {i}'
        t, created = Table.objects.update_or_create(
            number=num,
            defaults={
                'name': num,
                'capacity': 2,
                'section': 'Barra',
                'is_active': True,
                'status': 'available' if created else models.F('status') # Mantiene el estatus si ya existía
            }
        )
        if created:
            print(f"[OK] Creada nueva mesa: {num}")
        else:
            print(f"[OK] Actualizada la mesa existente: {num}")

    print("--- Migración Completada Exitosamente ---\n")

if __name__ == '__main__':
    run()
