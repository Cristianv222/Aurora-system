from django.test import TestCase
from rest_framework.test import APITestCase
from rest_framework import status
from unittest.mock import patch
from decimal import Decimal
from django.utils import timezone
import datetime

from apps.rooms.models import Room, Floor, RoomType
from apps.guests.models import Guest
from apps.reservations.models import Reservation, Payment
from apps.reports.models import Shift

class HotelShiftAPITests(APITestCase):

    def setUp(self):
        # Create test floor, room type and room
        self.floor = Floor.objects.create(name="Piso 1", order=1)
        self.room_type, _ = RoomType.objects.get_or_create(
            name="Individual",
            defaults={
                'price_per_adult': 15.00,
                'price_per_child': 8.00,
                'adult_capacity': 1,
                'child_capacity': 1
            }
        )
        self.room = Room.objects.create(
            floor=self.floor,
            room_number="101",
            room_type=self.room_type,
            status="available"
        )
        
        # Mock auth token verification response
        self.auth_patcher = patch('requests.post')
        self.mock_post = self.auth_patcher.start()
        
        self.mock_post.return_value.status_code = 200
        self.mock_post.return_value.json.return_value = {
            'user_id': 'test-user-uuid-12345',
            'username': 'recepcionista_test',
            'email': 'test@aurora.com',
            'role': 'receptionist',
            'is_staff': False,
            'is_superuser': False
        }
        
        self.client.credentials(HTTP_AUTHORIZATION='Bearer mock-jwt-token')

    def tearDown(self):
        self.auth_patcher.stop()

    def test_open_shift_and_close_shift(self):
        # 1. Open shift
        response = self.client.post('/api/reports/shifts/', {
            'opening_cash': 100.00,
            'opening_notes': 'Apertura de prueba'
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        shift_id = response.data['id']
        self.assertEqual(response.data['status'], 'open')
        self.assertEqual(float(response.data['opening_cash']), 100.00)

        # Try to open another shift when one is already open
        response_dup = self.client.post('/api/reports/shifts/', {
            'opening_cash': 50.00
        })
        self.assertEqual(response_dup.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Ya tienes un turno abierto', response_dup.data['error'])

        # 2. Close shift
        response_close = self.client.post(f'/api/reports/shifts/{shift_id}/close/', {
            'closing_cash': 100.00,
            'closing_notes': 'Cierre de prueba'
        })
        self.assertEqual(response_close.status_code, status.HTTP_200_OK)
        self.assertEqual(response_close.data['shift']['status'], 'closed')
        self.assertEqual(float(response_close.data['shift']['cash_difference']), 0.00)

    def test_reservation_deposit_enforces_shift(self):
        # Try to book a reservation when no shift is open
        guest_data = {
            'identification': '0999999999',
            'identification_type': '05',
            'name': 'Huesped Test',
            'email': 'testguest@aurora.com',
            'phone': '099999999',
            'address': 'Quito',
            'nationality': 'Ecuatoriana',
            'origin_city': 'Quito'
        }
        
        # 1. Booking WITHOUT deposit (should fail because no shift is open)
        response = self.client.post('/api/reservations/reserve/', {
            'room': self.room.id,
            'guest_data': guest_data,
            'check_in_date': timezone.now().isoformat(),
            'planned_check_out': (timezone.now() + datetime.timedelta(days=2)).isoformat(),
            'deposit_amount': 0.00
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # 2. Open shift
        self.client.post('/api/reports/shifts/', {
            'opening_cash': 100.00,
            'opening_notes': 'Turno de prueba'
        })

        # 3. Booking with deposit after opening shift (should succeed)
        response_with_shift = self.client.post('/api/reservations/reserve/', {
            'room': self.room.id,
            'guest_data': guest_data,
            'check_in_date': timezone.now().isoformat(),
            'planned_check_out': (timezone.now() + datetime.timedelta(days=2)).isoformat(),
            'deposit_amount': 20.00,
            'payment_method': 'cash'
        }, format='json')
        self.assertEqual(response_with_shift.status_code, status.HTTP_201_CREATED)

    def test_checkout_enforces_shift_and_creates_payment(self):
        # Create a pre-existing active reservation
        guest = Guest.objects.create(
            identification='0888888888',
            name='Otro Huésped',
            nationality='Ecuatoriana',
            origin_city='Guayaquil'
        )
        
        reservation = Reservation.objects.create(
            room=self.room,
            guest=guest,
            check_in_date=timezone.now() - datetime.timedelta(days=2),
            planned_check_out=timezone.now(),
            deposit_amount=10.00,
            deposit_paid=True,
            number_of_adults=1,
            status='active'
        )
        self.room.status = 'occupied'
        self.room.save()

        # Checkout payment without open shift (should fail)
        response_checkout_fail = self.client.post(f'/api/reservations/{reservation.id}/check-out/', {
            'payment_method': 'cash'
        })
        self.assertEqual(response_checkout_fail.status_code, status.HTTP_403_FORBIDDEN)

        # Open shift
        self.client.post('/api/reports/shifts/', {
            'opening_cash': 100.00
        })

        # Checkout payment with open shift (should succeed)
        response_checkout_ok = self.client.post(f'/api/reservations/{reservation.id}/check-out/', {
            'payment_method': 'cash'
        })
        self.assertEqual(response_checkout_ok.status_code, status.HTTP_200_OK)
        
        # Verify reservation status is now checked_out
        reservation.refresh_from_db()
        self.assertEqual(reservation.status, 'checked_out')
        
        # Verify payment was created and linked to the active shift
        payment = Payment.objects.filter(reservation=reservation, is_deposit=False).first()
        self.assertIsNotNone(payment)
        self.assertIsNotNone(payment.shift)
        self.assertEqual(float(payment.amount), 20.00) # (15.00 * 2 nights) - 10.00 deposit
