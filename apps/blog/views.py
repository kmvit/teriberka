from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters
from django.db.models import Q

from .models import Category, Article
from .serializers import CategorySerializer, ArticleListSerializer, ArticleDetailSerializer


class CategoryViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet для категорий блога (только чтение)
    """
    queryset = Category.objects.filter(is_active=True)
    serializer_class = CategorySerializer
    permission_classes = [AllowAny]
    pagination_class = None  # Категории не пагинируем


class ArticleViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet для статей блога (только чтение)
    """
    queryset = Article.objects.filter(is_published=True).select_related('category')
    lookup_field = 'slug'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['category']
    search_fields = ['title', 'excerpt', 'content']
    ordering_fields = ['published_at', 'created_at', 'views_count']
    ordering = ['-published_at']
    permission_classes = [AllowAny]
    
    def get_serializer_class(self):
        if self.action == 'retrieve':
            return ArticleDetailSerializer
        return ArticleListSerializer
    
    def retrieve(self, request, *args, **kwargs):
        """Увеличиваем счетчик просмотров при просмотре статьи"""
        instance = self.get_object()
        instance.views_count += 1
        instance.save(update_fields=['views_count'])
        serializer = self.get_serializer(instance)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def featured(self, request):
        """Возвращает последние опубликованные статьи (для главной страницы)"""
        articles = self.get_queryset()[:6]  # Последние 6 статей
        serializer = self.get_serializer(articles, many=True)
        return Response(serializer.data)
