from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
from django.utils import timezone
import logging
from .models import Booking

logger = logging.getLogger(__name__)


def _format_booking_message(booking):
    """Форматирует сообщение о бронировании для личных уведомлений"""
    from decimal import Decimal

    # ВАЖНО: с USE_TZ=True datetime хранится в UTC; strftime без localtime покажет UTC.
    # Конвертируем в локальную зону (Europe/Moscow) для корректного отображения.
    start_dt = timezone.localtime(booking.start_datetime)
    end_dt = timezone.localtime(booking.end_datetime)

    # Форматируем дату и время на русском языке
    months_ru = {
        1: 'января', 2: 'февраля', 3: 'марта', 4: 'апреля',
        5: 'мая', 6: 'июня', 7: 'июля', 8: 'августа',
        9: 'сентября', 10: 'октября', 11: 'ноября', 12: 'декабря'
    }
    day = start_dt.day
    month = months_ru[start_dt.month]
    start_date = f"{day} {month}"

    start_time = start_dt.strftime('%H:%M')
    end_time = end_dt.strftime('%H:%M')
    
    # Форматируем суммы с пробелами для тысяч
    def format_price(amount):
        if amount is None:
            return "0"
        return f"{amount:,.0f}".replace(',', ' ')
    
    # Формируем строку остатка
    if booking.remaining_amount and booking.remaining_amount > 0:
        remaining_text = f"{format_price(booking.remaining_amount)} ₽ при посадке на катер"
    else:
        remaining_text = "Оплачено полностью"
    
    # Формируем сообщение
    message = f"""Дата и время: {start_date} с {start_time} до {end_time}
Мероприятие: {booking.event_type}
Количество людей: {booking.number_of_people}
Катер: {booking.boat.name}
Общая стоимость: {format_price(booking.total_price)} ₽
Внесена предоплата: {format_price(booking.deposit)} ₽
Имя гостя: {booking.guest_name}
Контактный телефон: {booking.guest_phone}

Остаток: {remaining_text}"""
    
    return message


# Храним старые значения для отслеживания изменений
_booking_cache = {}


@receiver(pre_save, sender=Booking)
def store_booking_state(sender, instance, **kwargs):
    """Сохраняет состояние бронирования перед сохранением для отслеживания изменений"""
    if instance.pk:
        try:
            old_instance = Booking.objects.get(pk=instance.pk)
            _booking_cache[instance.pk] = {
                'start_datetime': old_instance.start_datetime,
                'end_datetime': old_instance.end_datetime,
                'guest_name': old_instance.guest_name,
                'guest_phone': old_instance.guest_phone,
                'event_type': old_instance.event_type,
                'number_of_people': old_instance.number_of_people,
                'duration_hours': old_instance.duration_hours,
                'boat_id': old_instance.boat_id,
                'price_per_person': old_instance.price_per_person,
                'total_price': old_instance.total_price,
                'deposit': old_instance.deposit,
                'remaining_amount': old_instance.remaining_amount,
                'notes': old_instance.notes,
                'status': old_instance.status,
            }
        except Booking.DoesNotExist:
            pass


