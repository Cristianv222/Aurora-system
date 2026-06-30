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

class RoomType(models.Model):
    """Tipo de habitación con precios y capacidades parametrizables"""
    name = models.CharField(max_length=50, unique=True, verbose_name="Nombre del Tipo")
    price_per_adult = models.DecimalField(max_digits=10, decimal_places=2, default=15.00, verbose_name="Precio por Adulto")
    price_per_child = models.DecimalField(max_digits=10, decimal_places=2, default=8.00, verbose_name="Precio por Niño (>2 años)")
    adult_capacity = models.PositiveIntegerField(default=2, verbose_name="Capacidad Máxima Adultos")
    child_capacity = models.PositiveIntegerField(default=2, verbose_name="Capacidad Máxima Niños")

    class Meta:
        verbose_name = "Tipo de Habitación"
        verbose_name_plural = "Tipos de Habitación"

    def __str__(self):
        return f"{self.name} (Ad: ${self.price_per_adult} / Ni: ${self.price_per_child})"

class Room(models.Model):
    """Habitación del hotel"""
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
    room_type = models.ForeignKey(
        RoomType,
        on_delete=models.PROTECT,
        related_name="rooms",
        verbose_name="Tipo de Habitación"
    )
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
        return f"Habitación {self.room_number} ({self.room_type.name})"

    @property
    def price_per_adult(self):
        return self.room_type.price_per_adult

    @property
    def price_per_child(self):
        return self.room_type.price_per_child

    @property
    def adult_capacity(self):
        return self.room_type.adult_capacity

    @property
    def child_capacity(self):
        return self.room_type.child_capacity

    @property
    def price_per_night(self):
        """Property wrapper for backward compatibility with external references"""
        return self.room_type.price_per_adult
