from django.db import models


class SiteSettings(models.Model):
    """Модель для хранения статических данных сайта (контактная информация)"""
    
    # Основная информация
    site_name = models.CharField(
        max_length=200,
        default='Териберка',
        verbose_name='Название сайта'
    )
    company_description = models.TextField(
        max_length=500,
        default='Организация морских прогулок и экскурсий в Териберке',
        verbose_name='Описание компании'
    )
    
    # Контактная информация
    phone = models.CharField(
        max_length=20,
        default='+7 (123) 123-12-12',
        verbose_name='Телефон'
    )
    phone_raw = models.CharField(
        max_length=20,
        default='+71231231212',
        verbose_name='Телефон (для ссылок)',
        help_text='Телефон без пробелов и скобок для использования в tel: и WhatsApp ссылках'
    )
    email = models.EmailField(
        blank=True,
        null=True,
        verbose_name='Email',
        help_text='Email адрес для связи'
    )
    
    # Социальные сети
    whatsapp_url = models.URLField(
        blank=True,
        null=True,
        verbose_name='WhatsApp URL',
        help_text='Например: https://wa.me/71231231212'
    )
    telegram_url = models.URLField(
        blank=True,
        null=True,
        verbose_name='Telegram URL',
        help_text='Например: https://t.me/teriberka'
    )
    vk_url = models.URLField(
        blank=True,
        null=True,
        verbose_name='ВКонтакте URL',
        help_text='Например: https://vk.com/teriberka'
    )
    max_url = models.URLField(
        blank=True,
        null=True,
        verbose_name='Max URL',
        help_text='Например: https://max.ru/teriberka'
    )
    
    # Реквизиты
    legal_name = models.CharField(
        max_length=200,
        default='ИП Иванов Иван Иванович',
        verbose_name='Юридическое название'
    )
    inn = models.CharField(
        max_length=20,
        default='123456789012',
        verbose_name='ИНН'
    )
    address = models.TextField(
        max_length=500,
        default='Мурманская область, село Териберка, ул. Морская, д. 1',
        verbose_name='Адрес'
    )
    
    # Информация о туроператоре
    tour_operator_info = models.TextField(
        blank=True,
        null=True,
        verbose_name='Информация о туроператоре',
        help_text='Текстовая информация о туроператоре'
    )
    
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Дата создания')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Дата обновления')
    
    class Meta:
        verbose_name = 'Настройки сайта'
        verbose_name_plural = 'Настройки сайта'
    
    def __str__(self):
        return f'Настройки сайта: {self.site_name}'
    
    def save(self, *args, **kwargs):
        # Ограничиваем количество записей до одной (Singleton pattern)
        self.pk = 1
        super().save(*args, **kwargs)
    
    @classmethod
    def load(cls):
        """Метод для получения единственной записи настроек"""
        obj, created = cls.objects.get_or_create(pk=1)
        return obj
