from django.urls import path
from .views import TelegramWebhookView

app_name = 'telegram'

urlpatterns = [
    path('webhook/', TelegramWebhookView.as_view(), name='webhook'),
]
