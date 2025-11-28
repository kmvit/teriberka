from django.urls import path, include
from . import views

app_name = 'accounts'

urlpatterns = [
    # Profile routes
    path('profile/', views.ProfileViewSet.as_view({'get': 'list', 'put': 'update', 'patch': 'update'}), name='profile'),
    path('profile/calendar/', views.ProfileViewSet.as_view({'get': 'calendar'}), name='profile-calendar'),
    path('profile/finances/', views.ProfileViewSet.as_view({'get': 'finances'}), name='profile-finances'),
    path('profile/transactions/', views.ProfileViewSet.as_view({'get': 'transactions'}), name='profile-transactions'),
    path('profile/reviews/', views.ProfileViewSet.as_view({'get': 'reviews'}), name='profile-reviews'),
    # Регистрация и авторизация
    path('register/', views.UserRegistrationView.as_view(), name='register'),
    path('login/', views.LoginView.as_view(), name='login'),
    
    # Подтверждение email
    path('verify-email/', views.EmailVerificationView.as_view(), name='verify-email'),
    
    # Восстановление пароля
    path('password-reset/', views.PasswordResetRequestView.as_view(), name='password-reset'),
    path('password-reset-confirm/', views.PasswordResetConfirmView.as_view(), name='password-reset-confirm'),
    
    # Верификация владельцев катеров
    path('verification/', views.BoatOwnerVerificationCreateView.as_view(), name='verification-create'),
    path('verification/status/', views.BoatOwnerVerificationDetailView.as_view(), name='verification-status'),
    
    
    # API для гида
    path('guide/commissions/', views.GuideCommissionsView.as_view(), name='guide-commissions'),
]
