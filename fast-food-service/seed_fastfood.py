import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fast_food_service.settings')
django.setup()

from apps.menu.models import Category, Product

# Creeate Categories
cat_food, _ = Category.objects.get_or_create(
    name="Comida Rápida", 
    defaults={'description': 'Hamburguesas y combos', 'slug': 'comida-rapida'}
)
cat_drinks, _ = Category.objects.get_or_create(
    name="Bebidas", 
    defaults={'description': 'Refrescos y cervezas', 'slug': 'bebidas'}
)

print("Fast-food categories seeded")

# Create Products
prod1, _ = Product.objects.get_or_create(
    name="Combo Hamburguesa Plus",
    defaults={
        'description': 'Doble Carne, queso, papas grandes',
        'price': 10.50,
        'category': cat_food,
        'is_available': True,
        'slug': 'combo-hamburguesa-plus'
    }
)

print("Fast-food products seeded")
