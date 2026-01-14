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
            'fields': ('phone', 'phone_raw', 'email')
        }),
        ('Социальные сети', {
            'fields': ('whatsapp_url', 'telegram_url', 'vk_url', 'max_url')
        }),
        ('Реквизиты', {
            'fields': ('legal_name', 'inn', 'address')
        }),
        ('Информация о туроператоре', {
            'fields': ('tour_operator_info',)
        }),
        ('Финансовые настройки', {
            'fields': ('platform_commission_percent',),
            'description': 'Настройки комиссии платформы для расчета выплат владельцам судов'
        }),
    )
    
    def has_add_permission(self, request):
        # Разрешаем создание только если записей нет
        return not SiteSettings.objects.exists()
    
    def has_delete_permission(self, request, obj=None):
        # Запрещаем удаление единственной записи
        return False
