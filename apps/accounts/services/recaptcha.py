"""
Верификация Google reCAPTCHA v2.
Документация: https://developers.google.com/recaptcha/docs/verify
"""
import logging
import requests
from django.conf import settings

logger = logging.getLogger(__name__)
VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify'


def verify_recaptcha(token: str, remote_ip: str = None) -> tuple[bool, str]:
    """
    Проверяет токен reCAPTCHA.
    
    Returns:
        tuple: (success: bool, error_message: str)
    """
    secret = getattr(settings, 'RECAPTCHA_SECRET_KEY', None)
    if not secret or not secret.strip():
        logger.warning('RECAPTCHA_SECRET_KEY не настроен')
        if settings.DEBUG:
            return True, ''  # В режиме разработки пропускаем проверку
        return False, 'Защита от ботов не настроена'
    
    if not token or not token.strip():
        return False, 'Подтвердите, что вы не робот'
    
    payload = {
        'secret': secret,
        'response': token.strip(),
    }
    if remote_ip:
        payload['remoteip'] = remote_ip
    
    try:
        response = requests.post(VERIFY_URL, data=payload, timeout=5)
        response.raise_for_status()
        data = response.json()
        
        if data.get('success'):
            return True, ''
        
        error_codes = data.get('error-codes', [])
        logger.warning(f'reCAPTCHA ошибка: {error_codes}')
        
        if 'invalid-input-secret' in error_codes:
            return False, 'Неверный секретный ключ reCAPTCHA (RECAPTCHA_SECRET_KEY в .env)'
        if 'invalid-input-response' in error_codes:
            return False, 'Неверный ключ сайта или истёк токен. Проверьте VITE_RECAPTCHA_SITE_KEY (должен быть Site Key, не Secret!)'
        if 'timeout-or-duplicate' in error_codes:
            return False, 'Срок действия проверки истёк. Попробуйте снова.'
        if 'missing-input-secret' in error_codes:
            return False, 'Не настроен RECAPTCHA_SECRET_KEY'
        if 'missing-input-response' in error_codes:
            return False, 'Подтвердите, что вы не робот'
        return False, 'Проверка не пройдена. Попробуйте снова.'
        
    except requests.RequestException as e:
        logger.exception(f'Ошибка верификации reCAPTCHA: {e}')
        return False, 'Ошибка проверки. Попробуйте позже.'
