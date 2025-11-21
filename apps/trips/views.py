from rest_framework import views, status
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.db.models import Q, Sum
from django.utils import timezone
from datetime import datetime, timedelta
from apps.boats.models import BoatAvailability, Boat, BoatPricing
from apps.bookings.models import Booking
from .serializers import AvailableTripSerializer


class AvailableTripsView(views.APIView):
    """
    API для поиска доступных рейсов
    Единый endpoint для гидов и клиентов
    """
    permission_classes = [AllowAny]
    
    def get(self, request):
        """
        Поиск доступных рейсов
        Query params:
            - date: "2025-11-22" (обязательно) или
            - date_from, date_to: диапазон дат
            - duration: 2 | 3 (длительность в часах)
            - number_of_people: количество человек
            - boat_id: фильтр по судну
            - boat_type: фильтр по типу
            - features: фильтр по особенностям
            - route_id: фильтр по маршруту
        """
        # Получаем параметры запроса
        date = request.query_params.get('date')
        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')
        duration = request.query_params.get('duration')
        number_of_people = request.query_params.get('number_of_people')
        boat_id = request.query_params.get('boat_id')
        boat_type = request.query_params.get('boat_type')
        features = request.query_params.getlist('features')
        route_id = request.query_params.get('route_id')
        
        # Валидация дат
        if not date and not (date_from and date_to):
            return Response(
                {'error': 'Необходимо указать date или date_from и date_to'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Получаем доступные слоты
        availabilities = BoatAvailability.objects.filter(is_active=True).select_related('boat')
        
        # Фильтрация по дате
        if date:
            try:
                date_obj = datetime.strptime(date, '%Y-%m-%d').date()
                availabilities = availabilities.filter(departure_date=date_obj)
            except ValueError:
                return Response(
                    {'error': 'Неверный формат даты. Используйте YYYY-MM-DD'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        else:
            try:
                date_from_obj = datetime.strptime(date_from, '%Y-%m-%d').date()
                date_to_obj = datetime.strptime(date_to, '%Y-%m-%d').date()
                availabilities = availabilities.filter(
                    departure_date__gte=date_from_obj,
                    departure_date__lte=date_to_obj
                )
            except (ValueError, TypeError):
                return Response(
                    {'error': 'Неверный формат дат. Используйте YYYY-MM-DD'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Фильтрация по судну
        if boat_id:
            availabilities = availabilities.filter(boat_id=boat_id)
        
        # Фильтрация по типу судна
        if boat_type:
            availabilities = availabilities.filter(boat__boat_type=boat_type)
        
        # Фильтрация по особенностям
        if features:
            availabilities = availabilities.filter(boat__features__feature_type__in=features).distinct()
        
        # Фильтрация по маршруту
        if route_id:
            availabilities = availabilities.filter(boat__sailing_zones__id=route_id).distinct()
        
        # Фильтрация по длительности
        if duration:
            try:
                duration_hours = int(duration)
                # Фильтруем по разнице между временем возвращения и временем отправления
                # Это приблизительная фильтрация, точная проверка будет при расчете
                availabilities = [
                    av for av in availabilities
                    if self._calculate_duration(av) == duration_hours
                ]
            except ValueError:
                pass
        
        # Формируем результат
        results = []
        for availability in availabilities:
            # Рассчитываем длительность
            trip_duration = self._calculate_duration(availability)
            
            # Пропускаем если не соответствует фильтру по длительности
            if duration and trip_duration != int(duration):
                continue
            
            # Получаем цену
            try:
                pricing = BoatPricing.objects.get(
                    boat=availability.boat,
                    duration_hours=trip_duration
                )
                price_per_person = pricing.price_per_person
            except BoatPricing.DoesNotExist:
                continue  # Пропускаем если нет цены
            
            # Рассчитываем доступные места
            available_spots = self._calculate_available_spots(availability, number_of_people)
            
            # Пропускаем если недостаточно мест
            if number_of_people and available_spots < int(number_of_people):
                continue
            
            # Формируем объект для сериализации
            trip_data = {
                'availability': availability,
                'duration_hours': trip_duration,
                'available_spots': available_spots,
                'price_per_person': price_per_person
            }
            
            serializer = AvailableTripSerializer(trip_data, context={'request': request})
            results.append(serializer.data)
        
        return Response(results, status=status.HTTP_200_OK)
    
    def _calculate_duration(self, availability):
        """Рассчитывает длительность рейса в часах"""
        departure = datetime.combine(availability.departure_date, availability.departure_time)
        return_dt = datetime.combine(availability.departure_date, availability.return_time)
        duration = return_dt - departure
        return int(duration.total_seconds() / 3600)
    
    def _calculate_available_spots(self, availability, requested_people=None):
        """Рассчитывает доступные места на рейс"""
        boat = availability.boat
        start_datetime = datetime.combine(availability.departure_date, availability.departure_time)
        end_datetime = datetime.combine(availability.departure_date, availability.return_time)
        
        # Подсчитываем уже забронированные места
        existing_bookings = Booking.objects.filter(
            boat=boat,
            status__in=[Booking.Status.PENDING, Booking.Status.CONFIRMED],
            start_datetime__lt=end_datetime,
            end_datetime__gt=start_datetime
        )
        
        booked_places = sum(booking.number_of_people for booking in existing_bookings)
        available_spots = boat.capacity - booked_places
        
        return max(0, available_spots)
