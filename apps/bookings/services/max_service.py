import logging

import requests
from django.conf import settings

logger = logging.getLogger(__name__)


class MaxService:
    """Сервис отправки уведомлений в MAX (групповой чат и личные сообщения)."""

    BASE_URL = "https://platform-api.max.ru"

    def __init__(self):
        self.bot_token = getattr(settings, 'MAX_BOT_TOKEN', None)
        self.chat_id = getattr(settings, 'MAX_CHAT_ID', None)
        self.notification_chat_ids = getattr(settings, 'MAX_NOTIFICATION_CHAT_IDS', None) or []
        if isinstance(self.notification_chat_ids, str):
            self.notification_chat_ids = [x.strip() for x in self.notification_chat_ids.split(',') if x.strip()]

        if not self.bot_token:
            logger.warning("❌ MAX_BOT_TOKEN not configured")

    def _headers(self):
        return {
            'Authorization': self.bot_token or '',
            'Content-Type': 'application/json',
        }

    def send_to_chat_id(self, chat_id, text, text_format=None):
        if not self.bot_token:
            logger.warning("❌ MAX_BOT_TOKEN not configured, skipping message")
            return None

        if not chat_id:
            logger.warning("❌ MAX chat_id not provided, skipping message")
            return None

        payload_variants = [
            {'chat_id': str(chat_id), 'text': text},
            {'chatId': str(chat_id), 'text': text},
        ]
        if text_format:
            for payload in payload_variants:
                payload['format'] = text_format

        for payload in payload_variants:
            try:
                response = requests.post(
                    f"{self.BASE_URL}/messages",
                    json=payload,
                    headers=self._headers(),
                    timeout=10,
                )
                if response.status_code >= 400:
                    logger.warning(f"MAX API returned {response.status_code} for payload keys: {list(payload.keys())}")
                    continue

                try:
                    return response.json()
                except ValueError:
                    return {'ok': True, 'raw': response.text}
            except requests.exceptions.RequestException as exc:
                logger.error(f"❌ Error sending MAX message: {exc}", exc_info=True)

        return None

    def send_message(self, text, text_format='html'):
        if not self.chat_id:
            logger.warning("❌ MAX_CHAT_ID not configured, skipping group message")
            return None

        result = self.send_to_chat_id(self.chat_id, text, text_format=text_format)
        for chat_id in self.notification_chat_ids:
            if chat_id:
                self.send_to_chat_id(chat_id, text, text_format=text_format)
        return result

    def send_to_user(self, user, text, text_format=None):
        if not user:
            return None
        max_chat_id = getattr(user, 'max_chat_id', None)
        if not max_chat_id:
            return None
        return self.send_to_chat_id(max_chat_id, text, text_format=text_format)

    def send_booking_notification(self, booking):
        from apps.bookings.signals import _format_booking_message

        text = _format_booking_message(booking)
        return self.send_message(text, text_format=None)
