from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters

from .models import FAQPage
from .serializers import FAQPageListSerializer, FAQPageDetailSerializer


class FAQPageViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet для страниц FAQ (только чтение)
    """
    queryset = FAQPage.objects.filter(is_published=True)
    lookup_field = 'slug'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['title', 'excerpt', 'content']
    ordering_fields = ['published_at', 'created_at', 'views_count']
    ordering = ['-published_at']
    permission_classes = [AllowAny]
    
    def get_serializer_class(self):
        if self.action == 'retrieve':
            return FAQPageDetailSerializer
        return FAQPageListSerializer
    
    def retrieve(self, request, *args, **kwargs):
        """Увеличиваем счетчик просмотров при просмотре страницы"""
        instance = self.get_object()
        instance.views_count += 1
        instance.save(update_fields=['views_count'])
        serializer = self.get_serializer(instance)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def featured(self, request):
        """Возвращает последние опубликованные страницы FAQ (для главной страницы)"""
        pages = self.get_queryset()[:6]  # Последние 6 страниц
        serializer = self.get_serializer(pages, many=True)
        return Response(serializer.data)

