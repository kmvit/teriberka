from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied, ValidationError
from django.db.models import Q
from django.utils import timezone
from django.conf import settings
from datetime import datetime, timedelta
from decimal import Decimal
import logging

from .models import Booking, PromoCode
from .serializers import BookingListSerializer, BookingDetailSerializer, BookingCreateSerializer, BlockSeatsSerializer, HotelBookingSerializer
from .services.telegram_service import TelegramService
from apps.accounts.models import User
from apps.payments.models import Payment
from apps.payments.services import TBankService
from apps.boats.models import BoatAvailability, BoatPricing

logger = logging.getLogger(__name__)


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
        elif user.role == User.Role.HOTEL:
            # Гостиница видит только свои бронирования
            queryset = queryset.filter(hotel_admin=user)
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
        
        # Исключаем блокировки из обычного списка бронирований
        # Блокировки имеют customer=None, guide=None, hotel_admin=None и notes начинается с "[БЛОКИРОВКА]"
        queryset = queryset.exclude(
            customer__isnull=True,
            guide__isnull=True,
            hotel_admin__isnull=True,
            notes__startswith="[БЛОКИРОВКА]"
        )
        
        # Исключаем неоплаченные бронирования (RESERVED) из списка в профиле
        # Они не учитываются в занятых местах и будут удаляться вручную в админке
        queryset = queryset.exclude(status=Booking.Status.RESERVED)
        
        return queryset.order_by('-created_at')
    
    def create(self, request, *args, **kwargs):
        """
        Создание бронирования с инициализацией оплаты предоплаты
        Если передан параметр preview=true, возвращает только расчет стоимости
        """
        logger.info("=== Starting booking creation ===")
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # Если это preview - возвращаем только расчет
        if request.data.get('preview', False):
            preview_data = serializer.save()
            # Преобразуем для ответа
            result = {
                'trip_id': preview_data['trip_id'],
                'number_of_people': preview_data['number_of_people'],
                'price_per_person': float(preview_data['price_per_person']),
                'original_price': float(preview_data['original_price']),
                'discount_percent': float(preview_data['discount_percent']),
                'discount_amount': float(preview_data['discount_amount']),
                'total_price': float(preview_data['total_price']),
                'deposit': float(preview_data['deposit']),
                'remaining_amount': float(preview_data['remaining_amount']),
                'available_spots': preview_data['available_spots'],
                'promo_code': {
                    'code': preview_data['promo_code'].code,
                    'discount_amount': float(preview_data['promo_code'].discount_amount),
                } if preview_data.get('promo_code') else None,
            }
            return Response(result, status=status.HTTP_200_OK)
        
        # Создаем бронирование
        booking = serializer.save()
        logger.info(f"Booking {booking.id} created successfully")
        
        try:
            # Инициализируем платеж для предоплаты через Т-Банк
            logger.info("Initializing TBankService...")
            tbank_service = TBankService()
            
            # Генерируем уникальный order_id
            order_id = f"booking_{booking.id}_deposit_{int(timezone.now().timestamp())}"
            logger.info(f"Order ID: {order_id}")
            
            # Формируем описание платежа
            description = f"Предоплата за бронирование #{booking.id} - {booking.boat.name} на {booking.start_datetime.strftime('%d.%m.%Y %H:%M')}"
            logger.info(f"Description: {description}")
            
            # Получаем URLs для перенаправления
            success_url = f"{settings.PAYMENT_SUCCESS_URL}?booking_id={booking.id}&type=deposit"
            fail_url = f"{settings.PAYMENT_FAIL_URL}?booking_id={booking.id}&type=deposit"
            logger.info(f"Success URL: {success_url}")
            logger.info(f"Fail URL: {fail_url}")
            
            # Инициализируем платеж
            logger.info(f"Calling init_payment with amount: {booking.deposit}")
            payment_result = tbank_service.init_payment(
                amount=booking.deposit,
                order_id=order_id,
                description=description,
                success_url=success_url,
                fail_url=fail_url,
                customer_email=request.user.email if request.user.email else None,
                customer_phone=booking.guest_phone
            )
            logger.info(f"Payment result: {payment_result}")
            
            # Сохраняем платеж в БД
            payment = Payment.objects.create(
                booking=booking,
                payment_id=payment_result['PaymentId'],
                order_id=order_id,
                amount=booking.deposit,
                payment_type=Payment.PaymentType.DEPOSIT,
                status=payment_result['Status'].lower(),
                payment_url=payment_result['PaymentURL'],
                success_url=success_url,
                fail_url=fail_url,
                raw_response=payment_result['raw_response']
            )
            
            logger.info(f"Payment initialized for booking {booking.id}: {payment.payment_id}")
            
            # Возвращаем данные бронирования с URL оплаты
            booking_data = BookingDetailSerializer(booking).data
            booking_data['payment_url'] = payment.payment_url
            booking_data['payment_id'] = payment.payment_id
            
            logger.info(f"Returning response with payment_url: {payment.payment_url}")
            
            headers = self.get_success_headers(serializer.data)
            return Response(booking_data, status=status.HTTP_201_CREATED, headers=headers)
            
        except Exception as e:
            logger.error(f"Error initializing payment for booking {booking.id}: {str(e)}", exc_info=True)
            # Если не удалось создать платеж, отменяем бронирование
            booking.status = Booking.Status.CANCELLED
            booking.notes = f"Ошибка инициализации оплаты: {str(e)}"
            booking.save()
            
            return Response(
                {
                    'error': 'Не удалось инициализировать оплату',
                    'detail': str(e)
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
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
        
        # Для RESERVED не нужна проверка времени - предоплата еще не внесена
        is_reserved = booking.status == Booking.Status.RESERVED
        
        if not is_reserved:
            # Проверка времени до рейса (только для PENDING и CONFIRMED)
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
        
        # Для RESERVED предоплата не возвращается, так как она еще не была внесена
        if not is_reserved:
            now = timezone.now()
            time_until_trip = booking.start_datetime - now
            if time_until_trip.total_seconds() > 72 * 3600:  # Более 72 часов
                refund_deposit = True
        
        # Удаляем событие из Google Calendar перед отменой
        if booking.google_calendar_event_id:
            try:
                from apps.bookings.services.google_calendar_service import GoogleCalendarService
                calendar_service = GoogleCalendarService()
                result = calendar_service.delete_event(booking)
                if result:
                    logger.info(f"✅ Google Calendar event deleted for booking {booking.id}")
                    # Очищаем event_id после успешного удаления
                    booking.google_calendar_event_id = None
                else:
                    logger.warning(f"⚠️ Failed to delete Google Calendar event for booking {booking.id}")
            except Exception as e:
                logger.error(f"❌ Failed to delete Google Calendar event for booking {booking.id}: {str(e)}", exc_info=True)
        
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
        Оплата остатка через Т-Банк
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
        
        if booking.status == Booking.Status.CONFIRMED:
            return Response(
                {'error': 'Бронирование уже полностью оплачено'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if booking.status == Booking.Status.COMPLETED:
            return Response(
                {'error': 'Бронирование уже завершено'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Проверяем, что предоплата была внесена
        if booking.remaining_amount <= 0:
            return Response(
                {'error': 'Нет остатка для оплаты'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Инициализируем платеж для остатка через Т-Банк
            tbank_service = TBankService()
            
            # Генерируем уникальный order_id
            order_id = f"booking_{booking.id}_remaining_{int(timezone.now().timestamp())}"
            
            # Формируем описание платежа
            description = f"Оплата остатка за бронирование #{booking.id} - {booking.boat.name} на {booking.start_datetime.strftime('%d.%m.%Y %H:%M')}"
            
            # Получаем URLs для перенаправления
            success_url = f"{settings.PAYMENT_SUCCESS_URL}?booking_id={booking.id}&type=remaining"
            fail_url = f"{settings.PAYMENT_FAIL_URL}?booking_id={booking.id}&type=remaining"
            
            # Инициализируем платеж
            payment_result = tbank_service.init_payment(
                amount=booking.remaining_amount,
                order_id=order_id,
                description=description,
                success_url=success_url,
                fail_url=fail_url,
                customer_email=user.email if user.email else None,
                customer_phone=booking.guest_phone
            )
            
            # Сохраняем платеж в БД
            payment = Payment.objects.create(
                booking=booking,
                payment_id=payment_result['PaymentId'],
                order_id=order_id,
                amount=booking.remaining_amount,
                payment_type=Payment.PaymentType.REMAINING,
                status=payment_result['Status'].lower(),
                payment_url=payment_result['PaymentURL'],
                success_url=success_url,
                fail_url=fail_url,
                raw_response=payment_result['raw_response']
            )
            
            logger.info(f"Remaining payment initialized for booking {booking.id}: {payment.payment_id}")
            
            # Возвращаем URL для оплаты
            return Response({
                'message': 'Платеж инициализирован',
                'payment_url': payment.payment_url,
                'payment_id': payment.payment_id,
                'amount': float(booking.remaining_amount),
                'booking_id': booking.id
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error initializing remaining payment for booking {booking.id}: {str(e)}")
            return Response(
                {
                    'error': 'Не удалось инициализировать оплату',
                    'detail': str(e)
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
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
        
        # Обновляем статус
        booking.status = Booking.Status.COMPLETED
        booking.save()
        
        return Response({
            'message': 'Посадка подтверждена',
            'verified': True,
            'number_of_people': booking.number_of_people,
            'status': 'boarding_allowed'
        }, status=status.HTTP_200_OK)
    
    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated])
    def block_seats(self, request):
        """
        Блокировка мест капитаном (внешняя продажа)
        Создает Booking с признаками блокировки
        """
        user = request.user
        
        # Только владелец судна может блокировать места
        if user.role != User.Role.BOAT_OWNER:
            raise PermissionDenied("Только владелец судна может блокировать места")
        
        serializer = BlockSeatsSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        booking = serializer.save()
        
        return Response({
            'message': 'Места успешно заблокированы',
            'booking_id': booking.id,
            'number_of_people': booking.number_of_people,
            'start_datetime': booking.start_datetime,
            'end_datetime': booking.end_datetime
        }, status=status.HTTP_201_CREATED)
    
    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def blocked_seats(self, request):
        """
        Список активных блокировок мест капитаном
        """
        user = request.user
        
        # Только владелец судна может просматривать блокировки
        if user.role != User.Role.BOAT_OWNER:
            raise PermissionDenied("Только владелец судна может просматривать блокировки")
        
        # Получаем блокировки (Booking с customer=None, guide=None, notes содержит "[БЛОКИРОВКА]")
        blocked_bookings = Booking.objects.filter(
            boat__owner=user,
            customer__isnull=True,
            guide__isnull=True,
            notes__startswith="[БЛОКИРОВКА]",
            status=Booking.Status.CONFIRMED
        ).select_related('boat').order_by('-start_datetime')
        
        # Фильтрация по boat_id если указан
        boat_id = request.query_params.get('boat_id')
        if boat_id:
            blocked_bookings = blocked_bookings.filter(boat_id=boat_id)
        
        serializer = BookingListSerializer(blocked_bookings, many=True, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)
    
    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def unblock(self, request, pk=None):
        """
        Разблокировка мест (изменение статуса блокировки на CANCELLED)
        """
        booking = self.get_object()
        user = request.user
        
        # Только владелец судна может разблокировать места
        if user.role != User.Role.BOAT_OWNER or booking.boat.owner != user:
            raise PermissionDenied("Только владелец судна может разблокировать места")
        
        # Проверяем, что это действительно блокировка
        if not (booking.customer is None and booking.guide is None and 
                booking.notes and booking.notes.startswith("[БЛОКИРОВКА]")):
            return Response(
                {'error': 'Это не блокировка мест'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Проверяем статус
        if booking.status == Booking.Status.CANCELLED:
            return Response(
                {'error': 'Места уже разблокированы'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Разблокируем (меняем статус на CANCELLED)
        booking.status = Booking.Status.CANCELLED
        booking.save()
        
        return Response({
            'message': 'Места успешно разблокированы',
            'booking_id': booking.id,
            'number_of_people': booking.number_of_people
        }, status=status.HTTP_200_OK)
    
    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def create_full_payment_link(self, request, pk=None):
        """
        Создание ссылки на полную оплату для бронирования гостиницы
        
        POST /api/bookings/{id}/create_full_payment_link/
        
        Возвращает:
        {
            "message": "Ссылка на полную оплату создана",
            "payment_url": "https://securepay.tinkoff.ru/...",
            "payment_id": "123456789",
            "amount": 10000.0,
            "booking_id": 1
        }
        """
        booking = self.get_object()
        user = request.user
        
        # Проверка прав доступа
        if user.role != User.Role.HOTEL:
            raise PermissionDenied("Только гостиницы могут создавать ссылки на полную оплату")
        
        if booking.hotel_admin != user:
            raise PermissionDenied("Вы можете создавать ссылки только для своих бронирований")
        
        # Проверка статуса
        if booking.status == Booking.Status.CANCELLED:
            return Response(
                {'error': 'Нельзя создать ссылку для отмененного бронирования'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if booking.status == Booking.Status.COMPLETED:
            return Response(
                {'error': 'Бронирование уже завершено'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if booking.status == Booking.Status.CONFIRMED:
            return Response(
                {'error': 'Бронирование уже полностью оплачено'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Определяем сумму для оплаты
        # Если предоплата внесена, оплачиваем остаток, иначе полную сумму
        if booking.deposit > 0 and booking.remaining_amount > 0:
            payment_amount = booking.remaining_amount
            payment_type = Payment.PaymentType.REMAINING
            payment_description = f"Оплата остатка за бронирование #{booking.id} - {booking.boat.name} на {booking.start_datetime.strftime('%d.%m.%Y %H:%M')}"
            order_id_suffix = "remaining"
        elif booking.deposit == 0:
            payment_amount = booking.total_price
            payment_type = Payment.PaymentType.FULL
            payment_description = f"Полная оплата за бронирование #{booking.id} - {booking.boat.name} на {booking.start_datetime.strftime('%d.%m.%Y %H:%M')}"
            order_id_suffix = "full"
        else:
            # Если deposit > 0 и remaining_amount == 0, значит уже полностью оплачено
            return Response(
                {'error': 'Бронирование уже полностью оплачено'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Инициализируем платеж через Т-Банк
            logger.info(f"Creating payment link for hotel booking {booking.id}...")
            logger.info(f"Payment amount: {payment_amount}, Type: {payment_type}")
            tbank_service = TBankService()
            
            # Генерируем уникальный order_id
            order_id = f"booking_{booking.id}_{order_id_suffix}_{int(timezone.now().timestamp())}"
            logger.info(f"Order ID: {order_id}")
            
            # Формируем описание платежа
            description = payment_description
            logger.info(f"Description: {description}")
            
            # Получаем URLs для перенаправления
            success_url = f"{settings.PAYMENT_SUCCESS_URL}?booking_id={booking.id}&type={order_id_suffix}"
            fail_url = f"{settings.PAYMENT_FAIL_URL}?booking_id={booking.id}&type={order_id_suffix}"
            logger.info(f"Success URL: {success_url}")
            logger.info(f"Fail URL: {fail_url}")
            
            # Проверяем, что сумма больше 0
            if payment_amount <= 0:
                return Response(
                    {'error': 'Сумма для оплаты должна быть больше 0'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Инициализируем платеж
            logger.info(f"Calling init_payment with amount: {payment_amount}")
            payment_result = tbank_service.init_payment(
                amount=payment_amount,
                order_id=order_id,
                description=description,
                success_url=success_url,
                fail_url=fail_url,
                customer_phone=booking.guest_phone
            )
            logger.info(f"Payment result: {payment_result}")
            
            # Сохраняем платеж в БД
            payment = Payment.objects.create(
                booking=booking,
                payment_id=payment_result['PaymentId'],
                order_id=order_id,
                amount=payment_amount,
                payment_type=payment_type,
                status=payment_result['Status'].lower(),
                payment_url=payment_result['PaymentURL'],
                success_url=success_url,
                fail_url=fail_url,
                raw_response=payment_result['raw_response']
            )
            
            logger.info(f"Payment link created for hotel booking {booking.id}: {payment.payment_id}")
            
            # Возвращаем URL для оплаты
            return Response({
                'message': 'Ссылка на оплату создана',
                'payment_url': payment.payment_url,
                'payment_id': payment.payment_id,
                'amount': float(payment_amount),
                'booking_id': booking.id
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error creating full payment link for booking {booking.id}: {str(e)}", exc_info=True)
            return Response(
                {
                    'error': 'Не удалось создать ссылку на оплату',
                    'detail': str(e)
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated])
    def create_hotel_booking(self, request):
        """
        Создание бронирования от гостиницы и генерация ссылки для оплаты гостем
        
        POST /api/bookings/create_hotel_booking/
        {
            "trip_id": 1,
            "number_of_people": 4,
            "guest_name": "Иван Иванов",
            "guest_phone": "+79001234567"
        }
        
        Возвращает:
        {
            "booking": {...},
            "payment_url": "https://securepay.tinkoff.ru/...",
            "payment_id": "123456789"
        }
        """
        logger.info("=== Creating hotel booking ===")
        
        # Проверяем, что пользователь - гостиница
        if request.user.role != User.Role.HOTEL:
            raise PermissionDenied("Только гостиницы могут создавать бронирования для гостей")
        
        # Создаём бронирование через сериализатор
        serializer = HotelBookingSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        booking = serializer.save()
        
        logger.info(f"Hotel booking {booking.id} created successfully")
        
        # Проверяем, что deposit больше 0
        if booking.deposit <= 0:
            logger.error(f"Invalid deposit amount for booking {booking.id}: {booking.deposit}")
            booking.status = Booking.Status.CANCELLED
            booking.notes = f"Ошибка: сумма предоплаты должна быть больше 0"
            booking.save()
            return Response(
                {
                    'error': 'Ошибка расчета предоплаты',
                    'detail': 'Сумма предоплаты должна быть больше 0'
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        try:
            # Инициализируем платеж для предоплаты через Т-Банк
            logger.info("Initializing TBankService...")
            tbank_service = TBankService()
            
            # Генерируем уникальный order_id
            order_id = f"booking_{booking.id}_deposit_{int(timezone.now().timestamp())}"
            logger.info(f"Order ID: {order_id}")
            
            # Формируем описание платежа
            description = f"Предоплата за бронирование #{booking.id} - {booking.boat.name} на {booking.start_datetime.strftime('%d.%m.%Y %H:%M')}"
            logger.info(f"Description: {description}")
            
            # Получаем URLs для перенаправления
            success_url = f"{settings.PAYMENT_SUCCESS_URL}?booking_id={booking.id}&type=deposit"
            fail_url = f"{settings.PAYMENT_FAIL_URL}?booking_id={booking.id}&type=deposit"
            logger.info(f"Success URL: {success_url}")
            logger.info(f"Fail URL: {fail_url}")
            
            # Инициализируем платеж для предоплаты
            logger.info(f"Calling init_payment with amount: {booking.deposit}")
            payment_result = tbank_service.init_payment(
                amount=booking.deposit,
                order_id=order_id,
                description=description,
                success_url=success_url,
                fail_url=fail_url,
                customer_phone=booking.guest_phone
            )
            logger.info(f"Payment result: {payment_result}")
            
            # Сохраняем платеж в БД
            payment = Payment.objects.create(
                booking=booking,
                payment_id=payment_result['PaymentId'],
                order_id=order_id,
                amount=booking.deposit,
                payment_type=Payment.PaymentType.DEPOSIT,
                status=payment_result['Status'].lower(),
                payment_url=payment_result['PaymentURL'],
                success_url=success_url,
                fail_url=fail_url,
                raw_response=payment_result['raw_response']
            )
            
            logger.info(f"Payment initialized for hotel booking {booking.id}: {payment.payment_id}")
            
            # Возвращаем данные бронирования с URL оплаты
            booking_data = BookingDetailSerializer(booking, context={'request': request}).data
            booking_data['payment_url'] = payment.payment_url
            booking_data['payment_id'] = payment.payment_id
            
            logger.info(f"Returning response with payment_url: {payment.payment_url}")
            
            return Response(booking_data, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            logger.error(f"Error initializing payment for hotel booking {booking.id}: {str(e)}", exc_info=True)
            # Если не удалось создать платеж, отменяем бронирование
            booking.status = Booking.Status.CANCELLED
            booking.notes = f"Ошибка инициализации оплаты: {str(e)}"
            booking.save()
            
            return Response(
                {
                    'error': 'Не удалось инициализировать оплату',
                    'detail': str(e)
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

