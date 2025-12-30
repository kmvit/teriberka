from django.contrib import admin
from .models import SiteSettings


@admin.register(SiteSettings)
class SiteSettingsAdmin(admin.ModelAdmin):
    """Админка для настроек сайта"""
    
    list_display = ('site_name', 'phone', 'updated_at')
    fieldsets = (
        ('Основная информация', {
            'fields': ('site_name', 'company_description')
        }),
        ('Контактная информация', {
            'fields': ('phone', 'phone_raw')
        }),
        ('Социальные сети', {
            'fields': ('whatsapp_url', 'telegram_url', 'vk_url')
        }),
        ('Реквизиты', {
            'fields': ('legal_name', 'inn', 'address')
        }),
    )
    
    def has_add_permission(self, request):
        # Разрешаем создание только если записей нет
        return not SiteSettings.objects.exists()
    
    def has_delete_permission(self, request, obj=None):
        # Запрещаем удаление единственной записи
        return False
