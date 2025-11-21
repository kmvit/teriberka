from django.urls import path
from .views import AvailableTripsView

app_name = 'trips'

urlpatterns = [
    path('', AvailableTripsView.as_view(), name='available-trips'),
]
