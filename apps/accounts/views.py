from rest_framework import status, generics, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.authtoken.models import Token
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from django.contrib.auth import login
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.conf import settings
from .models import User, BoatOwnerVerification
from .serializers import (
    UserRegistrationSerializer,
    UserLoginSerializer,
    UserSerializer,
    BoatOwnerVerificationSerializer,
    BoatOwnerVerificationDetailSerializer,
    PasswordResetRequestSerializer,
    PasswordResetConfirmSerializer
)


class UserRegistrationView(generics.CreateAPIView):
    """Регистрация нового пользователя"""
    queryset = User.objects.all()
    serializer_class = UserRegistrationSerializer
    permission_classes = [permissions.AllowAny]
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        
        # Генерируем токен для подтверждения email
        token = default_token_generator.make_token(user)
        
        # Формируем ссылку для подтверждения email на фронтенде
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
        confirm_url = f"{frontend_url}/verify-email?token={token}&email={user.email}"
        
        # Отправляем email с подтверждением
        try:
            send_mail(
                subject='Подтверждение регистрации',
                message=f'Здравствуйте, {user.first_name or "пользователь"}!\n\n'
                       f'Для завершения регистрации перейдите по ссылке: {confirm_url}\n\n'
                       f'Если вы не регистрировались на нашем сайте, просто проигнорируйте это письмо.',
                from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@teriberka.com'),
                recipient_list=[user.email],
                fail_silently=False,
            )
            # В режиме разработки также выводим ссылку в консоль
            if settings.DEBUG:
                print(f"\n{'='*60}")
                print(f"Ссылка для подтверждения email (для разработки):")
                print(f"{confirm_url}")
                print(f"{'='*60}\n")
        except Exception as e:
            # В режиме разработки выводим ссылку в консоль при ошибке отправки
            logger.error(f"Ошибка отправки email на {user.email}: {e}", exc_info=True)
            if settings.DEBUG:
                print(f"\n{'='*60}")
                print(f"Ошибка отправки email: {e}")
                print(f"Ссылка для подтверждения email (для разработки):")
                print(f"{confirm_url}")
                print(f"{'='*60}\n")
        
        return Response({
            'message': 'Регистрация успешна! На ваш email отправлено письмо с подтверждением. Пожалуйста, проверьте почту и перейдите по ссылке для активации аккаунта.',
            'email': user.email
        }, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    """Авторизация пользователя"""
    permission_classes = [permissions.AllowAny]
    
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
                'user': UserSerializer(user).data,
                'token': token.key,
                'message': 'Авторизация успешна'
            }, status=status.HTTP_200_OK)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def profile_view(request):
    """Профиль текущего пользователя"""
    serializer = UserSerializer(request.user)
    return Response(serializer.data)


class BoatOwnerVerificationCreateView(generics.CreateAPIView):
    """Загрузка документов для верификации"""
    serializer_class = BoatOwnerVerificationSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class BoatOwnerVerificationDetailView(generics.RetrieveAPIView):
    """Просмотр статуса верификации"""
    serializer_class = BoatOwnerVerificationDetailSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_object(self):
        user = self.request.user
        if user.role != User.Role.BOAT_OWNER:
            raise PermissionDenied('Только для владельцев судов')
        
        try:
            return user.verification
        except BoatOwnerVerification.DoesNotExist:
            raise NotFound('Документы еще не загружены')


class PasswordResetRequestView(APIView):
    """Запрос на сброс пароля"""
    permission_classes = [permissions.AllowAny]
    
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


