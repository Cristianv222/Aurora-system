from django.db import models

class Floor(models.Model):
    """Piso o nivel del hotel"""
    name = models.CharField(max_length=50, verbose_name="Nombre del Piso")
    order = models.IntegerField(default=0, verbose_name="Orden de visualización")

    class Meta:
        ordering = ['order', 'name']
        verbose_name = "Piso"
        verbose_name_plural = "Pisos"

    def __str__(self):
        return self.name

class Room(models.Model):
    """Habitación del hotel"""
    ROOM_TYPES = [
        ('single', 'Simple'),
        ('double', 'Doble'),
        ('suite', 'Suite'),
        ('matrimonial', 'Matrimonial'),
    ]

    ROOM_STATUS = [
        ('available', 'Disponible'),
        ('occupied', 'Ocupada'),
        ('cleaning', 'Limpieza'),
        ('maintenance', 'Mantenimiento'),
    ]

    floor = models.ForeignKey(
        Floor, 
        on_delete=models.CASCADE, 
        related_name="rooms", 
        verbose_name="Piso"
    )
    room_number = models.CharField(max_length=20, unique=True, verbose_name="Número de Habitación")
    room_type = models.CharField(
        max_length=20, 
        choices=ROOM_TYPES, 
        default='single', 
        verbose_name="Tipo de Habitación"
    )
    price_per_night = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        verbose_name="Precio por Noche"
    )
    adult_capacity = models.PositiveIntegerField(default=2, verbose_name="Capacidad de Adultos")
    child_capacity = models.PositiveIntegerField(default=0, verbose_name="Capacidad de Niños")
    status = models.CharField(
        max_length=20, 
        choices=ROOM_STATUS, 
        default='available', 
        verbose_name="Estado"
    )

    class Meta:
        ordering = ['room_number']
        verbose_name = "Habitación"
        verbose_name_plural = "Habitaciones"

    def __str__(self):
        return f"Habitación {self.room_number} ({self.get_room_type_display()})"
