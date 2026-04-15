from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.exceptions import NotFound
from django.http import HttpResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from django.db import transaction
from decimal import Decimal
import logging

from .models import Payment
from .serializers import PaymentSerializer, PaymentStatusSerializer
from .services import TBankService
from apps.bookings.models import Booking

logger = logging.getLogger(__name__)


class PaymentViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet для управления платежами
    """
    permission_classes = [IsAuthenticated]
    serializer_class = PaymentSerializer
    
    def get_queryset(self):
        """Фильтрация платежей по пользователю"""
        user = self.request.user
        
        # Получаем платежи через бронирования пользователя
        bookings = Booking.objects.filter(customer=user)
        return Payment.objects.filter(booking__in=bookings).select_related('booking')
    
    def _send_payment_confirmed_notifications(self, booking):
        """Отправка уведомлений о полной оплате бронирования.
        Одна персона = одно сообщение (без дублей, если владелец = клиент)."""
        try:
            from apps.bookings.services.telegram_service import TelegramService
            from apps.bookings.services.max_service import MaxService
            from apps.bookings.signals import _format_booking_message

            telegram_service = TelegramService()
            max_service = MaxService()
            seen_user_ids = set()

            def send_if_new(user, prefix, role_name):
                has_any_chat = bool(getattr(user, 'telegram_chat_id', None) or getattr(user, 'max_chat_id', None))
                if user and has_any_chat and user.id not in seen_user_ids:
                    seen_user_ids.add(user.id)
                    logger.info(f"Sending payment confirmation to {role_name} {user.email}")
                    message = prefix + _format_booking_message(booking)
                    telegram_service.send_to_user(user, message)
                    max_service.send_to_user(user, message)

            send_if_new(booking.customer, "✅ Оплата прошла успешно! Ждем вас на борту.\n\n", "customer")
            send_if_new(booking.boat.owner, "💰 Бронирование полностью оплачено!\n\n", "boat_owner")

        except Exception as e:
            logger.error(f"Error sending payment confirmation notifications: {str(e)}", exc_info=True)

    def _apply_paid_booking_effects(self, payment):
        """Применяет побочные эффекты успешной оплаты ровно один раз под блокировкой Payment."""
        booking = payment.booking

        if payment.payment_type == Payment.PaymentType.DEPOSIT:
            # Предоплата внесена - меняем статус с RESERVED на PENDING
            should_save_booking = False

            if booking.deposit != payment.amount:
                booking.deposit = payment.amount
                should_save_booking = True

            if booking.status == Booking.Status.RESERVED:
                booking.status = Booking.Status.PENDING
                should_save_booking = True

            if should_save_booking:
                booking.save()
                logger.info(f"Deposit paid for booking {booking.id}, status changed to {booking.status}")

        elif payment.payment_type == Payment.PaymentType.REMAINING:
            # Остаток оплачен - подтверждаем бронь
            booking.deposit = booking.total_price
            booking.remaining_amount = Decimal('0')
            booking.status = Booking.Status.CONFIRMED
            booking.payment_method = Booking.PaymentMethod.ONLINE
            booking.save()
            logger.info(f"Remaining amount paid for booking {booking.id}")

            # Отправляем уведомления о полной оплате только в рамках первого успешного применения
            self._send_payment_confirmed_notifications(booking)

        elif payment.payment_type == Payment.PaymentType.FULL:
            # Полная оплата (от гостиницы) - подтверждаем бронь
            booking.deposit = booking.total_price
            booking.remaining_amount = Decimal('0')
            booking.status = Booking.Status.CONFIRMED
            booking.payment_method = Booking.PaymentMethod.ONLINE
            logger.info(f"Full payment completed for hotel booking {booking.id}")
            logger.info(f"Hotel cashback: {booking.hotel_cashback_percent}% = {booking.hotel_cashback_amount} RUB")
            booking.save()

            # Отправляем уведомления о полной оплате только в рамках первого успешного применения
            self._send_payment_confirmed_notifications(booking)
    
    @action(detail=True, methods=['get'])
    def check_status(self, request, pk=None):
        """
        Проверка статуса платежа через API Т-Банка
        """
        payment = self.get_object()
        
        try:
            tbank_service = TBankService()
            result = tbank_service.get_payment_state(payment.payment_id)
            new_status = result['Status'].lower()

            with transaction.atomic():
                # Блокируем платеж, чтобы webhook/check_status не применяли побочные эффекты параллельно
                locked_payment = Payment.objects.select_for_update().select_related('booking').get(pk=payment.pk)
                old_status = locked_payment.status

                locked_payment.status = new_status
                locked_payment.raw_response = result['raw_response']

                # Если платеж успешно оплачен и ещё не обработан, применяем эффекты ровно один раз
                if locked_payment.is_paid() and not locked_payment.paid_at:
                    locked_payment.paid_at = timezone.now()
                    self._apply_paid_booking_effects(locked_payment)

                locked_payment.save()

            payment = locked_payment
            
            if old_status != new_status:
                logger.info(f"Payment {payment.id} status changed: {old_status} -> {new_status}")
            
            serializer = PaymentStatusSerializer({
                'payment_id': payment.payment_id,
                'status': payment.status,
                'status_display': payment.get_status_display(),
                'is_paid': payment.is_paid(),
                'is_failed': payment.is_failed()
            })
            
            return Response(serializer.data)
            
        except Exception as e:
            logger.error(f"Error checking payment status: {str(e)}")
            return Response(
                {'error': f'Ошибка проверки статуса: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @method_decorator(csrf_exempt, name='dispatch')
    @action(detail=False, methods=['post'], permission_classes=[AllowAny])
    def webhook(self, request):
        """
        Обработка уведомлений (webhook) от Т-Банка
        
        Этот endpoint вызывается Т-Банком при изменении статуса платежа
        """
        notification_data = request.data
        
        logger.info(f"Received webhook notification: {notification_data}")
        
        try:
            # Проверяем подлинность уведомления
            tbank_service = TBankService()
            if not tbank_service.verify_notification(notification_data):
                logger.warning("Invalid webhook signature")
                return Response({'error': 'Invalid signature'}, status=status.HTTP_403_FORBIDDEN)
            
            # Получаем данные из уведомления
            payment_id = notification_data.get('PaymentId')
            new_status = notification_data.get('Status', '').lower()
            
            if not payment_id:
                logger.error("No PaymentId in webhook notification")
                return Response({'error': 'PaymentId is required'}, status=status.HTTP_400_BAD_REQUEST)
            
            with transaction.atomic():
                # Находим и блокируем платеж в БД для строгой идемпотентности
                try:
                    payment = Payment.objects.select_for_update().select_related('booking').get(payment_id=payment_id)
                except Payment.DoesNotExist:
                    logger.error(f"Payment not found: {payment_id}")
                    return Response({'error': 'Payment not found'}, status=status.HTTP_404_NOT_FOUND)

                old_status = payment.status

                # Обновляем статус платежа
                payment.status = new_status
                payment.raw_response = notification_data

                # Обрабатываем ошибки
                if 'ErrorCode' in notification_data:
                    payment.error_code = notification_data['ErrorCode']
                    payment.error_message = notification_data.get('Message', '')

                # Если платеж успешно оплачен и еще не обработан - применяем эффекты ровно один раз
                if payment.is_paid() and not payment.paid_at:
                    payment.paid_at = timezone.now()
                    self._apply_paid_booking_effects(payment)
                elif payment.is_failed():
                    logger.warning(f"Payment {payment_id} failed with status {new_status}")
                    # Можно добавить логику отмены бронирования или уведомления пользователя

                payment.save()
            
            logger.info(f"Payment {payment_id} status updated: {old_status} -> {new_status}")
            
            # Т-Банк требует: HTTP 200 + тело ответа "OK" (plain text, заглавными, без JSON-тегов)
            return HttpResponse('OK', status=200, content_type='text/plain')
            
        except Exception as e:
            logger.error(f"Error processing webhook: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Internal server error'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
