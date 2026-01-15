from rest_framework import views
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.utils import timezone
from datetime import datetime, timedelta
from apps.boats.models import BoatAvailability, BoatPricing
from apps.bookings.models import Booking
import pytz


class DebugTimeView(views.APIView):
    """Временный endpoint для отладки времени"""
    permission_classes = [AllowAny]
    
    def get(self, request):
        now = timezone.now()
        moscow_tz = pytz.timezone('Europe/Moscow')
        now_moscow = now.astimezone(moscow_tz)
        
        # Получаем все активные рейсы
        availabilities = BoatAvailability.objects.filter(
            is_active=True
        ).select_related('boat').order_by('departure_date', 'departure_time')[:10]
        
        trips_info = []
        for av in availabilities:
            naive_departure = datetime.combine(av.departure_date, av.departure_time)
            departure_datetime = timezone.make_aware(naive_departure, timezone.get_current_timezone())
            departure_moscow = departure_datetime.astimezone(moscow_tz)
            min_departure_time = now + timedelta(hours=1)
            
            # Рассчитываем длительность
            departure = datetime.combine(av.departure_date, av.departure_time)
            return_dt = datetime.combine(av.departure_date, av.return_time)
            
            # Если время возвращения меньше времени отправления, значит рейс через полночь
            if av.return_time < av.departure_time:
                return_dt += timedelta(days=1)
            
            duration = return_dt - departure
            trip_duration = int(duration.total_seconds() / 3600)
            
            # Проверяем наличие цены
            try:
                pricing = BoatPricing.objects.get(
                    boat=av.boat,
                    duration_hours=trip_duration
                )
                has_pricing = True
                price_per_person = float(pricing.price_per_person)
            except BoatPricing.DoesNotExist:
                has_pricing = False
                price_per_person = None
            
            # Рассчитываем доступные места
            boat = av.boat
            start_datetime = datetime.combine(av.departure_date, av.departure_time)
            end_datetime = datetime.combine(av.departure_date, av.return_time)
            
            # Если время возвращения меньше времени отправления, значит рейс через полночь
            if av.return_time < av.departure_time:
                end_datetime += timedelta(days=1)
            
            existing_bookings = Booking.objects.filter(
                boat=boat,
                status__in=[Booking.Status.PENDING, Booking.Status.CONFIRMED],
                start_datetime__lt=end_datetime,
                end_datetime__gt=start_datetime
            )
            
            booked_places = sum(booking.number_of_people for booking in existing_bookings)
            available_spots = boat.capacity - booked_places
            
            trips_info.append({
                'boat_name': av.boat.name,
                'boat_id': av.boat.id,
                'availability_id': av.id,
                'is_active': av.is_active,
                'departure_date': str(av.departure_date),
                'departure_time': str(av.departure_time),
                'return_time': str(av.return_time),
                'duration_hours': trip_duration,
                'naive_departure': str(naive_departure),
                'departure_datetime_aware': str(departure_datetime),
                'departure_moscow': str(departure_moscow),
                'will_be_filtered_by_time': departure_datetime <= min_departure_time,
                'hours_until_departure': round((departure_datetime - now).total_seconds() / 3600, 2),
                'has_pricing': has_pricing,
                'price_per_person': price_per_person,
                'boat_capacity': boat.capacity,
                'booked_places': booked_places,
                'available_spots': available_spots,
                'will_be_shown': (
                    not (departure_datetime <= min_departure_time) and
                    has_pricing and
                    available_spots > 0
                ),
            })
        
        return Response({
            'server_time_utc': str(now),
            'server_time_moscow': str(now_moscow),
            'timezone_setting': str(timezone.get_current_timezone()),
            'min_departure_time_utc': str(now + timedelta(hours=1)),
            'min_departure_time_moscow': str((now + timedelta(hours=1)).astimezone(moscow_tz)),
            'trips': trips_info,
        })
