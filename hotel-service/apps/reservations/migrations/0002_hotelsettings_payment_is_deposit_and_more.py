# Generated manually

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('reservations', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='HotelSettings',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('default_checkin_time', models.TimeField(default='14:00', verbose_name='Hora Check-in por Defecto')),
                ('default_checkout_time', models.TimeField(default='12:00', verbose_name='Hora Check-out por Defecto')),
                ('hotel_name', models.CharField(default='Hotel Aurora', max_length=200, verbose_name='Nombre del Hotel')),
                ('hotel_address', models.TextField(blank=True, null=True, verbose_name='Dirección del Hotel')),
                ('hotel_phone', models.CharField(blank=True, null=True, max_length=50, verbose_name='Teléfono del Hotel')),
            ],
            options={
                'verbose_name': 'Configuración del Hotel',
                'verbose_name_plural': 'Configuraciones del Hotel',
            },
        ),
        migrations.AddField(
            model_name='payment',
            name='is_deposit',
            field=models.BooleanField(default=False, verbose_name='¿Es Depósito?'),
        ),
        migrations.AddField(
            model_name='reservation',
            name='deposit_amount',
            field=models.DecimalField(decimal_places=2, default=0.0, max_digits=10, verbose_name='Monto Depósito'),
        ),
        migrations.AddField(
            model_name='reservation',
            name='deposit_paid',
            field=models.BooleanField(default=False, verbose_name='¿Depósito Pagado?'),
        ),
        migrations.AddField(
            model_name='reservation',
            name='notes',
            field=models.TextField(blank=True, null=True, verbose_name='Notas'),
        ),
        migrations.AddField(
            model_name='reservation',
            name='planned_check_out',
            field=models.DateTimeField(blank=True, null=True, verbose_name='Fecha/Hora Salida Planeada'),
        ),
        migrations.AddField(
            model_name='reservation',
            name='reservation_code',
            field=models.CharField(blank=True, max_length=8, null=True, unique=True, verbose_name='Código de Reserva'),
        ),
        migrations.AlterField(
            model_name='reservation',
            name='status',
            field=models.CharField(choices=[('reserved', 'Reservada'), ('active', 'Activa'), ('checked_out', 'Completada (Check-out)'), ('cancelled', 'Cancelada')], default='active', max_length=20, verbose_name='Estado'),
        ),
    ]
