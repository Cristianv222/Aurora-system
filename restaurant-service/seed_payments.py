import os
import sys
import django

# Add the current directory to python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Configurar entorno de Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'restaurant_service.settings')
django.setup()

from apps.payments.models import PaymentMethod

methods_to_create = [
    {"name": "Efectivo", "method_type": "cash", "display_order": 1},
    {"name": "Transferencia Bancaria", "method_type": "bank_transfer", "display_order": 2},
    {"name": "Tarjeta de Crédito", "method_type": "credit_card", "display_order": 3},
    {"name": "Tarjeta de Débito", "method_type": "debit_card", "display_order": 4},
    {"name": "Pago Móvil / DeUna", "method_type": "mobile_payment", "display_order": 5},
]

def run():
    print("Iniciando creación de métodos de pago en la DB...")
    for item in methods_to_create:
        obj, created = PaymentMethod.objects.get_or_create(
            # Buscamos por type para que no se dupliquen si alguien le cambia el nombre
            method_type=item["method_type"],
            defaults={
                "name": item["name"],
                "display_order": item["display_order"],
                "is_active": True
            }
        )
        if created:
            print(f"✅ Método de pago creado exitosamente: {obj.name}")
        else:
            print(f"ℹ️ Método de pago ya existía: {obj.name}")
            
    print("¡Todos los métodos de pago están en la base de datos!")

if __name__ == '__main__':
    run()
