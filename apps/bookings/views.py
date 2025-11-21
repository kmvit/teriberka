from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied, ValidationError
from django.db.models import Q
from django.utils import timezone
from datetime import datetime, timedelta
from decimal import Decimal

from .models import Booking
from .serializers import BookingListSerializer, BookingDetailSerializer, BookingCreateSerializer
from apps.accounts.models import User


class BookingViewSet(viewsets.ModelViewSet):
    """
    ViewSet для управления бронированиями
    Единый endpoint для всех ролей с автоматической фильтрацией
    """
    permission_classes = [IsAuthenticated]
    
    def get_serializer_class(self):
        if self.action == 'create':
            return BookingCreateSerializer
        elif self.action == 'list':
            return BookingListSerializer
        return BookingDetailSerializer
    
    def get_queryset(self):
        """
        Фильтрация бронирований по роли пользователя:
        - Владелец судна: все бронирования его судов
        - Гид: только его бронирования
        - Клиент: только его бронирования
        """
        user = self.request.user
        queryset = Booking.objects.select_related('boat', 'guide', 'customer', 'boat__owner')
        
        if user.role == User.Role.BOAT_OWNER:
            # Владелец видит все бронирования своих судов
            queryset = queryset.filter(boat__owner=user)
        elif user.role == User.Role.GUIDE:
            # Гид видит только свои бронирования
            queryset = queryset.filter(guide=user)
        elif user.role == User.Role.CUSTOMER:
            # Клиент видит только свои бронирования
            queryset = queryset.filter(customer=user)
        else:
            # Для других ролей возвращаем пустой queryset
            queryset = queryset.none()
        
        # Дополнительная фильтрация по query params
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        boat_id = self.request.query_params.get('boat_id')
        if boat_id:
            queryset = queryset.filter(boat_id=boat_id)
        
        date_from = self.request.query_params.get('date_from')
        if date_from:
            try:
                date_from_obj = datetime.strptime(date_from, '%Y-%m-%d').date()
                queryset = queryset.filter(start_datetime__date__gte=date_from_obj)
            except ValueError:
                pass
        
        date_to = self.request.query_params.get('date_to')
        if date_to:
            try:
                date_to_obj = datetime.strptime(date_to, '%Y-%m-%d').date()
                queryset = queryset.filter(start_datetime__date__lte=date_to_obj)
            except ValueError:
                pass
        
        return queryset.order_by('-created_at')
    
    def perform_create(self, serializer):
        """Создание бронирования - автоматически определяется роль пользователя"""
        serializer.save()
    
    def retrieve(self, request, *args, **kwargs):
        """Детали бронирования с проверкой прав доступа"""
        instance = self.get_object()
        user = request.user
        
        # Проверка прав доступа
        if user.role == User.Role.BOAT_OWNER:
            if instance.boat.owner != user:
                raise PermissionDenied("Вы можете просматривать только бронирования своих судов")
        elif user.role == User.Role.GUIDE:
            if instance.guide != user:
                raise PermissionDenied("Вы можете просматривать только свои бронирования")
        elif user.role == User.Role.CUSTOMER:
            if instance.customer != user:
                raise PermissionDenied("Вы можете просматривать только свои бронирования")
        
        serializer = self.get_serializer(instance)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """
        Отмена бронирования
        Логика:
        - Если > 72 часов: возврат предоплаты, статус "cancelled"
        - Если < 72 часов: предоплата удерживается, статус "cancelled"
        - Если < 3 часов: отмена блокируется
        """
        booking = self.get_object()
        user = request.user
        
        # Проверка прав доступа
        if user.role == User.Role.BOAT_OWNER:
            if booking.boat.owner != user:
                raise PermissionDenied("Вы можете отменять только бронирования своих судов")
        elif user.role == User.Role.GUIDE:
            if booking.guide != user:
                raise PermissionDenied("Вы можете отменять только свои бронирования")
        elif user.role == User.Role.CUSTOMER:
            if booking.customer != user:
                raise PermissionDenied("Вы можете отменять только свои бронирования")
        
        # Проверка статуса
        if booking.status == Booking.Status.CANCELLED:
            return Response(
                {'error': 'Бронирование уже отменено'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if booking.status == Booking.Status.COMPLETED:
            return Response(
                {'error': 'Нельзя отменить завершенное бронирование'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Проверка времени до рейса
        now = timezone.now()
        time_until_trip = booking.start_datetime - now
        
        if time_until_trip.total_seconds() < 3 * 3600:  # Менее 3 часов
            return Response(
                {'error': 'Отмена невозможна менее чем за 3 часа до рейса'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Логика возврата предоплаты
        reason = request.data.get('reason', '')
        refund_deposit = False
        
        if time_until_trip.total_seconds() > 72 * 3600:  # Более 72 часов
            refund_deposit = True
        
        # Обновляем статус
        booking.status = Booking.Status.CANCELLED
        booking.notes = f"{booking.notes}\nОтменено: {reason}".strip() if reason else booking.notes
        booking.save()
        
        return Response({
            'message': 'Бронирование отменено',
            'refund_deposit': refund_deposit,
            'deposit_amount': float(booking.deposit) if refund_deposit else 0
        }, status=status.HTTP_200_OK)
    
    @action(detail=True, methods=['post'])
    def pay_remaining(self, request, pk=None):
        """
        Оплата остатка
        Доступно за 3 часа до выхода
        """
        booking = self.get_object()
        user = request.user
        
        # Проверка прав доступа
        if user.role == User.Role.BOAT_OWNER:
            raise PermissionDenied("Владелец судна не может оплачивать бронирования")
        
        if booking.guide and booking.guide != user:
            raise PermissionDenied("Вы можете оплачивать только свои бронирования")
        if booking.customer and booking.customer != user:
            raise PermissionDenied("Вы можете оплачивать только свои бронирования")
        
        # Проверка статуса
        if booking.status == Booking.Status.CANCELLED:
            return Response(
                {'error': 'Нельзя оплатить отмененное бронирование'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if booking.status == Booking.Status.COMPLETED:
            return Response(
                {'error': 'Бронирование уже завершено'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Проверка времени до рейса
        now = timezone.now()
        time_until_trip = booking.start_datetime - now
        
        if time_until_trip.total_seconds() < 3 * 3600:
            return Response(
                {'error': 'Оплата остатка доступна не менее чем за 3 часа до рейса'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Получаем способ оплаты
        payment_method = request.data.get('payment_method', Booking.PaymentMethod.ONLINE)
        
        # Обновляем статус
        booking.payment_method = payment_method
        booking.status = Booking.Status.CONFIRMED
        booking.deposit = booking.total_price  # Предоплата становится полной оплатой
        booking.remaining_amount = Decimal('0')
        booking.save()
        
        # TODO: Интеграция с платежным шлюзом
        # TODO: Генерация QR-кода или уникального ID для посадки
        
        return Response({
            'message': 'Остаток успешно оплачен',
            'booking_id': booking.id,
            'verification_code': f"BOOK-{booking.id}",  # Временный код, позже будет QR
            'status': booking.status
        }, status=status.HTTP_200_OK)
    
    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def check_in(self, request, pk=None):
        """
        Посадка (Check-in) - для капитана/владельца судна
        """
        booking = self.get_object()
        user = request.user
        
        # Только владелец судна может выполнять check-in
        if user.role != User.Role.BOAT_OWNER or booking.boat.owner != user:
            raise PermissionDenied("Только владелец судна может выполнять посадку")
        
        # Проверка статуса
        if booking.status != Booking.Status.CONFIRMED:
            return Response(
                {'error': 'Бронирование должно быть полностью оплачено для посадки'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Проверка кода верификации (если передан)
        verification_code = request.data.get('verification_code')
        if verification_code:
            expected_code = f"BOOK-{booking.id}"
            if verification_code != expected_code:
                return Response(
                    {'error': 'Неверный код верификации'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Обновляем статус
        booking.status = Booking.Status.COMPLETED
        booking.save()
        
        return Response({
            'message': 'Посадка подтверждена',
            'verified': True,
            'number_of_people': booking.number_of_people,
            'status': 'boarding_allowed'
        }, status=status.HTTP_200_OK)
