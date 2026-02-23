from django.contrib import admin
from .models import Reservation, ReservationNote


class ReservationNoteInline(admin.TabularInline):
    model = ReservationNote
    extra = 0
    readonly_fields = ['created_at']
    fields = ['content', 'created_by', 'created_at']


@admin.register(Reservation)
class ReservationAdmin(admin.ModelAdmin):
    list_display = [
        'reservation_number', 'guest_name', 'guest_phone',
        'reservation_date', 'reservation_time', 'party_size',
        'table', 'status', 'occasion', 'created_at',
    ]
    list_filter = ['status', 'reservation_date', 'occasion']
    search_fields = ['reservation_number', 'guest_name', 'guest_phone', 'guest_email']
    ordering = ['-reservation_date', 'reservation_time']
    readonly_fields = [
        'reservation_number', 'created_at', 'updated_at',
        'confirmed_at', 'seated_at', 'completed_at', 'cancelled_at',
    ]
    inlines = [ReservationNoteInline]
    fieldsets = (
        ('Información del Cliente', {
            'fields': ('customer', 'guest_name', 'guest_phone', 'guest_email')
        }),
        ('Detalles de la Reserva', {
            'fields': ('reservation_number', 'table', 'party_size',
                       'reservation_date', 'reservation_time', 'duration_minutes',
                       'occasion', 'special_requests')
        }),
        ('Estado', {
            'fields': ('status', 'cancellation_reason')
        }),
        ('Gestión', {
            'fields': ('created_by_id', 'created_by_name')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at', 'confirmed_at',
                       'seated_at', 'completed_at', 'cancelled_at'),
            'classes': ('collapse',),
        }),
    )


@admin.register(ReservationNote)
class ReservationNoteAdmin(admin.ModelAdmin):
    list_display = ['reservation', 'created_by', 'created_at']
    readonly_fields = ['created_at']
    search_fields = ['reservation__reservation_number', 'content']
