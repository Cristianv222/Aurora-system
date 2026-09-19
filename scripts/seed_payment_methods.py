import os
import django

def seed_restaurant():
    os.environ['DJANGO_SETTINGS_MODULE'] = 'restaurant_service.settings'
    django.setup()

    from apps.payments.models import Currency, PaymentMethod

    # Currencies
    usd, _ = Currency.objects.get_or_create(
        code='USD',
        defaults={'name': 'Dólar Americano', 'symbol': '$', 'is_default': True, 'is_active': True, 'decimal_places': 2}
    )
    if not usd.is_default:
        usd.is_default = True
        usd.save()

    cop, _ = Currency.objects.get_or_create(
        code='COP',
        defaults={'name': 'Peso Colombiano', 'symbol': '$', 'is_default': False, 'is_active': True, 'decimal_places': 0}
    )

    # Payment Methods
    methods = [
        {'name': 'Efectivo', 'method_type': 'cash', 'display_order': 1, 'is_active': True},
        {'name': 'Tarjeta de Crédito', 'method_type': 'credit_card', 'display_order': 2, 'is_active': True},
        {'name': 'Tarjeta de Débito', 'method_type': 'debit_card', 'display_order': 3, 'is_active': True},
        {'name': 'Transferencia Bancaria', 'method_type': 'bank_transfer', 'display_order': 4, 'is_active': True},
        {'name': 'Pago Móvil / QR', 'method_type': 'mobile_payment', 'display_order': 5, 'is_active': True},
    ]

    for m in methods:
        PaymentMethod.objects.get_or_create(
            name=m['name'],
            defaults=m
        )

    print(f"✅ Métodos de pago creados en Restaurante: {PaymentMethod.objects.count()}")

if __name__ == '__main__':
    seed_restaurant()
