from django.core.management.base import BaseCommand
from django.utils import timezone
from django.db.models import Q
from datetime import timedelta
from apps.bookings.models import Booking
from apps.bookings.services.telegram_service import TelegramService
from apps.bookings.services.max_service import MaxService
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Отправляет напоминания гидам и клиентам за 1 час до выхода в море'

    def handle(self, *args, **options):
        now = timezone.now()
        time_min = now
        time_max = now + timedelta(hours=3, minutes=15)

        self.stdout.write(f"Поиск бронирований с {time_min} до {time_max}")

        telegram_service = TelegramService()
        max_service = MaxService()
        total_sent = 0

        # === 1. Напоминания гидам (существующая логика) ===
        guide_bookings = Booking.objects.filter(
            status__in=[Booking.Status.PENDING, Booking.Status.CONFIRMED],
            guide__isnull=False,
        ).filter(
            Q(guide__telegram_chat_id__isnull=False) | Q(guide__max_chat_id__isnull=False)
        ).filter(
            start_datetime__gte=time_min,
            start_datetime__lte=time_max,
            guide_reminder_sent=False,
            remaining_amount__gt=0
        ).select_related('guide', 'boat')

        self.stdout.write(f"Напоминания гидам: найдено {guide_bookings.count()}")

        for booking in guide_bookings:
            try:
                time_until = booking.start_datetime - now
                hours = int(time_until.total_seconds() // 3600)
                minutes = int((time_until.total_seconds() % 3600) // 60)

                def format_price(amount):
                    if amount is None:
                        return "0"
                    return f"{amount:,.0f}".replace(',', ' ')

                message = f"""⏰ Напоминание: через {hours}ч {minutes}мин выход в море!

Катер: {booking.boat.name}
Количество людей: {booking.number_of_people}
Мероприятие: {booking.event_type}

💰 Остаток к оплате: {format_price(booking.remaining_amount)} ₽

Оплатите остаток за 1 час до выхода в море в личном кабинете в разделе «Бронирования»."""

                telegram_result = telegram_service.send_to_user(booking.guide, message)
                max_result = max_service.send_to_user(booking.guide, message)
                if telegram_result or max_result:
                    Booking.objects.filter(pk=booking.pk).update(guide_reminder_sent=True)
                    total_sent += 1
                    self.stdout.write(self.style.SUCCESS(
                        f'✅ Напоминание гиду {booking.guide.email} для бронирования #{booking.id}'
                    ))
                else:
                    self.stdout.write(self.style.WARNING(
                        f'⚠️ Не удалось отправить напоминание гиду {booking.guide.email} для #{booking.id}'
                    ))
            except Exception as e:
                self.stdout.write(self.style.ERROR(
                    f'❌ Ошибка напоминания гиду для #{booking.id}: {str(e)}'
                ))
                logger.error(f"Error sending guide reminder for booking {booking.id}: {str(e)}", exc_info=True)

        # === 2. Напоминания клиентам об оплате остатка (для индивидуальных выходов) ===
        from apps.boats.models import TripType

        client_bookings = Booking.objects.filter(
            status__in=[Booking.Status.PENDING, Booking.Status.CONFIRMED],
            trip_type=TripType.INDIVIDUAL,
            customer__isnull=False,
        ).filter(
            Q(customer__telegram_chat_id__isnull=False) | Q(customer__max_chat_id__isnull=False)
        ).filter(
            start_datetime__gte=time_min,
            start_datetime__lte=time_max,
            client_payment_reminder_sent=False,
            remaining_amount__gt=0
        ).select_related('customer', 'boat')

        self.stdout.write(f"Напоминания клиентам (чарт): найдено {client_bookings.count()}")

        for booking in client_bookings:
            try:
                time_until = booking.start_datetime - now
                hours = int(time_until.total_seconds() // 3600)
                minutes = int((time_until.total_seconds() % 3600) // 60)

                def format_price(amount):
                    if amount is None:
                        return "0"
                    return f"{amount:,.0f}".replace(',', ' ')

                message = f"""⏰ Напоминание: через {hours}ч {minutes}мин ваш индивидуальный выход!

Катер: {booking.boat.name}
Длительность: {booking.duration_hours} ч.

💰 Остаток к оплате (70%): {format_price(booking.remaining_amount)} ₽

Пожалуйста, оплатите остаток в личном кабинете в разделе «Бронирования»."""

                telegram_result = telegram_service.send_to_user(booking.customer, message)
                max_result = max_service.send_to_user(booking.customer, message)
                if telegram_result or max_result:
                    Booking.objects.filter(pk=booking.pk).update(client_payment_reminder_sent=True)
                    total_sent += 1
                    self.stdout.write(self.style.SUCCESS(
                        f'✅ Напоминание клиенту {booking.customer.email} для бронирования #{booking.id}'
                    ))
                else:
                    self.stdout.write(self.style.WARNING(
                        f'⚠️ Не удалось отправить напоминание клиенту {booking.customer.email} для #{booking.id}'
                    ))
            except Exception as e:
                self.stdout.write(self.style.ERROR(
                    f'❌ Ошибка напоминания клиенту для #{booking.id}: {str(e)}'
                ))
                logger.error(f"Error sending client reminder for booking {booking.id}: {str(e)}", exc_info=True)

        self.stdout.write(self.style.SUCCESS(f'Готово! Всего отправлено напоминаний: {total_sent}'))
