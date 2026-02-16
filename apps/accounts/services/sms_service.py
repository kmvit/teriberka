"""
Сервис отправки SMS через sms.ru API.
Документация: https://sms.ru/api
"""
import logging
import re
import requests
from django.conf import settings

logger = logging.getLogger(__name__)

SMS_RU_API_URL = 'https://sms.ru/sms/send'


def normalize_phone(phone: str) -> str:
    """Приводит номер телефона к формату 79XXXXXXXXX для sms.ru"""
    digits = re.sub(r'\D', '', str(phone))
    if digits.startswith('8'):
        digits = '7' + digits[1:]
    elif digits.startswith('7'):
        pass
    else:
        digits = '7' + digits
    return digits[:11]


def send_sms(phone: str, message: str) -> tuple[bool, str]:
    """
    Отправляет SMS через sms.ru.
    
    Returns:
        tuple: (success: bool, error_message: str)
    """
    api_id = getattr(settings, 'SMS_RU_API_ID', None)
    if not api_id:
        logger.warning('SMS_RU_API_ID не настроен. SMS не будет отправлена.')
        if settings.DEBUG:
            logger.info(f'[DEBUG] Имитация SMS на {phone}: {message}')
            return True, ''
        return False, 'Сервис SMS не настроен'
    
    normalized_phone = normalize_phone(phone)
    if len(normalized_phone) != 11:
        return False, 'Неверный формат номера телефона'
    
    # В режиме тестирования sms.ru поддерживает test=1
    test_mode = getattr(settings, 'SMS_RU_TEST', False)
    
    payload = {
        'api_id': api_id,
        'to': normalized_phone,
        'msg': message,
        'json': 1,
    }
    if test_mode:
        payload['test'] = 1
    
    try:
        response = requests.post(
            SMS_RU_API_URL,
            data=payload,
            timeout=10,
        )
        response.raise_for_status()
        data = response.json()
        
        if data.get('status') == 'OK':
            sms_data = data.get('sms', {}).get(normalized_phone, {})
            if sms_data.get('status') == 'OK':
                logger.info(f'SMS успешно отправлена на {normalized_phone}')
                return True, ''
            else:
                error_text = sms_data.get('status_text', 'Неизвестная ошибка')
                logger.error(f'Ошибка sms.ru для {normalized_phone}: {error_text}')
                return False, error_text
        else:
            error_text = data.get('status_text', 'Неизвестная ошибка')
            logger.error(f'Ошибка sms.ru: {error_text}')
            return False, error_text
            
    except requests.RequestException as e:
        logger.exception(f'Ошибка при отправке SMS: {e}')
        return False, 'Ошибка при отправке SMS. Попробуйте позже.'
