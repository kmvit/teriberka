from django.urls import path
from .views import AvailableTripsView, TripDetailView

app_name = 'trips'

urlpatterns = [
    path('', AvailableTripsView.as_view(), name='available-trips'),
    path('<int:trip_id>/', TripDetailView.as_view(), name='trip-detail'),
]
