import logging

from django.conf import settings
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.bookings.services.max_service import MaxService

logger = logging.getLogger(__name__)


@method_decorator(csrf_exempt, name='dispatch')
class MaxWebhookView(APIView):
    """
    Webhook для обработки входящих сообщений от MAX-бота
    """

    permission_classes = [AllowAny]

    def post(self, request):
        try:
            payload = request.data
            logger.info("=== MAX webhook received ===")
            logger.debug(f"Payload: {payload}")

            event = payload.get('update') if isinstance(payload, dict) else None
            if not isinstance(event, dict):
                event = payload if isinstance(payload, dict) else {}

            message = self._extract_message(event)
            if not message:
                logger.info("No message in MAX payload, skipping")
                return Response({'ok': True})

            chat_id = self._extract_chat_id(message)
            text = self._extract_text(message).strip()
            chat_type = self._extract_chat_type(message)

            if not chat_id or not text:
                logger.warning(f"Missing chat_id or text in MAX payload: chat_id={chat_id}, text={text}")
                return Response({'ok': True})

            # Логика аналогична Telegram: обрабатываем только личные диалоги.
            if chat_type and chat_type != 'private':
                logger.info(f"Ignoring MAX non-private chat message (type={chat_type}, chat_id={chat_id})")
                return Response({'ok': True})

            if text.startswith('/start'):
                self._handle_start(chat_id)
                return Response({'ok': True})

            if '@' in text:
                self._handle_bind_email(chat_id, text)
                return Response({'ok': True})

            self._send_message(chat_id, "Для привязки аккаунта введите ваш email.")
            return Response({'ok': True})

        except Exception as exc:
            logger.error(f"Error processing MAX webhook: {exc}", exc_info=True)
            # Возвращаем ok, чтобы провайдер не зацикливался на ретраях из-за логических ошибок.
            return Response({'ok': True})

    @staticmethod
    def _extract_message(event):
        if not isinstance(event, dict):
            return None
        if isinstance(event.get('message'), dict):
            return event['message']
        if isinstance(event.get('payload'), dict) and isinstance(event['payload'].get('message'), dict):
            return event['payload']['message']
        return None

    @staticmethod
    def _extract_chat_id(message):
        if not isinstance(message, dict):
            return None
        if message.get('chat_id'):
            return message.get('chat_id')
        chat = message.get('chat') or {}
        if isinstance(chat, dict):
            return chat.get('chat_id') or chat.get('id')
        return None

    @staticmethod
    def _extract_chat_type(message):
        if not isinstance(message, dict):
            return ''
        if message.get('chat_type'):
            return str(message.get('chat_type')).lower()
        chat = message.get('chat') or {}
        if isinstance(chat, dict):
            value = chat.get('type') or chat.get('chat_type')
            return str(value).lower() if value else ''
        return ''

    @staticmethod
    def _extract_text(message):
        if not isinstance(message, dict):
            return ''
        if isinstance(message.get('text'), str):
            return message['text']
        body = message.get('body') or {}
        if isinstance(body, dict) and isinstance(body.get('text'), str):
            return body['text']
        return ''

    def _handle_start(self, chat_id):
        start_message = (
            "✉️ Привяжите почту:\n"
            "Отправьте мне email, который вы использовали на сайте.\n"
            "Например: ivan@mail.ru"
        )
        self._send_message(chat_id, start_message)

    def _handle_bind_email(self, chat_id, email):
        email = email.lower().strip()
        try:
            user = User.objects.filter(email__iexact=email).first()
            if not user:
                self._send_message(
                    chat_id,
                    f"Аккаунт с email {email} не найден. Проверьте правильность написания или зарегистрируйтесь на сайте."
                )
                return

            user.max_chat_id = chat_id
            user.save(update_fields=['max_chat_id'])
            self._send_message(
                chat_id,
                "✅ Аккаунт успешно привязан!\n\nТеперь вы будете получать уведомления о бронированиях и оплатах."
            )
        except Exception as exc:
            logger.error(f"Error binding MAX user: {exc}", exc_info=True)
            self._send_message(chat_id, "Произошла ошибка при привязке аккаунта. Попробуйте позже.")

    def _send_message(self, chat_id, text):
        bot_token = getattr(settings, 'MAX_BOT_TOKEN', '')
        if not bot_token:
            logger.warning("MAX_BOT_TOKEN not configured")
            return

        service = MaxService()
        service.send_to_chat_id(chat_id, text)
