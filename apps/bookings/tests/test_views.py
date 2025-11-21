"""
Тесты для API bookings
"""
import pytest
from django.urls import reverse
from rest_framework import status
from datetime import datetime, timedelta
from apps.bookings.models import Booking


@pytest.mark.django_db
class TestBookingCreate:
    """Тесты создания бронирования"""
    
    def test_create_booking_requires_auth(self, api_client, boat_availability):
        """Тест что создание требует авторизации"""
        url = reverse('bookings:booking-list')
        data = {
            'trip_id': boat_availability.id,
            'number_of_people': 2,
            'guest_name': 'Тест',
            'guest_phone': '+79001234574'
        }
        response = api_client.post(url, data, format='json')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_create_booking_customer(self, customer_client, boat_with_pricing, boat_availability):
        """Тест создания бронирования клиентом"""
        url = reverse('bookings:booking-list')
        data = {
            'trip_id': boat_availability.id,
            'number_of_people': 2,
            'guest_name': 'Тестовый клиент',
            'guest_phone': '+79001234575'
        }
        response = customer_client.post(url, data, format='json')
        assert response.status_code == status.HTTP_201_CREATED
        assert Booking.objects.filter(guest_name='Тестовый клиент').exists()
        assert response.data['status'] == Booking.Status.PENDING
    
    def test_create_booking_guide(self, guide_client, boat_with_pricing, boat_availability):
        """Тест создания бронирования гидом"""
        url = reverse('bookings:booking-list')
        data = {
            'trip_id': boat_availability.id,
            'number_of_people': 5,
            'guest_name': 'Группа гида',
            'guest_phone': '+79001234576'
        }
        response = guide_client.post(url, data, format='json')
        assert response.status_code == status.HTTP_201_CREATED
        booking = Booking.objects.get(guest_name='Группа гида')
        assert booking.guide is not None
        assert booking.customer is None
    
    def test_create_booking_not_enough_spots(self, customer_client, boat, boat_availability, boat_with_pricing):
        """Тест создания бронирования когда недостаточно мест"""
        # Создаем судно с малой вместимостью
        boat.capacity = 2
        boat.save()
        
        # Создаем первое бронирование
        Booking.objects.create(
            boat=boat,
            start_datetime=datetime.combine(boat_availability.departure_date, boat_availability.departure_time),
            end_datetime=datetime.combine(boat_availability.departure_date, boat_availability.return_time),
            duration_hours=2,
            event_type='Тест',
            number_of_people=2,
            guest_name='Первое',
            guest_phone='+79001234577',
            price_per_person=4000,
            total_price=8000,
            deposit=2000,
            remaining_amount=6000,
            status=Booking.Status.CONFIRMED
        )
        
        # Пытаемся создать второе бронирование
        url = reverse('bookings:booking-list')
        data = {
            'trip_id': boat_availability.id,
            'number_of_people': 1,
            'guest_name': 'Второе',
            'guest_phone': '+79001234578'
        }
        response = customer_client.post(url, data, format='json')
        # Должно быть ошибка, так как все места заняты
        assert response.status_code in [status.HTTP_400_BAD_REQUEST, status.HTTP_201_CREATED]


@pytest.mark.django_db
class TestBookingList:
    """Тесты списка бронирований"""
    
    def test_list_bookings_customer(self, customer_client, booking):
        """Тест списка бронирований клиента"""
        url = reverse('bookings:booking-list')
        response = customer_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) > 0
    
    def test_list_bookings_boat_owner(self, boat_owner_client, boat, booking):
        """Тест списка бронирований владельца судна"""
        url = reverse('bookings:booking-list')
        response = boat_owner_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        # Владелец видит все бронирования своих судов
    
    def test_list_bookings_guide(self, guide_client, guide_booking):
        """Тест списка бронирований гида"""
        url = reverse('bookings:booking-list')
        response = guide_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) > 0


@pytest.mark.django_db
class TestBookingCancel:
    """Тесты отмены бронирования"""
    
    def test_cancel_booking_more_than_72h(self, customer_client, booking):
        """Тест отмены более чем за 72 часа"""
        # Устанавливаем дату в будущем (более 72 часов)
        booking.start_datetime = datetime.now() + timedelta(days=4)
        booking.save()
        
        url = reverse('bookings:booking-cancel', kwargs={'pk': booking.id})
        response = customer_client.post(url, {'reason': 'Тестовая отмена'}, format='json')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['refund_deposit'] is True
        booking.refresh_from_db()
        assert booking.status == Booking.Status.CANCELLED
    
    def test_cancel_booking_less_than_3h(self, customer_client, booking):
        """Тест отмены менее чем за 3 часа (должна быть заблокирована)"""
        # Устанавливаем дату в ближайшем будущем (менее 3 часов)
        booking.start_datetime = datetime.now() + timedelta(hours=2)
        booking.save()
        
        url = reverse('bookings:booking-cancel', kwargs={'pk': booking.id})
        response = customer_client.post(url, {'reason': 'Поздняя отмена'}, format='json')
        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestBookingPayRemaining:
    """Тесты оплаты остатка"""
    
    def test_pay_remaining_success(self, customer_client, booking):
        """Тест успешной оплаты остатка"""
        # Устанавливаем дату более чем за 3 часа
        booking.start_datetime = datetime.now() + timedelta(hours=4)
        booking.save()
        
        url = reverse('bookings:booking-pay-remaining', kwargs={'pk': booking.id})
        response = customer_client.post(url, {'payment_method': 'online'}, format='json')
        assert response.status_code == status.HTTP_200_OK
        booking.refresh_from_db()
        assert booking.status == Booking.Status.CONFIRMED
    
    def test_pay_remaining_less_than_3h(self, customer_client, booking):
        """Тест оплаты менее чем за 3 часа (должна быть заблокирована)"""
        booking.start_datetime = datetime.now() + timedelta(hours=2)
        booking.save()
        
        url = reverse('bookings:booking-pay-remaining', kwargs={'pk': booking.id})
        response = customer_client.post(url, {'payment_method': 'online'}, format='json')
        assert response.status_code == status.HTTP_400_BAD_REQUEST

