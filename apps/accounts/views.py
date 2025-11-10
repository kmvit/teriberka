from rest_framework import status, generics, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from rest_framework.exceptions import NotFound, PermissionDenied
from django.contrib.auth import login
from .models import User, BoatOwnerVerification
from .serializers import (
    UserRegistrationSerializer,
    UserLoginSerializer,
    UserSerializer,
    BoatOwnerVerificationSerializer,
    BoatOwnerVerificationDetailSerializer
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
        
        # Создаем токен для автоматической авторизации
        token, created = Token.objects.get_or_create(user=user)
        
        return Response({
            'user': UserSerializer(user).data,
            'token': token.key,
            'message': 'Регистрация успешна. Для владельцев катеров требуется верификация.'
        }, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def login_view(request):
    """Авторизация пользователя"""
    serializer = UserLoginSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.validated_data['user']
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
            raise PermissionDenied('Только для владельцев катеров')
        
        try:
            return user.verification
        except BoatOwnerVerification.DoesNotExist:
            raise NotFound('Документы еще не загружены')


