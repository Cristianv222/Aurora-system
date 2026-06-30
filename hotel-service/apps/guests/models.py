from django.db import models

class Guest(models.Model):
    """Huésped / Cliente del hotel"""
    IDENTIFICATION_TYPES = [
        ('04', 'RUC'),
        ('05', 'Cédula'),
        ('06', 'Pasaporte'),
        ('07', 'Consumidor Final'),
        ('08', 'ID Exterior'),
    ]

    identification_type = models.CharField(
        max_length=2, 
        choices=IDENTIFICATION_TYPES, 
        default='05',
        verbose_name="Tipo de Identificación"
    )
    identification = models.CharField(
        max_length=20, 
        unique=True, 
        verbose_name="Identificación"
    )
    name = models.CharField(max_length=300, verbose_name="Nombre / Razón Social")
    email = models.EmailField(blank=True, null=True, verbose_name="Correo Electrónico")
    phone = models.CharField(max_length=20, blank=True, null=True, verbose_name="Teléfono")
    address = models.TextField(blank=True, null=True, verbose_name="Dirección")
    nationality = models.CharField(max_length=100, blank=True, null=True, verbose_name="Nacionalidad")
    origin_city = models.CharField(max_length=200, blank=True, null=True, verbose_name="De qué parte viaja")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        verbose_name = "Huésped"
        verbose_name_plural = "Huéspedes"

    def __str__(self):
        return f"{self.name} ({self.identification})"
