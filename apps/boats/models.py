from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from apps.accounts.models import User


class Boat(models.Model):
    """Модель катера"""
    name = models.CharField(max_length=200, verbose_name='Название')
    owner = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='boats',
        verbose_name='Владелец'
    )
    capacity = models.PositiveIntegerField(
        validators=[MinValueValidator(1)],
        verbose_name='Вместимость (чел.)'
    )
    description = models.TextField(blank=True, verbose_name='Описание')
    base_price_per_person = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)],
        verbose_name='Базовая ставка за человека (₽)'
    )
    image = models.ImageField(
        upload_to='boats/',
        blank=True,
        null=True,
        verbose_name='Фото'
    )
    is_active = models.BooleanField(default=True, verbose_name='Активен')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Дата создания')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Дата обновления')
    
    class Meta:
        verbose_name = 'Катер'
        verbose_name_plural = 'Катера'
        ordering = ['-created_at']
    
    def __str__(self):
        return self.name


class BoatAvailability(models.Model):
    """Расписание доступности катера"""
    DAY_CHOICES = [
        (0, 'Понедельник'),
        (1, 'Вторник'),
        (2, 'Среда'),
        (3, 'Четверг'),
        (4, 'Пятница'),
        (5, 'Суббота'),
        (6, 'Воскресенье'),
    ]
    
    boat = models.ForeignKey(
        Boat,
        on_delete=models.CASCADE,
        related_name='availabilities',
        verbose_name='Катер'
    )
    day_of_week = models.IntegerField(
        choices=DAY_CHOICES,
        null=True,
        blank=True,
        verbose_name='День недели'
    )
    specific_date = models.DateField(
        null=True,
        blank=True,
        verbose_name='Конкретная дата'
    )
    start_time = models.TimeField(verbose_name='Время начала')
    end_time = models.TimeField(verbose_name='Время окончания')
    min_duration_hours = models.PositiveIntegerField(
        default=1,
        verbose_name='Минимальная длительность (часы)'
    )
    max_duration_hours = models.PositiveIntegerField(
        default=8,
        verbose_name='Максимальная длительность (часы)'
    )
    is_active = models.BooleanField(default=True, verbose_name='Активно')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Дата создания')
    
    class Meta:
        verbose_name = 'Расписание доступности'
        verbose_name_plural = 'Расписания доступности'
        ordering = ['day_of_week', 'start_time']
    
    def __str__(self):
        day = self.get_day_of_week_display() if self.day_of_week is not None else str(self.specific_date)
        return f"{self.boat.name} - {day} {self.start_time}-{self.end_time}"


class GuideBoatDiscount(models.Model):
    """Скидка для гида от владельца катера"""
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
        verbose_name='Владелец катера'
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
