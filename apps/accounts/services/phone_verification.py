"""
Хранение и проверка кодов подтверждения по телефону.
Использует Django cache с TTL.
"""
import random
import string
import logging
import time
from django.core.cache import cache
from .sms_service import normalize_phone, send_sms

logger = logging.getLogger(__name__)

CODE_LENGTH = 6
CACHE_PREFIX = 'phone_verification_'
CACHE_TIMEOUT = 300  # 5 минут
RESEND_COOLDOWN = 60  # секунд до повторной отправки


def generate_code() -> str:
    """Генерирует 6-значный цифровой код"""
    return ''.join(random.choices(string.digits, k=CODE_LENGTH))


def _cache_key(phone: str) -> str:
    return f'{CACHE_PREFIX}{normalize_phone(phone)}'


def store_code(phone: str) -> str:
    """Сохраняет код в кеш, возвращает сгенерированный код"""
    normalized = normalize_phone(phone)
    code = generate_code()
    cache.set(_cache_key(phone), code, CACHE_TIMEOUT)
    return code


def verify_code(phone: str, code: str) -> bool:
    """Проверяет код. При успехе удаляет код из кеша (одноразовое использование)."""
    cached = cache.get(_cache_key(phone))
    if cached and cached == code:
        cache.delete(_cache_key(phone))
        return True
    return False


def get_cooldown_remaining(phone: str) -> int:
    """Возвращает секунды до возможности повторной отправки. 0 если можно отправить."""
    key = f'{CACHE_PREFIX}cooldown_{normalize_phone(phone)}'
    expiry = cache.get(key)
    if expiry is None:
        return 0
    return max(0, int(expiry - time.time()))


def set_cooldown(phone: str) -> None:
    """Устанавливает кулдаун на повторную отправку"""
    key = f'{CACHE_PREFIX}cooldown_{normalize_phone(phone)}'
    cache.set(key, time.time() + RESEND_COOLDOWN, RESEND_COOLDOWN + 10)


def send_verification_code(phone: str) -> tuple[bool, str]:
    """
    Генерирует код, сохраняет в кеш, отправляет SMS.
    Returns: (success, error_message)
    """
    if get_cooldown_remaining(phone) > 0:
        return False, f'Подождите {get_cooldown_remaining(phone)} сек. перед повторной отправкой'
    
    normalized = normalize_phone(phone)
    if len(normalized) != 11:
        return False, 'Неверный формат номера телефона'
    
    code = store_code(phone)
    message = f'Код подтверждения Teriberka: {code}'
    
    success, error = send_sms(phone, message)
    if success:
        set_cooldown(phone)
    else:
        cache.delete(_cache_key(phone))
    
    return success, error
