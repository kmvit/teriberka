from rest_framework import serializers
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from .models import User, BoatOwnerVerification


class UserRegistrationSerializer(serializers.ModelSerializer):
    """Сериализатор для регистрации пользователя"""
    password = serializers.CharField(
        write_only=True,
        required=True,
        validators=[validate_password],
        style={'input_type': 'password'}
    )
    password_confirm = serializers.CharField(
        write_only=True,
        required=True,
        style={'input_type': 'password'}
    )
    
    class Meta:
        model = User
        fields = ('username', 'email', 'phone', 'first_name', 'last_name', 'password', 'password_confirm', 'role')
        extra_kwargs = {
            'email': {'required': True},
            'phone': {'required': True},
        }
    
    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({"password": "Пароли не совпадают"})
        return attrs
    
    def create(self, validated_data):
        validated_data.pop('password_confirm')
        password = validated_data.pop('password')
        
        # Для владельцев катеров аккаунт неактивен до верификации
        is_active = validated_data.get('role') != User.Role.BOAT_OWNER
        
        user = User.objects.create_user(**validated_data, is_active=is_active)
        user.set_password(password)
        user.save()
        return user


class UserLoginSerializer(serializers.Serializer):
    """Сериализатор для авторизации"""
    username = serializers.CharField(required=True)
    password = serializers.CharField(
        required=True,
        write_only=True,
        style={'input_type': 'password'}
    )
    
    def validate(self, attrs):
        username = attrs.get('username')
        password = attrs.get('password')
        
        if username and password:
            user = authenticate(username=username, password=password)
            if not user:
                raise serializers.ValidationError('Неверный логин или пароль')
            if not user.is_active:
                raise serializers.ValidationError('Аккаунт неактивен. Ожидайте верификации.')
            attrs['user'] = user
        else:
            raise serializers.ValidationError('Необходимо указать логин и пароль')
        
        return attrs


class UserSerializer(serializers.ModelSerializer):
    """Сериализатор для отображения пользователя"""
    verification_status_display = serializers.CharField(source='get_verification_status_display', read_only=True)
    
    class Meta:
        model = User
        fields = (
            'id', 'username', 'email', 'phone', 'first_name', 'last_name',
            'role', 'verification_status', 'verification_status_display',
            'is_active', 'created_at'
        )
        read_only_fields = ('id', 'created_at', 'verification_status')


class BoatOwnerVerificationSerializer(serializers.ModelSerializer):
    """Сериализатор для загрузки документов верификации"""
    user = serializers.PrimaryKeyRelatedField(read_only=True)
    boat_photos = serializers.ListField(
        child=serializers.ImageField(),
        required=False,
        allow_empty=True,
        write_only=True
    )
    
    class Meta:
        model = BoatOwnerVerification
        fields = (
            'id', 'user', 'passport_scan', 'gims_documents', 'insurance',
            'boat_photos', 'submitted_at', 'verification_status'
        )
        read_only_fields = ('id', 'user', 'submitted_at')
    
    def create(self, validated_data):
        user = self.context['request'].user
        if user.role != User.Role.BOAT_OWNER:
            raise serializers.ValidationError('Только владельцы катеров могут загружать документы')
        
        # Проверяем, нет ли уже заявки на верификацию
        if hasattr(user, 'verification'):
            raise serializers.ValidationError('Документы уже загружены. Ожидайте проверки.')
        
        # Обрабатываем boat_photos - сохраняем файлы
        boat_photos = validated_data.pop('boat_photos', [])
        boat_photo_urls = []
        
        verification = BoatOwnerVerification.objects.create(user=user, **validated_data)
        
        # Сохраняем фотографии и получаем их URL
        import os
        from django.core.files.storage import default_storage
        from django.conf import settings
        
        for idx, photo in enumerate(boat_photos):
            # Сохраняем файл
            file_name = f'verification/boats/{user.id}/photo_{idx}_{photo.name}'
            file_path = default_storage.save(file_name, photo)
            # Получаем полный URL
            file_url = f"{settings.MEDIA_URL}{file_path}"
            boat_photo_urls.append(file_url)
        
        verification.boat_photos = boat_photo_urls
        verification.save()
        user.verification_status = User.VerificationStatus.PENDING
        user.save()
        
        return verification
    
    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['verification_status'] = instance.user.verification_status
        # Преобразуем boat_photos из JSON в список URL
        if isinstance(instance.boat_photos, list):
            data['boat_photos'] = instance.boat_photos
        return data


class BoatOwnerVerificationDetailSerializer(serializers.ModelSerializer):
    """Сериализатор для детального просмотра верификации"""
    user = UserSerializer(read_only=True)
    verification_status_display = serializers.CharField(
        source='user.get_verification_status_display',
        read_only=True
    )
    
    class Meta:
        model = BoatOwnerVerification
        fields = (
            'id', 'user', 'passport_scan', 'gims_documents', 'insurance',
            'boat_photos', 'submitted_at', 'reviewed_at', 'reviewed_by',
            'admin_notes', 'verification_status_display'
        )
        read_only_fields = ('id', 'user', 'submitted_at', 'reviewed_at', 'reviewed_by')

