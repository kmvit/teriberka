# Диагностика проблем с отправкой почты

## Быстрая проверка

### 1. Проверьте переменные окружения

На сервере выполните:
```bash
cd /opt/teriberka
source venv/bin/activate
python check_email_config.py
```

Этот скрипт покажет:
- Какие переменные окружения установлены
- Какие настройки использует Django
- Позволит отправить тестовое письмо

### 2. Проверьте .env файл

Убедитесь, что в файле `.env` (в корне проекта) установлены следующие переменные:

```bash
EMAIL_HOST=smtp.gmail.com          # или другой SMTP сервер
EMAIL_PORT=587                      # или 465 для SSL
EMAIL_USE_TLS=True                  # True для порта 587
EMAIL_USE_SSL=False                 # True для порта 465
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password
```

**Важно для Gmail:**
- Используйте "Пароль приложения", а не обычный пароль
- Включите двухфакторную аутентификацию в аккаунте Google
- Создайте пароль приложения: https://myaccount.google.com/apppasswords

### 3. Просмотр логов Django

Логи Django теперь сохраняются в файл `logs/django.log`:

```bash
# Последние 50 строк логов
tail -n 50 logs/django.log

# Поиск ошибок отправки почты
grep -i "email\|mail" logs/django.log

# Поиск ошибок регистрации
grep -i "регистрац\|registration\|accounts" logs/django.log

# Мониторинг логов в реальном времени
tail -f logs/django.log
```

### 4. Просмотр логов Gunicorn

Логи Gunicorn находятся в:
```bash
# Логи ошибок
tail -f logs/gunicorn_error.log

# Логи доступа (если настроены)
tail -f logs/gunicorn_access.log
```

**Примечание:** Ошибки отправки почты могут не попадать в логи Gunicorn, если они происходят в отдельном потоке. Используйте `logs/django.log` для диагностики.

### 5. Проверка в реальном времени

При регистрации нового пользователя следите за логами:

```bash
# В одном терминале
tail -f logs/django.log | grep -i "email\|mail\|регистрац"

# В другом терминале выполните регистрацию
```

## Частые проблемы

### Проблема: EMAIL_HOST не установлен

**Симптомы:**
- Письма не отправляются
- В логах нет ошибок

**Решение:**
1. Установите `EMAIL_HOST` в `.env` файле
2. Перезапустите Gunicorn:
   ```bash
   sudo systemctl restart gunicorn
   # или
   supervisorctl restart gunicorn
   ```

### Проблема: Ошибка аутентификации

**Симптомы:**
- В логах: `SMTPAuthenticationError` или `535 Authentication failed`

**Решение:**
1. Проверьте правильность `EMAIL_HOST_USER` и `EMAIL_HOST_PASSWORD`
2. Для Gmail используйте пароль приложения, а не обычный пароль
3. Убедитесь, что двухфакторная аутентификация включена

### Проблема: Ошибка подключения

**Симптомы:**
- В логах: `Connection refused` или `Timeout`

**Решение:**
1. Проверьте, что порт не заблокирован файрволом:
   ```bash
   telnet smtp.gmail.com 587
   ```
2. Проверьте правильность `EMAIL_HOST` и `EMAIL_PORT`
3. Для порта 465 используйте `EMAIL_USE_SSL=True`
4. Для порта 587 используйте `EMAIL_USE_TLS=True`

### Проблема: Письма попадают в спам

**Решение:**
1. Настройте SPF, DKIM и DMARC записи для вашего домена
2. Используйте доменное имя в `DEFAULT_FROM_EMAIL` вместо Gmail
3. Проверьте репутацию IP-адреса сервера

## Тестирование отправки почты

### Через Django shell

```bash
cd /opt/teriberka
source venv/bin/activate
python manage.py shell
```

В shell:
```python
from django.core.mail import send_mail
from django.conf import settings

send_mail(
    subject='Тест',
    message='Тестовое сообщение',
    from_email=settings.DEFAULT_FROM_EMAIL,
    recipient_list=['your-email@example.com'],
    fail_silently=False,
)
```

### Через скрипт проверки

```bash
python check_email_config.py
```

## Настройка для разных провайдеров

### Gmail
```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_USE_SSL=False
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password
```

### Yandex
```env
EMAIL_HOST=smtp.yandex.ru
EMAIL_PORT=465
EMAIL_USE_TLS=False
EMAIL_USE_SSL=True
EMAIL_HOST_USER=your-email@yandex.ru
EMAIL_HOST_PASSWORD=your-password
```

### Mail.ru
```env
EMAIL_HOST=smtp.mail.ru
EMAIL_PORT=465
EMAIL_USE_TLS=False
EMAIL_USE_SSL=True
EMAIL_HOST_USER=your-email@mail.ru
EMAIL_HOST_PASSWORD=your-password
```

## Мониторинг

Для постоянного мониторинга ошибок отправки почты можно настроить:

```bash
# Создать скрипт для мониторинга
cat > /opt/teriberka/monitor_email_errors.sh << 'EOF'
#!/bin/bash
tail -f /opt/teriberka/logs/django.log | grep --line-buffered -i "ошибка отправки email\|error.*email\|mail.*error"
EOF

chmod +x /opt/teriberka/monitor_email_errors.sh
```

## Полезные команды

```bash
# Проверить, запущен ли Gunicorn
ps aux | grep gunicorn

# Перезапустить Gunicorn
sudo systemctl restart gunicorn
# или
supervisorctl restart gunicorn

# Посмотреть последние ошибки
tail -n 100 logs/django.log | grep -i error

# Очистить старые логи (оставить последние 1000 строк)
tail -n 1000 logs/django.log > logs/django.log.tmp
mv logs/django.log.tmp logs/django.log
```
