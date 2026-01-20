from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
from django.utils import timezone
from .models import Customer, CustomerLoyalty

@receiver(post_save, sender=Customer)
def create_customer_loyalty(sender, instance, created, **kwargs):
    """
    Crear automáticamente programa de lealtad cuando se crea un cliente
    """
    if created:
        CustomerLoyalty.objects.create(customer=instance)

@receiver(pre_save, sender=Customer)
def update_vip_status(sender, instance, **kwargs):
    """
    Actualizar automáticamente estado VIP basado en gastos
    """
    if instance.total_spent >= 1000 and not instance.is_vip:
        instance.is_vip = True
    elif instance.total_spent < 1000 and instance.is_vip:
        instance.is_vip = False