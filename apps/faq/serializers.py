from rest_framework import serializers
from sorl.thumbnail import get_thumbnail
from .models import FAQPage


class FAQPageListSerializer(serializers.ModelSerializer):
    """Сериализатор для списка страниц FAQ"""
    image_url = serializers.SerializerMethodField()
    thumbnail_url = serializers.SerializerMethodField()
    
    class Meta:
        model = FAQPage
        fields = (
            'id', 'title', 'slug', 'image_url', 'thumbnail_url',
            'excerpt', 'is_published', 'views_count', 'published_at', 'created_at'
        )
        read_only_fields = ('id', 'slug', 'views_count', 'published_at', 'created_at')
    
    def get_image_url(self, obj):
        request = self.context.get('request')
        if obj.image and hasattr(obj.image, 'url'):
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return None
    
    def get_thumbnail_url(self, obj):
        """Возвращает URL thumbnail для списка страниц FAQ"""
        if not obj.image:
            return None
        
        try:
            thumbnail = get_thumbnail(obj.image, '400x300', quality=85, crop='center')
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(thumbnail.url)
            return thumbnail.url
        except Exception:
            return self.get_image_url(obj)


class FAQPageDetailSerializer(serializers.ModelSerializer):
    """Сериализатор для детальной информации о странице FAQ"""
    image_url = serializers.SerializerMethodField()
    
    class Meta:
        model = FAQPage
        fields = (
            'id', 'title', 'slug', 'image_url', 'content',
            'excerpt', 'is_published', 'views_count', 'published_at',
            'created_at', 'updated_at'
        )
        read_only_fields = ('id', 'slug', 'views_count', 'published_at', 'created_at', 'updated_at')
    
    def get_image_url(self, obj):
        request = self.context.get('request')
        if obj.image and hasattr(obj.image, 'url'):
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return None

