from rest_framework import viewsets, status
from rest_framework.decorators import action, permission_classes as api_permission_classes, authentication_classes as api_authentication_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from core.permissions import IsJWTAuthenticated
from .models import Reservation, Payment, SRIConfiguration, HotelSettings
from .serializers import ReservationSerializer, PaymentSerializer, SRIConfigurationSerializer, HotelSettingsSerializer
from apps.rooms.models import Room
from apps.guests.models import Guest
from django.utils import timezone
from decimal import Decimal
import requests
import json
import logging
from django.db.models import Q

logger = logging.getLogger(__name__)

class ReservationViewSet(viewsets.ModelViewSet):
    queryset = Reservation.objects.all()
    serializer_class = ReservationSerializer
    permission_classes = [IsJWTAuthenticated]

    def get_queryset(self):
        queryset = Reservation.objects.all()
        room = self.request.query_params.get('room')
        status = self.request.query_params.get('status')
        if room:
            queryset = queryset.filter(room_id=room)
        if status:
            queryset = queryset.filter(status=status)
        return queryset


    @action(detail=False, methods=['post'], url_path='reserve')
    def reserve(self, request):
        """
        Registra una reserva anticipada (status='reserved') para una habitación.
        Crea o busca al huésped.
        Permite registrar un pago de depósito inicial.
        """
        room_id = request.data.get('room')
        guest_data = request.data.get('guest_data', {})
        check_in_date = request.data.get('check_in_date')
        planned_check_out = request.data.get('planned_check_out')
        number_of_adults = int(request.data.get('number_of_adults', 1))
        number_of_children = int(request.data.get('number_of_children', 0))
        deposit_amount = Decimal(request.data.get('deposit_amount', 0.0))
        payment_method = request.data.get('payment_method', 'cash')
        notes = request.data.get('notes', '')

        if not room_id or not check_in_date or not planned_check_out:
            return Response({'error': 'Habitación, check_in_date y planned_check_out son requeridos.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            room = Room.objects.get(id=room_id)
        except Room.DoesNotExist:
            return Response({'error': 'Habitación no existe.'}, status=status.HTTP_404_NOT_FOUND)

        # Buscar o crear Huésped
        ident = guest_data.get('identification')
        if not ident:
            return Response({'error': 'Identificación del huésped es requerida.'}, status=status.HTTP_400_BAD_REQUEST)

        guest, created = Guest.objects.get_or_create(
            identification=ident,
            defaults={
                'identification_type': guest_data.get('identification_type', '05'),
                'name': guest_data.get('name', ''),
                'email': guest_data.get('email', ''),
                'phone': guest_data.get('phone', ''),
                'address': guest_data.get('address', '')
            }
        )

        if not created:
            guest.identification_type = guest_data.get('identification_type', guest.identification_type)
            guest.name = guest_data.get('name', guest.name)
            guest.email = guest_data.get('email', guest.email)
            guest.phone = guest_data.get('phone', guest.phone)
            guest.address = guest_data.get('address', guest.address)
            guest.save()

        # Registrar reservación
        reservation_data = {
            'room': room.id,
            'guest': guest.id,
            'check_in_date': check_in_date,
            'planned_check_out': planned_check_out,
            'number_of_adults': number_of_adults,
            'number_of_children': number_of_children,
            'deposit_amount': deposit_amount,
            'deposit_paid': deposit_amount > 0,
            'notes': notes,
            'status': 'reserved'
        }

        serializer = self.get_serializer(data=reservation_data)
        if serializer.is_valid():
            res = serializer.save()

            if deposit_amount > 0:
                Payment.objects.create(
                    reservation=res,
                    amount=deposit_amount,
                    payment_method=payment_method,
                    is_deposit=True,
                    sri_status='DRAFT'
                )

            return Response(ReservationSerializer(res).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'], url_path='check-in')
    def check_in(self, request):
        """
        Registra una reserva / Check-in para una habitación disponible.
        O si se proporciona un reservation_id, realiza el check-in de una reserva ya existente.
        """
        reservation_id = request.data.get('reservation_id')
        if reservation_id:
            try:
                res = Reservation.objects.get(id=reservation_id)
            except Reservation.DoesNotExist:
                return Response({'error': 'Reservación no existe.'}, status=status.HTTP_404_NOT_FOUND)

            if res.status != 'reserved':
                return Response({'error': 'La reservación no está en estado reservado.'}, status=status.HTTP_400_BAD_REQUEST)

            room = res.room
            if room.status != 'available':
                return Response({'error': f'La habitación {room.room_number} no está disponible (Estado actual: {room.get_status_display()}).'}, status=status.HTTP_400_BAD_REQUEST)

            res.status = 'active'
            res.check_in_date = timezone.now()
            res.save()

            room.status = 'occupied'
            room.save()
            return Response(ReservationSerializer(res).data, status=status.HTTP_200_OK)

        room_id = request.data.get('room')
        guest_data = request.data.get('guest_data', {})
        number_of_adults = int(request.data.get('number_of_adults', 1))
        number_of_children = int(request.data.get('number_of_children', 0))
        planned_check_out = request.data.get('planned_check_out')
        notes = request.data.get('notes', '')

        if not room_id:
            return Response({'error': 'Habitación es requerida.'}, status=status.HTTP_400_BAD_REQUEST)
        if not planned_check_out:
            return Response({'error': 'Fecha/Hora Salida Planeada es requerida para el check-in.'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            room = Room.objects.get(id=room_id)
        except Room.DoesNotExist:
            return Response({'error': 'Habitación no existe.'}, status=status.HTTP_404_NOT_FOUND)

        if room.status != 'available':
            return Response({'error': f'La habitación {room.room_number} no está disponible (Estado actual: {room.get_status_display()}).'}, status=status.HTTP_400_BAD_REQUEST)

        # Buscar o crear Huésped
        ident = guest_data.get('identification')
        if not ident:
            return Response({'error': 'Identificación del huésped es requerida.'}, status=status.HTTP_400_BAD_REQUEST)

        guest, created = Guest.objects.get_or_create(
            identification=ident,
            defaults={
                'identification_type': guest_data.get('identification_type', '05'),
                'name': guest_data.get('name', ''),
                'email': guest_data.get('email', ''),
                'phone': guest_data.get('phone', ''),
                'address': guest_data.get('address', '')
            }
        )

        if not created:
            guest.identification_type = guest_data.get('identification_type', guest.identification_type)
            guest.name = guest_data.get('name', guest.name)
            guest.email = guest_data.get('email', guest.email)
            guest.phone = guest_data.get('phone', guest.phone)
            guest.address = guest_data.get('address', guest.address)
            guest.save()

        # Crear reservación activa
        reservation_data = {
            'room': room.id,
            'guest': guest.id,
            'check_in_date': timezone.now(),
            'planned_check_out': planned_check_out,
            'number_of_adults': number_of_adults,
            'number_of_children': number_of_children,
            'notes': notes,
            'status': 'active'
        }
        
        serializer = self.get_serializer(data=reservation_data)
        if serializer.is_valid():
            res = serializer.save()
            room.status = 'occupied'
            room.save()
            return Response(ReservationSerializer(res).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='check-out')
    def check_out(self, request, pk=None):
        """
        Completa el Checkout de la habitación, procesando pagos y opcionalmente facturación electrónica.
        """
        reservation = self.get_object()
        if reservation.status != 'active':
            return Response({'error': 'La reserva no está activa o ya se le hizo check-out.'}, status=status.HTTP_400_BAD_REQUEST)

        payment_method = request.data.get('payment_method', 'cash')
        process_sri = request.data.get('process_sri', False)
        billing_data = request.data.get('billing_data', {})

        # Calcular costo total de la estadía
        check_in = reservation.check_in_date
        check_out = timezone.now()
        delta = check_out - check_in
        nights = delta.days
        if nights <= 0:
            nights = 1  # Cobrar mínimo 1 noche
        
        total_amount = Decimal(nights) * reservation.room.price_per_night
        
        remaining_amount = total_amount - reservation.deposit_amount
        if remaining_amount < 0:
            remaining_amount = Decimal('0.0')

        reservation.total_amount = total_amount
        reservation.check_out_date = check_out
        reservation.status = 'checked_out'
        reservation.save()

        # Cambiar estado de la habitación a limpieza
        room = reservation.room
        room.status = 'cleaning'
        room.save()

        # Registrar Pago
        payment = Payment.objects.create(
            reservation=reservation,
            amount=remaining_amount,
            payment_method=payment_method,
            is_deposit=False,
            sri_status='DRAFT'
        )

        # Si requiere facturación electrónica SRI
        if process_sri:
            sri_config = SRIConfiguration.objects.filter(is_active=True).first()
            if not sri_config or not sri_config.vsr_token:
                payment.sri_status = 'REJECTED'
                payment.save()
                return Response({
                    'message': 'Check-out completado pero la facturación falló: Configuración SRI no configurada o inactiva.',
                    'reservation': ReservationSerializer(reservation).data,
                    'invoice_error': 'SRI_CONFIGURATION_MISSING'
                }, status=status.HTTP_200_OK)

            customer_identification_type = billing_data.get('identification_type', reservation.guest.identification_type)
            customer_identification = billing_data.get('identification', reservation.guest.identification)
            customer_name = billing_data.get('name', reservation.guest.name)
            customer_email = billing_data.get('email', reservation.guest.email)
            customer_address = billing_data.get('address', reservation.guest.address or 'N/A')
            customer_phone = billing_data.get('phone', reservation.guest.phone or '0000000000')

            issue_date = timezone.now().strftime('%Y-%m-%d')

            item_hospedaje = {
                'main_code': f'HOSP-{room.room_number}',
                'description': f'Servicio de Hospedaje Habitación {room.room_number} - {nights} Noches',
                'quantity': float(nights),
                'unit_price': float(room.price_per_night),
                'discount': float(reservation.deposit_amount)
            }

            payload = {
                'issue_date': issue_date,
                'customer_identification_type': customer_identification_type,
                'customer_identification': customer_identification,
                'customer_name': customer_name,
                'customer_address': customer_address,
                'customer_email': customer_email,
                'customer_phone': customer_phone,
                'send_email': True,
                'items': [item_hospedaje]
            }

            headers = {
                'Content-Type': 'application/json',
                'Authorization': f'Token {sri_config.vsr_token}'
            }

            try:
                payment.sri_status = 'QUEUED'
                payment.save()

                self._broadcast_websocket_status(reservation.id, 'QUEUED', 'Factura enviada a cola de procesamiento.')

                response = requests.post(
                    'https://factuexpress.fronteratech.ec/api/sri/documents/create_and_process_invoice_complete/',
                    json=payload,
                    headers=headers,
                    timeout=10
                )

                if response.status_code == 201:
                    resp_data = response.json()
                    is_success = resp_data.get('success', False)
                    invoice_data = resp_data.get('invoice', {})

                    payment.sri_access_key = invoice_data.get('access_key')
                    payment.sri_number = invoice_data.get('number')
                    
                    if is_success:
                        payment.sri_status = 'AUTHORIZED'
                        payment.save()
                        self._broadcast_websocket_status(reservation.id, 'AUTHORIZED', 'Factura autorizada exitosamente por el SRI.')
                        return Response({
                            'message': 'Check-out completado y Factura Autorizada.',
                            'reservation': ReservationSerializer(reservation).data,
                            'invoice': invoice_data
                        })
                    else:
                        payment.sri_status = 'REJECTED'
                        payment.save()
                        self._broadcast_websocket_status(reservation.id, 'REJECTED', f"Fallo SRI: {invoice_data.get('error_details', 'Error desconocido')}")
                        return Response({
                            'message': 'Check-out completado pero la factura falló ante el SRI.',
                            'reservation': ReservationSerializer(reservation).data,
                            'invoice_error': invoice_data.get('error_details')
                        })
                else:
                    payment.sri_status = 'REJECTED'
                    payment.save()
                    err_msg = response.json().get('message', 'Error en la llamada al API.')
                    self._broadcast_websocket_status(reservation.id, 'REJECTED', f"Fallo API: {err_msg}")
                    return Response({
                        'message': 'Check-out completado pero la factura fue rechazada por el servidor.',
                        'reservation': ReservationSerializer(reservation).data,
                        'invoice_error': err_msg
                    })

            except requests.exceptions.RequestException as e:
                payment.sri_status = 'REJECTED'
                payment.save()
                self._broadcast_websocket_status(reservation.id, 'REJECTED', f"Error de red: {str(e)}")
                return Response({
                    'message': 'Check-out completado pero no se pudo contactar al servidor de facturación.',
                    'reservation': ReservationSerializer(reservation).data,
                    'invoice_error': str(e)
                })

        return Response({
            'message': 'Check-out completado sin emisión de factura electrónica.',
            'reservation': ReservationSerializer(reservation).data
        })

    @action(detail=True, methods=['post'], url_path='cancel')
    def cancel(self, request, pk=None):
        """
        Cancela una reserva.
        """
        reservation = self.get_object()
        if reservation.status not in ['reserved', 'active']:
            return Response({'error': 'Solo se pueden cancelar reservas en estado Activo o Reservado.'}, status=status.HTTP_400_BAD_REQUEST)

        reservation.status = 'cancelled'
        reservation.save()

        room = reservation.room
        active_exists = Reservation.objects.filter(room=room, status='active').exclude(id=reservation.id).exists()
        if not active_exists and room.status == 'occupied':
            room.status = 'available'
            room.save()

        return Response(ReservationSerializer(reservation).data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='calendar')
    def calendar(self, request):
        """
        Retorna las reservas en un rango de fechas.
        """
        start_param = request.query_params.get('start')
        end_param = request.query_params.get('end')

        queryset = self.queryset.filter(status__in=['active', 'reserved'])

        if start_param:
            queryset = queryset.filter(Q(planned_check_out__gte=start_param) | Q(check_out_date__gte=start_param) | Q(check_in_date__gte=start_param))
        if end_param:
            queryset = queryset.filter(check_in_date__lte=end_param)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='today-alerts')
    def today_alerts(self, request):
        """
        Alertas de llegadas y salidas para hoy.
        """
        today = timezone.localtime(timezone.now()).date()
        
        arrivals = Reservation.objects.filter(
            status='reserved',
            check_in_date__date=today
        )

        departures = Reservation.objects.filter(
            status='active',
            planned_check_out__date__lte=today
        )

        return Response({
            'arrivals': ReservationSerializer(arrivals, many=True).data,
            'departures': ReservationSerializer(departures, many=True).data
        })

    @action(detail=False, methods=['get'], url_path='public/(?P<code>[^/.]+)', permission_classes=[AllowAny], authentication_classes=[])
    def public_detail(self, request, code=None):

        """
        Detalle público de una reservación sin requerir autenticación.
        """
        try:
            reservation = Reservation.objects.get(reservation_code=code)
        except Reservation.DoesNotExist:
            return Response({'error': 'Reservación no encontrada.'}, status=status.HTTP_404_NOT_FOUND)

        settings = HotelSettings.objects.first()
        settings_data = HotelSettingsSerializer(settings).data if settings else {
            'hotel_name': 'Hotel Park',
            'hotel_address': '',
            'hotel_phone': ''
        }

        return Response({
            'reservation': ReservationSerializer(reservation).data,
            'hotel_settings': settings_data
        })

    def _broadcast_websocket_status(self, reservation_id, status_code, message):
        """Transmite el estado del SRI a través del canal websocket del grupo"""
        try:
            from channels.layers import get_channel_layer
            from asgiref.sync import async_to_sync
            channel_layer = get_channel_layer()
            if channel_layer:
                async_to_sync(channel_layer.group_send)(
                    f"invoice_status_{reservation_id}",
                    {
                        "type": "invoice.status_update",
                        "status": status_code,
                        "message": message
                    }
                )
        except Exception as e:
            logger.error(f"Error al enviar mensaje por websocket: {str(e)}")

class PaymentViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Payment.objects.all()
    serializer_class = PaymentSerializer
    permission_classes = [IsJWTAuthenticated]

class SRIConfigurationViewSet(viewsets.ModelViewSet):
    queryset = SRIConfiguration.objects.all()
    serializer_class = SRIConfigurationSerializer
    permission_classes = [IsJWTAuthenticated]

    def list(self, request):
        config = SRIConfiguration.objects.first()
        if not config:
            config = SRIConfiguration.objects.create(is_active=False)
        serializer = self.get_serializer(config)
        return Response(serializer.data)

class HotelSettingsViewSet(viewsets.ModelViewSet):
    queryset = HotelSettings.objects.all()
    serializer_class = HotelSettingsSerializer
    permission_classes = [IsJWTAuthenticated]

    def list(self, request):
        config = HotelSettings.objects.first()
        if not config:
            config = HotelSettings.objects.create(
                hotel_name="Hotel Park",
                default_checkin_time="14:00",
                default_checkout_time="12:00"
            )
        serializer = self.get_serializer(config)
        return Response(serializer.data)

    @action(detail=False, methods=['put', 'patch'], url_path='update-settings')
    def update_settings(self, request):
        config = HotelSettings.objects.first()
        if not config:
            config = HotelSettings.objects.create()
        serializer = self.get_serializer(config, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
