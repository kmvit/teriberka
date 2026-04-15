import requests
from django.conf import settings
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Подписывает MAX-бота на webhook-обновления'

    def handle(self, *args, **options):
        bot_token = getattr(settings, 'MAX_BOT_TOKEN', None)
        webhook_url = getattr(settings, 'MAX_WEBHOOK_URL', None)

        if not bot_token:
            self.stdout.write(self.style.ERROR('❌ MAX_BOT_TOKEN не настроен в settings'))
            return

        if not webhook_url:
            self.stdout.write(self.style.ERROR('❌ MAX_WEBHOOK_URL не настроен в settings'))
            return

        url = "https://platform-api.max.ru/subscriptions"
        headers = {
            'Authorization': bot_token,
            'Content-Type': 'application/json',
        }
        payload = {
            'url': webhook_url,
        }

        self.stdout.write(f"Устанавливаем MAX webhook: {webhook_url}")
        try:
            response = requests.post(url, json=payload, headers=headers, timeout=15)
            response.raise_for_status()
            self.stdout.write(self.style.SUCCESS('✅ Подписка на MAX webhook успешно установлена'))
            self.stdout.write(f"Ответ: {response.text}")
        except requests.exceptions.RequestException as exc:
            self.stdout.write(self.style.ERROR(f'❌ Ошибка при установке MAX webhook: {exc}'))
