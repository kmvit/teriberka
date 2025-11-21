"""
Глобальные фикстуры для pytest
"""
import pytest
from decimal import Decimal
from datetime import datetime, timedelta
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework.authtoken.models import Token

from apps.accounts.models import User, BoatOwnerVerification
from apps.boats.models import Boat, BoatImage, BoatFeature, BoatPricing, BoatAvailability, SailingZone
from apps.bookings.models import Booking

User = get_user_model()


@pytest.fixture
def api_client():
    """API клиент для тестирования"""
    return APIClient()


@pytest.fixture
def customer_user(db):
    """Создает обычного пользователя (клиента)"""
    user = User.objects.create_user(
        email='customer@test.com',
        password='testpass123',
        first_name='Иван',
        last_name='Иванов',
        phone='+79001234567',
        role=User.Role.CUSTOMER,
        is_active=True
    )
    return user


@pytest.fixture
def customer_client(api_client, customer_user):
    """API клиент с авторизованным клиентом"""
    token, _ = Token.objects.get_or_create(user=customer_user)
    api_client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')
    return api_client


@pytest.fixture
def boat_owner_user(db):
    """Создает владельца судна"""
    user = User.objects.create_user(
        email='owner@test.com',
        password='testpass123',
        first_name='Петр',
        last_name='Петров',
        phone='+79001234568',
        role=User.Role.BOAT_OWNER,
        verification_status=User.VerificationStatus.VERIFIED,
        is_active=True
    )
    return user


@pytest.fixture
def boat_owner_client(api_client, boat_owner_user):
    """API клиент с авторизованным владельцем судна"""
    token, _ = Token.objects.get_or_create(user=boat_owner_user)
    api_client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')
    return api_client


@pytest.fixture
def guide_user(db):
    """Создает гида"""
    user = User.objects.create_user(
        email='guide@test.com',
        password='testpass123',
        first_name='Мария',
        last_name='Сидорова',
        phone='+79001234569',
        role=User.Role.GUIDE,
        verification_status=User.VerificationStatus.VERIFIED,
        is_active=True
    )
    return user


@pytest.fixture
def guide_client(api_client, guide_user):
    """API клиент с авторизованным гидом"""
    token, _ = Token.objects.get_or_create(user=guide_user)
    api_client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')
    return api_client


@pytest.fixture
def boat(boat_owner_user, db):
    """Создает тестовое судно"""
    boat = Boat.objects.create(
        name='Тестовый катер',
        boat_type=Boat.BoatType.BOAT,
        owner=boat_owner_user,
        capacity=11,
        description='Описание тестового катера',
        is_active=True
    )
    return boat


@pytest.fixture
def boat_with_pricing(boat, db):
    """Создает судно с ценами"""
    BoatPricing.objects.create(
        boat=boat,
        duration_hours=2,
        price_per_person=Decimal('4000')
    )
    BoatPricing.objects.create(
        boat=boat,
        duration_hours=3,
        price_per_person=Decimal('5000')
    )
    return boat


@pytest.fixture
def boat_with_features(boat, db):
    """Создает судно с особенностями"""
    BoatFeature.objects.create(boat=boat, feature_type=BoatFeature.FeatureType.TOILET)
    BoatFeature.objects.create(boat=boat, feature_type=BoatFeature.FeatureType.BLANKETS)
    BoatFeature.objects.create(boat=boat, feature_type=BoatFeature.FeatureType.TEA_COFFEE)
    return boat


@pytest.fixture
def boat_availability(boat, db):
    """Создает доступный слот для судна"""
    tomorrow = datetime.now().date() + timedelta(days=1)
    availability = BoatAvailability.objects.create(
        boat=boat,
        departure_date=tomorrow,
        departure_time=datetime.strptime('11:00', '%H:%M').time(),
        return_time=datetime.strptime('13:00', '%H:%M').time(),
        is_active=True
    )
    return availability


@pytest.fixture
def sailing_zone(db):
    """Создает маршрут"""
    zone = SailingZone.objects.create(
        name='Прогулка с китами',
        description='Маршрут проходит через места обитания китов',
        is_active=True
    )
    return zone


@pytest.fixture
def booking(boat, customer_user, boat_with_pricing, db):
    """Создает тестовое бронирование"""
    tomorrow = datetime.now() + timedelta(days=1)
    start_datetime = tomorrow.replace(hour=11, minute=0, second=0, microsecond=0)
    end_datetime = tomorrow.replace(hour=13, minute=0, second=0, microsecond=0)
    
    booking = Booking.objects.create(
        boat=boat,
        start_datetime=start_datetime,
        end_datetime=end_datetime,
        duration_hours=2,
        event_type='Выход в море',
        customer=customer_user,
        number_of_people=2,
        guest_name='Тестовый гость',
        guest_phone='+79001234570',
        price_per_person=Decimal('4000'),
        total_price=Decimal('8000'),
        deposit=Decimal('2000'),
        remaining_amount=Decimal('6000'),
        status=Booking.Status.PENDING
    )
    return booking


@pytest.fixture
def guide_booking(boat, guide_user, boat_with_pricing, db):
    """Создает бронирование от гида"""
    tomorrow = datetime.now() + timedelta(days=2)
    start_datetime = tomorrow.replace(hour=12, minute=0, second=0, microsecond=0)
    end_datetime = tomorrow.replace(hour=14, minute=0, second=0, microsecond=0)
    
    booking = Booking.objects.create(
        boat=boat,
        start_datetime=start_datetime,
        end_datetime=end_datetime,
        duration_hours=2,
        event_type='Группа от гида',
        guide=guide_user,
        number_of_people=5,
        guest_name='Группа гида',
        guest_phone='+79001234571',
        price_per_person=Decimal('4000'),
        total_price=Decimal('20000'),
        deposit=Decimal('5000'),
        remaining_amount=Decimal('15000'),
        status=Booking.Status.PENDING
    )
    return booking


@pytest.fixture
def guide_discount(guide_user, boat_owner_user, db):
    """Создает скидку для гида (используется для комиссий)"""
    from apps.boats.models import GuideBoatDiscount
    discount = GuideBoatDiscount.objects.create(
        guide=guide_user,
        boat_owner=boat_owner_user,
        discount_percent=Decimal('15'),
        is_active=True
    )
    return discount

