from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import FAQPageViewSet

router = DefaultRouter()
router.register(r'pages', FAQPageViewSet, basename='faqpage')

app_name = 'faq'

urlpatterns = [
    path('', include(router.urls)),
]

