from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from apps.bookings.models import Booking
from apps.bookings.services.telegram_service import TelegramService
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Отправляет напоминания гидам за 1 час до выхода в море'

    def handle(self, *args, **options):
        now = timezone.now()
        
        # Диапазон: от now до now + 3h15m (с запасом 15 минут)
        time_min = now
        time_max = now + timedelta(hours=3, minutes=15)
        
        self.stdout.write(f"Поиск бронирований с {time_min} до {time_max}")
        
        # Находим бронирования:
        # - статус PENDING или CONFIRMED
        # - есть гид
        # - start_datetime в диапазоне
        # - напоминание еще не отправлено
        # - есть остаток к оплате
        bookings = Booking.objects.filter(
            status__in=[Booking.Status.PENDING, Booking.Status.CONFIRMED],
            guide__isnull=False,
            guide__telegram_chat_id__isnull=False,
            start_datetime__gte=time_min,
            start_datetime__lte=time_max,
            guide_reminder_sent=False,
            remaining_amount__gt=0
        ).select_related('guide', 'boat')
        
        count = bookings.count()
        self.stdout.write(f"Найдено бронирований: {count}")
        
        if count == 0:
            self.stdout.write(self.style.SUCCESS('Нет бронирований для напоминания'))
            return
        
        telegram_service = TelegramService()
        sent_count = 0
        
        for booking in bookings:
            try:
                # Форматируем время до выхода
                time_until = booking.start_datetime - now
                hours = int(time_until.total_seconds() // 3600)
                minutes = int((time_until.total_seconds() % 3600) // 60)
                
                # Форматируем сумму
                def format_price(amount):
                    if amount is None:
                        return "0"
                    return f"{amount:,.0f}".replace(',', ' ')
                
                # Формируем сообщение
                message = f"""⏰ Напоминание: через {hours}ч {minutes}мин выход в море!

Катер: {booking.boat.name}
Количество людей: {booking.number_of_people}
Мероприятие: {booking.event_type}

💰 Остаток к оплате: {format_price(booking.remaining_amount)} ₽

Оплатите остаток за 1 час до выхода в море в личном кабинете в разделе «Бронирования»."""
                
                # Отправляем напоминание
                result = telegram_service.send_to_user(booking.guide, message)
                
                if result:
                    # Отмечаем, что напоминание отправлено
                    Booking.objects.filter(pk=booking.pk).update(guide_reminder_sent=True)
                    sent_count += 1
                    self.stdout.write(
                        self.style.SUCCESS(f'✅ Напоминание отправлено гиду {booking.guide.email} для бронирования #{booking.id}')
                    )
                else:
                    self.stdout.write(
                        self.style.WARNING(f'⚠️ Не удалось отправить напоминание гиду {booking.guide.email} для бронирования #{booking.id}')
                    )
                    
            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f'❌ Ошибка при отправке напоминания для бронирования #{booking.id}: {str(e)}')
                )
                logger.error(f"Error sending guide reminder for booking {booking.id}: {str(e)}", exc_info=True)
        
        self.stdout.write(
            self.style.SUCCESS(f'Готово! Отправлено напоминаний: {sent_count} из {count}')
        )
