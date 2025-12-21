from django.db import models
from django.urls import reverse
from django.utils.text import slugify
from ckeditor.fields import RichTextField


class FAQPage(models.Model):
    """Модель страницы FAQ"""
    
    title = models.CharField(max_length=300, verbose_name='Заголовок')
    slug = models.SlugField(max_length=300, unique=True, verbose_name='URL-адрес', blank=True)
    image = models.ImageField(
        upload_to='faq/pages/',
        verbose_name='Изображение',
        blank=True,
        null=True
    )
    content = RichTextField(verbose_name='Содержание')
    excerpt = models.TextField(max_length=500, blank=True, verbose_name='Краткое описание')
    is_published = models.BooleanField(default=False, verbose_name='Опубликовано')
    views_count = models.PositiveIntegerField(default=0, verbose_name='Количество просмотров')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Дата создания')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Дата обновления')
    published_at = models.DateTimeField(null=True, blank=True, verbose_name='Дата публикации')
    
    class Meta:
        verbose_name = 'Страница FAQ'
        verbose_name_plural = 'Страницы FAQ'
        ordering = ['-published_at', '-created_at']
        indexes = [
            models.Index(fields=['-published_at', 'is_published']),
        ]
    
    def __str__(self):
        return self.title
    
    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.title)
        # Автоматически устанавливаем дату публикации при первой публикации
        if self.is_published and not self.published_at:
            from django.utils import timezone
            self.published_at = timezone.now()
        super().save(*args, **kwargs)
    
    def get_absolute_url(self):
        return reverse('faq:faqpage-detail', kwargs={'slug': self.slug})

