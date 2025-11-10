from django.db import models
from django.core.validators import MinValueValidator
from apps.accounts.models import User
from apps.boats.models import Boat


class Booking(models.Model):
    """Модель бронирования"""
    
    class Status(models.TextChoices):
        PENDING = 'pending', 'Ожидает подтверждения'
        CONFIRMED = 'confirmed', 'Подтверждено'
        CANCELLED = 'cancelled', 'Отменено'
        COMPLETED = 'completed', 'Завершено'
    
    class PaymentMethod(models.TextChoices):
        CASH = 'cash', 'Наличные'
        CARD = 'card', 'Безналичный расчет'
        ONLINE = 'online', 'Онлайн оплата'
    
    boat = models.ForeignKey(
        Boat,
        on_delete=models.CASCADE,
        related_name='bookings',
        verbose_name='Судно'
    )
    start_datetime = models.DateTimeField(verbose_name='Дата и время начала')
    end_datetime = models.DateTimeField(verbose_name='Дата и время окончания')
    duration_hours = models.PositiveIntegerField(
        validators=[MinValueValidator(1)],
        verbose_name='Длительность (часы)'
    )
    event_type = models.CharField(
        max_length=200,
        verbose_name='Тип мероприятия',
        help_text='Например: "Выход в море на поиски китов"'
    )
    guide = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='guide_bookings',
        limit_choices_to={'role': User.Role.GUIDE},
        verbose_name='Гид',
        help_text='Гид, который привел группу'
    )
    customer = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='bookings',
        limit_choices_to={'role': User.Role.CUSTOMER},
        verbose_name='Клиент'
    )
    guest_name = models.CharField(max_length=200, verbose_name='Имя гостя')
    guest_phone = models.CharField(max_length=20, verbose_name='Контактный телефон')
    number_of_people = models.PositiveIntegerField(
        validators=[MinValueValidator(1)],
        verbose_name='Количество людей'
    )
    price_per_person = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)],
        null=True,
        blank=True,
        verbose_name='Ставка за человека (₽)',
        help_text='Если не указано, будет использована ставка из стоимости прогулки для данной длительности'
    )
    original_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)],
        default=0,
        verbose_name='Исходная стоимость (₽)',
        help_text='Стоимость до применения скидки'
    )
    discount_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        validators=[MinValueValidator(0)],
        default=0,
        verbose_name='Скидка (%)',
        help_text='Процент скидки, примененной к бронированию'
    )
    discount_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)],
        default=0,
        verbose_name='Сумма скидки (₽)'
    )
    total_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)],
        verbose_name='Общая стоимость (₽)'
    )
    deposit = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)],
        default=0,
        verbose_name='Предоплата (₽)'
    )
    remaining_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)],
        verbose_name='Остаток к оплате (₽)'
    )
    payment_method = models.CharField(
        max_length=20,
        choices=PaymentMethod.choices,
        default=PaymentMethod.CARD,
        verbose_name='Способ оплаты остатка'
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        verbose_name='Статус'
    )
    notes = models.TextField(blank=True, verbose_name='Примечания')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Дата создания')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Дата обновления')
    
    class Meta:
        verbose_name = 'Бронирование'
        verbose_name_plural = 'Бронирования'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['boat', 'start_datetime', 'end_datetime']),
            models.Index(fields=['boat', 'status']),
            models.Index(fields=['customer', 'status']),
            models.Index(fields=['guide', 'status']),
        ]
    
    def __str__(self):
        return f"{self.guest_name} - {self.boat.name} ({self.start_datetime.strftime('%d.%m.%Y %H:%M')})"
    
    def save(self, *args, **kwargs):
        from decimal import Decimal
        from apps.boats.models import GuideBoatDiscount, BoatPricing
        
        # Если цена за человека не указана, используем цену из BoatPricing
        if self.price_per_person is None:
            # Определяем длительность и ищем соответствующую цену
            duration = self.duration_hours
            try:
                pricing = BoatPricing.objects.get(
                    boat=self.boat,
                    duration_hours=duration
                )
                self.price_per_person = pricing.price_per_person
            except BoatPricing.DoesNotExist:
                # Если цены нет, оставляем None - нужно будет указать вручную
                pass
        
        # Рассчитываем исходную стоимость
        if self.original_price == 0 and self.price_per_person is not None:
            self.original_price = self.price_per_person * self.number_of_people
        
        # Если указан гид, проверяем скидку
        if self.guide:
            try:
                discount_obj = GuideBoatDiscount.objects.get(
                    guide=self.guide,
                    boat_owner=self.boat.owner,
                    is_active=True
                )
                self.discount_percent = discount_obj.discount_percent
            except GuideBoatDiscount.DoesNotExist:
                # Если скидка не найдена, скидка = 0
                self.discount_percent = Decimal('0')
        
        # Рассчитываем сумму скидки и итоговую стоимость
        if self.discount_percent > 0:
            self.discount_amount = (self.original_price * self.discount_percent) / Decimal('100')
            self.total_price = self.original_price - self.discount_amount
        else:
            # Если скидки нет, итоговая цена = исходная
            if self.total_price == 0:
                self.total_price = self.original_price
            self.discount_amount = Decimal('0')
        
        # Автоматически рассчитываем остаток к оплате
        self.remaining_amount = self.total_price - self.deposit
        
        super().save(*args, **kwargs)
