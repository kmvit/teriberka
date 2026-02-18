from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.exceptions import NotFound
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
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
        """Отправка уведомлений о полной оплате бронирования"""
        try:
            from apps.bookings.services.telegram_service import TelegramService
            from apps.bookings.signals import _format_booking_message
            
            telegram_service = TelegramService()
            
            # Уведомление владельцу судна
            boat_owner = booking.boat.owner
            if boat_owner and boat_owner.telegram_chat_id:
                logger.info(f"Sending payment confirmation to boat owner {boat_owner.email}")
                message = f"💰 Бронирование полностью оплачено!\n\n"
                message += _format_booking_message(booking)
                telegram_service.send_to_user(boat_owner, message)
            
            # Уведомление клиенту
            if booking.customer and booking.customer.telegram_chat_id:
                logger.info(f"Sending payment confirmation to customer {booking.customer.email}")
                message = f"✅ Оплата прошла успешно! Ждем вас на борту.\n\n"
                message += _format_booking_message(booking)
                telegram_service.send_to_user(booking.customer, message)
                
        except Exception as e:
            logger.error(f"Error sending payment confirmation notifications: {str(e)}", exc_info=True)
    
    @action(detail=True, methods=['get'])
    def check_status(self, request, pk=None):
        """
        Проверка статуса платежа через API Т-Банка
        """
        payment = self.get_object()
        
        try:
            tbank_service = TBankService()
            result = tbank_service.get_payment_state(payment.payment_id)
            
            # Обновляем статус в нашей БД
            old_status = payment.status
            new_status = result['Status'].lower()
            
            payment.status = new_status
            payment.raw_response = result['raw_response']
            
            # Если платеж успешно оплачен
            if payment.is_paid() and not payment.paid_at:
                payment.paid_at = timezone.now()
                
                # Обновляем статус бронирования
                booking = payment.booking
                if payment.payment_type == Payment.PaymentType.DEPOSIT:
                    # Предоплата внесена - меняем статус с RESERVED на PENDING
                    booking.deposit = payment.amount
                    if booking.status == Booking.Status.RESERVED:
                        booking.status = Booking.Status.PENDING
                elif payment.payment_type == Payment.PaymentType.REMAINING:
                    # Остаток оплачен - бронь подтверждена
                    booking.status = Booking.Status.CONFIRMED
                    booking.deposit = booking.total_price
                    booking.remaining_amount = Decimal('0')
                    
                    # Отправляем уведомления о полной оплате
                    self._send_payment_confirmed_notifications(booking)
                    
                elif payment.payment_type == Payment.PaymentType.FULL:
                    # Полная оплата (от гостиницы) - бронь подтверждена
                    booking.status = Booking.Status.CONFIRMED
                    booking.deposit = booking.total_price
                    booking.remaining_amount = Decimal('0')
                    logger.info(f"Full payment completed, hotel cashback: {booking.hotel_cashback_percent}% = {booking.hotel_cashback_amount} RUB")
                    
                    # Отправляем уведомления о полной оплате
                    self._send_payment_confirmed_notifications(booking)
                
                booking.save()
                logger.info(f"Booking {booking.id} status updated to {booking.status} after payment")
                # Событие в Google Calendar создастся автоматически через signal при сохранении бронирования
            
            payment.save()
            
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
            
            # Находим платеж в БД
            try:
                payment = Payment.objects.select_related('booking').get(payment_id=payment_id)
            except Payment.DoesNotExist:
                logger.error(f"Payment not found: {payment_id}")
                return Response({'error': 'Payment not found'}, status=status.HTTP_404_NOT_FOUND)
            
            # Проверяем, не был ли уже обработан этот статус (идемпотентность)
            if payment.status == new_status:
                logger.info(f"Payment {payment_id} already has status {new_status}, skipping")
                return Response({'message': 'OK'}, status=status.HTTP_200_OK)
            
            # Обновляем статус платежа
            old_status = payment.status
            payment.status = new_status
            payment.raw_response = notification_data
            
            # Обрабатываем ошибки
            if 'ErrorCode' in notification_data:
                payment.error_code = notification_data['ErrorCode']
                payment.error_message = notification_data.get('Message', '')
            
            # Если платеж успешно оплачен
            if payment.is_paid() and not payment.paid_at:
                payment.paid_at = timezone.now()
                
                # Обновляем бронирование
                booking = payment.booking
                
                if payment.payment_type == Payment.PaymentType.DEPOSIT:
                    # Предоплата внесена - меняем статус с RESERVED на PENDING
                    # Проверяем, не был ли уже обработан этот платеж (защита от дублирования при повторных webhook)
                    if booking.status == Booking.Status.PENDING and booking.deposit == payment.amount:
                        logger.info(f"Booking {booking.id} already has status PENDING with deposit {payment.amount}, skipping update")
                    else:
                        booking.deposit = payment.amount
                        # Если было RESERVED, меняем на PENDING (места теперь заблокированы)
                        if booking.status == Booking.Status.RESERVED:
                            booking.status = Booking.Status.PENDING
                        logger.info(f"Deposit paid for booking {booking.id}, status changed to {booking.status}")
                        booking.save()
                        # Уведомление в Telegram отправится автоматически через signal при сохранении бронирования
                    
                elif payment.payment_type == Payment.PaymentType.REMAINING:
                    # Остаток оплачен - подтверждаем бронь
                    booking.deposit = booking.total_price
                    booking.remaining_amount = Decimal('0')
                    booking.status = Booking.Status.CONFIRMED
                    booking.payment_method = Booking.PaymentMethod.ONLINE
                    logger.info(f"Remaining amount paid for booking {booking.id}")
                    booking.save()
                    
                    # Отправляем уведомления о полной оплате
                    self._send_payment_confirmed_notifications(booking)
                
                elif payment.payment_type == Payment.PaymentType.FULL:
                    # Полная оплата (от гостиницы) - подтверждаем бронь
                    booking.deposit = booking.total_price
                    booking.remaining_amount = Decimal('0')
                    booking.status = Booking.Status.CONFIRMED
                    booking.payment_method = Booking.PaymentMethod.ONLINE
                    logger.info(f"Full payment completed for hotel booking {booking.id}")
                    # Кешбэк гостинице уже рассчитан в методе save модели Booking
                    logger.info(f"Hotel cashback: {booking.hotel_cashback_percent}% = {booking.hotel_cashback_amount} RUB")
                    booking.save()
                    
                    # Отправляем уведомления о полной оплате
                    self._send_payment_confirmed_notifications(booking)
            
            # Если платеж неудачен или отменен
            elif payment.is_failed():
                logger.warning(f"Payment {payment_id} failed with status {new_status}")
                # Можно добавить логику отмены бронирования или уведомления пользователя
            
            payment.save()
            
            logger.info(f"Payment {payment_id} status updated: {old_status} -> {new_status}")
            
            # Т-Банк ожидает ответ "OK"
            return Response({'message': 'OK'}, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error processing webhook: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Internal server error'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
