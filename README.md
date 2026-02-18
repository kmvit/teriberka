# Сервис бронирования катеров на Териберке

Django проект для бронирования катеров с API и админкой.

## Структура проекта

```
teriberka/
├── apps/
│   ├── accounts/      # Пользователи и роли
│   ├── boats/         # Катера и расписание доступности
│   └── bookings/      # Бронирования
├── config/            # Настройки Django
├── frontend/          # React приложение
│   ├── src/
│   │   ├── pages/     # Страницы приложения
│   │   ├── services/  # API сервисы
│   │   └── styles/    # CSS стили
│   └── package.json
├── manage.py
└── requirements.txt
```

## Установка

1. Создайте виртуальное окружение:
```bash
python3 -m venv venv
source venv/bin/activate  # На Windows: venv\Scripts\activate
```

2. Установите зависимости:
```bash
pip install -r requirements.txt
```

3. Примените миграции:
```bash
python manage.py migrate
```

4. Создайте суперпользователя:
```bash
python manage.py createsuperuser
```

5. Запустите сервер:
```bash
python manage.py runserver
```

Админка будет доступна по адресу: http://127.0.0.1:8000/admin/

## Frontend (React)

1. Перейдите в папку frontend:
```bash
cd frontend
```

2. Установите зависимости:
```bash
npm install
```

3. Запустите dev сервер:
```bash
npm run dev
```

Frontend будет доступен по адресу: http://localhost:3000

**Примечание:** Убедитесь, что Django сервер запущен на порту 8000, так как frontend обращается к API по адресу http://localhost:8000/api

## Модели

### User (Пользователь)
- Роли: Клиент, Владелец катера, Гид
- Телефон, email, имя

### Boat (Катер)
- Название, владелец, вместимость
- Базовая ставка за человека
- Фото, описание

### BoatAvailability (Расписание доступности)
- День недели или конкретная дата
- Время начала и окончания
- Минимальная/максимальная длительность рейса

### Booking (Бронирование)
- Катер, дата и время начала/окончания
- Длительность, тип мероприятия
- Клиент (опционально), имя гостя, телефон
- Количество людей
- Ставка за человека (если не указана, используется базовая ставка катера)
- Общая стоимость, предоплата, остаток
- Способ оплаты, статус

## Бизнес-логика

Бронирование происходит напрямую на катер с указанием:
- Даты и времени начала/окончания
- Длительности
- Типа мероприятия
- Количества людей

Система проверяет доступность катера по расписанию (BoatAvailability) и существующим бронированиям.

## Настройка Telegram-бота для личных уведомлений

Система отправляет личные уведомления пользователям через Telegram:
- **Владельцу судна** — о новых бронированиях на его катер
- **Гиду** — о новых бронированиях с его группой + напоминание за 3 часа до выхода
- **Клиенту** — подтверждение брони и оплаты

### Шаг 1: Создание бота

1. Откройте Telegram и найдите [@BotFather](https://t.me/BotFather)
2. Отправьте команду `/newbot`
3. Следуйте инструкциям: укажите имя и username бота
4. Сохраните **токен бота** (например: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)
5. Сохраните **username бота** (например: `teriberka_bot`)

### Шаг 2: Настройка переменных окружения

Добавьте в `.env`:

```bash
# Токен бота
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz

# ID канала/группы для общих уведомлений (опционально)
TELEGRAM_CHANNEL_ID=-1001234567890

# Username бота (без @)
TELEGRAM_BOT_USERNAME=teriberka_bot

# Webhook URL (должен быть HTTPS)
TELEGRAM_WEBHOOK_URL=https://yourdomain.com/api/v1/telegram/webhook/
```

### Шаг 3: Настройка webhook

#### Для разработки (ngrok)

1. Установите ngrok: https://ngrok.com/download
2. Запустите Django сервер: `python manage.py runserver`
3. В другом терминале запустите ngrok: `ngrok http 8000`
4. Скопируйте HTTPS URL (например: `https://abc123.ngrok.io`)
5. Обновите `.env`: `TELEGRAM_WEBHOOK_URL=https://abc123.ngrok.io/api/v1/telegram/webhook/`
6. Установите webhook: `python manage.py telegram_set_webhook`

#### Для production

1. Убедитесь, что ваш сервер доступен по HTTPS
2. Установите webhook: `python manage.py telegram_set_webhook`

### Шаг 4: Как пользователи привязывают аккаунт

1. Пользователь открывает бота в Telegram (например, `https://t.me/teriberka_bot`)
2. Отправляет команду `/start`
3. Бот просит ввести email
4. Пользователь вводит свой email (который использовал при регистрации на сайте)
5. Бот находит аккаунт и привязывает `telegram_chat_id`
6. Готово! Теперь пользователь будет получать личные уведомления

### Шаг 5: Настройка периодических задач (Cron)

Команда `send_guide_reminders` должна запускаться каждые 15 минут для отправки напоминаний гидам за 3 часа до выхода.

#### Вариант 1: System Cron (рекомендуется)

1. Откройте crontab: `crontab -e`
2. Добавьте строку (замените пути на актуальные):
```bash
*/15 * * * * cd /path/to/teriberka && /path/to/venv/bin/python manage.py send_guide_reminders >> /path/to/logs/guide_reminders.log 2>&1
```
3. Сохраните и проверьте: `crontab -l`

#### Вариант 2: django-crontab

1. Установите: `pip install django-crontab`
2. Добавьте в `INSTALLED_APPS`: `'django_crontab'`
3. Добавьте в `config/settings.py`:
```python
CRONJOBS = [
    ('*/15 * * * *', 'django.core.management.call_command', ['send_guide_reminders']),
]
```
4. Добавьте задачи: `python manage.py crontab add`
5. Проверьте: `python manage.py crontab show`

#### Тестирование

Запустите команду вручную: `python manage.py send_guide_reminders`

### API Endpoints для Telegram

#### Статус привязки
```
GET /api/accounts/profile/telegram/status/
Authorization: Token <user_token>

Response:
{
  "is_linked": true,
  "telegram_chat_id": 123456789
}
```

#### Отвязка Telegram
```
POST /api/accounts/profile/telegram/unlink/
Authorization: Token <user_token>

Response:
{
  "message": "Telegram успешно отвязан от аккаунта"
}
```

### Frontend интеграция

Блок Telegram уже добавлен в профиль пользователя (`frontend/src/pages/profile/Profile.jsx`).

**Настройка переменной окружения:**

Добавьте в `frontend/.env`:
```bash
VITE_TELEGRAM_BOT_USERNAME=your_bot_username
```

**Что отображается:**
- Статус подключения (Подключен / Не подключен)
- Telegram Chat ID (если подключен)
- Кнопка "Подключить Telegram" (ссылка на бота)
- Кнопка "Отключить Telegram" (если подключен)

### Отладка

#### Бот не отвечает на сообщения
1. Проверьте webhook: `curl https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo`
2. Проверьте логи Django
3. Убедитесь, что ngrok запущен (для разработки)

#### Уведомления не приходят
1. Проверьте `telegram_chat_id` у пользователя в БД
2. Проверьте логи: `tail -f logs/django.log`
3. Убедитесь, что `TELEGRAM_BOT_TOKEN` настроен правильно

#### Напоминания гидам не отправляются
1. Проверьте cron: `crontab -l`
2. Проверьте логи: `tail -f logs/guide_reminders.log`
3. Запустите команду вручную для тестирования

