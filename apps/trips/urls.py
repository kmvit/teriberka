from django.urls import path
from .views import AvailableTripsView, TripDetailView
from .debug_time import DebugTimeView

app_name = 'trips'

urlpatterns = [
    path('', AvailableTripsView.as_view(), name='available-trips'),
    path('debug-time/', DebugTimeView.as_view(), name='debug-time'),
    path('<int:trip_id>/', TripDetailView.as_view(), name='trip-detail'),
]
