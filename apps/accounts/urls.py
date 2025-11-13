from django.urls import path
from . import views

app_name = 'accounts'

urlpatterns = [
    # Регистрация и авторизация
    path('register/', views.UserRegistrationView.as_view(), name='register'),
    path('login/', views.LoginView.as_view(), name='login'),
    path('profile/', views.profile_view, name='profile'),
    
    # Восстановление пароля
    path('password-reset/', views.PasswordResetRequestView.as_view(), name='password-reset'),
    path('password-reset-confirm/', views.PasswordResetConfirmView.as_view(), name='password-reset-confirm'),
    
    # Верификация владельцев катеров
    path('verification/', views.BoatOwnerVerificationCreateView.as_view(), name='verification-create'),
    path('verification/status/', views.BoatOwnerVerificationDetailView.as_view(), name='verification-status'),
]
