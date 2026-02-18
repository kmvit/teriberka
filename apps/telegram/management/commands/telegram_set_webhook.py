import requests
from django.core.management.base import BaseCommand
from django.conf import settings


class Command(BaseCommand):
    help = 'Устанавливает webhook для Telegram бота'

    def handle(self, *args, **options):
        bot_token = getattr(settings, 'TELEGRAM_BOT_TOKEN', None)
        webhook_url = getattr(settings, 'TELEGRAM_WEBHOOK_URL', None)
        
        if not bot_token:
            self.stdout.write(self.style.ERROR('❌ TELEGRAM_BOT_TOKEN не настроен в settings'))
            return
        
        if not webhook_url:
            self.stdout.write(self.style.ERROR('❌ TELEGRAM_WEBHOOK_URL не настроен в settings'))
            return
        
        # URL для установки webhook
        url = f"https://api.telegram.org/bot{bot_token}/setWebhook"
        
        # Параметры
        payload = {
            'url': webhook_url,
            'allowed_updates': ['message']  # Получаем только сообщения
        }
        
        self.stdout.write(f"Устанавливаем webhook: {webhook_url}")
        
        try:
            response = requests.post(url, json=payload, timeout=10)
            response.raise_for_status()
            result = response.json()
            
            if result.get('ok'):
                self.stdout.write(self.style.SUCCESS(f'✅ Webhook успешно установлен: {webhook_url}'))
                self.stdout.write(f"Описание: {result.get('description', 'N/A')}")
            else:
                error_description = result.get('description', 'Unknown error')
                self.stdout.write(self.style.ERROR(f'❌ Ошибка: {error_description}'))
                
        except requests.exceptions.RequestException as e:
            self.stdout.write(self.style.ERROR(f'❌ Ошибка при установке webhook: {str(e)}'))
