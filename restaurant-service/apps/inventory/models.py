from django.db import models
from django.utils import timezone
from django.core.validators import MinValueValidator
from decimal import Decimal
import uuid

class RawMaterial(models.Model):
    """Materia prima física para el inventario"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200, verbose_name='Nombre de materia prima')
    unit = models.CharField(max_length=50, verbose_name='Unidad de medida', help_text='Ej: Unidades, Kg, Gramos, Litros, Porciones')
    
    # El stock actual
    stock = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        default=0,
        verbose_name='Saldo Actual'
    )
    
    is_active = models.BooleanField(default=True, verbose_name='Activo')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Materia Prima'
        verbose_name_plural = 'Materias Primas'
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.unit})"

class RecipeItem(models.Model):
    """Vincula un producto del menú con la materia prima (Receta / Uso)"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    raw_material = models.ForeignKey(
        RawMaterial, 
        on_delete=models.CASCADE, 
        related_name='recipe_items',
        verbose_name='Materia Prima'
    )
    product = models.ForeignKey(
        'menu.Product', 
        on_delete=models.CASCADE, 
        related_name='recipe_items',
        verbose_name='Producto'
    )
    
    quantity_used = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        default=1,
        validators=[MinValueValidator(Decimal('0.01'))],
        verbose_name='Cantidad Usada',
        help_text='Cantidad de materia prima que se descuenta al vender 1 unidad de este producto'
    )

    class Meta:
        verbose_name = 'Item de Receta'
        verbose_name_plural = 'Items de Receta'
        unique_together = ('raw_material', 'product')

    def __str__(self):
        return f"{self.product.name} usa {self.quantity_used} {self.raw_material.unit} de {self.raw_material.name}"

class DailyInventory(models.Model):
    """Kardex diario por materia prima"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    date = models.DateField(default=timezone.now, verbose_name='Fecha')
    raw_material = models.ForeignKey(
        RawMaterial, 
        on_delete=models.CASCADE, 
        related_name='daily_records',
        verbose_name='Materia Prima'
    )
    
    previous_balance = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name='Saldo Anterior')
    income = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name='Ingreso')
    consumption = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name='Consumo')
    current_balance = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name='Saldo Actual')

    class Meta:
        verbose_name = 'Inventario Diario'
        verbose_name_plural = 'Inventarios Diarios'
        unique_together = ('date', 'raw_material')
        ordering = ['-date', 'raw_material__name']

    def __str__(self):
        return f"{self.date} - {self.raw_material.name}"

    def update_balance(self):
        """Calcula el saldo actual basado en la fórmula: Anterior + Ingreso - Consumo"""
        self.current_balance = self.previous_balance + self.income - self.consumption
