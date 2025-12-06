from rest_framework import serializers
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from .models import User, UserVerification, VerificationDocument


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
        fields = ('email', 'phone', 'first_name', 'last_name', 'password', 'password_confirm', 'role')
        extra_kwargs = {
            'email': {'required': True},
            'phone': {'required': True},
            'first_name': {'required': True},
            'last_name': {'required': False, 'allow_blank': True},
        }
    
    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({"password": "Пароли не совпадают"})
        return attrs
    
    def create(self, validated_data):
        validated_data.pop('password_confirm')
        password = validated_data.pop('password')
        email = validated_data.pop('email')
        
        # Пользователи регистрируются с неактивным аккаунтом до подтверждения email
        is_active = False
        
        # create_user уже устанавливает пароль, поэтому передаем его напрямую
        user = User.objects.create_user(
            email=email,
            password=password,
            is_active=is_active,
            **validated_data
        )
        return user


class UserLoginSerializer(serializers.Serializer):
    """Сериализатор для авторизации"""
    email = serializers.EmailField(required=True)
    password = serializers.CharField(
        required=True,
        write_only=True,
        style={'input_type': 'password'}
    )
    
    def validate(self, attrs):
        email = attrs.get('email')
        password = attrs.get('password')
        
        if email and password:
            try:
                user = User.objects.get(email=email)
            except User.DoesNotExist:
                raise serializers.ValidationError('Неверный email или пароль')
            
            # Проверяем пароль
            if not user.check_password(password):
                raise serializers.ValidationError('Неверный email или пароль')
            
            attrs['user'] = user
        else:
            raise serializers.ValidationError('Необходимо указать email и пароль')
        
        return attrs


class UserSerializer(serializers.ModelSerializer):
    """Сериализатор для отображения пользователя"""
    verification_status_display = serializers.CharField(source='get_verification_status_display', read_only=True)
    
    class Meta:
        model = User
        fields = (
            'id', 'email', 'phone', 'first_name', 'last_name',
            'role', 'verification_status', 'verification_status_display',
            'is_active', 'created_at'
        )
        read_only_fields = ('id', 'created_at', 'verification_status', 'role', 'is_active')


class LoginResponseSerializer(serializers.Serializer):
    """Сериализатор для ответа авторизации"""
    token = serializers.CharField()
    message = serializers.CharField()


class UserVerificationSerializer(serializers.ModelSerializer):
    """Сериализатор для загрузки документов верификации"""
    user = serializers.PrimaryKeyRelatedField(read_only=True)
    verification_status = serializers.SerializerMethodField()
    documents_files = serializers.ListField(
        child=serializers.FileField(),
        required=True,
        allow_empty=False,
        write_only=True,
        help_text='Список файлов документов и фотографий'
    )
    documents = serializers.SerializerMethodField(read_only=True)
    
    class Meta:
        model = UserVerification
        fields = (
            'id', 'user', 'documents', 'documents_files',
            'submitted_at', 'verification_status'
        )
        read_only_fields = ('id', 'user', 'documents', 'submitted_at', 'verification_status')
    
    def get_verification_status(self, obj):
        """Возвращает статус верификации из связанного пользователя"""
        return obj.user.verification_status
    
    def get_documents(self, obj):
        """Возвращает список файлов документов"""
        request = self.context.get('request')
        documents = obj.documents.all()
        return [
            {
                'id': doc.id,
                'file': request.build_absolute_uri(doc.file.url) if request else doc.file.url,
                'uploaded_at': doc.uploaded_at
            }
            for doc in documents
        ]
    
    def create(self, validated_data):
        user = self.context['request'].user
        if user.role not in [User.Role.BOAT_OWNER, User.Role.GUIDE]:
            raise serializers.ValidationError('Только владельцы судов и гиды могут загружать документы')
        
        # Проверяем, нет ли уже заявки на верификацию
        if hasattr(user, 'verification'):
            raise serializers.ValidationError('Документы уже загружены. Ожидайте проверки.')
        
        # Обрабатываем documents_files - сохраняем файлы
        documents_files = validated_data.pop('documents_files', [])
        
        # Создаем верификацию
        verification = UserVerification.objects.create(user=user)
        
        # Создаем объекты VerificationDocument для каждого файла
        for file in documents_files:
            VerificationDocument.objects.create(
                verification=verification,
                file=file
            )
        
        user.verification_status = User.VerificationStatus.PENDING
        user.save()
        
        return verification


class VerificationDocumentSerializer(serializers.ModelSerializer):
    """Сериализатор для документа верификации"""
    file = serializers.SerializerMethodField()
    
    class Meta:
        model = VerificationDocument
        fields = ('id', 'file', 'uploaded_at')
        read_only_fields = ('id', 'uploaded_at')
    
    def get_file(self, obj):
        request = self.context.get('request')
        return request.build_absolute_uri(obj.file.url) if request else obj.file.url


class UserVerificationDetailSerializer(serializers.ModelSerializer):
    """Сериализатор для детального просмотра верификации"""
    user = UserSerializer(read_only=True)
    verification_status_display = serializers.CharField(
        source='user.get_verification_status_display',
        read_only=True
    )
    documents = VerificationDocumentSerializer(many=True, read_only=True)
    
    class Meta:
        model = UserVerification
        fields = (
            'id', 'user', 'documents', 'submitted_at', 'reviewed_at', 'reviewed_by',
            'admin_notes', 'verification_status_display'
        )
        read_only_fields = ('id', 'user', 'submitted_at', 'reviewed_at', 'reviewed_by')


class PasswordResetRequestSerializer(serializers.Serializer):
    """Сериализатор для запроса сброса пароля"""
    email = serializers.EmailField(required=True)
    
    def validate_email(self, value):
        try:
            User.objects.get(email=value)
        except User.DoesNotExist:
            # Не раскрываем информацию о существовании пользователя
            pass
        return value


class PasswordResetConfirmSerializer(serializers.Serializer):
    """Сериализатор для подтверждения сброса пароля"""
    token = serializers.CharField(required=True)
    email = serializers.EmailField(required=True)
    password = serializers.CharField(
        required=True,
        write_only=True,
        validators=[validate_password],
        style={'input_type': 'password'}
    )
    password_confirm = serializers.CharField(
        required=True,
        write_only=True,
        style={'input_type': 'password'}
    )
    
    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({"password": "Пароли не совпадают"})
        return attrs


class ChangePasswordSerializer(serializers.Serializer):
    """Сериализатор для смены пароля авторизованным пользователем"""
    old_password = serializers.CharField(
        required=True,
        write_only=True,
        style={'input_type': 'password'}
    )
    new_password = serializers.CharField(
        required=True,
        write_only=True,
        validators=[validate_password],
        style={'input_type': 'password'}
    )
    new_password_confirm = serializers.CharField(
        required=True,
        write_only=True,
        style={'input_type': 'password'}
    )
    
    def validate(self, attrs):
        if attrs['new_password'] != attrs['new_password_confirm']:
            raise serializers.ValidationError({"new_password": "Новые пароли не совпадают"})
        return attrs

