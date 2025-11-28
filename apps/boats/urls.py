from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import BoatViewSet, FeatureViewSet

router = DefaultRouter()
router.register(r'', BoatViewSet, basename='boat')
router.register(r'features', FeatureViewSet, basename='feature')

app_name = 'boats'

urlpatterns = [
    path('', include(router.urls)),
]
