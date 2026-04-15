from django.urls import path
from .views import MaxWebhookView

app_name = 'max'

urlpatterns = [
    path('webhook/', MaxWebhookView.as_view(), name='webhook'),
]
