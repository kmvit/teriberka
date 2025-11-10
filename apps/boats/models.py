from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from datetime import date, time
from apps.accounts.models import User


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


class BoatFeature(models.Model):
    """Особенности судна"""
    
    class FeatureType(models.TextChoices):
        TOILET = 'toilet', 'Туалет на судне'
        BLANKETS = 'blankets', 'Теплые пледы'
        RAINCOATS = 'raincoats', 'Дождевики'
        TEA_COFFEE = 'tea_coffee', 'Чай и кофе'
        FISHING_RODS = 'fishing_rods', 'Удочки для рыбалки'
    
    boat = models.ForeignKey(
        Boat,
        on_delete=models.CASCADE,
        related_name='features',
        verbose_name='Судно'
    )
    feature_type = models.CharField(
        max_length=30,
        choices=FeatureType.choices,
        verbose_name='Особенность'
    )
    
    class Meta:
        verbose_name = 'Особенность судна'
        verbose_name_plural = 'Особенности судна'
        unique_together = [['boat', 'feature_type']]
    
    def __str__(self):
        return f"{self.boat.name} - {self.get_feature_type_display()}"


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
    is_active = models.BooleanField(default=True, verbose_name='Активно')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Дата создания')
    
    class Meta:
        verbose_name = 'Расписание доступности'
        verbose_name_plural = 'Расписания доступности'
        ordering = ['departure_date', 'departure_time']
    
    def __str__(self):
        return f"{self.boat.name} - {self.departure_date} {self.departure_time}-{self.return_time}"


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
        return f"{self.guide.username} - {self.boat_owner.username} ({self.discount_percent}%)"
