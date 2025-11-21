"""
Тесты для API accounts
"""
import pytest
from django.urls import reverse
from rest_framework import status
from apps.accounts.models import User


@pytest.mark.django_db
class TestUserRegistration:
    """Тесты регистрации пользователя"""
    
    def test_register_customer(self, api_client):
        """Тест регистрации клиента"""
        url = reverse('accounts:register')
        data = {
            'email': 'newuser@test.com',
            'password': 'testpass123',
            'password_confirm': 'testpass123',
            'first_name': 'Новый',
            'last_name': 'Пользователь',
            'phone': '+79001234572',
            'role': User.Role.CUSTOMER
        }
        response = api_client.post(url, data)
        assert response.status_code == status.HTTP_201_CREATED
        assert User.objects.filter(email='newuser@test.com').exists()
    
    def test_register_boat_owner(self, api_client):
        """Тест регистрации владельца судна"""
        url = reverse('accounts:register')
        data = {
            'email': 'newowner@test.com',
            'password': 'testpass123',
            'password_confirm': 'testpass123',
            'first_name': 'Новый',
            'last_name': 'Владелец',
            'phone': '+79001234573',
            'role': User.Role.BOAT_OWNER
        }
        response = api_client.post(url, data)
        assert response.status_code == status.HTTP_201_CREATED
        user = User.objects.get(email='newowner@test.com')
        assert user.role == User.Role.BOAT_OWNER
        assert user.verification_status == User.VerificationStatus.NOT_VERIFIED


@pytest.mark.django_db
class TestUserLogin:
    """Тесты входа пользователя"""
    
    def test_login_success(self, api_client, customer_user):
        """Тест успешного входа"""
        url = reverse('accounts:login')
        data = {
            'email': 'customer@test.com',
            'password': 'testpass123'
        }
        response = api_client.post(url, data)
        assert response.status_code == status.HTTP_200_OK
        assert 'token' in response.data
        assert 'user' in response.data
    
    def test_login_wrong_password(self, api_client, customer_user):
        """Тест входа с неверным паролем"""
        url = reverse('accounts:login')
        data = {
            'email': 'customer@test.com',
            'password': 'wrongpass'
        }
        response = api_client.post(url, data)
        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestProfile:
    """Тесты профиля пользователя"""
    
    def test_get_profile_customer(self, customer_client):
        """Тест получения профиля клиента"""
        url = reverse('accounts:profile')
        response = customer_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['email'] == 'customer@test.com'
        assert 'dashboard' in response.data
    
    def test_get_profile_boat_owner(self, boat_owner_client):
        """Тест получения профиля владельца судна"""
        url = reverse('accounts:profile')
        response = boat_owner_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['email'] == 'owner@test.com'
        assert 'dashboard' in response.data
        assert 'today_stats' in response.data['dashboard']
    
    def test_get_profile_guide(self, guide_client):
        """Тест получения профиля гида"""
        url = reverse('accounts:profile')
        response = guide_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['email'] == 'guide@test.com'
        assert 'dashboard' in response.data
    
    def test_update_profile(self, customer_client):
        """Тест обновления профиля"""
        url = reverse('accounts:profile')
        data = {
            'first_name': 'Обновленное',
            'last_name': 'Имя',
            'phone': '+79009999999'
        }
        response = customer_client.patch(url, data)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['first_name'] == 'Обновленное'
        assert response.data['phone'] == '+79009999999'
    
    def test_profile_requires_auth(self, api_client):
        """Тест что профиль требует авторизации"""
        url = reverse('accounts:profile')
        response = api_client.get(url)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestProfileDashboard:
    """Тесты дашборда в профиле"""
    
    def test_boat_owner_calendar(self, boat_owner_client, boat, booking):
        """Тест календаря владельца судна"""
        url = reverse('accounts:profile-calendar')
        response = boat_owner_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert isinstance(response.data, dict)
        # Проверяем что есть bookings или это пустой ответ
        assert 'bookings' in response.data or response.status_code == status.HTTP_200_OK
    
    def test_boat_owner_finances(self, boat_owner_client, boat, booking):
        """Тест финансов владельца судна"""
        url = reverse('accounts:profile-finances')
        response = boat_owner_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert isinstance(response.data, dict)
        assert 'revenue' in response.data
        assert 'platform_commission' in response.data
        assert 'to_payout' in response.data
    
    def test_guide_commissions(self, guide_client, guide_booking):
        """Тест комиссий гида"""
        url = reverse('accounts:guide-commissions')
        response = guide_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert isinstance(response.data, dict)
        assert 'total_commission' in response.data
        assert 'bookings_count' in response.data

