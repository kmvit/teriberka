from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import BookingViewSet

router = DefaultRouter()
router.register(r'', BookingViewSet, basename='booking')

app_name = 'bookings'

urlpatterns = [
    path('', include(router.urls)),
]
