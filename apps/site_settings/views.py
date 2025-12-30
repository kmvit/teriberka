from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from .models import SiteSettings
from .serializers import SiteSettingsSerializer


class SiteSettingsViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet для настроек сайта (только чтение для публичного доступа)
    """
    queryset = SiteSettings.objects.all()
    serializer_class = SiteSettingsSerializer
    permission_classes = [AllowAny]
    
    def get_queryset(self):
        """Возвращаем единственную запись настроек"""
        return SiteSettings.objects.filter(pk=1)
    
    def list(self, request, *args, **kwargs):
        """Переопределяем list для возврата единственной записи"""
        settings = SiteSettings.load()
        serializer = self.get_serializer(settings)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def current(self, request):
        """Возвращает текущие настройки сайта"""
        settings = SiteSettings.load()
        serializer = self.get_serializer(settings)
        return Response(serializer.data)
