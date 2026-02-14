from django.db import models
from django.core.validators import MinValueValidator
from apps.bookings.models import Booking


class Payment(models.Model):
    """Модель платежа через Т-Банк"""
    
    class Status(models.TextChoices):
        NEW = 'new', 'Создан'
        FORM_SHOWED = 'form_showed', 'Форма показана'
        AUTHORIZING = 'authorizing', 'Авторизация'
        AUTHORIZED = 'authorized', 'Авторизован'
        CONFIRMING = 'confirming', 'Подтверждение'
        CONFIRMED = 'confirmed', 'Подтвержден'
        REVERSING = 'reversing', 'Отмена'
        REVERSED = 'reversed', 'Отменен'
        REFUNDING = 'refunding', 'Возврат'
        PARTIAL_REFUNDED = 'partial_refunded', 'Частичный возврат'
        REFUNDED = 'refunded', 'Возвращен'
        REJECTED = 'rejected', 'Отклонен'
        DEADLINE_EXPIRED = 'deadline_expired', 'Истек срок'
    
    class PaymentType(models.TextChoices):
        DEPOSIT = 'deposit', 'Предоплата'
        REMAINING = 'remaining', 'Остаток'
        FULL = 'full', 'Полная оплата'
    
    booking = models.ForeignKey(
        Booking,
        on_delete=models.CASCADE,
        related_name='payments',
        verbose_name='Бронирование'
    )
    payment_id = models.CharField(
        max_length=100,
        unique=True,
        verbose_name='ID платежа в Т-Банке',
        help_text='PaymentId, возвращаемый API Т-Банка'
    )
    order_id = models.CharField(
        max_length=255,
        unique=True,
        verbose_name='ID заказа',
        help_text='Уникальный идентификатор заказа в нашей системе'
    )
    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)],
        verbose_name='Сумма платежа (₽)'
    )
    payment_type = models.CharField(
        max_length=20,
        choices=PaymentType.choices,
        verbose_name='Тип платежа'
    )
    status = models.CharField(
        max_length=30,
        choices=Status.choices,
        default=Status.NEW,
        verbose_name='Статус'
    )
    payment_url = models.URLField(
        max_length=500,
        blank=True,
        verbose_name='Ссылка для оплаты',
        help_text='URL для перенаправления пользователя на оплату'
    )
    success_url = models.URLField(
        max_length=500,
        blank=True,
        verbose_name='URL успешной оплаты'
    )
    fail_url = models.URLField(
        max_length=500,
        blank=True,
        verbose_name='URL неудачной оплаты'
    )
    error_code = models.CharField(
        max_length=50,
        blank=True,
        verbose_name='Код ошибки'
    )
    error_message = models.TextField(
        blank=True,
        verbose_name='Сообщение об ошибке'
    )
    raw_response = models.JSONField(
        null=True,
        blank=True,
        verbose_name='Полный ответ от Т-Банка',
        help_text='JSON ответ от API для отладки'
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='Дата создания'
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name='Дата обновления'
    )
    paid_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='Дата оплаты'
    )
    cache_key = models.CharField(
        max_length=255,
        blank=True,
        default='',
        verbose_name='Ключ кэша',
        help_text='Ключ для получения временных данных бронирования из кэша'
    )
    
    class Meta:
        verbose_name = 'Платеж'
        verbose_name_plural = 'Платежи'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['booking', 'payment_type']),
            models.Index(fields=['payment_id']),
            models.Index(fields=['order_id']),
            models.Index(fields=['status']),
        ]
    
    def __str__(self):
        return f"Платеж {self.order_id} - {self.amount} ₽ ({self.get_payment_type_display()})"
    
    def is_paid(self):
        """Проверка, оплачен ли платеж"""
        return self.status in [self.Status.CONFIRMED, self.Status.AUTHORIZED]
    
    def is_failed(self):
        """Проверка, неудачен ли платеж"""
        return self.status in [
            self.Status.REJECTED,
            self.Status.REVERSED,
            self.Status.DEADLINE_EXPIRED
        ]
