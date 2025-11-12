from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models


class UserManager(BaseUserManager):
    """Кастомный менеджер пользователей для работы с email вместо username"""
    
    def create_user(self, email, password=None, **extra_fields):
        """Создает и возвращает обычного пользователя с email и паролем"""
        if not email:
            raise ValueError('Email обязателен для создания пользователя')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user
    
    def create_superuser(self, email, password=None, **extra_fields):
        """Создает и возвращает суперпользователя с email и паролем"""
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)
        
        if extra_fields.get('is_staff') is not True:
            raise ValueError('Суперпользователь должен иметь is_staff=True')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Суперпользователь должен иметь is_superuser=True')
        
        return self.create_user(email, password, **extra_fields)


class User(AbstractUser):
    """Расширенная модель пользователя с ролями"""
    
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []  # Имя и фамилия необязательны при регистрации
    
    class Role(models.TextChoices):
        CUSTOMER = 'customer', 'Клиент'
        BOAT_OWNER = 'boat_owner', 'Владелец судна'
        GUIDE = 'guide', 'Гид'
    
    class VerificationStatus(models.TextChoices):
        NOT_VERIFIED = 'not_verified', 'Не верифицирован'
        PENDING = 'pending', 'На проверке'
        VERIFIED = 'verified', 'Верифицирован'
        REJECTED = 'rejected', 'Отклонен'
    
    username = None  # Убираем username
    email = models.EmailField(
        unique=True,
        verbose_name='Email'
    )
    
    objects = UserManager()  # Используем кастомный менеджер
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.CUSTOMER,
        verbose_name='Роль'
    )
    phone = models.CharField(
        max_length=20,
        blank=True,
        null=True,
        verbose_name='Телефон'
    )
    verification_status = models.CharField(
        max_length=20,
        choices=VerificationStatus.choices,
        default=VerificationStatus.NOT_VERIFIED,
        verbose_name='Статус верификации'
    )
    verification_rejection_reason = models.TextField(
        blank=True,
        null=True,
        verbose_name='Причина отклонения верификации'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Дата создания')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Дата обновления')
    
    class Meta:
        verbose_name = 'Пользователь'
        verbose_name_plural = 'Пользователи'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.email} ({self.get_role_display()})"
    
    @property
    def is_boat_owner(self):
        return self.role == self.Role.BOAT_OWNER
    
    @property
    def is_guide(self):
        return self.role == self.Role.GUIDE
    
    @property
    def is_customer(self):
        return self.role == self.Role.CUSTOMER
    
    @property
    def is_verified(self):
        return self.verification_status == self.VerificationStatus.VERIFIED


class BoatOwnerVerification(models.Model):
    """Документы для верификации владельца судна"""
    
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='verification',
        limit_choices_to={'role': User.Role.BOAT_OWNER},
        verbose_name='Пользователь'
    )
    passport_scan = models.ImageField(
        upload_to='verification/passports/',
        verbose_name='Паспорт (скан)'
    )
    gims_documents = models.FileField(
        upload_to='verification/gims/',
        verbose_name='Разрешительные документы ГИМС',
        help_text='Документы на судно от ГИМС'
    )
    insurance = models.FileField(
        upload_to='verification/insurance/',
        verbose_name='Страховка'
    )
    boat_photos = models.JSONField(
        default=list,
        verbose_name='Фото судна',
        help_text='Список URL фотографий судна (3-5 ракурсов)'
    )
    submitted_at = models.DateTimeField(auto_now_add=True, verbose_name='Дата подачи')
    reviewed_at = models.DateTimeField(null=True, blank=True, verbose_name='Дата проверки')
    reviewed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_verifications',
        limit_choices_to={'is_staff': True},
        verbose_name='Проверил'
    )
    admin_notes = models.TextField(
        blank=True,
        null=True,
        verbose_name='Примечания администратора'
    )
    
    class Meta:
        verbose_name = 'Верификация владельца судна'
        verbose_name_plural = 'Верификации владельцев судов'
        ordering = ['-submitted_at']
    
    def __str__(self):
        return f"Верификация {self.user.email}"
