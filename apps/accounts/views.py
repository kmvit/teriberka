from rest_framework import status, generics, permissions
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ViewSet
from rest_framework.authtoken.models import Token
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from django.contrib.auth import login
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.conf import settings
from django.db.models import Sum, Count, Q
from django.utils import timezone
from datetime import datetime, timedelta
from decimal import Decimal
import logging
import threading
from .models import User, UserVerification
from apps.boats.models import Boat
from apps.bookings.models import Booking
from apps.site_settings.models import SiteSettings
from apps.bookings.serializers import BookingListSerializer
from apps.boats.serializers import BoatListSerializer

logger = logging.getLogger(__name__)
from .serializers import (
    UserRegistrationSerializer,
    UserLoginSerializer,
    UserSerializer,
    UserVerificationSerializer,
    UserVerificationDetailSerializer,
    PasswordResetRequestSerializer,
    PasswordResetConfirmSerializer,
    PhoneSendCodeSerializer,
    PhoneRegisterSerializer,
)
from .schemas import (
    login_schema,
    register_schema,
    password_reset_request_schema,
    password_reset_confirm_schema,
    profile_list_schema,
    profile_update_schema,
    profile_legacy_get_schema,
    profile_legacy_update_schema,
)


def send_registration_email_async(user, token):
    """Асинхронная отправка email с подтверждением регистрации"""
    try:
        # Формируем ссылку для подтверждения email на фронтенде
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
        confirm_url = f"{frontend_url}/verify-email?token={token}&email={user.email}"
        
        # Логируем попытку отправки
        logger.info(f"Попытка отправки email подтверждения на {user.email}")
        logger.debug(f"EMAIL_HOST: {getattr(settings, 'EMAIL_HOST', 'не указан')}")
        logger.debug(f"EMAIL_BACKEND: {getattr(settings, 'EMAIL_BACKEND', 'не указан')}")
        
        send_mail(
            subject='Подтверждение регистрации',
            message=f'Здравствуйте, {user.first_name or "пользователь"}!\n\n'
                   f'Для завершения регистрации перейдите по ссылке: {confirm_url}\n\n'
                   f'Если вы не регистрировались на нашем сайте, просто проигнорируйте это письмо.',
            from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@teriberka.com'),
            recipient_list=[user.email],
            fail_silently=False,
        )
        logger.info(f"✅ Email успешно отправлен на {user.email}")
        
        # В режиме разработки также выводим ссылку в консоль
        if settings.DEBUG:
            print(f"\n{'='*60}")
            print(f"Ссылка для подтверждения email (для разработки):")
            print(f"{confirm_url}")
            print(f"{'='*60}\n")
    except Exception as e:
        # Логируем ошибку с полной информацией
        logger.error(f"❌ Ошибка отправки email на {user.email}: {e}", exc_info=True)
        logger.error(f"Тип ошибки: {type(e).__name__}")
        logger.error(f"EMAIL_HOST: {getattr(settings, 'EMAIL_HOST', 'не указан')}")
        logger.error(f"EMAIL_PORT: {getattr(settings, 'EMAIL_PORT', 'не указан')}")
        logger.error(f"EMAIL_BACKEND: {getattr(settings, 'EMAIL_BACKEND', 'не указан')}")
        
        # В режиме разработки выводим ссылку в консоль при ошибке отправки
        if settings.DEBUG:
            frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
            confirm_url = f"{frontend_url}/verify-email?token={token}&email={user.email}"
            print(f"\n{'='*60}")
            print(f"Ошибка отправки email: {e}")
            print(f"Ссылка для подтверждения email (для разработки):")
            print(f"{confirm_url}")
            print(f"{'='*60}\n")


