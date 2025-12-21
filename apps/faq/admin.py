from django.contrib import admin
from .models import FAQPage


@admin.register(FAQPage)
class FAQPageAdmin(admin.ModelAdmin):
    list_display = ('title', 'is_published', 'views_count', 'published_at', 'created_at')
    list_filter = ('is_published', 'created_at', 'published_at')
    search_fields = ('title', 'excerpt', 'content')
    prepopulated_fields = {'slug': ('title',)}
    readonly_fields = ('views_count', 'created_at', 'updated_at', 'published_at')
    
    fieldsets = (
        ('Основная информация', {
            'fields': ('title', 'slug', 'excerpt')
        }),
        ('Содержание', {
            'fields': ('content', 'image')
        }),
        ('Публикация', {
            'fields': ('is_published', 'published_at', 'views_count')
        }),
        ('Даты', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

