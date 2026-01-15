from rest_framework import views
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.utils import timezone
from datetime import datetime, timedelta
from apps.boats.models import BoatAvailability
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
            
            trips_info.append({
                'boat_name': av.boat.name,
                'departure_date': str(av.departure_date),
                'departure_time': str(av.departure_time),
                'return_time': str(av.return_time),
                'naive_departure': str(naive_departure),
                'departure_datetime_aware': str(departure_datetime),
                'departure_moscow': str(departure_moscow),
                'will_be_filtered_out': departure_datetime <= min_departure_time,
                'hours_until_departure': round((departure_datetime - now).total_seconds() / 3600, 2),
            })
        
        return Response({
            'server_time_utc': str(now),
            'server_time_moscow': str(now_moscow),
            'timezone_setting': str(timezone.get_current_timezone()),
            'min_departure_time_utc': str(now + timedelta(hours=1)),
            'min_departure_time_moscow': str((now + timedelta(hours=1)).astimezone(moscow_tz)),
            'trips': trips_info,
        })
