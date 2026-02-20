import requests
from django.core.management.base import BaseCommand
from django.conf import settings

# Полное приветственное сообщение (показывается ДО нажатия кнопки Start в Telegram)
BOT_DESCRIPTION = (
    "👋 Добро пожаловать в бот SeaTeribas!\n"
    "Я буду держать вас в курсе всех событий по вашим бронированиям.\n"
    "📌 Что я умею:\n"
    "• Мгновенно сообщать о новой брони\n"
    "• Присылать уведомления об оплате\n"
    "• Напоминать о прогулке за 3 часа\n"
    "• Предупреждать об изменениях (погода, отмена)\n"
    "✉️ Привяжите почту:\n"
    "Отправьте мне email, который вы использовали на сайте.\n"
    "Например: ivan@mail.ru\n"
    "✅ После этого вы начнёте получать уведомления.\n"
    "Если захотите отписаться — отправьте команду /stop"
)


class Command(BaseCommand):
    help = 'Устанавливает описание бота (текст до нажатия Start)'

    def handle(self, *args, **options):
        bot_token = getattr(settings, 'TELEGRAM_BOT_TOKEN', None)

        if not bot_token:
            self.stdout.write(self.style.ERROR('❌ TELEGRAM_BOT_TOKEN не настроен в settings'))
            return

        url = f"https://api.telegram.org/bot{bot_token}/setMyDescription"

        payload = {
            'description': BOT_DESCRIPTION
        }

        self.stdout.write('Устанавливаем описание бота...')

        try:
            response = requests.post(url, json=payload, timeout=10)
            response.raise_for_status()
            result = response.json()

            if result.get('ok'):
                self.stdout.write(self.style.SUCCESS('✅ Описание бота успешно установлено'))
            else:
                error_description = result.get('description', 'Unknown error')
                self.stdout.write(self.style.ERROR(f'❌ Ошибка: {error_description}'))

        except requests.exceptions.RequestException as e:
            self.stdout.write(self.style.ERROR(f'❌ Ошибка: {str(e)}'))
