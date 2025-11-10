from django.db import models
from django.core.validators import MinValueValidator
from apps.accounts.models import User
from apps.boats.models import Boat


class Trip(models.Model):
    """Модель рейса"""
    
    class Status(models.TextChoices):
        SCHEDULED = 'scheduled', 'Запланирован'
        IN_PROGRESS = 'in_progress', 'В процессе'
        COMPLETED = 'completed', 'Завершен'
        CANCELLED = 'cancelled', 'Отменен'
    
    boat = models.ForeignKey(
        Boat,
        on_delete=models.CASCADE,
        related_name='trips',
        verbose_name='Катер'
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
        related_name='guided_trips',
        limit_choices_to={'role': User.Role.GUIDE},
        verbose_name='Гид'
    )
    price_per_person = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)],
        verbose_name='Ставка за человека (₽)'
    )
    max_capacity = models.PositiveIntegerField(
        validators=[MinValueValidator(1)],
        verbose_name='Максимальная вместимость'
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.SCHEDULED,
        verbose_name='Статус'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Дата создания')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Дата обновления')
    
    class Meta:
        verbose_name = 'Рейс'
        verbose_name_plural = 'Рейсы'
        ordering = ['start_datetime']
        indexes = [
            models.Index(fields=['start_datetime', 'end_datetime']),
            models.Index(fields=['boat', 'status']),
        ]
    
    def __str__(self):
        return f"{self.boat.name} - {self.start_datetime.strftime('%d.%m.%Y %H:%M')}"
