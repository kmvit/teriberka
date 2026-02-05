from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from datetime import date, time, datetime, timedelta
from apps.accounts.models import User


class Dock(models.Model):
    """Модель причала"""
    name = models.CharField(max_length=200, verbose_name='Название причала')
    yandex_location_url = models.URLField(
        max_length=500,
        blank=True,
        verbose_name='Ссылка на Яндекс.Карты',
        help_text='URL ссылка на локацию причала в Яндекс.Картах'
    )
    description = models.TextField(blank=True, verbose_name='Описание')
    is_active = models.BooleanField(default=True, verbose_name='Активен')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Дата создания')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Дата обновления')
    
    class Meta:
        verbose_name = 'Причал'
        verbose_name_plural = 'Причалы'
        ordering = ['name']
    
    def __str__(self):
        return self.name


class Boat(models.Model):
    """Модель судна"""
    
    class BoatType(models.TextChoices):
        BOAT = 'boat', 'Катер'
        YACHT = 'yacht', 'Яхта'
        BARKAS = 'barkas', 'Баркас'
    
    name = models.CharField(max_length=200, verbose_name='Название судна')
    boat_type = models.CharField(
        max_length=20,
        choices=BoatType.choices,
        default=BoatType.BOAT,
        verbose_name='Тип судна'
    )
    owner = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='boats',
        verbose_name='Владелец'
    )
    capacity = models.PositiveIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(11)],
        verbose_name='Вместимость (чел.)',
        help_text='Максимум 11 человек (12 включая капитана)'
    )
    description = models.TextField(blank=True, verbose_name='Описание и особенности')
    dock = models.ForeignKey(
        'Dock',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='boats',
        verbose_name='Причал'
    )
    features = models.ManyToManyField(
        'Feature',
        related_name='boats',
        blank=True,
        verbose_name='Особенности'
    )
    is_active = models.BooleanField(default=True, verbose_name='Активен')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Дата создания')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Дата обновления')
    
    class Meta:
        verbose_name = 'Судно'
        verbose_name_plural = 'Судна'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.get_boat_type_display()} {self.name}"


class BoatImage(models.Model):
    """Галерея фото судна"""
    boat = models.ForeignKey(
        Boat,
        on_delete=models.CASCADE,
        related_name='images',
        verbose_name='Судно'
    )
    image = models.ImageField(
        upload_to='boats/gallery/',
        verbose_name='Фото'
    )
    order = models.PositiveIntegerField(
        default=0,
        verbose_name='Порядок сортировки'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Дата создания')
    
    class Meta:
        verbose_name = 'Фото судна'
        verbose_name_plural = 'Фото судна'
        ordering = ['order', 'created_at']
    
    def __str__(self):
        return f"{self.boat.name} - фото #{self.order}"


class Feature(models.Model):
    """Особенности судна (создаются отдельно в админке)"""
    name = models.CharField(max_length=200, unique=True, verbose_name='Название особенности')
    is_active = models.BooleanField(default=True, verbose_name='Активна')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Дата создания')
    
    class Meta:
        verbose_name = 'Особенность'
        verbose_name_plural = 'Особенности'
        ordering = ['name']
    
    def __str__(self):
        return self.name


class BoatPricing(models.Model):
    """Стоимость прогулки на судне"""
    
    class DurationHours(models.IntegerChoices):
        TWO_HOURS = 2, '2 часа'
        THREE_HOURS = 3, '3 часа'
    
    boat = models.ForeignKey(
        Boat,
        on_delete=models.CASCADE,
        related_name='pricing',
        verbose_name='Судно'
    )
    duration_hours = models.IntegerField(
        choices=DurationHours.choices,
        verbose_name='Длительность'
    )
    price_per_person = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)],
        verbose_name='Стоимость за человека (₽)'
    )
    
    class Meta:
        verbose_name = 'Стоимость прогулки'
        verbose_name_plural = 'Стоимость прогулок'
        unique_together = [['boat', 'duration_hours']]
    
    def __str__(self):
        return f"{self.boat.name} - {self.get_duration_hours_display()} ({self.price_per_person} ₽/чел.)"


class SailingZone(models.Model):
    """Зоны плавания (маршруты)"""
    name = models.CharField(max_length=200, verbose_name='Название маршрута')
    description = models.TextField(blank=True, verbose_name='Описание маршрута')
    boats = models.ManyToManyField(
        Boat,
        related_name='sailing_zones',
        verbose_name='Судна',
        blank=True
    )
    is_active = models.BooleanField(default=True, verbose_name='Активен')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Дата создания')
    
    class Meta:
        verbose_name = 'Зона плавания'
        verbose_name_plural = 'Зоны плавания'
        ordering = ['name']
    
    def __str__(self):
        return self.name


