import logging
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from apps.accounts.models import User

logger = logging.getLogger(__name__)


@method_decorator(csrf_exempt, name='dispatch')
class TelegramWebhookView(APIView):
    """
    Webhook для обработки входящих сообщений от Telegram бота
    """
    permission_classes = [AllowAny]
    
    def post(self, request):
        """
        Обработка webhook от Telegram
        
        Формат payload:
        {
            "update_id": 123456789,
            "message": {
                "message_id": 1,
                "from": {"id": 123456, "first_name": "John", ...},
                "chat": {"id": 123456, "type": "private", ...},
                "text": "/start" или "user@example.com"
            }
        }
        """
        try:
            data = request.data
            logger.info(f"=== Telegram webhook received ===")
            logger.debug(f"Payload: {data}")
            
            # Проверяем наличие message
            if 'message' not in data:
                logger.warning("No 'message' in webhook payload")
                return Response({'ok': True})
            
            message = data['message']
            chat_id = message.get('chat', {}).get('id')
            text = message.get('text', '').strip()
            
            if not chat_id or not text:
                logger.warning(f"Missing chat_id or text: chat_id={chat_id}, text={text}")
                return Response({'ok': True})
            
            logger.info(f"Message from chat_id={chat_id}: {text}")
            
            # Обработка команды /start
            if text.startswith('/start'):
                self._handle_start(chat_id)
                return Response({'ok': True})
            
            # Попытка привязки по email
            if '@' in text:
                self._handle_bind_email(chat_id, text)
                return Response({'ok': True})
            
            # Неизвестная команда
            self._send_message(chat_id, "Для привязки аккаунта введите ваш email.")
            return Response({'ok': True})
            
        except Exception as e:
            logger.error(f"Error processing Telegram webhook: {str(e)}", exc_info=True)
            return Response({'ok': True})  # Всегда возвращаем ok, чтобы Telegram не повторял запрос
    
    def _handle_start(self, chat_id):
        """Обработка команды /start"""
        welcome_message = (
            "Добро пожаловать в Teriberka!\n\n"
            "Для привязки аккаунта введите ваш email, который вы использовали при регистрации на сайте."
        )
        self._send_message(chat_id, welcome_message)
        logger.info(f"Sent welcome message to chat_id={chat_id}")
    
    def _handle_bind_email(self, chat_id, email):
        """Попытка привязки аккаунта по email"""
        email = email.lower().strip()
        
        try:
            # Ищем пользователя по email (регистронезависимый поиск)
            user = User.objects.filter(email__iexact=email).first()
            
            if not user:
                logger.info(f"User with email {email} not found")
                self._send_message(
                    chat_id,
                    f"Аккаунт с email {email} не найден. Проверьте правильность написания или зарегистрируйтесь на сайте."
                )
                return
            
            # Привязываем telegram_chat_id
            user.telegram_chat_id = chat_id
            user.save()
            
            logger.info(f"✅ User {user.email} successfully linked to chat_id={chat_id}")
            
            self._send_message(
                chat_id,
                f"✅ Аккаунт успешно привязан!\n\nТеперь вы будете получать уведомления о бронированиях и оплатах."
            )
            
        except Exception as e:
            logger.error(f"Error binding user: {str(e)}", exc_info=True)
            self._send_message(
                chat_id,
                "Произошла ошибка при привязке аккаунта. Попробуйте позже."
            )
    
    def _send_message(self, chat_id, text):
        """
        Отправка сообщения напрямую через Telegram API (без использования TelegramService)
        Это нужно, чтобы не дублировать сообщения в канал
        """
        try:
            import requests
            from django.conf import settings
            
            bot_token = getattr(settings, 'TELEGRAM_BOT_TOKEN', None)
            if not bot_token:
                logger.warning("TELEGRAM_BOT_TOKEN not configured")
                return
            
            url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
            payload = {
                'chat_id': chat_id,
                'text': text
            }
            
            response = requests.post(url, json=payload, timeout=10)
            response.raise_for_status()
            result = response.json()
            
            if result.get('ok'):
                logger.info(f"Message sent to chat_id={chat_id}")
            else:
                logger.error(f"Telegram API error: {result.get('description', 'Unknown error')}")
                
        except Exception as e:
            logger.error(f"Error sending message to chat_id={chat_id}: {str(e)}", exc_info=True)
