from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

app_name = 'accounts'

router = DefaultRouter()
router.register(r'profile', views.ProfileViewSet, basename='profile')

urlpatterns = [
    # Регистрация и авторизация
    path('register/', views.UserRegistrationView.as_view(), name='register'),
    path('login/', views.LoginView.as_view(), name='login'),
    path('profile/', views.profile_view, name='profile'),  # Legacy endpoint
    
    # Подтверждение email
    path('verify-email/', views.EmailVerificationView.as_view(), name='verify-email'),
    
    # Восстановление пароля
    path('password-reset/', views.PasswordResetRequestView.as_view(), name='password-reset'),
    path('password-reset-confirm/', views.PasswordResetConfirmView.as_view(), name='password-reset-confirm'),
    
    # Верификация владельцев катеров
    path('verification/', views.BoatOwnerVerificationCreateView.as_view(), name='verification-create'),
    path('verification/status/', views.BoatOwnerVerificationDetailView.as_view(), name='verification-status'),
    
    # Profile routes (через router)
    path('', include(router.urls)),
    
    # API для гида
    path('guide/commissions/', views.GuideCommissionsView.as_view(), name='guide-commissions'),
]
