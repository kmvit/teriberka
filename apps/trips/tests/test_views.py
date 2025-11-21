"""
Тесты для API trips
"""
import pytest
from django.urls import reverse
from rest_framework import status
from datetime import datetime, timedelta


@pytest.mark.django_db
class TestAvailableTrips:
    """Тесты поиска доступных рейсов"""
    
    def test_search_trips_public(self, api_client, boat_availability):
        """Тест публичного поиска рейсов"""
        url = reverse('trips:available-trips')
        tomorrow = (datetime.now() + timedelta(days=1)).date()
        response = api_client.get(url, {'date': tomorrow.isoformat()})
        assert response.status_code == status.HTTP_200_OK
        assert isinstance(response.data, list)
    
    def test_search_trips_with_duration(self, api_client, boat_availability):
        """Тест поиска с фильтром по длительности"""
        url = reverse('trips:available-trips')
        tomorrow = (datetime.now() + timedelta(days=1)).date()
        response = api_client.get(url, {
            'date': tomorrow.isoformat(),
            'duration': 2
        })
        assert response.status_code == status.HTTP_200_OK
    
    def test_search_trips_with_people(self, api_client, boat_availability):
        """Тест поиска с указанием количества людей"""
        url = reverse('trips:available-trips')
        tomorrow = (datetime.now() + timedelta(days=1)).date()
        response = api_client.get(url, {
            'date': tomorrow.isoformat(),
            'number_of_people': 2
        })
        assert response.status_code == status.HTTP_200_OK
    
    def test_search_trips_guide_commission(self, guide_client, boat_availability, boat_with_pricing):
        """Тест что для гида показывается комиссия"""
        url = reverse('trips:available-trips')
        tomorrow = (datetime.now() + timedelta(days=1)).date()
        response = guide_client.get(url, {
            'date': tomorrow.isoformat(),
            'number_of_people': 5
        })
        assert response.status_code == status.HTTP_200_OK
        if len(response.data) > 0:
            trip = response.data[0]
            # Для гида должна быть комиссия
            assert 'guide_commission_per_person' in trip or trip.get('guide_commission_per_person') is not None
    
    def test_search_trips_date_range(self, api_client, boat_availability):
        """Тест поиска по диапазону дат"""
        url = reverse('trips:available-trips')
        date_from = (datetime.now() + timedelta(days=1)).date()
        date_to = (datetime.now() + timedelta(days=7)).date()
        response = api_client.get(url, {
            'date_from': date_from.isoformat(),
            'date_to': date_to.isoformat()
        })
        assert response.status_code == status.HTTP_200_OK

