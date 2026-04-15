from decimal import Decimal

from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from apps.accounts.models import User
from apps.boats.models import Boat, TripType


class PromoCode(models.Model):
    """Модель промокода"""

    class DiscountType(models.TextChoices):
        PERCENT = 'percent', 'Процент (%)'
        AMOUNT = 'amount', 'Сумма (₽)'

    code = models.CharField(
        max_length=50,
        unique=True,
        verbose_name='Промокод',
        help_text='Уникальный код промокода'
    )
    discount_type = models.CharField(
        max_length=10,
        choices=DiscountType.choices,
        default=DiscountType.AMOUNT,
        verbose_name='Тип скидки',
        help_text='Процент от суммы или фиксированная сумма в рублях'
    )
    discount_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        null=True,
        blank=True,
        verbose_name='Скидка (%)',
        help_text='Процент скидки (0–100). Используется при типе «Процент»'
    )
    discount_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)],
        null=True,
        blank=True,
        verbose_name='Сумма скидки (₽)',
        help_text='Фиксированная сумма скидки в рублях. Используется при типе «Сумма»'
    )
    is_active = models.BooleanField(
        default=True,
        verbose_name='Активен',
        help_text='Отметьте, чтобы активировать промокод'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Дата создания')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Дата обновления')

    class Meta:
        verbose_name = 'Промокод'
        verbose_name_plural = 'Промокоды'
        ordering = ['-created_at']

    def get_discount_for_price(self, price):
        """Возвращает сумму скидки для заданной цены (после скидки гида)."""
        if not self.is_active or price <= 0:
            return Decimal('0')
        if self.discount_type == self.DiscountType.PERCENT and self.discount_percent:
            return (Decimal(str(price)) * self.discount_percent / Decimal('100')).quantize(Decimal('0.01'))
        if self.discount_type == self.DiscountType.AMOUNT and self.discount_amount:
            return min(self.discount_amount, Decimal(str(price)))
        return Decimal('0')

    def clean(self):
        from django.core.exceptions import ValidationError
        if self.discount_type == self.DiscountType.PERCENT:
            if self.discount_percent is None:
                raise ValidationError({'discount_percent': 'Укажите процент скидки при типе «Процент»'})
        elif self.discount_type == self.DiscountType.AMOUNT:
            if self.discount_amount is None or self.discount_amount == 0:
                raise ValidationError({'discount_amount': 'Укажите сумму скидки при типе «Сумма»'})

    def __str__(self):
        if self.discount_type == self.DiscountType.PERCENT and self.discount_percent is not None:
            return f"{self.code} - {self.discount_percent}% ({'активен' if self.is_active else 'неактивен'})"
        amt = self.discount_amount or 0
        return f"{self.code} - {amt}₽ ({'активен' if self.is_active else 'неактивен'})"


