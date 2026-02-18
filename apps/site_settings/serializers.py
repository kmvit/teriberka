from rest_framework import serializers
from django.conf import settings
from .models import SiteSettings


class SiteSettingsSerializer(serializers.ModelSerializer):
    """Сериализатор для настроек сайта"""
    
    telegram_bot_username = serializers.SerializerMethodField()
    
    class Meta:
        model = SiteSettings
        fields = (
            'site_name',
            'company_description',
            'phone',
            'phone_raw',
            'email',
            'whatsapp_url',
            'telegram_url',
            'vk_url',
            'max_url',
            'legal_name',
            'inn',
            'address',
            'tour_operator_info',
            'telegram_bot_username',
        )
        read_only_fields = ('created_at', 'updated_at')
    
    def get_telegram_bot_username(self, obj):
        """Получаем username бота из настроек Django"""
        return getattr(settings, 'TELEGRAM_BOT_USERNAME', '')

