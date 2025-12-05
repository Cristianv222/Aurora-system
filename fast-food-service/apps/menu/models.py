from django.db import models
from django.utils import timezone
from django.core.validators import MinValueValidator, MaxValueValidator
import uuid
import os

def menu_item_image_path(instance, filename):
    """Genera la ruta para las imágenes de items del menú"""
    ext = filename.split('.')[-1]
    filename = f'{instance.id}.{ext}'
    return os.path.join('menu', 'items', filename)

def category_image_path(instance, filename):
    """Genera la ruta para las imágenes de categorías"""
    ext = filename.split('.')[-1]
    filename = f'{instance.id}.{ext}'
    return os.path.join('menu', 'categories', filename)


class Category(models.Model):
    """Categorías dinámicas del menú"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, unique=True, verbose_name='Nombre')
    slug = models.SlugField(max_length=100, unique=True, verbose_name='Slug')
    description = models.TextField(blank=True, verbose_name='Descripción')
    
    # Imagen
    image = models.ImageField(
        upload_to=category_image_path, 
        blank=True, 
        null=True,
        verbose_name='Imagen'
    )
    
    # Color para UI (opcional)
    color = models.CharField(
        max_length=7,
        blank=True,
        verbose_name='Color',
        help_text='Código hexadecimal, ej: #FF5733'
    )
    
    # Icono (opcional, nombre del icono o clase CSS)
    icon = models.CharField(
        max_length=50,
        blank=True,
        verbose_name='Icono',
        help_text='Nombre del icono para usar en frontend'
    )
    
    # Configuración
    is_active = models.BooleanField(default=True, verbose_name='Activo')
    display_order = models.PositiveIntegerField(default=0, verbose_name='Orden')
    
    # Auditoría
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Categoría'
        verbose_name_plural = 'Categorías'
        ordering = ['display_order', 'name']
        indexes = [
            models.Index(fields=['is_active', 'display_order']),
            models.Index(fields=['slug']),
        ]
    
    def __str__(self):
        return self.name


class Product(models.Model):
    """Productos del menú de fast food"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    category = models.ForeignKey(
        Category, 
        on_delete=models.CASCADE, 
        related_name='products',
        verbose_name='Categoría'
    )
    
    # Información básica
    name = models.CharField(max_length=200, verbose_name='Nombre')
    slug = models.SlugField(max_length=200, unique=True, verbose_name='Slug')
    description = models.TextField(verbose_name='Descripción')
    
    image = models.ImageField(
        upload_to=menu_item_image_path,
        verbose_name='Imagen',
        blank=True,
        null=True
    )
    
    # Precio base (precio del tamaño regular/único)
    price = models.DecimalField(
        max_digits=10, 
        decimal_places=2,
        validators=[MinValueValidator(0)],
        verbose_name='Precio'
    )
    
    # Información nutricional opcional
    calories = models.PositiveIntegerField(
        null=True, 
        blank=True, 
        verbose_name='Calorías'
    )
    
    # Ingredientes y alergenos
    ingredients = models.TextField(blank=True, verbose_name='Ingredientes')
    allergens = models.CharField(
        max_length=255, 
        blank=True, 
        verbose_name='Alergenos',
        help_text='Ej: Gluten, Lácteos, Huevo'
    )
    
    # Estado y disponibilidad
    is_active = models.BooleanField(default=True, verbose_name='Activo')
    is_available = models.BooleanField(default=True, verbose_name='Disponible')
    is_featured = models.BooleanField(default=False, verbose_name='Destacado')
    is_new = models.BooleanField(default=False, verbose_name='Nuevo')
    
    # Tiempo de preparación estimado (minutos)
    prep_time = models.PositiveIntegerField(
        default=10,
        verbose_name='Tiempo de preparación (min)'
    )
    
    # Orden de visualización
    display_order = models.PositiveIntegerField(default=0, verbose_name='Orden')
    
    # Auditoría
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Producto'
        verbose_name_plural = 'Productos'
        ordering = ['category', 'display_order', 'name']
        indexes = [
            models.Index(fields=['category', 'is_active', 'is_available']),
            models.Index(fields=['is_featured']),
            models.Index(fields=['slug']),
        ]
    
    def __str__(self):
        return f'{self.name} - ${self.price}'
    
    def is_available_now(self):
        """Verifica disponibilidad"""
        return self.is_active and self.is_available


