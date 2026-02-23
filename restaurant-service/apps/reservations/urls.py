from django.urls import path
from . import views

urlpatterns = [
    # Health check
    path('health/', views.health_check, name='reservations-health'),

    # Listado y creación
    path('', views.reservation_list_create, name='reservation-list-create'),

    # Endpoints de consulta especiales (deben ir ANTES de <pk>)
    path('today/', views.reservations_today, name='reservations-today'),
    path('available-tables/', views.available_tables, name='reservations-available-tables'),
    path('croquis/', views.croquis_status, name='reservations-croquis'),
    path('stats/', views.reservation_stats, name='reservations-stats'),

    # Detalle, edición y eliminación
    path('<uuid:pk>/', views.reservation_detail, name='reservation-detail'),

    # Acciones de estado
    path('<uuid:pk>/confirm/', views.reservation_confirm, name='reservation-confirm'),
    path('<uuid:pk>/seat/', views.reservation_seat, name='reservation-seat'),
    path('<uuid:pk>/complete/', views.reservation_complete, name='reservation-complete'),
    path('<uuid:pk>/cancel/', views.reservation_cancel, name='reservation-cancel'),
    path('<uuid:pk>/no-show/', views.reservation_no_show, name='reservation-no-show'),

    # Notas
    path('<uuid:pk>/notes/', views.reservation_add_note, name='reservation-add-note'),
]
