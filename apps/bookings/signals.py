from django.db.models.signals import post_save
from django.dispatch import receiver
import logging
from .models import Booking

logger = logging.getLogger(__name__)


@receiver(post_save, sender=Booking)
def send_telegram_notification_on_booking_creation(sender, instance, created, **kwargs):
    """
    Отправляет уведомление в Telegram при создании нового бронирования
    """
    logger.info(f"=== SIGNAL TRIGGERED for Booking {instance.id} ===")
    logger.info(f"Created: {created}, Status: {instance.status}, Deposit: {instance.deposit}")
    
    # Отправляем уведомление только при создании нового бронирования
    if created:
        logger.info(f"✅ Booking {instance.id} is newly created, sending Telegram notification ===")
        try:
            from .services.telegram_service import TelegramService
            logger.info(f"Importing TelegramService...")
            telegram_service = TelegramService()
            logger.info(f"TelegramService created, calling send_booking_notification for booking {instance.id}...")
            result = telegram_service.send_booking_notification(instance)
            if result:
                logger.info(f"✅ Telegram notification sent successfully for booking {instance.id}")
            else:
                logger.warning(f"⚠️ Telegram notification returned None for booking {instance.id}")
        except Exception as e:
            logger.error(f"❌ Failed to send Telegram notification for booking {instance.id}: {str(e)}", exc_info=True)
    else:
        logger.info(f"Booking {instance.id} is not new (created=False), skipping notification")
