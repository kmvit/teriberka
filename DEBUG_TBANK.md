# Отладка интеграции Т-Банка

## Проблема: "Неверные параметры" (код 204)

Эта ошибка обычно означает одно из:
1. Неправильные или пустые ключи (TerminalKey, Password)
2. Неверный формат данных запроса
3. Неправильно сгенерирован токен

## Шаг 1: Проверьте .env файл

Убедитесь, что в вашем `.env` файле правильно указаны все переменные:

```bash
# Обязательные параметры
TBANK_TERMINAL_KEY=ваш_реальный_ключ_терминала
TBANK_PASSWORD=ваш_реальный_пароль

# Для локальной разработки используйте тестовый API
TBANK_API_URL=https://rest-api-test.tinkoff.ru/v2

# Backend URL (ваш ngrok URL)
BACKEND_URL=https://ваш-ngrok-id.ngrok.io

# Frontend URLs (обычно localhost при разработке)
PAYMENT_SUCCESS_URL=http://localhost:3000/payment/success
PAYMENT_FAIL_URL=http://localhost:3000/payment/fail
```

## Шаг 2: Перезапустите Django

После изменения .env ОБЯЗАТЕЛЬНО перезапустите сервер:

```bash
# Остановите текущий сервер (Ctrl+C)
# Затем запустите снова
python manage.py runserver
```

## Шаг 3: Проверьте логи

После попытки создания бронирования смотрите в консоль Django. Должны быть такие строки:

```
Making request to T-Bank API: Init
Request data: {'Amount': 100000, 'OrderId': 'booking_1_deposit_1234567890', ...}
Response status: 200
Response text: {"Success": true, "PaymentId": "12345", ...}
```

Если видите:
```
Response text: {"Success": false, "ErrorCode": "204", "Message": "Неверные параметры", ...}
```

То проблема в одном из параметров.

## Шаг 4: Проверьте ключи программно

Создайте временный скрипт для проверки:

```python
# test_tbank.py
import os
from dotenv import load_dotenv

load_dotenv()

print("TBANK_TERMINAL_KEY:", os.getenv('TBANK_TERMINAL_KEY', 'НЕ НАЙДЕН'))
print("TBANK_PASSWORD:", os.getenv('TBANK_PASSWORD', 'НЕ НАЙДЕН'))
print("TBANK_API_URL:", os.getenv('TBANK_API_URL', 'НЕ НАЙДЕН'))
print("BACKEND_URL:", os.getenv('BACKEND_URL', 'НЕ НАЙДЕН'))
```

Запустите:
```bash
python test_tbank.py
```

Если какой-то из ключей показывает "НЕ НАЙДЕН" - значит проблема в .env файле.

## Шаг 5: Проверьте формат ключей

Убедитесь что:
- В ключах нет лишних пробелов
- Нет кавычек вокруг значений в .env
- Файл .env находится в корне проекта (рядом с manage.py)

Правильно:
```bash
TBANK_TERMINAL_KEY=1234567890TestKey
TBANK_PASSWORD=test_password_123
```

Неправильно:
```bash
TBANK_TERMINAL_KEY = "1234567890TestKey"  # Лишние пробелы и кавычки
TBANK_PASSWORD='test_password_123'        # Лишние кавычки
```

## Шаг 6: Тестовые данные Т-Банка

Для локального тестирования получите тестовые ключи:
1. Зарегистрируйтесь в тестовой среде Т-Банка
2. Получите тестовый TerminalKey и Password
3. Используйте тестовый API: `https://rest-api-test.tinkoff.ru/v2`

## Частые ошибки

### "ModuleNotFoundError: dotenv"
```bash
pip install python-dotenv
```

### Изменения в .env не применяются
- Перезапустите Django сервер
- Убедитесь что .env файл в правильном месте
- Проверьте что в settings.py есть `load_dotenv()`

### Webhook не приходят
- Убедитесь что ngrok запущен
- BACKEND_URL должен быть ngrok URL: `https://abc123.ngrok.io`
- НЕ используйте localhost в BACKEND_URL - Т-Банк не сможет до него достучаться

### "Invalid signature" в webhook
- Проверьте что TBANK_PASSWORD правильный
- Убедитесь что webhook endpoint не изменяет данные

## Проверка API вручную

Можете протестировать API Т-Банка напрямую:

```python
import requests
import hashlib

# Ваши данные
terminal_key = "YOUR_TERMINAL_KEY"
password = "YOUR_PASSWORD"

# Данные платежа
data = {
    'TerminalKey': terminal_key,
    'Amount': 100000,  # 1000 руб в копейках
    'OrderId': 'test_order_123',
    'Description': 'Тестовый платеж'
}

# Генерация токена
token_data = data.copy()
token_data['Password'] = password
sorted_values = [str(token_data[key]) for key in sorted(token_data.keys())]
concatenated = ''.join(sorted_values)
token = hashlib.sha256(concatenated.encode('utf-8')).hexdigest()

data['Token'] = token

# Запрос
response = requests.post(
    'https://rest-api-test.tinkoff.ru/v2/Init',
    json=data
)

print("Status:", response.status_code)
print("Response:", response.json())
```

Если этот скрипт работает - значит проблема в Django настройках.
Если не работает - проблема в ключах или доступе к API.

## Поддержка

Если ничего не помогло:
- Проверьте документацию: https://developer.tbank.ru/eacq/intro/
- Свяжитесь с поддержкой Т-Банка: openapi@tbank.ru
- Проверьте статус API: https://status.tbank.ru/
