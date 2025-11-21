from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import BoatViewSet

router = DefaultRouter()
router.register(r'', BoatViewSet, basename='boat')

app_name = 'boats'

urlpatterns = [
    path('', include(router.urls)),
]