class BoatAvailability(models.Model):
    """Расписание доступности судна (дата и время выхода)"""
    
    boat = models.ForeignKey(
        Boat,
        on_delete=models.CASCADE,
        related_name='availabilities',
        verbose_name='Судно'
    )
    departure_date = models.DateField(
        verbose_name='Дата выхода',
        help_text='Например: 7 ноября',
        default=date.today  # Django автоматически вызовет функцию при создании записи
    )
    departure_time = models.TimeField(
        verbose_name='Время выхода',
        help_text='Например: 12:00',
        default=time(12, 0)
    )
    return_time = models.TimeField(
        verbose_name='Время возвращения',
        help_text='Например: 14:00',
        default=time(14, 0)
    )
    capacity_limit = models.PositiveIntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(11)],
        verbose_name='Ограничение мест на рейс',
        help_text='Если не указано, используется вместимость судна'
    )
    is_active = models.BooleanField(default=True, verbose_name='Активно')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Дата создания')
    
    class Meta:
        verbose_name = 'Расписание доступности'
        verbose_name_plural = 'Расписания доступности'
        ordering = ['departure_date', 'departure_time']
    
    def __str__(self):
        return f"{self.boat.name} - {self.departure_date} {self.departure_time}-{self.return_time}"

    @property
    def effective_capacity(self):
        """Возвращает эффективную вместимость: capacity_limit если указано, иначе boat.capacity"""
        return self.capacity_limit if self.capacity_limit is not None else self.boat.capacity

    @property
    def duration_hours(self):
        """
        Рассчитывает длительность рейса в часах
        Учитывает переход через полночь
        """
        departure = datetime.combine(self.departure_date, self.departure_time)
        return_dt = datetime.combine(self.departure_date, self.return_time)

        # Если время возвращения меньше времени отправления, значит рейс через полночь
        if self.return_time < self.departure_time:
            return_dt += timedelta(days=1)

        duration = return_dt - departure
        return int(duration.total_seconds() / 3600)


class GuideBoatDiscount(models.Model):
    """Скидка для гида от владельца судна"""
    guide = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='guide_discounts',
        limit_choices_to={'role': User.Role.GUIDE},
        verbose_name='Гид'
    )
    boat_owner = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='guide_discounts_given',
        limit_choices_to={'role': User.Role.BOAT_OWNER},
        verbose_name='Владелец судна'
    )
    discount_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        verbose_name='Скидка (%)',
        help_text='Процент скидки от базовой цены'
    )
    is_active = models.BooleanField(default=True, verbose_name='Активна')
    notes = models.TextField(blank=True, verbose_name='Примечания')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Дата создания')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Дата обновления')
    
    class Meta:
        verbose_name = 'Скидка для гида'
        verbose_name_plural = 'Скидки для гидов'
        unique_together = [['guide', 'boat_owner']]
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.guide.email} - {self.boat_owner.email} ({self.discount_percent}%)"


class HotelBoatCashback(models.Model):
    """Кешбэк для гостиницы от владельца судна"""
    hotel = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='hotel_cashbacks',
        limit_choices_to={'role': User.Role.HOTEL},
        verbose_name='Гостиница'
    )
    boat_owner = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='hotel_cashbacks_given',
        limit_choices_to={'role': User.Role.BOAT_OWNER},
        verbose_name='Владелец судна'
    )
    cashback_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        verbose_name='Кешбэк (%)',
        help_text='Процент кешбэка от стоимости бронирования'
    )
    is_active = models.BooleanField(default=True, verbose_name='Активен')
    notes = models.TextField(blank=True, verbose_name='Примечания')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Дата создания')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Дата обновления')
    
    class Meta:
        verbose_name = 'Кешбэк для гостиницы'
        verbose_name_plural = 'Кешбэки для гостиниц'
        unique_together = [['hotel', 'boat_owner']]
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.hotel.email} - {self.boat_owner.email} ({self.cashback_percent}%)"


class BlockedDate(models.Model):
    """Блокировка дат для судна (техобслуживание, личные планы)"""
    
    class BlockReason(models.TextChoices):
        MAINTENANCE = 'maintenance', 'Техобслуживание'
        PERSONAL = 'personal', 'Личные планы'
        OTHER = 'other', 'Другое'
    
    boat = models.ForeignKey(
        Boat,
        on_delete=models.CASCADE,
        related_name='blocked_dates',
        verbose_name='Судно'
    )
    date_from = models.DateField(verbose_name='Дата начала блокировки')
    date_to = models.DateField(verbose_name='Дата окончания блокировки')
    reason = models.CharField(
        max_length=20,
        choices=BlockReason.choices,
        default=BlockReason.OTHER,
        verbose_name='Причина блокировки'
    )
    reason_text = models.TextField(
        blank=True,
        verbose_name='Дополнительная информация',
        help_text='Подробное описание причины блокировки'
    )
    is_active = models.BooleanField(default=True, verbose_name='Активна')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Дата создания')
    
    class Meta:
        verbose_name = 'Блокировка даты'
        verbose_name_plural = 'Блокировки дат'
        ordering = ['-date_from']
    
    def __str__(self):
        return f"{self.boat.name} - {self.date_from} до {self.date_to} ({self.get_reason_display()})"


class SeasonalPricing(models.Model):
    """Сезонные цены для судна (ручная корректировка базовой цены)"""
    
    boat = models.ForeignKey(
        Boat,
        on_delete=models.CASCADE,
        related_name='seasonal_pricing',
        verbose_name='Судно'
    )
    date_from = models.DateField(verbose_name='Дата начала действия')
    date_to = models.DateField(verbose_name='Дата окончания действия')
    duration_hours = models.IntegerField(
        choices=BoatPricing.DurationHours.choices,
        verbose_name='Длительность'
    )
    price_per_person = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)],
        verbose_name='Стоимость за человека (₽)',
        help_text='Цена за человека для указанного периода и длительности'
    )
    is_active = models.BooleanField(default=True, verbose_name='Активна')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Дата создания')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Дата обновления')
    
    class Meta:
        verbose_name = 'Сезонная цена'
        verbose_name_plural = 'Сезонные цены'
        ordering = ['-date_from']
    
    def __str__(self):
        return f"{self.boat.name} - {self.date_from} до {self.date_to} ({self.get_duration_hours_display()}: {self.price_per_person} ₽/чел.)"
