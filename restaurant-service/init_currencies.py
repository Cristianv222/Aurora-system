"""
Script para inicializar monedas y tasas de cambio
"""
from apps.payments.models import Currency, ExchangeRate

# Crear o actualizar USD
usd, created = Currency.objects.get_or_create(
    code='USD',
    defaults={
        'name': 'Dólar Americano',
        'symbol': '$',
        'is_default': True,
        'is_active': True,
        'decimal_places': 2
    }
)
if not created and not usd.is_default:
    usd.is_default = True
    usd.save()
print(f'✅ USD: {"Creado" if created else "Ya existe"} (Default: {usd.is_default})')

# Crear COP
cop, created = Currency.objects.get_or_create(
    code='COP',
    defaults={
        'name': 'Peso Colombiano',
        'symbol': '$',
        'is_default': False,
        'is_active': True,
        'decimal_places': 0  # COP no usa decimales
    }
)
print(f'✅ COP: {"Creado" if created else "Ya existe"}')

# Crear tasa de cambio USD -> COP
rate, created = ExchangeRate.objects.get_or_create(
    from_currency=usd,
    to_currency=cop,
    defaults={
        'rate': 4000.0000,
        'source': 'Initial Setup',
        'is_active': True,
        'updated_by': 'System'
    }
)
print(f'✅ Tasa USD->COP: {"Creada" if created else "Ya existe"} (Rate: {rate.rate})')

print('\n=== RESUMEN ===')
print(f'Monedas activas: {Currency.objects.filter(is_active=True).count()}')
print(f'Tasas de cambio activas: {ExchangeRate.objects.filter(is_active=True).count()}')