class UserRegistrationView(generics.CreateAPIView):
    """Регистрация нового пользователя"""
    queryset = User.objects.all()
    serializer_class = UserRegistrationSerializer
    permission_classes = [permissions.AllowAny]
    
    @register_schema
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            # Логируем детали ошибок валидации
            logger.warning(
                f"Ошибка валидации при регистрации: {serializer.errors}. "
                f"Данные запроса: {request.data}"
            )
            # Вызываем исключение, которое вернет ошибки клиенту
            raise ValidationError(serializer.errors)
        user = serializer.save()
        
        # Генерируем токен для подтверждения email
        token = default_token_generator.make_token(user)
        
        # Отправляем email с подтверждением асинхронно в фоновом потоке
        # Это позволяет сразу вернуть ответ пользователю, не дожидаясь отправки письма
        email_thread = threading.Thread(
            target=send_registration_email_async,
            args=(user, token),
            daemon=True
        )
        email_thread.start()
        
        return Response({
            'message': 'Регистрация успешна! На ваш email отправлено письмо с подтверждением. Пожалуйста, проверьте почту и перейдите по ссылке для активации аккаунта.',
            'email': user.email
        }, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    """Авторизация пользователя"""
    permission_classes = [permissions.AllowAny]
    
    @login_schema
    def post(self, request):
        serializer = UserLoginSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.validated_data['user']
            
            # Проверяем, подтвержден ли email
            if not user.is_active:
                return Response({
                    'non_field_errors': ['Ваш email не подтвержден. Пожалуйста, проверьте почту и перейдите по ссылке для подтверждения регистрации.']
                }, status=status.HTTP_400_BAD_REQUEST)
            
            login(request, user)
            
            # Получаем или создаем токен
            token, created = Token.objects.get_or_create(user=user)
            
            return Response({
                'token': token.key,
                'message': 'Авторизация успешна',
                'user': UserSerializer(user, context={'request': request}).data
            }, status=status.HTTP_200_OK)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PhoneSendCodeView(APIView):
    """Отправка SMS-кода подтверждения на телефон"""
    permission_classes = [permissions.AllowAny]
    
    def post(self, request):
        serializer = PhoneSendCodeSerializer(data=request.data)
        if not serializer.is_valid():
            raise ValidationError(serializer.errors)
        
        # Проверка reCAPTCHA (если настроен)
        from django.conf import settings
        from .services.recaptcha import verify_recaptcha
        captcha_token = serializer.validated_data.get('captcha_token', '')
        if getattr(settings, 'RECAPTCHA_SECRET_KEY', None):
            captcha_ok, captcha_error = verify_recaptcha(
                captcha_token,
                request.META.get('REMOTE_ADDR')
            )
            if not captcha_ok:
                return Response(
                    {'captcha_token': [captcha_error]},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        phone = serializer.validated_data['phone']
        if User.objects.filter(phone=phone).exists():
            return Response(
                {'phone': ['Пользователь с этим номером уже зарегистрирован']},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        from .services.phone_verification import send_verification_code
        success, error = send_verification_code(phone)
        
        if not success:
            return Response(
                {'phone': [error]},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        return Response({
            'message': 'Код подтверждения отправлен на указанный номер',
            'phone': phone
        }, status=status.HTTP_200_OK)


class PhoneRegisterView(APIView):
    """Регистрация пользователя по телефону с подтверждением SMS-кодом"""
    permission_classes = [permissions.AllowAny]
    
    def post(self, request):
        serializer = PhoneRegisterSerializer(data=request.data)
        if not serializer.is_valid():
            raise ValidationError(serializer.errors)
        
        user = serializer.save()
        token, _ = Token.objects.get_or_create(user=user)
        login(request, user)
        
        return Response({
            'message': 'Регистрация успешна! Вы вошли в аккаунт.',
            'token': token.key,
            'user': UserSerializer(user, context={'request': request}).data
        }, status=status.HTTP_201_CREATED)


class ProfileViewSet(ViewSet):
    """
    ViewSet для профиля пользователя
    Единый endpoint /api/accounts/profile/ с разным функционалом для разных ролей
    """
    permission_classes = [permissions.IsAuthenticated]
    
    @profile_list_schema
    def list(self, request):
        """
        Профиль пользователя с дашбордом
        Возвращает разный функционал в зависимости от роли
        """
        user = request.user
        logger.info(f'Загрузка профиля пользователя {user.email}')
        serializer = UserSerializer(user, context={'request': request})
        profile_data = serializer.data
        
        # Логируем информацию об аватарке
        if user.avatar:
            logger.info(f'Аватарка пользователя {user.email}: {user.avatar.url}, URL в ответе: {profile_data.get("avatar", "отсутствует")}')
        else:
            logger.info(f'У пользователя {user.email} нет аватарки')
        
        # Для гида и капитана проверяем верификацию
        # Админы и гостиницы не требуют верификации
        # Если не верифицирован, возвращаем только информацию о необходимости верификации
        if user.role in [User.Role.BOAT_OWNER, User.Role.GUIDE] and not user.is_staff:
            if not user.is_verified:
                profile_data['requires_verification'] = True
                profile_data['verification_status'] = user.verification_status
                profile_data['verification_status_display'] = user.get_verification_status_display()
                # Проверяем, есть ли уже заявка на верификацию
                if hasattr(user, 'verification'):
                    profile_data['verification_submitted'] = True
                    profile_data['verification_submitted_at'] = user.verification.submitted_at
                return Response(profile_data)
        
        # Добавляем дашборд в зависимости от роли (только для верифицированных)
        if user.role == User.Role.BOAT_OWNER:
            profile_data['dashboard'] = self._get_boat_owner_dashboard(user, request)
        elif user.role == User.Role.GUIDE:
            profile_data['dashboard'] = self._get_guide_dashboard(user, request)
        elif user.role == User.Role.HOTEL:
            profile_data['dashboard'] = self._get_hotel_dashboard(user, request)
        elif user.role == User.Role.CUSTOMER:
            profile_data['dashboard'] = self._get_customer_dashboard(user, request)
        
        return Response(profile_data)
    
    @profile_update_schema
    def update(self, request):
        """Обновление профиля"""
        user = request.user
        logger.info(f'Обновление профиля пользователя {user.email}')
        
        # Логируем, если загружается аватарка
        if 'avatar' in request.FILES:
            avatar_file = request.FILES['avatar']
            logger.info(f'Загрузка аватарки для пользователя {user.email}: {avatar_file.name}, размер: {avatar_file.size} байт')
        
        serializer = UserSerializer(user, data=request.data, partial=True, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            # Логируем успешное сохранение
            if 'avatar' in request.FILES:
                logger.info(f'✅ Аватарка успешно сохранена для пользователя {user.email}. URL: {user.avatar.url if user.avatar else "None"}')
            return Response(serializer.data)
        
        logger.warning(f'Ошибка валидации при обновлении профиля {user.email}: {serializer.errors}')
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['post'])
    def change_password(self, request):
        """Смена пароля"""
        from .serializers import ChangePasswordSerializer
        
        user = request.user
        serializer = ChangePasswordSerializer(data=request.data)
        
        if serializer.is_valid():
            old_password = serializer.validated_data['old_password']
            new_password = serializer.validated_data['new_password']
            
            # Проверяем старый пароль
            if not user.check_password(old_password):
                return Response(
                    {'old_password': ['Неверный текущий пароль']},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Устанавливаем новый пароль
            user.set_password(new_password)
            user.save()
            
            return Response({'message': 'Пароль успешно изменен'}, status=status.HTTP_200_OK)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['get'], url_path='telegram/status')
    def telegram_status(self, request):
        """Проверка статуса привязки Telegram"""
        user = request.user
        is_linked = bool(user.telegram_chat_id)
        
        return Response({
            'is_linked': is_linked,
            'telegram_chat_id': user.telegram_chat_id if is_linked else None
        })
    
    @action(detail=False, methods=['post'], url_path='telegram/unlink')
    def telegram_unlink(self, request):
        """Отвязка Telegram от аккаунта"""
        user = request.user
        
        if not user.telegram_chat_id:
            return Response(
                {'error': 'Telegram не привязан к аккаунту'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        user.telegram_chat_id = None
        user.save()
        
        logger.info(f"User {user.email} unlinked Telegram")
        
        return Response({'message': 'Telegram успешно отвязан от аккаунта'})
    
    def _get_boat_owner_dashboard(self, user, request):
        """Дашборд для владельца судна"""
        today = timezone.now().date()
        week_start = today - timedelta(days=today.weekday())
        week_end = week_start + timedelta(days=6)
        
        # Получаем все суда владельца с оптимизацией запросов
        boats = Boat.objects.filter(owner=user).prefetch_related(
            'images', 'features', 'pricing'
        ).order_by('-created_at')
        boat_ids = list(boats.values_list('id', flat=True))
        
        # Статистика на сегодня
        today_bookings = Booking.objects.filter(
            boat_id__in=boat_ids,
            start_datetime__date=today,
            status__in=[Booking.Status.PENDING, Booking.Status.CONFIRMED]
        )
        today_stats = {
            'bookings_count': today_bookings.count(),
            'revenue': float(today_bookings.aggregate(Sum('total_price'))['total_price__sum'] or 0),
            'upcoming_bookings': today_bookings.filter(start_datetime__gt=timezone.now()).count()
        }
        
        # Статистика за неделю
        week_bookings = Booking.objects.filter(
            boat_id__in=boat_ids,
            start_datetime__date__gte=week_start,
            start_datetime__date__lte=week_end,
            status__in=[Booking.Status.PENDING, Booking.Status.CONFIRMED, Booking.Status.COMPLETED]
        )
        week_revenue = week_bookings.aggregate(Sum('total_price'))['total_price__sum'] or 0
        week_stats = {
            'bookings_count': week_bookings.count(),
            'revenue': float(week_revenue),
            'occupancy_rate': 0  # TODO: рассчитать загрузку
        }
        
        # Последние бронирования
        recent_bookings = Booking.objects.filter(
            boat_id__in=boat_ids
        ).exclude(status=Booking.Status.RESERVED).order_by('-created_at')[:5]
        
        # Ближайшие бронирования
        upcoming_bookings = Booking.objects.filter(
            boat_id__in=boat_ids,
            start_datetime__gt=timezone.now(),
            status__in=[Booking.Status.PENDING, Booking.Status.CONFIRMED]
        ).order_by('start_datetime')[:5]
        
        context = {'request': request} if request else {}
        return {
            'boats': BoatListSerializer(boats, many=True, context=context).data,
            'today_stats': today_stats,
            'week_stats': week_stats,
            'recent_bookings': BookingListSerializer(recent_bookings, many=True, context=context).data,
            'upcoming_bookings': BookingListSerializer(upcoming_bookings, many=True, context=context).data
        }
    
    def _get_guide_dashboard(self, user, request=None):
        """Дашборд для гида"""
        # Бронирования гида
        bookings = Booking.objects.filter(guide=user).exclude(status=Booking.Status.RESERVED).select_related('boat', 'boat__owner')
        
        # Ближайшие бронирования
        upcoming_bookings = bookings.filter(
            start_datetime__gt=timezone.now(),
            status__in=[Booking.Status.PENDING, Booking.Status.CONFIRMED]
        ).order_by('start_datetime')[:5]
        
        context = {'request': request} if request else {}
        return {
            'bookings_count': bookings.count(),
            'upcoming_bookings': BookingListSerializer(upcoming_bookings, many=True, context=context).data
        }
    
    def _get_hotel_dashboard(self, user, request=None):
        """Дашборд для гостиницы"""
        bookings = Booking.objects.filter(hotel_admin=user).exclude(status=Booking.Status.RESERVED).select_related('boat', 'boat__owner')
        
        # Ближайшие бронирования
        upcoming_bookings = bookings.filter(
            start_datetime__gt=timezone.now(),
            status__in=[Booking.Status.PENDING, Booking.Status.CONFIRMED]
        ).order_by('start_datetime')[:5]
        
        # Рассчитываем общий кешбэк
        completed_bookings = bookings.filter(status=Booking.Status.CONFIRMED)
        total_cashback = sum(float(booking.hotel_cashback_amount) for booking in completed_bookings)
        
        # Ожидаемый кешбэк (от подтвержденных бронирований)
        pending_cashback = sum(
            float(booking.hotel_cashback_amount) 
            for booking in bookings.filter(status__in=[Booking.Status.PENDING, Booking.Status.CONFIRMED])
        )
        
        context = {'request': request} if request else {}
        return {
            'bookings_count': bookings.count(),
            'total_cashback': total_cashback,
            'pending_cashback': pending_cashback,
            'upcoming_bookings': BookingListSerializer(upcoming_bookings, many=True, context=context).data
        }
    
    def _get_customer_dashboard(self, user, request=None):
        """Дашборд для клиента"""
        bookings = Booking.objects.filter(customer=user).exclude(status=Booking.Status.RESERVED)
        
        # Ближайшие бронирования
        upcoming_bookings = bookings.filter(
            start_datetime__gt=timezone.now(),
            status__in=[Booking.Status.PENDING, Booking.Status.CONFIRMED]
        ).order_by('start_datetime')[:5]
        
        context = {'request': request} if request else {}
        return {
            'total_bookings': bookings.count(),
            'upcoming_bookings_count': upcoming_bookings.count(),
            'upcoming_bookings': BookingListSerializer(upcoming_bookings, many=True, context=context).data
        }
    
    @action(detail=False, methods=['get'])
    def calendar(self, request):
        """Календарь бронирований (для владельца судна)"""
        user = request.user
        if user.role != User.Role.BOAT_OWNER:
            raise PermissionDenied("Только для владельцев судов")
        if not user.is_staff and not user.is_verified:
            raise PermissionDenied("Требуется верификация для доступа к календарю")
        
        month = request.query_params.get('month')  # формат: "2025-11"
        boat_id = request.query_params.get('boat_id')
        
        boats = Boat.objects.filter(owner=user, is_active=True)
        if boat_id:
            boats = boats.filter(id=boat_id)
        
        # Парсим месяц
        if month:
            try:
                year, month_num = map(int, month.split('-'))
                date_from = datetime(year, month_num, 1).date()
                if month_num == 12:
                    date_to = datetime(year + 1, 1, 1).date() - timedelta(days=1)
                else:
                    date_to = datetime(year, month_num + 1, 1).date() - timedelta(days=1)
            except (ValueError, TypeError):
                return Response({'error': 'Неверный формат месяца. Используйте YYYY-MM'}, 
                              status=status.HTTP_400_BAD_REQUEST)
        else:
            # По умолчанию текущий месяц
            today = timezone.now().date()
            date_from = datetime(today.year, today.month, 1).date()
            if today.month == 12:
                date_to = datetime(today.year + 1, 1, 1).date() - timedelta(days=1)
            else:
                date_to = datetime(today.year, today.month + 1, 1).date() - timedelta(days=1)
        
        boat_ids = list(boats.values_list('id', flat=True))
        bookings = Booking.objects.filter(
            boat_id__in=boat_ids,
            start_datetime__date__gte=date_from,
            start_datetime__date__lte=date_to
        ).exclude(status=Booking.Status.RESERVED)
        
        from apps.bookings.serializers import BookingListSerializer
        from apps.boats.models import BlockedDate, SeasonalPricing
        from apps.boats.serializers import BlockedDateSerializer, SeasonalPricingSerializer
        
        # Получаем блокированные даты для всех судов владельца
        blocked_dates = BlockedDate.objects.filter(
            boat__in=boats,
            is_active=True,
            date_from__lte=date_to,
            date_to__gte=date_from
        )
        
        # Получаем сезонные цены
        seasonal_pricing = SeasonalPricing.objects.filter(
            boat__in=boats,
            is_active=True,
            date_from__lte=date_to,
            date_to__gte=date_from
        )
        
        return Response({
            'bookings': BookingListSerializer(bookings, many=True, context={'request': request}).data,
            'blocked_dates': BlockedDateSerializer(blocked_dates, many=True, context={'request': request}).data,
            'seasonal_pricing': SeasonalPricingSerializer(seasonal_pricing, many=True, context={'request': request}).data
        })
    
    @action(detail=False, methods=['get'])
    def finances(self, request):
        """Финансы (для владельца судна или гида)"""
        user = request.user
        
        if not user.is_staff and not user.is_verified:
            raise PermissionDenied("Требуется верификация для доступа к финансам")
        
        if user.role == User.Role.BOAT_OWNER:
            # Финансы для владельца судна
            period_start = request.query_params.get('period_start')
            period_end = request.query_params.get('period_end')
            
            boats = Boat.objects.filter(owner=user, is_active=True)
            boat_ids = list(boats.values_list('id', flat=True))
            
            # Учитываем подтвержденные и завершенные бронирования
            bookings = Booking.objects.filter(
                boat_id__in=boat_ids,
                status__in=[Booking.Status.CONFIRMED, Booking.Status.COMPLETED]
            )
            
            if period_start:
                try:
                    bookings = bookings.filter(start_datetime__date__gte=datetime.strptime(period_start, '%Y-%m-%d').date())
                except ValueError:
                    pass
            
            if period_end:
                try:
                    bookings = bookings.filter(start_datetime__date__lte=datetime.strptime(period_end, '%Y-%m-%d').date())
                except ValueError:
                    pass
            
            revenue_sum = bookings.aggregate(Sum('total_price'))['total_price__sum']
            revenue = Decimal(str(revenue_sum)) if revenue_sum else Decimal('0')
            
            # Комиссия платформы из настроек сайта
            site_settings = SiteSettings.load()
            commission_percent = site_settings.platform_commission_percent
            platform_commission = revenue * commission_percent / Decimal('100')
            to_payout = revenue - platform_commission
            
            return Response({
                'revenue': revenue,
                'platform_commission': float(platform_commission),
                'to_payout': float(to_payout),
                'payout_history': []  # TODO: реализовать историю выплат
            })
        
        elif user.role == User.Role.GUIDE:
            # Финансы для гида (комиссии)
            period_start = request.query_params.get('period_start')
            period_end = request.query_params.get('period_end')
            
            bookings = Booking.objects.filter(guide=user).exclude(status=Booking.Status.RESERVED)
            
            if period_start:
                try:
                    bookings = bookings.filter(start_datetime__date__gte=datetime.strptime(period_start, '%Y-%m-%d').date())
                except ValueError:
                    pass
            
            if period_end:
                try:
                    bookings = bookings.filter(start_datetime__date__lte=datetime.strptime(period_end, '%Y-%m-%d').date())
                except ValueError:
                    pass
            
            # Комиссия за одного туриста (пока фиксированная)
            commission_per_person = 500
            
            completed_bookings = bookings.filter(status=Booking.Status.COMPLETED)
            total_commission = sum(
                float(commission_per_person * booking.number_of_people)
                for booking in completed_bookings
            )
            
            pending_bookings = bookings.filter(status__in=[Booking.Status.PENDING, Booking.Status.CONFIRMED])
            pending_commission = sum(
                float(commission_per_person * booking.number_of_people)
                for booking in pending_bookings
            )
            
            # Следующая выплата (каждый понедельник)
            today = timezone.now().date()
            days_until_monday = (7 - today.weekday()) % 7
            if days_until_monday == 0:
                days_until_monday = 7
            next_payout_date = today + timedelta(days=days_until_monday)
            
            return Response({
                'total_commission': total_commission,
                'pending_commission': pending_commission,
                'to_payout': total_commission,  # К выплате = заработанная комиссия
                'next_payout_date': next_payout_date.isoformat(),
                'payout_history': []  # TODO: реализовать историю выплат
            })
        
        else:
            raise PermissionDenied("Финансы доступны только для владельцев судов и гидов")
    
    @action(detail=False, methods=['get'])
    def transactions(self, request):
        """История операций (для владельца судна)"""
        user = request.user
        if user.role != User.Role.BOAT_OWNER:
            raise PermissionDenied("Только для владельцев судов")
        if not user.is_staff and not user.is_verified:
            raise PermissionDenied("Требуется верификация для доступа к транзакциям")
        
        # TODO: реализовать историю транзакций
        return Response([])
    
    @action(detail=False, methods=['get'])
    def reviews(self, request):
        """Отзывы и рейтинг (для владельца судна)"""
        user = request.user
        if user.role != User.Role.BOAT_OWNER:
            raise PermissionDenied("Только для владельцев судов")
        if not user.is_staff and not user.is_verified:
            raise PermissionDenied("Требуется верификация для доступа к отзывам")
        
        # TODO: реализовать отзывы и рейтинг
        return Response({
            'average_rating': 0,
            'total_reviews': 0,
            'recent_reviews': []
        })


class GuideCommissionsView(APIView):
    """
    API для статистики по комиссиям гида
    """
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        """Статистика по комиссиям гида"""
        user = request.user
        if user.role != User.Role.GUIDE:
            raise PermissionDenied("Только для гидов")
        if not user.is_staff and not user.is_verified:
            raise PermissionDenied("Требуется верификация для доступа к комиссиям")
        
        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')
        
        bookings = Booking.objects.filter(guide=user).exclude(status=Booking.Status.RESERVED)
        
        if date_from:
            try:
                bookings = bookings.filter(start_datetime__date__gte=datetime.strptime(date_from, '%Y-%m-%d').date())
            except ValueError:
                pass
        
        if date_to:
            try:
                bookings = bookings.filter(start_datetime__date__lte=datetime.strptime(date_to, '%Y-%m-%d').date())
            except ValueError:
                pass
        
        # Комиссия за одного туриста (пока фиксированная, потом будет из модели)
        commission_per_person = 500
        
        completed_bookings = bookings.filter(status=Booking.Status.COMPLETED)
        total_commission = sum(
            float(commission_per_person * booking.number_of_people)
            for booking in completed_bookings
        )
        
        pending_bookings = bookings.filter(status__in=[Booking.Status.PENDING, Booking.Status.CONFIRMED])
        pending_commission = sum(
            float(commission_per_person * booking.number_of_people)
            for booking in pending_bookings
        )
        
        # История комиссий
        commission_history = []
        for booking in completed_bookings:
            commission_history.append({
                'booking_id': booking.id,
                'date': booking.start_datetime.date().isoformat(),
                'number_of_people': booking.number_of_people,
                'commission': float(commission_per_person * booking.number_of_people),
                'status': booking.status
            })
        
        return Response({
            'total_commission': total_commission,
            'bookings_count': bookings.count(),
            'pending_commission': pending_commission,
            'paid_commission': total_commission,
            'commission_history': commission_history
        })
        


class UserVerificationCreateView(generics.CreateAPIView):
    """Загрузка документов для верификации"""
    serializer_class = UserVerificationSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class UserVerificationDetailView(generics.RetrieveAPIView):
    """Просмотр статуса верификации"""
    serializer_class = UserVerificationDetailSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_object(self):
        user = self.request.user
        if user.role not in [User.Role.BOAT_OWNER, User.Role.GUIDE]:
            raise PermissionDenied('Только для владельцев судов и гидов')
        
        try:
            return user.verification
        except UserVerification.DoesNotExist:
            raise NotFound('Документы еще не загружены')


class PasswordResetRequestView(APIView):
    """Запрос на сброс пароля"""
    permission_classes = [permissions.AllowAny]
    
    @password_reset_request_schema
    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        if serializer.is_valid():
            email = serializer.validated_data['email']
            
            try:
                user = User.objects.get(email=email)
            except User.DoesNotExist:
                # Не раскрываем информацию о существовании пользователя
                return Response({
                    'message': 'Если пользователь с таким email существует, на него будет отправлено письмо с инструкциями по восстановлению пароля.'
                }, status=status.HTTP_200_OK)
            
            # Генерируем токен для сброса пароля
            token = default_token_generator.make_token(user)
            
            # Формируем ссылку для сброса пароля на фронтенде
            # В продакшене нужно использовать реальный домен фронтенда
            frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
            reset_url = f"{frontend_url}/reset-password?token={token}&email={email}"
            
            # Отправляем email
            try:
                send_mail(
                    subject='Восстановление пароля',
                    message=f'Для восстановления пароля перейдите по ссылке: {reset_url}',
                    from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@teriberka.com'),
                    recipient_list=[email],
                    fail_silently=False,
                )
                # В режиме разработки также выводим ссылку в консоль
                if settings.DEBUG:
                    print(f"\n{'='*60}")
                    print(f"Ссылка для сброса пароля (для разработки):")
                    print(f"{reset_url}")
                    print(f"{'='*60}\n")
            except Exception as e:
                # В режиме разработки выводим ссылку в консоль при ошибке отправки
                if settings.DEBUG:
                    print(f"\n{'='*60}")
                    print(f"Ошибка отправки email: {e}")
                    print(f"Ссылка для сброса пароля (для разработки):")
                    print(f"{reset_url}")
                    print(f"{'='*60}\n")
                # В продакшене можно логировать ошибку или отправлять уведомление администратору
            
            return Response({
                'message': 'Если пользователь с таким email существует, на него будет отправлено письмо с инструкциями по восстановлению пароля.'
            }, status=status.HTTP_200_OK)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PasswordResetConfirmView(APIView):
    """Подтверждение сброса пароля"""
    permission_classes = [permissions.AllowAny]
    
    @password_reset_confirm_schema
    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        if serializer.is_valid():
            token = serializer.validated_data['token']
            email = serializer.validated_data['email']
            password = serializer.validated_data['password']
            
            try:
                user = User.objects.get(email=email)
            except User.DoesNotExist:
                raise ValidationError({'email': 'Пользователь с таким email не найден'})
            
            # Проверяем токен
            if not default_token_generator.check_token(user, token):
                raise ValidationError({'token': 'Неверный или устаревший токен'})
            
            # Устанавливаем новый пароль
            user.set_password(password)
            user.save()
            
            return Response({
                'message': 'Пароль успешно изменен'
            }, status=status.HTTP_200_OK)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class EmailVerificationView(APIView):
    """Подтверждение email при регистрации"""
    permission_classes = [permissions.AllowAny]
    
    def post(self, request):
        token = request.data.get('token')
        email = request.data.get('email')
        
        if not token or not email:
            return Response({
                'error': 'Токен и email обязательны'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response({
                'error': 'Пользователь с таким email не найден'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Проверяем, не подтвержден ли уже email
        if user.is_active:
            return Response({
                'message': 'Email уже подтвержден',
                'verified': True
            }, status=status.HTTP_200_OK)
        
        # Проверяем токен
        if not default_token_generator.check_token(user, token):
            return Response({
                'error': 'Неверный или устаревший токен'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Активируем пользователя
        user.is_active = True
        user.save()
        
        # Создаем токен для автоматической авторизации
        token_auth, created = Token.objects.get_or_create(user=user)
        
        return Response({
            'message': 'Email успешно подтвержден',
            'verified': True,
            'user': UserSerializer(user).data,
            'token': token_auth.key
        }, status=status.HTTP_200_OK)


class AdminCaptainsListView(APIView):
    """Список всех капитанов для админа"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        """Получить список всех капитанов"""
        if not request.user.is_staff:
            raise PermissionDenied("Только для администраторов")
        
        captains = User.objects.filter(role=User.Role.BOAT_OWNER).order_by('first_name', 'last_name', 'email')
        
        # Сериализация
        serializer = UserSerializer(captains, many=True, context={'request': request})
        
        return Response(serializer.data)


class AdminCaptainsFinancesTableView(APIView):
    """Финансовая таблица по всем капитанам для админа"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        """Получить финансовую таблицу по капитанам"""
        if not request.user.is_staff:
            raise PermissionDenied("Только для администраторов")
        
        # Фильтры
        captain_id = request.query_params.get('captain_id')
        period_start = request.query_params.get('period_start')
        period_end = request.query_params.get('period_end')
        
        # Получаем капитанов
        captains_query = User.objects.filter(role=User.Role.BOAT_OWNER)
        if captain_id:
            try:
                captains_query = captains_query.filter(id=int(captain_id))
            except ValueError:
                pass
        
        captains = captains_query.order_by('first_name', 'last_name', 'email')
        
        # Получаем настройки для расчета комиссии
        site_settings = SiteSettings.load()
        commission_percent = site_settings.platform_commission_percent
        
        # Подготавливаем данные для таблицы
        table_data = []
        captains_summary = []
        
        # Для каждого капитана собираем данные
        for captain in captains:
            boats = Boat.objects.filter(owner=captain, is_active=True)
            boat_ids = list(boats.values_list('id', flat=True))
            
            if not boat_ids:
                continue
            
            # Получаем бронирования
            # Учитываем все статусы кроме отмененных для финансовой отчетности
            bookings = Booking.objects.filter(
                boat_id__in=boat_ids
            ).exclude(status=Booking.Status.CANCELLED)
            
            # Фильтр по периоду
            if period_start:
                try:
                    period_start_date = datetime.strptime(period_start, '%Y-%m-%d').date()
                    bookings = bookings.filter(start_datetime__date__gte=period_start_date)
                except ValueError:
                    pass
            
            if period_end:
                try:
                    period_end_date = datetime.strptime(period_end, '%Y-%m-%d').date()
                    bookings = bookings.filter(start_datetime__date__lte=period_end_date)
                except ValueError:
                    pass
            
            # Логируем для отладки
            bookings_list = list(bookings)
            logger.info(f'Капитан {captain.email}: найдено бронирований {len(bookings_list)}, судов {len(boat_ids)}')
            for b in bookings_list[:5]:  # Логируем первые 5
                logger.info(f'  - Бронирование {b.id}: дата {b.start_datetime.date()}, статус {b.status}, цена {b.total_price}, люди {b.number_of_people}')
            
            # Группируем по датам
            bookings_by_date = {}
            total_revenue = Decimal('0')
            total_people = 0
            total_bookings_count = 0
            
            for booking in bookings_list:
                booking_date = booking.start_datetime.date()
                date_key = booking_date.isoformat()
                
                if date_key not in bookings_by_date:
                    bookings_by_date[date_key] = {
                        'date': date_key,
                        'revenue': Decimal('0'),
                        'people': 0,
                        'bookings_count': 0
                    }
                
                bookings_by_date[date_key]['revenue'] += booking.total_price
                bookings_by_date[date_key]['people'] += booking.number_of_people
                bookings_by_date[date_key]['bookings_count'] += 1
                
                total_revenue += booking.total_price
                total_people += booking.number_of_people
                total_bookings_count += 1
            
            # Рассчитываем комиссию и к выплате
            platform_commission = total_revenue * commission_percent / Decimal('100')
            to_payout = total_revenue - platform_commission
            
            # Добавляем в сводку по капитану
            # Используем total_bookings_count вместо bookings.count() для точности
            captains_summary.append({
                'captain_id': captain.id,
                'captain_name': f"{captain.first_name or ''} {captain.last_name or ''}".strip() or captain.email,
                'captain_email': captain.email,
                'revenue': float(total_revenue),
                'platform_commission': float(platform_commission),
                'to_payout': float(to_payout),
                'total_people': total_people,
                'bookings_count': total_bookings_count
            })
            
            logger.info(f'Капитан {captain.email}: итого - бронирований {total_bookings_count}, выручка {total_revenue}, люди {total_people}')
            
            # Добавляем данные по датам
            for date_key, date_data in bookings_by_date.items():
                date_commission = date_data['revenue'] * commission_percent / Decimal('100')
                date_payout = date_data['revenue'] - date_commission
                
                table_data.append({
                    'date': date_key,
                    'captain_id': captain.id,
                    'captain_name': f"{captain.first_name or ''} {captain.last_name or ''}".strip() or captain.email,
                    'people': date_data['people'],
                    'revenue': float(date_data['revenue']),
                    'platform_commission': float(date_commission),
                    'to_payout': float(date_payout),
                    'bookings_count': date_data['bookings_count']
                })
        
        # Сортируем по дате
        table_data.sort(key=lambda x: x['date'])
        
        return Response({
            'table_data': table_data,
            'captains_summary': captains_summary,
            'period_start': period_start,
            'period_end': period_end
        })


class AdminHotelsListView(APIView):
    """Список всех гостиниц для админа"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        """Получить список всех гостиниц"""
        if not request.user.is_staff:
            raise PermissionDenied("Только для администраторов")
        
        hotels = User.objects.filter(role=User.Role.HOTEL).order_by('first_name', 'last_name', 'email')
        
        # Сериализация
        serializer = UserSerializer(hotels, many=True, context={'request': request})
        
        return Response(serializer.data)


class AdminHotelsFinancesTableView(APIView):
    """Финансовая таблица по всем гостиницам для админа"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        """Получить финансовую таблицу по гостиницам (кешбэк)"""
        if not request.user.is_staff:
            raise PermissionDenied("Только для администраторов")
        
        # Фильтры
        hotel_id = request.query_params.get('hotel_id')
        period_start = request.query_params.get('period_start')
        period_end = request.query_params.get('period_end')
        
        # Получаем гостиницы
        hotels_query = User.objects.filter(role=User.Role.HOTEL)
        if hotel_id:
            try:
                hotels_query = hotels_query.filter(id=int(hotel_id))
            except ValueError:
                pass
        
        hotels = hotels_query.order_by('first_name', 'last_name', 'email')
        
        # Подготавливаем данные для таблицы
        table_data = []
        hotels_summary = []
        
        # Для каждой гостиницы собираем данные
        for hotel in hotels:
            # Получаем бронирования гостиницы
            bookings = Booking.objects.filter(hotel_admin=hotel).exclude(status=Booking.Status.RESERVED)
            
            # Фильтр по периоду
            if period_start:
                try:
                    period_start_date = datetime.strptime(period_start, '%Y-%m-%d').date()
                    bookings = bookings.filter(start_datetime__date__gte=period_start_date)
                except ValueError:
                    pass
            
            if period_end:
                try:
                    period_end_date = datetime.strptime(period_end, '%Y-%m-%d').date()
                    bookings = bookings.filter(start_datetime__date__lte=period_end_date)
                except ValueError:
                    pass
            
            # Логируем для отладки
            bookings_list = list(bookings)
            logger.info(f'Гостиница {hotel.email}: найдено бронирований {len(bookings_list)}')
            for b in bookings_list[:5]:  # Логируем первые 5
                logger.info(f'  - Бронирование {b.id}: дата {b.start_datetime.date()}, статус {b.status}, кешбэк {b.hotel_cashback_amount}')
            
            # Группируем по датам
            bookings_by_date = {}
            total_cashback = Decimal('0')
            total_revenue = Decimal('0')
            total_people = 0
            total_bookings_count = 0
            
            for booking in bookings_list:
                # Учитываем только подтвержденные бронирования для кешбэка
                if booking.status not in [Booking.Status.CONFIRMED, Booking.Status.COMPLETED]:
                    continue
                    
                booking_date = booking.start_datetime.date()
                date_key = booking_date.isoformat()
                
                if date_key not in bookings_by_date:
                    bookings_by_date[date_key] = {
                        'date': date_key,
                        'cashback': Decimal('0'),
                        'revenue': Decimal('0'),
                        'people': 0,
                        'bookings_count': 0
                    }
                
                bookings_by_date[date_key]['cashback'] += booking.hotel_cashback_amount
                bookings_by_date[date_key]['revenue'] += booking.total_price
                bookings_by_date[date_key]['people'] += booking.number_of_people
                bookings_by_date[date_key]['bookings_count'] += 1
                
                total_cashback += booking.hotel_cashback_amount
                total_revenue += booking.total_price
                total_people += booking.number_of_people
                total_bookings_count += 1
            
            # Добавляем в сводку по гостинице
            hotels_summary.append({
                'hotel_id': hotel.id,
                'hotel_name': f"{hotel.first_name or ''} {hotel.last_name or ''}".strip() or hotel.email,
                'hotel_email': hotel.email,
                'total_cashback': float(total_cashback),
                'total_revenue': float(total_revenue),
                'total_people': total_people,
                'bookings_count': total_bookings_count
            })
            
            logger.info(f'Гостиница {hotel.email}: итого - бронирований {total_bookings_count}, кешбэк {total_cashback}, выручка {total_revenue}')
            
            # Добавляем данные по датам
            for date_key, date_data in bookings_by_date.items():
                table_data.append({
                    'date': date_key,
                    'hotel_id': hotel.id,
                    'hotel_name': f"{hotel.first_name or ''} {hotel.last_name or ''}".strip() or hotel.email,
                    'people': date_data['people'],
                    'revenue': float(date_data['revenue']),
                    'cashback': float(date_data['cashback']),
                    'bookings_count': date_data['bookings_count']
                })
        
        # Сортируем по дате
        table_data.sort(key=lambda x: x['date'])
        
        return Response({
            'table_data': table_data,
            'hotels_summary': hotels_summary,
            'period_start': period_start,
            'period_end': period_end
        })

