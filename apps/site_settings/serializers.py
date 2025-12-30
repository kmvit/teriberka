from rest_framework import serializers
from .models import SiteSettings


class SiteSettingsSerializer(serializers.ModelSerializer):
    """Сериализатор для настроек сайта"""
    
    class Meta:
        model = SiteSettings
        fields = (
            'site_name',
            'company_description',
            'phone',
            'phone_raw',
            'whatsapp_url',
            'telegram_url',
            'vk_url',
            'legal_name',
            'inn',
            'address',
        )
        read_only_fields = ('created_at', 'updated_at')

