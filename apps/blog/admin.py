from django.contrib import admin
from django.utils.html import format_html
from .models import Category, Article


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'is_active', 'articles_count', 'created_at')
    list_filter = ('is_active', 'created_at')
    search_fields = ('name', 'description')
    prepopulated_fields = {'slug': ('name',)}
    readonly_fields = ('created_at', 'updated_at')
    
    fieldsets = (
        ('Основная информация', {
            'fields': ('name', 'slug', 'description')
        }),
        ('Статус', {
            'fields': ('is_active',)
        }),
        ('Даты', {
            'fields': ('created_at', 'updated_at')
        }),
    )
    
    def articles_count(self, obj):
        return obj.articles.filter(is_published=True).count()
    articles_count.short_description = 'Количество статей'


@admin.register(Article)
class ArticleAdmin(admin.ModelAdmin):
    list_display = ('title', 'category', 'is_published', 'views_count', 'published_at', 'created_at')
    list_filter = ('is_published', 'category', 'created_at', 'published_at')
    search_fields = ('title', 'excerpt', 'content')
    prepopulated_fields = {'slug': ('title',)}
    readonly_fields = ('views_count', 'created_at', 'updated_at', 'image_preview')
    date_hierarchy = 'published_at'
    
    fieldsets = (
        ('Основная информация', {
            'fields': ('title', 'slug', 'category', 'excerpt')
        }),
        ('Содержание', {
            'fields': ('content',)
        }),
        ('Изображение', {
            'fields': ('image', 'image_preview')
        }),
        ('Публикация', {
            'fields': ('is_published', 'published_at')
        }),
        ('Статистика', {
            'fields': ('views_count',)
        }),
        ('Даты', {
            'fields': ('created_at', 'updated_at')
        }),
    )
    
    def image_preview(self, obj):
        if obj.image:
            return format_html(
                '<img src="{}" style="max-width: 300px; max-height: 200px;" />',
                obj.image.url
            )
        return "Нет изображения"
    image_preview.short_description = 'Предпросмотр изображения'