class Size(models.Model):
    """Tamaños disponibles para productos (Small, Medium, Large)"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name='sizes',
        verbose_name='Producto'
    )
    
    name = models.CharField(
        max_length=50, 
        verbose_name='Nombre',
        help_text='Ej: Pequeño, Mediano, Grande'
    )
    
    # Precio adicional sobre el precio base
    price_adjustment = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        verbose_name='Ajuste de precio',
        help_text='Adicional al precio base. Puede ser negativo para descuento'
    )
    
    # Calorías específicas del tamaño
    calories = models.PositiveIntegerField(
        null=True,
        blank=True,
        verbose_name='Calorías'
    )
    
    is_default = models.BooleanField(default=False, verbose_name='Por defecto')
    is_active = models.BooleanField(default=True, verbose_name='Activo')
    display_order = models.PositiveIntegerField(default=0, verbose_name='Orden')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Tamaño'
        verbose_name_plural = 'Tamaños'
        ordering = ['product', 'display_order']
        unique_together = ['product', 'name']
    
    def __str__(self):
        return f'{self.product.name} - {self.name}'
    
    def get_final_price(self):
        """Calcula el precio final del tamaño"""
        return self.product.price + self.price_adjustment


class Extra(models.Model):
    """Extras/Adicionales para los productos (Queso extra, Bacon, etc.)"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    name = models.CharField(max_length=100, verbose_name='Nombre')
    description = models.CharField(
        max_length=255, 
        blank=True, 
        verbose_name='Descripción'
    )
    
    # Precio del extra
    price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)],
        verbose_name='Precio'
    )
    
    # Imagen opcional
    image = models.ImageField(
        upload_to='menu/extras/',
        blank=True,
        null=True,
        verbose_name='Imagen'
    )
    
    # Disponibilidad
    is_active = models.BooleanField(default=True, verbose_name='Activo')
    
    # A qué productos aplica (Many-to-Many)
    products = models.ManyToManyField(
        Product,
        related_name='extras',
        blank=True,
        verbose_name='Productos'
    )
    
    display_order = models.PositiveIntegerField(default=0, verbose_name='Orden')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Extra/Adicional'
        verbose_name_plural = 'Extras/Adicionales'
        ordering = ['display_order', 'name']
    
    def __str__(self):
        return f'{self.name} (+${self.price})'


class Combo(models.Model):
    """Combos de comida rápida (Burger + Fries + Drink)"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    name = models.CharField(max_length=200, verbose_name='Nombre')
    slug = models.SlugField(max_length=200, unique=True, verbose_name='Slug')
    description = models.TextField(verbose_name='Descripción')
    
    # Imagen del combo
    image = models.ImageField(
        upload_to='menu/combos/',
        verbose_name='Imagen'
    )
    
    # Precio del combo (con descuento)
    price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)],
        verbose_name='Precio'
    )
    
    # Configuración
    is_active = models.BooleanField(default=True, verbose_name='Activo')
    is_featured = models.BooleanField(default=False, verbose_name='Destacado')
    
    display_order = models.PositiveIntegerField(default=0, verbose_name='Orden')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Combo'
        verbose_name_plural = 'Combos'
        ordering = ['display_order', 'name']
    
    def __str__(self):
        return f'{self.name} - ${self.price}'


class ComboProduct(models.Model):
    """Productos incluidos en un combo"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    combo = models.ForeignKey(
        Combo,
        on_delete=models.CASCADE,
        related_name='combo_products',
        verbose_name='Combo'
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        verbose_name='Producto'
    )
    
    quantity = models.PositiveIntegerField(default=1, verbose_name='Cantidad')
    
    # Si el cliente puede elegir entre varias opciones del mismo tipo
    is_selectable = models.BooleanField(
        default=False,
        verbose_name='Seleccionable',
        help_text='El cliente puede elegir de varias opciones'
    )
    
    display_order = models.PositiveIntegerField(default=0, verbose_name='Orden')
    
    class Meta:
        verbose_name = 'Producto del Combo'
        verbose_name_plural = 'Productos del Combo'
        ordering = ['display_order']
    
    def __str__(self):
        return f'{self.combo.name} - {self.product.name} (x{self.quantity})'