from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.utils import timezone
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from apps.orders.models import OrderItem
from .models import RawMaterial, RecipeItem, DailyInventory

def get_or_create_daily_inventory(raw_material, date=None):
    if date is None:
        date = timezone.now().date()
    
    daily, created = DailyInventory.objects.get_or_create(
        date=date,
        raw_material=raw_material,
        defaults={
            'previous_balance': raw_material.stock,
            'current_balance': raw_material.stock
        }
    )
    return daily

@receiver(post_save, sender=OrderItem)
def handle_order_item_save(sender, instance, created, **kwargs):
    """
    Cuando se crea un OrderItem, descuenta del stock.
    Si se actualiza la cantidad de un OrderItem existente, habría que calcular la diferencia,
    pero usualmente el POS crea o elimina OrderItems en vez de actualizarlos.
    Para estar seguros, asumiremos que si es 'created', descontamos.
    Si no es created, pero cambió la cantidad, requeriría guardar el estado previo (lo cual es complejo).
    Asumiremos que los items se agregan o eliminan completos por ahora.
    """
    if created:
        recipes = RecipeItem.objects.filter(product=instance.product)
        for recipe in recipes:
            qty_to_deduct = recipe.quantity_used * instance.quantity
            
            # Obtener kardex diario antes de afectar el stock, por si se crea hoy.
            daily = get_or_create_daily_inventory(recipe.raw_material)
            
            # Bloquear la fila de la materia prima para manejar la concurrencia (prioridades)
            raw_material = RawMaterial.objects.select_for_update().get(id=recipe.raw_material_id)
            raw_material.stock -= qty_to_deduct
            raw_material.save()
            
            # Bloquear Kardex
            daily = DailyInventory.objects.select_for_update().get(id=daily.id)
            daily.consumption += qty_to_deduct
            daily.update_balance()
            daily.save()
            
            # Emitir mensaje por WebSockets
            channel_layer = get_channel_layer()
            if channel_layer:
                async_to_sync(channel_layer.group_send)(
                    "inventory_updates",
                    {
                        "type": "inventory_update",
                        "message": "inventory_changed"
                    }
                )

@receiver(post_delete, sender=OrderItem)
def handle_order_item_delete(sender, instance, **kwargs):
    """
    Cuando se elimina un OrderItem, devuelve al stock.
    """
    recipes = RecipeItem.objects.filter(product=instance.product)
    for recipe in recipes:
        qty_to_return = recipe.quantity_used * instance.quantity
        
        # Siempre afectamos el kardex de hoy, porque la devolución ocurre hoy
        daily = get_or_create_daily_inventory(recipe.raw_material)
        
        # Bloquear fila de materia prima
        raw_material = RawMaterial.objects.select_for_update().get(id=recipe.raw_material_id)
        raw_material.stock += qty_to_return
        raw_material.save()
        
        # Bloquear fila de Kardex
        daily = DailyInventory.objects.select_for_update().get(id=daily.id)
        daily.consumption -= qty_to_return
        # Evitar consumo negativo si devuelven algo de ayer
        if daily.consumption < 0:
            daily.income += abs(daily.consumption)
            daily.consumption = 0
            
        daily.update_balance()
        daily.save()
        
        # Emitir mensaje por WebSockets
        channel_layer = get_channel_layer()
        if channel_layer:
            async_to_sync(channel_layer.group_send)(
                "inventory_updates",
                {
                    "type": "inventory_update",
                    "message": "inventory_changed"
                }
            )
