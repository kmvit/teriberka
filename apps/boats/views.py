from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny, IsAuthenticatedOrReadOnly
from rest_framework.exceptions import PermissionDenied, ValidationError
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q, Count, Min
from django.utils import timezone
from datetime import datetime, timedelta

from .models import Boat, BoatImage, Feature, BoatPricing, BoatAvailability, SailingZone, BlockedDate, SeasonalPricing
from .serializers import (
    BoatListSerializer, BoatDetailSerializer, BoatCreateUpdateSerializer,
    BoatImageSerializer, FeatureSerializer, BoatPricingSerializer,
    BoatAvailabilitySerializer, SailingZoneSerializer, BlockedDateSerializer, SeasonalPricingSerializer
)
from apps.accounts.models import User


class BoatViewSet(viewsets.ModelViewSet):
    """
    ViewSet для управления судами
    """
    queryset = Boat.objects.filter(is_active=True).select_related('owner').prefetch_related(
        'images', 'features', 'pricing', 'sailing_zones'
    )
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['boat_type', 'capacity']
    search_fields = ['name', 'description']
    ordering_fields = ['created_at', 'name']
    ordering = ['-created_at']
    
    def get_serializer_class(self):
        if self.action == 'list':
            return BoatListSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return BoatCreateUpdateSerializer
        return BoatDetailSerializer
    
    def get_permissions(self):
        """
        Разрешения:
        - Список и детали: публичный доступ
        - Создание, обновление, удаление: только для верифицированных владельцев судов
        """
        if self.action in ['list', 'retrieve']:
            return [AllowAny()]
        elif self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAuthenticated()]
        return [IsAuthenticatedOrReadOnly()]
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Фильтрация по особенностям (принимаем ID особенностей)
        features = self.request.query_params.getlist('features')
        if features:
            try:
                feature_ids = [int(f) for f in features]
                queryset = queryset.filter(features__id__in=feature_ids).distinct()
            except (ValueError, TypeError):
                pass
        
        # Фильтрация по минимальной/максимальной вместимости
        min_capacity = self.request.query_params.get('min_capacity')
        max_capacity = self.request.query_params.get('max_capacity')
        if min_capacity:
            queryset = queryset.filter(capacity__gte=min_capacity)
        if max_capacity:
            queryset = queryset.filter(capacity__lte=max_capacity)
        
        # Фильтрация по доступности на дату
        available_date = self.request.query_params.get('available_date')
        if available_date:
            try:
                date_obj = datetime.strptime(available_date, '%Y-%m-%d').date()
                # Находим суда, у которых есть доступные слоты на эту дату
                available_boats = BoatAvailability.objects.filter(
                    departure_date=date_obj,
                    is_active=True
                ).values_list('boat_id', flat=True)
                queryset = queryset.filter(id__in=available_boats)
            except ValueError:
                pass
        
        return queryset
    
    
    def perform_create(self, serializer):
        """Создание судна - только для верифицированных владельцев"""
        user = self.request.user
        if user.role != User.Role.BOAT_OWNER:
            raise PermissionDenied("Только владельцы судов могут создавать суда")
        if not user.is_verified:
            raise PermissionDenied("Необходимо пройти верификацию для создания судна")
        serializer.save(owner=user)
    
    def perform_update(self, serializer):
        """Обновление судна - только владелец может обновлять свое судно"""
        boat = self.get_object()
        if boat.owner != self.request.user:
            raise PermissionDenied("Вы можете обновлять только свои суда")
        serializer.save()
    
    def perform_destroy(self, instance):
        """Мягкое удаление судна"""
        if instance.owner != self.request.user:
            raise PermissionDenied("Вы можете удалять только свои суда")
        instance.is_active = False
        instance.save()
    
    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def add_image(self, request, pk=None):
        """Добавление фото к судну"""
        boat = self.get_object()
        if boat.owner != request.user:
            return Response(
                {'error': 'Вы можете добавлять фото только к своим суднам'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        image = request.FILES.get('image')
        if not image:
            return Response(
                {'error': 'Необходимо передать файл изображения'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        order = boat.images.count()
        boat_image = BoatImage.objects.create(boat=boat, image=image, order=order)
        serializer = BoatImageSerializer(boat_image, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['delete'], url_path='images/(?P<image_id>[^/.]+)', permission_classes=[IsAuthenticated])
    def delete_image(self, request, pk=None, image_id=None):
        """Удаление фото судна"""
        boat = self.get_object()
        if boat.owner != request.user:
            return Response(
                {'error': 'Вы можете удалять фото только у своих судов'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            image = boat.images.get(id=image_id)
            image.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except BoatImage.DoesNotExist:
            return Response(
                {'error': 'Фото не найдено'},
                status=status.HTTP_404_NOT_FOUND
            )
    
    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def add_feature(self, request, pk=None):
        """Добавление особенности к судну"""
        boat = self.get_object()
        if boat.owner != request.user:
            return Response(
                {'error': 'Вы можете добавлять особенности только к своим суднам'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        feature_id = request.data.get('feature_id')
        if not feature_id:
            return Response(
                {'error': 'Необходимо указать feature_id'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            feature = Feature.objects.get(id=feature_id, is_active=True)
            boat.features.add(feature)
            serializer = FeatureSerializer(feature)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Feature.DoesNotExist:
            return Response(
                {'error': 'Особенность не найдена'},
                status=status.HTTP_404_NOT_FOUND
            )
    
    @action(detail=True, methods=['delete'], url_path='features/(?P<feature_id>[^/.]+)', permission_classes=[IsAuthenticated])
    def delete_feature(self, request, pk=None, feature_id=None):
        """Удаление особенности судна"""
        boat = self.get_object()
        if boat.owner != request.user:
            return Response(
                {'error': 'Вы можете удалять особенности только у своих судов'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            feature = Feature.objects.get(id=feature_id)
            boat.features.remove(feature)
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Feature.DoesNotExist:
            return Response(
                {'error': 'Особенность не найдена'},
                status=status.HTTP_404_NOT_FOUND
            )
    
    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def add_pricing(self, request, pk=None):
        """Добавление цены к судну"""
        boat = self.get_object()
        if boat.owner != request.user:
            return Response(
                {'error': 'Вы можете добавлять цены только к своим суднам'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        duration_hours = request.data.get('duration_hours')
        price_per_person = request.data.get('price_per_person')
        
        if not duration_hours or price_per_person is None:
            return Response(
                {'error': 'Необходимо указать duration_hours и price_per_person'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        pricing, created = BoatPricing.objects.get_or_create(
            boat=boat,
            duration_hours=duration_hours,
            defaults={'price_per_person': price_per_person}
        )
        if not created:
            pricing.price_per_person = price_per_person
            pricing.save()
        
        serializer = BoatPricingSerializer(pricing)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['put', 'patch'], url_path='pricing/(?P<pricing_id>[^/.]+)', permission_classes=[IsAuthenticated])
    def update_pricing(self, request, pk=None, pricing_id=None):
        """Обновление цены судна"""
        boat = self.get_object()
        if boat.owner != request.user:
            return Response(
                {'error': 'Вы можете обновлять цены только у своих судов'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            pricing = boat.pricing.get(id=pricing_id)
            serializer = BoatPricingSerializer(pricing, data=request.data, partial=True)
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except BoatPricing.DoesNotExist:
            return Response(
                {'error': 'Цена не найдена'},
                status=status.HTTP_404_NOT_FOUND
            )
    
    @action(detail=True, methods=['delete'], url_path='pricing/(?P<pricing_id>[^/.]+)', permission_classes=[IsAuthenticated])
    def delete_pricing(self, request, pk=None, pricing_id=None):
        """Удаление цены судна"""
        boat = self.get_object()
        if boat.owner != request.user:
            return Response(
                {'error': 'Вы можете удалять цены только у своих судов'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            pricing = boat.pricing.get(id=pricing_id)
            pricing.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except BoatPricing.DoesNotExist:
            return Response(
                {'error': 'Цена не найдена'},
                status=status.HTTP_404_NOT_FOUND
            )
    
    @action(detail=True, methods=['get', 'post'], url_path='availability', permission_classes=[IsAuthenticated])
    def availability(self, request, pk=None):
        """Управление расписанием доступности судна"""
        boat = self.get_object()
        if boat.owner != request.user:
            return Response(
                {'error': 'Вы можете управлять расписанием только своих судов'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        if request.method == 'GET':
            date_from = request.query_params.get('date_from')
            date_to = request.query_params.get('date_to')
            
            queryset = boat.availabilities.filter(is_active=True)
            
            if date_from:
                try:
                    date_from_obj = datetime.strptime(date_from, '%Y-%m-%d').date()
                    queryset = queryset.filter(departure_date__gte=date_from_obj)
                except ValueError:
                    pass
            
            if date_to:
                try:
                    date_to_obj = datetime.strptime(date_to, '%Y-%m-%d').date()
                    queryset = queryset.filter(departure_date__lte=date_to_obj)
                except ValueError:
                    pass
            
            serializer = BoatAvailabilitySerializer(queryset, many=True)
            return Response(serializer.data)
        
        elif request.method == 'POST':
            serializer = BoatAvailabilitySerializer(data=request.data)
            if serializer.is_valid():
                serializer.save(boat=boat)
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['put', 'patch', 'delete'], url_path='availability/(?P<availability_id>[^/.]+)', permission_classes=[IsAuthenticated])
    def availability_detail(self, request, pk=None, availability_id=None):
        """Детальное управление расписанием доступности"""
        boat = self.get_object()
        if boat.owner != request.user:
            return Response(
                {'error': 'Вы можете управлять расписанием только своих судов'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            availability = boat.availabilities.get(id=availability_id)
        except BoatAvailability.DoesNotExist:
            return Response(
                {'error': 'Расписание не найдено'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        if request.method == 'DELETE':
            availability.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        
        serializer = BoatAvailabilitySerializer(availability, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['get'], permission_classes=[IsAuthenticated])
    def statistics(self, request, pk=None):
        """Статистика загрузки судна"""
        boat = self.get_object()
        if boat.owner != request.user:
            return Response(
                {'error': 'Вы можете просматривать статистику только своих судов'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        month = request.query_params.get('month')  # формат: "2025-11"
        
        # Здесь можно добавить логику статистики
        # Пока возвращаем базовую структуру
        return Response({
            'boat_id': boat.id,
            'boat_name': boat.name,
            'month': month,
            'bookings_count': 0,
            'occupancy_rate': 0,
            'revenue': 0
        })
    
    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated], url_path='my-boats')
    def my_boats(self, request):
        """Получение списка судов текущего владельца"""
        if request.user.role != User.Role.BOAT_OWNER:
            return Response(
                {'error': 'Только владельцы судов могут просматривать свои суда'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Получаем все суда владельца (включая неактивные)
        boats = Boat.objects.filter(owner=request.user).select_related('owner').prefetch_related(
            'images', 'features', 'pricing'
        ).order_by('-created_at')
        
        serializer = BoatListSerializer(boats, many=True, context={'request': request})
        return Response(serializer.data)
    
    @action(detail=True, methods=['get', 'post'], permission_classes=[IsAuthenticated], url_path='blocked-dates')
    def blocked_dates(self, request, pk=None):
        """Управление блокировкой дат (техобслуживание, личные планы)"""
        boat = self.get_object()
        if boat.owner != request.user:
            raise PermissionDenied("Вы можете управлять блокировками только для своих судов")
        
        if request.method == 'GET':
            blocked_dates = boat.blocked_dates.filter(is_active=True).order_by('-date_from')
            serializer = BlockedDateSerializer(blocked_dates, many=True)
            return Response(serializer.data)
        
        elif request.method == 'POST':
            serializer = BlockedDateSerializer(data=request.data)
            if serializer.is_valid():
                serializer.save(boat=boat)
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['delete'], permission_classes=[IsAuthenticated], url_path='blocked-dates/(?P<blocked_date_id>[^/.]+)')
    def delete_blocked_date(self, request, pk=None, blocked_date_id=None):
        """Удаление блокировки даты"""
        boat = self.get_object()
        if boat.owner != request.user:
            raise PermissionDenied("Вы можете удалять блокировки только для своих судов")
        
        try:
            blocked_date = boat.blocked_dates.get(id=blocked_date_id)
            blocked_date.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except BlockedDate.DoesNotExist:
            return Response(
                {'error': 'Блокировка не найдена'},
                status=status.HTTP_404_NOT_FOUND
            )
    
    @action(detail=True, methods=['get', 'post'], permission_classes=[IsAuthenticated], url_path='seasonal-pricing')
    def seasonal_pricing(self, request, pk=None):
        """Управление сезонными ценами"""
        boat = self.get_object()
        if boat.owner != request.user:
            raise PermissionDenied("Вы можете управлять сезонными ценами только для своих судов")
        
        if request.method == 'GET':
            seasonal_pricing = boat.seasonal_pricing.filter(is_active=True).order_by('-date_from')
            serializer = SeasonalPricingSerializer(seasonal_pricing, many=True)
            return Response(serializer.data)
        
        elif request.method == 'POST':
            serializer = SeasonalPricingSerializer(data=request.data)
            if serializer.is_valid():
                serializer.save(boat=boat)
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['put', 'patch', 'delete'], permission_classes=[IsAuthenticated], url_path='seasonal-pricing/(?P<pricing_id>[^/.]+)')
    def seasonal_pricing_detail(self, request, pk=None, pricing_id=None):
        """Детальное управление сезонной ценой"""
        boat = self.get_object()
        if boat.owner != request.user:
            raise PermissionDenied("Вы можете управлять сезонными ценами только для своих судов")
        
        try:
            seasonal_pricing = boat.seasonal_pricing.get(id=pricing_id)
        except SeasonalPricing.DoesNotExist:
            return Response(
                {'error': 'Сезонная цена не найдена'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        if request.method == 'DELETE':
            seasonal_pricing.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        
        serializer = SeasonalPricingSerializer(seasonal_pricing, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['get'], permission_classes=[IsAuthenticated], url_path='statistics')
    def statistics(self, request, pk=None):
        """Статистика загрузки судна по месяцам"""
        boat = self.get_object()
        if boat.owner != request.user:
            raise PermissionDenied("Вы можете просматривать статистику только своих судов")
        
        month = request.query_params.get('month')  # формат: "2025-11"
        
        from apps.bookings.models import Booking
        from django.db.models import Count, Sum, Q
        
        # Парсим месяц
        if month:
            try:
                year, month_num = map(int, month.split('-'))
                date_from = datetime(year, month_num, 1).date()
                if month_num == 12:
                    date_to = datetime(year + 1, 1, 1).date() - timedelta(days=1)
                else:
                    date_to = datetime(year, month_num + 1, 1).date() - timedelta(days=1)
            except (ValueError, TypeError):
                return Response({'error': 'Неверный формат месяца. Используйте YYYY-MM'}, 
                              status=status.HTTP_400_BAD_REQUEST)
        else:
            # По умолчанию текущий месяц
            today = timezone.now().date()
            date_from = datetime(today.year, today.month, 1).date()
            if today.month == 12:
                date_to = datetime(today.year + 1, 1, 1).date() - timedelta(days=1)
            else:
                date_to = datetime(today.year, today.month + 1, 1).date() - timedelta(days=1)
        
        # Статистика бронирований
        bookings = Booking.objects.filter(
            boat=boat,
            start_datetime__date__gte=date_from,
            start_datetime__date__lte=date_to
        )
        
        total_bookings = bookings.count()
        confirmed_bookings = bookings.filter(status__in=[Booking.Status.CONFIRMED, Booking.Status.COMPLETED]).count()
        total_people = bookings.aggregate(Sum('number_of_people'))['number_of_people__sum'] or 0
        total_revenue = bookings.aggregate(Sum('total_price'))['total_price__sum'] or 0
        
        # Загрузка (процент занятости)
        total_days = (date_to - date_from).days + 1
        booked_days = bookings.values('start_datetime__date').distinct().count()
        occupancy_rate = (booked_days / total_days * 100) if total_days > 0 else 0
        
        return Response({
            'boat_id': boat.id,
            'boat_name': boat.name,
            'month': month or f"{today.year}-{today.month:02d}",
            'date_from': date_from,
            'date_to': date_to,
            'bookings_count': total_bookings,
            'confirmed_bookings': confirmed_bookings,
            'total_people': total_people,
            'total_revenue': float(total_revenue),
            'occupancy_rate': round(occupancy_rate, 2),
            'booked_days': booked_days,
            'total_days': total_days
        })


class FeatureViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet для получения списка доступных особенностей"""
    queryset = Feature.objects.filter(is_active=True)
    serializer_class = FeatureSerializer
    permission_classes = [AllowAny]


class SailingZoneViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet для получения списка маршрутов (зон плавания)"""
    queryset = SailingZone.objects.filter(is_active=True)
    serializer_class = SailingZoneSerializer
    permission_classes = [AllowAny]
