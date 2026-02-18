import requests
import logging
from django.conf import settings

logger = logging.getLogger(__name__)


class TelegramService:
    """Сервис для отправки уведомлений в Telegram (канал/группа и личные сообщения)"""
    
    BASE_URL = "https://api.telegram.org/bot"
    
    def __init__(self):
        self.bot_token = getattr(settings, 'TELEGRAM_BOT_TOKEN', None)
        self.channel_id = getattr(settings, 'TELEGRAM_CHANNEL_ID', None)  # Может быть ID канала или группы
        
        logger.info(f"=== TelegramService initialized ===")
        logger.info(f"Bot token configured: {bool(self.bot_token)}")
        logger.info(f"Bot token length: {len(self.bot_token) if self.bot_token else 0}")
        logger.info(f"Channel/Group ID: {self.channel_id}")
        logger.info(f"Channel/Group ID configured: {bool(self.channel_id)}")
        
        if not self.bot_token:
            logger.warning("❌ TELEGRAM_BOT_TOKEN not configured")
        if not self.channel_id:
            logger.warning("❌ TELEGRAM_CHANNEL_ID not configured")
    
    def _send_to_chat_id(self, chat_id, text, parse_mode=None, disable_notification=False):
        """
        Базовый метод отправки сообщения в конкретный чат
        
        Args:
            chat_id: ID чата (канал, группа или личный чат)
            text: Текст сообщения
            parse_mode: 'HTML' или 'Markdown' (или None для простого текста)
            disable_notification: Отключить уведомление (по умолчанию False)
        
        Returns:
            dict: Результат отправки или None в случае ошибки
        """
        if not self.bot_token:
            logger.warning("❌ TELEGRAM_BOT_TOKEN not configured, skipping message")
            return None
        
        if not chat_id:
            logger.warning("❌ chat_id not provided, skipping message")
            return None
        
        url = f"{self.BASE_URL}{self.bot_token}/sendMessage"
        
        payload = {
            'chat_id': chat_id,
            'text': text,
            'disable_notification': disable_notification
        }
        
        if parse_mode:
            payload['parse_mode'] = parse_mode
        
        logger.debug(f"Sending to chat_id={chat_id}, text_length={len(text)}, parse_mode={parse_mode}")
        
        try:
            response = requests.post(url, json=payload, timeout=10)
            response.raise_for_status()
            result = response.json()
            
            if result.get('ok'):
                logger.info(f"✅ Telegram message sent successfully to chat_id={chat_id}")
                return result
            else:
                error_description = result.get('description', 'Unknown error')
                error_code = result.get('error_code', 'N/A')
                logger.error(f"❌ Telegram API error: {error_description} (code: {error_code})")
                return None
                
        except requests.exceptions.Timeout as e:
            logger.error(f"❌ Telegram API timeout: {str(e)}")
            return None
        except requests.exceptions.HTTPError as e:
            logger.error(f"❌ Telegram API HTTP error: {str(e)}")
            return None
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Error sending Telegram message: {str(e)}", exc_info=True)
            return None
    
    def send_message(self, text, parse_mode='HTML', disable_notification=False):
        """
        Отправка сообщения в Telegram канал/группу (для обратной совместимости)
        
        Args:
            text: Текст сообщения
            parse_mode: 'HTML' или 'Markdown' (или None для простого текста)
            disable_notification: Отключить уведомление (по умолчанию False)
        
        Returns:
            dict: Результат отправки или None в случае ошибки
        """
        logger.info(f"=== send_message to channel called ===")
        
        if not self.channel_id:
            logger.warning("❌ TELEGRAM_CHANNEL_ID not configured, skipping message")
            return None
        
        return self._send_to_chat_id(self.channel_id, text, parse_mode, disable_notification)
    
    def send_to_user(self, user, text, parse_mode=None, disable_notification=False):
        """
        Отправка личного сообщения пользователю
        
        Args:
            user: Объект User с заполненным telegram_chat_id
            text: Текст сообщения
            parse_mode: 'HTML' или 'Markdown' (или None для простого текста)
            disable_notification: Отключить уведомление (по умолчанию False)
        
        Returns:
            dict: Результат отправки или None в случае ошибки
        """
        if not user:
            logger.warning("❌ User is None, skipping personal message")
            return None
        
        telegram_chat_id = getattr(user, 'telegram_chat_id', None)
        if not telegram_chat_id:
            logger.info(f"⏭️ User {user.email} has no telegram_chat_id, skipping personal message")
            return None
        
        logger.info(f"=== Sending personal message to user {user.email} (chat_id={telegram_chat_id}) ===")
        return self._send_to_chat_id(telegram_chat_id, text, parse_mode, disable_notification)
    
    def send_booking_notification(self, booking):
        """
        Отправка уведомления о новом бронировании в формате:
        
        Дата и время: 16 января с 12:00 до 14:00
        Мероприятие: Выход в море на поиски китов 
        Количество людей: 1
        Длительность: 2
        Катер: Владислава
        Ставка 1 человека: 3 500 ₽
        Общая стоимость: 3 500 ₽
        Внесена предоплата: 3 500 ₽
        Имя гостя: Яо
        Контактный телефон: +7 925 380 5678 тг
        
        Остаток: - ₽ при посадке на катер безналичным расчетом, перед выходом в море🐋
        
        Args:
            booking: Объект Booking
        """
        logger.info(f"=== send_booking_notification called for booking #{booking.id} ===")
        logger.info(f"Booking details: guest={booking.guest_name}, boat={booking.boat.name}, status={booking.status}, deposit={booking.deposit}")
        
        from decimal import Decimal
        
        # Форматируем дату и время на русском языке
        months_ru = {
            1: 'января', 2: 'февраля', 3: 'марта', 4: 'апреля',
            5: 'мая', 6: 'июня', 7: 'июля', 8: 'августа',
            9: 'сентября', 10: 'октября', 11: 'ноября', 12: 'декабря'
        }
        day = booking.start_datetime.day
        month = months_ru[booking.start_datetime.month]
        start_date = f"{day} {month}"
        
        start_time = booking.start_datetime.strftime('%H:%M')
        end_time = booking.end_datetime.strftime('%H:%M')
        
        # Форматируем суммы с пробелами для тысяч
        def format_price(amount):
            """Форматирует цену с пробелами для тысяч"""
            if amount is None:
                return "0"
            return f"{amount:,.0f}".replace(',', ' ')
        
        # Формируем строку остатка
        if booking.remaining_amount and booking.remaining_amount > 0:
            remaining_text = f"{format_price(booking.remaining_amount)} ₽ при посадке на катер безналичным расчетом, перед выходом в море🐋"
        else:
            remaining_text = "- ₽ при посадке на катер безналичным расчетом, перед выходом в море🐋"
        
        # Формируем сообщение в нужном формате
        message = f"""Дата и время: {start_date} с {start_time} до {end_time}
Мероприятие: {booking.event_type}
Количество людей: {booking.number_of_people}
Длительность: {booking.duration_hours}
Катер: {booking.boat.name}
Ставка 1 человека: {format_price(booking.price_per_person)} ₽
Общая стоимость: {format_price(booking.total_price)} ₽
Внесена предоплата: {format_price(booking.deposit)} ₽
Имя гостя: {booking.guest_name}
Контактный телефон: {booking.guest_phone}

Остаток: {remaining_text}"""
        
        logger.info(f"Formatted message for booking #{booking.id}")
        logger.debug(f"Full message: {message}")
        
        result = self.send_message(message, parse_mode=None)  # Без HTML разметки, простой текст
        
        if result:
            logger.info(f"✅ Booking notification sent successfully for booking #{booking.id}")
        else:
            logger.error(f"❌ Failed to send booking notification for booking #{booking.id}")
        
        return result
    
    def send_payment_confirmed_notification(self, booking):
        """
        Отправка уведомления о полной оплате бронирования
        Использует тот же формат, что и при создании
        
        Args:
            booking: Объект Booking
        """
        return self.send_booking_notification(booking)
