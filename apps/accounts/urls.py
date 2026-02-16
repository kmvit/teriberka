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
    path('profile/change-password/', views.ProfileViewSet.as_view({'post': 'change_password'}), name='profile-change-password'),
    # Регистрация и авторизация
    path('register/', views.UserRegistrationView.as_view(), name='register'),
    path('login/', views.LoginView.as_view(), name='login'),
    
    # Регистрация по телефону (SMS)
    path('phone/send-code/', views.PhoneSendCodeView.as_view(), name='phone-send-code'),
    path('phone/register/', views.PhoneRegisterView.as_view(), name='phone-register'),
    
    # Подтверждение email
    path('verify-email/', views.EmailVerificationView.as_view(), name='verify-email'),
    
    # Восстановление пароля
    path('password-reset/', views.PasswordResetRequestView.as_view(), name='password-reset'),
    path('password-reset-confirm/', views.PasswordResetConfirmView.as_view(), name='password-reset-confirm'),
    
    # Верификация пользователей (гид и владелец судна)
    path('verification/', views.UserVerificationCreateView.as_view(), name='verification-create'),
    path('verification/status/', views.UserVerificationDetailView.as_view(), name='verification-status'),
    
    
    # API для гида
    path('guide/commissions/', views.GuideCommissionsView.as_view(), name='guide-commissions'),
    
    # API для админа
    path('admin/captains/', views.AdminCaptainsListView.as_view(), name='admin-captains-list'),
    path('admin/captains/finances-table/', views.AdminCaptainsFinancesTableView.as_view(), name='admin-captains-finances-table'),
    path('admin/hotels/', views.AdminHotelsListView.as_view(), name='admin-hotels-list'),
    path('admin/hotels/finances-table/', views.AdminHotelsFinancesTableView.as_view(), name='admin-hotels-finances-table'),
]