@receiver(post_save, sender=Booking)
def send_telegram_notification_on_booking_creation(sender, instance, created, **kwargs):
    """
    Отправляет уведомление в Telegram при создании нового бронирования
    Исключает блокировки мест (внешняя продажа) - бронирования с notes, начинающимся с "[БЛОКИРОВКА]"
    """
    logger.info(f"=== SIGNAL TRIGGERED for Booking {instance.id} ===")
    logger.info(f"Created: {created}, Status: {instance.status}, Deposit: {instance.deposit}")
    
    # Проверяем, является ли это блокировкой мест (внешняя продажа)
    # Блокировки имеют notes, начинающийся с "[БЛОКИРОВКА]"
    is_blocked_seats = (
        instance.notes and 
        instance.notes.startswith("[БЛОКИРОВКА]")
    )
    
    if is_blocked_seats:
        logger.info(f"⏭️ Booking {instance.id} is a blocked seats booking (external sale), skipping Telegram notification")
        return
    
    # Не отправляем уведомления для RESERVED - места еще не заблокированы, ждем оплаты предоплаты
    if instance.status == Booking.Status.RESERVED:
        logger.info(f"⏭️ Booking {instance.id} is RESERVED (waiting for deposit payment), skipping Telegram notification")
        return
    
    # Отправляем уведомление только при создании нового бронирования или при переходе в PENDING
    # PENDING означает, что предоплата внесена и места заблокированы
    if created or (not created and instance.status == Booking.Status.PENDING):
        # Перезагружаем из БД для получения актуального состояния (защита от дублирования)
        if instance.pk:
            instance.refresh_from_db()
            logger.debug(f"Refreshed booking {instance.id} from DB, telegram_notification_sent={instance.telegram_notification_sent}")
        
        # Проверяем, не было ли уже отправлено уведомление (защита от дублирования)
        if instance.telegram_notification_sent:
            logger.info(f"⏭️ Booking {instance.id} already has Telegram notification sent, skipping duplicate")
            return
        
        logger.info(f"✅ Booking {instance.id} is ready for Telegram notification, sending ===")
        try:
            from .services.telegram_service import TelegramService
            logger.info(f"Importing TelegramService...")
            telegram_service = TelegramService()
            
            # 1. Отправка в общий канал (как было раньше)
            logger.info(f"TelegramService created, calling send_booking_notification for booking {instance.id}...")
            result = telegram_service.send_booking_notification(instance)
            if result:
                logger.info(f"✅ Telegram notification sent successfully to channel for booking {instance.id}")
                # Отмечаем, что уведомление отправлено (используем update для избежания повторного вызова сигнала)
                Booking.objects.filter(pk=instance.pk).update(telegram_notification_sent=True)
                instance.telegram_notification_sent = True
            else:
                logger.warning(f"⚠️ Telegram notification to channel returned None for booking {instance.id}")
            
            # Личные уведомления: собираем получателей без дублей (одна персона = одно сообщение)
            # Приоритет: клиент > гид > владелец (клиенту важнее "ваше бронирование подтверждено")
            recipients = []  # [(user, message_prefix), ...]
            seen_user_ids = set()

            def add_recipient(user, prefix, role_name):
                if user and user.telegram_chat_id and user.id not in seen_user_ids:
                    seen_user_ids.add(user.id)
                    recipients.append((user, prefix, role_name))

            add_recipient(instance.customer, "✅ Ваше бронирование подтверждено!\n\n", "customer")
            add_recipient(instance.guide, "👥 Новое бронирование с вашей группой!\n\n", "guide")
            add_recipient(instance.boat.owner, f"🚤 Новое бронирование на ваш катер {instance.boat.name}!\n\n", "boat_owner")

            for user, prefix, role_name in recipients:
                logger.info(f"Sending personal notification to {role_name} {user.email}")
                message = prefix + _format_booking_message(instance)
                telegram_service.send_to_user(user, message)
                
        except Exception as e:
            logger.error(f"❌ Failed to send Telegram notification for booking {instance.id}: {str(e)}", exc_info=True)
        
        # Создаем событие в Google Calendar после успешной оплаты предоплаты (когда статус PENDING)
        # Создаем только если событие еще не создано (защита от дублирования при повторных вызовах сигнала)
        if instance.status == Booking.Status.PENDING and not instance.google_calendar_event_id:
            logger.info(f"=== Creating Google Calendar event for booking {instance.id} ===")
            try:
                # Дополнительная проверка после refresh_from_db - защита от race condition
                # Используем select_for_update для блокировки записи в транзакции
                from django.db import transaction
                with transaction.atomic():
                    # Блокируем запись для обновления, чтобы предотвратить параллельное создание
                    booking = Booking.objects.select_for_update().get(pk=instance.pk)
                    
                    # Проверяем еще раз, что событие не было создано другим процессом
                    if booking.google_calendar_event_id:
                        logger.warning(f"⚠️ Booking {instance.id} already has calendar event (race condition prevented): {booking.google_calendar_event_id}")
                        return
                    
                    from .services.google_calendar_service import GoogleCalendarService
                    calendar_service = GoogleCalendarService()
                    event_id = calendar_service.create_event(booking)
                    if event_id:
                        # Используем update() вместо save() чтобы не вызывать сигнал post_save повторно
                        Booking.objects.filter(pk=booking.pk).update(google_calendar_event_id=event_id)
                        # Обновляем локальный объект для дальнейшего использования
                        instance.google_calendar_event_id = event_id
                        logger.info(f"✅ Google Calendar event created for booking {instance.id}, event_id={event_id}")
                    else:
                        logger.warning(f"⚠️ Google Calendar event creation returned None for booking {instance.id}")
            except Booking.DoesNotExist:
                logger.error(f"❌ Booking {instance.id} not found when trying to create calendar event")
            except Exception as e:
                logger.error(f"❌ Failed to create Google Calendar event for booking {instance.id}: {str(e)}", exc_info=True)
    else:
        logger.info(f"Booking {instance.id} is not new (created=False), skipping notification")
    
    # Обновляем событие в Google Calendar при изменении бронирования
    if not created and instance.google_calendar_event_id and instance.status != Booking.Status.CANCELLED:
        old_data = _booking_cache.get(instance.pk)
        if old_data:
            # Проверяем, изменились ли релевантные поля
            relevant_fields_changed = (
                old_data['start_datetime'] != instance.start_datetime or
                old_data['end_datetime'] != instance.end_datetime or
                old_data['guest_name'] != instance.guest_name or
                old_data['guest_phone'] != instance.guest_phone or
                old_data['event_type'] != instance.event_type or
                old_data['number_of_people'] != instance.number_of_people or
                old_data['duration_hours'] != instance.duration_hours or
                old_data['boat_id'] != instance.boat_id or
                old_data['price_per_person'] != instance.price_per_person or
                old_data['total_price'] != instance.total_price or
                old_data['deposit'] != instance.deposit or
                old_data['remaining_amount'] != instance.remaining_amount or
                old_data['notes'] != instance.notes
            )
            
            if relevant_fields_changed:
                logger.info(f"=== Updating Google Calendar event for booking {instance.id} ===")
                try:
                    from .services.google_calendar_service import GoogleCalendarService
                    calendar_service = GoogleCalendarService()
                    result = calendar_service.update_event(instance)
                    if result:
                        logger.info(f"✅ Google Calendar event updated successfully for booking {instance.id}")
                    else:
                        logger.warning(f"⚠️ Failed to update Google Calendar event for booking {instance.id}")
                except Exception as e:
                    logger.error(f"❌ Failed to update Google Calendar event for booking {instance.id}: {str(e)}", exc_info=True)
        
        # Очищаем кэш
        _booking_cache.pop(instance.pk, None)