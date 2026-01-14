#!/usr/bin/env python
"""
Скрипт для проверки настроек Т-Банка
Запуск: python check_tbank_config.py
"""

import os
import sys
import django
from pathlib import Path

# Настраиваем Django
BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.conf import settings
from dotenv import load_dotenv

# Загружаем .env
load_dotenv()

print("=" * 60)
print("ПРОВЕРКА НАСТРОЕК Т-БАНКА")
print("=" * 60)

# Проверяем переменные окружения
print("\n1. Переменные окружения из .env:")
print("-" * 60)

env_vars = {
    'TBANK_TERMINAL_KEY': os.getenv('TBANK_TERMINAL_KEY'),
    'TBANK_PASSWORD': os.getenv('TBANK_PASSWORD'),
    'TBANK_API_URL': os.getenv('TBANK_API_URL'),
    'BACKEND_URL': os.getenv('BACKEND_URL'),
    'TBANK_NOTIFICATION_URL': os.getenv('TBANK_NOTIFICATION_URL'),
    'PAYMENT_SUCCESS_URL': os.getenv('PAYMENT_SUCCESS_URL'),
    'PAYMENT_FAIL_URL': os.getenv('PAYMENT_FAIL_URL'),
}

all_ok = True
for key, value in env_vars.items():
    if value:
        # Маскируем пароль
        if 'PASSWORD' in key and value:
            display_value = value[:4] + '*' * (len(value) - 4)
        else:
            display_value = value
        print(f"✅ {key}: {display_value}")
    else:
        print(f"❌ {key}: НЕ НАЙДЕН")
        all_ok = False

# Проверяем настройки Django
print("\n2. Настройки Django (settings.py):")
print("-" * 60)

django_settings = {
    'TBANK_TERMINAL_KEY': settings.TBANK_TERMINAL_KEY,
    'TBANK_PASSWORD': settings.TBANK_PASSWORD,
    'TBANK_API_URL': settings.TBANK_API_URL,
    'TBANK_NOTIFICATION_URL': settings.TBANK_NOTIFICATION_URL,
    'PAYMENT_SUCCESS_URL': settings.PAYMENT_SUCCESS_URL,
    'PAYMENT_FAIL_URL': settings.PAYMENT_FAIL_URL,
}

for key, value in django_settings.items():
    if value:
        # Маскируем пароль
        if 'PASSWORD' in key and value:
            display_value = value[:4] + '*' * (len(value) - 4)
        else:
            display_value = value
        print(f"✅ {key}: {display_value}")
    else:
        print(f"❌ {key}: ПУСТОЕ ЗНАЧЕНИЕ")
        all_ok = False

# Проверяем TBankService
print("\n3. Проверка TBankService:")
print("-" * 60)

try:
    from apps.payments.services import TBankService
    
    service = TBankService()
    print(f"✅ TBankService создан успешно")
    print(f"   Terminal Key: {service.terminal_key[:10]}..." if service.terminal_key else "❌ Terminal Key пустой")
    print(f"   Password: {'*' * 10}" if service.password else "❌ Password пустой")
    print(f"   API URL: {service.api_url}")
    print(f"   Notification URL: {service.notification_url}")
except Exception as e:
    print(f"❌ Ошибка при создании TBankService: {e}")
    all_ok = False

# Итог
print("\n" + "=" * 60)
if all_ok:
    print("✅ ВСЕ НАСТРОЙКИ В ПОРЯДКЕ!")
    print("\nМожете попробовать создать бронирование.")
    print("Следите за логами в консоли Django для отладки.")
else:
    print("❌ ЕСТЬ ПРОБЛЕМЫ С НАСТРОЙКАМИ!")
    print("\nЧто делать:")
    print("1. Проверьте файл .env в корне проекта")
    print("2. Убедитесь что все переменные заполнены")
    print("3. Перезапустите Django сервер после изменений")
    print("\nСмотрите DEBUG_TBANK.md для подробной инструкции")

print("=" * 60)

# Проверка доступности API
print("\n4. Проверка доступности API Т-Банка:")
print("-" * 60)

try:
    import requests
    response = requests.get(settings.TBANK_API_URL.replace('/v2', ''), timeout=5)
    print(f"✅ API доступен (status: {response.status_code})")
except Exception as e:
    print(f"⚠️  Не удалось проверить API: {e}")
    print("   Это нормально, если у вас нет интернета или API временно недоступен")

print("=" * 60)