class Booking(models.Model):
    """Модель бронирования"""
    
    class Status(models.TextChoices):
        RESERVED = 'reserved', 'Зарезервировано (ожидает оплаты)'
        PENDING = 'pending', 'Ожидает подтверждения'
        CONFIRMED = 'confirmed', 'Подтверждено'
        CANCELLED = 'cancelled', 'Отменено'
        COMPLETED = 'completed', 'Завершено'
    
    class PaymentMethod(models.TextChoices):
        CASH = 'cash', 'Наличные'
        CARD = 'card', 'Безналичный расчет'
        ONLINE = 'online', 'Онлайн оплата'
    
    trip_type = models.CharField(
        max_length=20,
        choices=TripType.choices,
        default=TripType.GROUP,
        verbose_name='Тип выхода',
        help_text='Групповой или Индивидуальный (Чарт)'
    )
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
    hotel_admin = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='hotel_bookings',
        limit_choices_to={'role': User.Role.HOTEL},
        verbose_name='Администратор гостиницы',
        help_text='Гостиница, которая привела гостя'
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
    hotel_cashback_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        validators=[MinValueValidator(0)],
        default=0,
        verbose_name='Кешбэк гостинице (%)',
        help_text='Процент кешбэка для гостиницы'
    )
    hotel_cashback_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)],
        default=0,
        verbose_name='Сумма кешбэка гостинице (₽)'
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
    promo_code = models.ForeignKey(
        PromoCode,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='bookings',
        verbose_name='Промокод',
        help_text='Примененный промокод для скидки'
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
    google_calendar_event_id = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        verbose_name='ID события в Google Calendar',
        help_text='Идентификатор события в календаре Google для синхронизации'
    )
    telegram_notification_sent = models.BooleanField(
        default=False,
        verbose_name='Уведомление в Telegram отправлено',
        help_text='Флаг для предотвращения дублирования уведомлений в Telegram'
    )
    guide_reminder_sent = models.BooleanField(
        default=False,
        verbose_name='Напоминание гиду отправлено',
        help_text='Флаг для предотвращения дублирования напоминания гиду за 1 час до выхода'
    )
    client_payment_reminder_sent = models.BooleanField(
        default=False,
        verbose_name='Напоминание клиенту об оплате отправлено',
        help_text='Флаг для предотвращения дублирования напоминания клиенту об оплате остатка за 1 час до выхода'
    )
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
            models.Index(fields=['hotel_admin', 'status']),
            models.Index(fields=['promo_code']),
        ]
    
    def __str__(self):
        return f"{self.guest_name} - {self.boat.name} ({self.start_datetime.strftime('%d.%m.%Y %H:%M')})"
    
    def save(self, *args, **kwargs):
        from decimal import Decimal
        from apps.boats.models import GuideBoatDiscount, BoatPricing, HotelBoatCashback, CharterPricing

        if self.trip_type == TripType.INDIVIDUAL:
            # === Индивидуальный выход (Чарт) ===
            # Цена берётся из CharterPricing (за весь катер, не за человека)
            if self.original_price is None or self.original_price == 0:
                try:
                    charter = CharterPricing.objects.get(
                        boat=self.boat,
                        duration_hours=self.duration_hours,
                        is_active=True
                    )
                    self.original_price = charter.total_price
                except CharterPricing.DoesNotExist:
                    pass

            if self.original_price is None:
                self.original_price = Decimal('0')

            # Для чарта price_per_person не используется
            # Скидки гида и промокоды не применяются к чарту
            if self.discount_percent is None:
                self.discount_percent = Decimal('0')
            self.discount_amount = Decimal('0')
            self.total_price = self.original_price

            # Кешбэк гостиницы
            if self.hotel_admin:
                try:
                    cashback_obj = HotelBoatCashback.objects.get(
                        hotel=self.hotel_admin,
                        boat_owner=self.boat.owner,
                        is_active=True
                    )
                    self.hotel_cashback_percent = cashback_obj.cashback_percent
                    self.hotel_cashback_amount = (self.total_price * self.hotel_cashback_percent) / Decimal('100')
                except HotelBoatCashback.DoesNotExist:
                    self.hotel_cashback_percent = Decimal('0')
                    self.hotel_cashback_amount = Decimal('0')
            else:
                if self.hotel_cashback_percent is None:
                    self.hotel_cashback_percent = Decimal('0')
                if self.hotel_cashback_amount is None:
                    self.hotel_cashback_amount = Decimal('0')

            # Предоплата 30% от total_price
            if self.deposit is None or self.deposit == 0:
                self.deposit = (self.total_price * Decimal('30')) / Decimal('100')

            self.remaining_amount = self.total_price - self.deposit

        else:
            # === Групповой выход (текущая логика) ===
            # Если цена за человека не указана, используем цену из BoatPricing
            if self.price_per_person is None:
                duration = self.duration_hours
                try:
                    pricing = BoatPricing.objects.get(
                        boat=self.boat,
                        duration_hours=duration
                    )
                    self.price_per_person = pricing.price_per_person
                except BoatPricing.DoesNotExist:
                    pass

            # Рассчитываем исходную стоимость
            if (self.original_price is None or self.original_price == 0) and self.price_per_person is not None:
                self.original_price = self.price_per_person * self.number_of_people

            if self.original_price is None:
                self.original_price = Decimal('0')

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
                    self.discount_percent = Decimal('0')
            else:
                if self.discount_percent is None:
                    self.discount_percent = Decimal('0')

            # Рассчитываем сумму скидки и итоговую стоимость
            price_after_guide_discount = self.original_price
            if self.discount_percent and self.discount_percent > 0:
                self.discount_amount = (self.original_price * self.discount_percent) / Decimal('100')
                price_after_guide_discount = self.original_price - self.discount_amount
            else:
                if self.total_price is None or self.total_price == 0:
                    price_after_guide_discount = self.original_price
                self.discount_amount = Decimal('0')

            # Применяем скидку по промокоду к цене после скидки гида
            promo_discount = Decimal('0')
            if self.promo_code and self.promo_code.is_active:
                promo_discount = self.promo_code.get_discount_for_price(price_after_guide_discount)
                promo_discount = min(promo_discount, price_after_guide_discount)

            if promo_discount > 0:
                actual_promo_discount = promo_discount
                self.total_price = price_after_guide_discount - actual_promo_discount
                self.discount_amount = self.discount_amount + actual_promo_discount
            else:
                self.total_price = price_after_guide_discount

            if self.total_price is None:
                self.total_price = self.original_price

            # Если указан администратор гостиницы, рассчитываем кешбэк
            if self.hotel_admin:
                try:
                    cashback_obj = HotelBoatCashback.objects.get(
                        hotel=self.hotel_admin,
                        boat_owner=self.boat.owner,
                        is_active=True
                    )
                    self.hotel_cashback_percent = cashback_obj.cashback_percent
                    self.hotel_cashback_amount = (self.total_price * self.hotel_cashback_percent) / Decimal('100')
                except HotelBoatCashback.DoesNotExist:
                    self.hotel_cashback_percent = Decimal('0')
                    self.hotel_cashback_amount = Decimal('0')
            else:
                if self.hotel_cashback_percent is None:
                    self.hotel_cashback_percent = Decimal('0')
                if self.hotel_cashback_amount is None:
                    self.hotel_cashback_amount = Decimal('0')

            # Убеждаемся, что deposit установлен
            if self.deposit is None:
                self.deposit = Decimal('0')

            # Автоматически рассчитываем остаток к оплате
            self.remaining_amount = self.total_price - self.deposit

        super().save(*args, **kwargs)
