import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'restaurant_service.settings')
django.setup()

from apps.menu.models import Category, Product

# Creeate Categories
cat_food, _ = Category.objects.get_or_create(
    name="Platos Principales", 
    defaults={'description': 'Comidas fuertes', 'slug': 'platos-principales'}
)
cat_drinks, _ = Category.objects.get_or_create(
    name="Bebidas", 
    defaults={'description': 'Refrescos y cervezas', 'slug': 'bebidas'}
)
cat_desserts, _ = Category.objects.get_or_create(
    name="Postres", 
    defaults={'description': 'Dulces', 'slug': 'postres'}
)

print("Categories seeded")

# Create Products
prod1, _ = Product.objects.get_or_create(
    name="Hamburguesa Clásica",
    defaults={
        'description': 'Carne, queso, lechuga y tomate',
        'price': 8.50,
        'category': cat_food,
        'is_available': True,
        'slug': 'hamburguesa-clasica'
    }
)

prod2, _ = Product.objects.get_or_create(
    name="Pizza Margarita",
    defaults={
        'description': 'Queso mozzarella y albahaca',
        'price': 12.00,
        'category': cat_food,
        'is_available': True,
        'slug': 'pizza-margarita'
    }
)

prod3, _ = Product.objects.get_or_create(
    name="Coca Cola",
    defaults={
        'description': 'Refresco de cola de 350ml',
        'price': 2.00,
        'category': cat_drinks,
        'is_available': True,
        'slug': 'coca-cola'
    }
)

prod4, _ = Product.objects.get_or_create(
    name="Helado de Vainilla",
    defaults={
        'description': 'Dos bolas de helado',
        'price': 4.00,
        'category': cat_desserts,
        'is_available': True,
        'slug': 'helado-vainilla'
    }
)

print("Products seeded")
