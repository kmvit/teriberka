"""
Тесты для API boats
"""
import pytest
from django.urls import reverse
from rest_framework import status
from apps.boats.models import Boat, BoatFeature, BoatPricing, BoatAvailability


@pytest.mark.django_db
class TestBoatList:
    """Тесты списка судов"""
    
    def test_list_boats_public(self, api_client, boat):
        """Тест публичного доступа к списку судов"""
        url = reverse('boats:boat-list')
        response = api_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) > 0
    
    def test_list_boats_filter_by_type(self, api_client, boat):
        """Тест фильтрации по типу судна"""
        url = reverse('boats:boat-list')
        response = api_client.get(url, {'boat_type': 'boat'})
        assert response.status_code == status.HTTP_200_OK
    
    def test_list_boats_search(self, api_client, boat):
        """Тест поиска по названию"""
        url = reverse('boats:boat-list')
        response = api_client.get(url, {'search': 'Тестовый'})
        assert response.status_code == status.HTTP_200_OK


@pytest.mark.django_db
class TestBoatDetail:
    """Тесты деталей судна"""
    
    def test_get_boat_detail_public(self, api_client, boat):
        """Тест публичного доступа к деталям судна"""
        url = reverse('boats:boat-detail', kwargs={'pk': boat.id})
        response = api_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['name'] == 'Тестовый катер'
    
    def test_get_boat_not_found(self, api_client):
        """Тест получения несуществующего судна"""
        url = reverse('boats:boat-detail', kwargs={'pk': 99999})
        response = api_client.get(url)
        assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
class TestBoatCreate:
    """Тесты создания судна"""
    
    def test_create_boat_requires_auth(self, api_client):
        """Тест что создание требует авторизации"""
        url = reverse('boats:boat-list')
        data = {
            'name': 'Новое судно',
            'boat_type': 'boat',
            'capacity': 11,
            'description': 'Описание'
        }
        response = api_client.post(url, data)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_create_boat_success(self, boat_owner_client):
        """Тест успешного создания судна"""
        url = reverse('boats:boat-list')
        data = {
            'name': 'Новое судно',
            'boat_type': 'boat',
            'capacity': 11,
            'description': 'Описание нового судна',
            'features': ['toilet', 'blankets'],
            'pricing': [
                {'duration_hours': 2, 'price_per_person': 4000},
                {'duration_hours': 3, 'price_per_person': 5000}
            ]
        }
        response = boat_owner_client.post(url, data, format='json')
        assert response.status_code == status.HTTP_201_CREATED
        assert Boat.objects.filter(name='Новое судно').exists()


@pytest.mark.django_db
class TestBoatUpdate:
    """Тесты обновления судна"""
    
    def test_update_own_boat(self, boat_owner_client, boat):
        """Тест обновления своего судна"""
        url = reverse('boats:boat-detail', kwargs={'pk': boat.id})
        data = {
            'name': 'Обновленное название',
            'description': 'Новое описание'
        }
        response = boat_owner_client.patch(url, data, format='json')
        assert response.status_code == status.HTTP_200_OK
        boat.refresh_from_db()
        assert boat.name == 'Обновленное название'
    
    def test_update_other_boat_forbidden(self, customer_client, boat):
        """Тест что нельзя обновлять чужое судно"""
        url = reverse('boats:boat-detail', kwargs={'pk': boat.id})
        data = {'name': 'Взломанное название'}
        response = customer_client.patch(url, data, format='json')
        assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
class TestBoatAvailability:
    """Тесты расписания доступности"""
    
    def test_get_availability(self, boat_owner_client, boat, boat_availability):
        """Тест получения расписания"""
        url = reverse('boats:boat-availability', kwargs={'pk': boat.id})
        response = boat_owner_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) > 0
    
    def test_create_availability(self, boat_owner_client, boat):
        """Тест создания расписания"""
        url = reverse('boats:boat-availability', kwargs={'pk': boat.id})
        from datetime import datetime, timedelta
        tomorrow = datetime.now().date() + timedelta(days=1)
        data = {
            'departure_date': tomorrow.isoformat(),
            'departure_time': '14:00:00',
            'return_time': '16:00:00'
        }
        response = boat_owner_client.post(url, data, format='json')
        assert response.status_code == status.HTTP_201_CREATED
        assert BoatAvailability.objects.filter(boat=boat).exists()

