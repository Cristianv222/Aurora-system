import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'restaurant_service.settings')
django.setup()
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
        print("[INFO] No se encontró 'Barra A', ya fue desactivada.")

    # 2. Crear o actualizar 'Barra 1', 'Barra 2', 'Barra 3'
    for i in range(1, 4):
        num = f'Barra {i}'
        exists = Table.objects.filter(number=num).exists()
        t, created = Table.objects.update_or_create(
            number=num,
            defaults={
                'name': num,
                'capacity': 2,
                'section': 'Barra',
                'is_active': True,
                **(({'status': 'available'}) if not exists else {})
            }
        )
        if created:
            print(f"[OK] Creada nueva mesa: {num}")
        else:
            print(f"[OK] Actualizada la mesa existente: {num}")

    print("--- Migración Completada Exitosamente ---\n")

if __name__ == '__main__':
    run()
