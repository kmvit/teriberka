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
        phone = validated_data.get('phone')
        if phone:
            from .services.sms_service import normalize_phone
            validated_data['phone'] = normalize_phone(phone)
        
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
    """Сериализатор для авторизации по email или телефону"""
    email = serializers.CharField(required=False, allow_blank=True)
    phone = serializers.CharField(required=False, allow_blank=True)
    password = serializers.CharField(
        required=True,
        write_only=True,
        style={'input_type': 'password'}
    )
    
    def validate(self, attrs):
        email = attrs.get('email', '').strip()
        phone = attrs.get('phone', '').strip()
        password = attrs.get('password')
        
        if not password:
            raise serializers.ValidationError({'password': 'Пароль обязателен'})
        
        if not email and not phone:
            raise serializers.ValidationError({
                'non_field_errors': ['Укажите email или номер телефона']
            })
        
        if email and phone:
            raise serializers.ValidationError({
                'non_field_errors': ['Укажите только email или только телефон']
            })
        
        user = None
        if email:
            try:
                user = User.objects.get(email=email)
            except User.DoesNotExist:
                raise serializers.ValidationError({'non_field_errors': ['Неверный email или пароль']})
        else:
            from .services.sms_service import normalize_phone
            normalized_phone = normalize_phone(phone)
            if len(normalized_phone) != 11:
                raise serializers.ValidationError({'phone': 'Неверный формат номера телефона'})
            try:
                user = User.objects.get(phone=normalized_phone)
            except User.DoesNotExist:
                raise serializers.ValidationError({'non_field_errors': ['Неверный номер телефона или пароль']})
        
        if not user.check_password(password):
            raise serializers.ValidationError({'non_field_errors': ['Неверный email или пароль']})
        
        attrs['user'] = user
        return attrs


class UserSerializer(serializers.ModelSerializer):
    """Сериализатор для отображения пользователя"""
    verification_status_display = serializers.CharField(source='get_verification_status_display', read_only=True)
    avatar = serializers.ImageField(required=False, allow_null=True)
    
    class Meta:
        model = User
        fields = (
            'id', 'email', 'phone', 'first_name', 'last_name',
            'role', 'verification_status', 'verification_status_display',
            'is_active', 'is_staff', 'created_at', 'avatar'
        )
        read_only_fields = ('id', 'created_at', 'verification_status', 'role', 'is_active', 'is_staff')
    
    def to_representation(self, instance):
        """Переопределяем для возврата полного URL аватарки"""
        representation = super().to_representation(instance)
        request = self.context.get('request')
        if instance.avatar:
            if request:
                # Используем build_absolute_uri для получения полного URL
                representation['avatar'] = request.build_absolute_uri(instance.avatar.url)
            else:
                # Если request нет, формируем URL вручную
                from django.conf import settings
                avatar_url = instance.avatar.url
                if avatar_url.startswith('/'):
                    # Относительный путь - добавляем базовый URL
                    # В режиме разработки обычно это localhost:8000
                    base_url = getattr(settings, 'BASE_URL', 'http://localhost:8000')
                    representation['avatar'] = f"{base_url}{avatar_url}"
                else:
                    representation['avatar'] = avatar_url
        return representation


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


class PhoneSendCodeSerializer(serializers.Serializer):
    """Сериализатор для запроса отправки SMS-кода на телефон"""
    phone = serializers.CharField(required=True, max_length=20)
    
    def validate_phone(self, value):
        from .services.phone_verification import normalize_phone
        normalized = normalize_phone(value)
        if len(normalized) != 11:
            raise serializers.ValidationError('Неверный формат номера телефона')
        return normalized


class PhoneRegisterSerializer(serializers.Serializer):
    """Сериализатор для регистрации по телефону с подтверждением SMS-кодом"""
    phone = serializers.CharField(required=True, max_length=20)
    code = serializers.CharField(required=True, min_length=6, max_length=6)
    email = serializers.EmailField(required=False, allow_blank=True)
    first_name = serializers.CharField(required=True, max_length=150)
    last_name = serializers.CharField(required=False, allow_blank=True, max_length=150)
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
    role = serializers.ChoiceField(
        choices=User.Role.choices,
        default=User.Role.CUSTOMER
    )
    
    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({"password_confirm": "Пароли не совпадают"})
        
        from .services.phone_verification import normalize_phone, verify_code
        phone = normalize_phone(attrs['phone'])
        if len(phone) != 11:
            raise serializers.ValidationError({"phone": "Неверный формат номера телефона"})
        
        if not verify_code(attrs['phone'], attrs['code']):
            raise serializers.ValidationError({"code": "Неверный или истёкший код подтверждения"})
        
        if User.objects.filter(phone=phone).exists():
            raise serializers.ValidationError({"phone": "Пользователь с этим номером уже зарегистрирован"})
        
        email = attrs.get('email', '').strip()
        if email and User.objects.filter(email=email).exists():
            raise serializers.ValidationError({"email": "Пользователь с таким email уже зарегистрирован"})
        
        attrs['phone_normalized'] = phone
        return attrs
    
    def create(self, validated_data):
        validated_data.pop('password_confirm')
        validated_data.pop('code')
        validated_data.pop('phone', None)
        phone = validated_data.pop('phone_normalized')
        password = validated_data.pop('password')
        email = (validated_data.pop('email', None) or '').strip()
        
        # Используем указанный email или генерируем placeholder
        if not email:
            email = f"phone_{phone}@teriberka.local"
        
        user = User.objects.create_user(
            email=email,
            password=password,
            phone=phone,
            is_active=True,  # Сразу активен - телефон подтверждён SMS
            **validated_data
        )
        return user


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

