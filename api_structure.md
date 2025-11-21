# Структура API для системы бронирования катеров

## Общая архитектура

Проект использует Django REST Framework. Предлагается RESTful API с группировкой по модулям.

---

## 1. API для аутентификации и пользователей (`/api/accounts/`)

### Текущие endpoints (уже реализованы):
- `POST /api/accounts/register/` - Регистрация
- `POST /api/accounts/login/` - Вход
- `GET /api/accounts/profile/` - Профиль текущего пользователя
- `POST /api/accounts/verify-email/` - Подтверждение email
- `POST /api/accounts/password-reset/` - Запрос сброса пароля
- `POST /api/accounts/password-reset-confirm/` - Подтверждение сброса пароля
- `POST /api/accounts/verification/` - Загрузка документов для верификации (владелец судна)
- `GET /api/accounts/verification/status/` - Статус верификации

### Дополнительные endpoints (предлагаемые):

```python
# Обновление профиля
PUT/PATCH /api/accounts/profile/
  - Обновление личных данных (first_name, last_name, phone)
  - Обновление банковских реквизитов (для владельцев судов)

# Верификация для гидов
POST /api/accounts/guide-verification/
  - Загрузка документов гида (Свидетельство ИП, Справка Самозанятого, Сертификат)
  
GET /api/accounts/guide-verification/status/
  - Статус верификации гида
```

---

## 2. API для судов (`/api/boats/`)

### Основные endpoints:

```python
# Список судов (публичный)
GET /api/boats/
  Query params:
    - search: поиск по названию
    - boat_type: фильтр по типу (boat, yacht, barkas)
    - min_capacity, max_capacity: фильтр по вместимости
    - features: фильтр по особенностям (toilet, blankets, etc.)
    - available_date: фильтр по доступности на дату
  Response: список судов с базовой информацией

# Детали судна (публичный)
GET /api/boats/{id}/
  Response: полная информация о судне (фото, особенности, цены, маршруты)

# Создание судна (только владелец судна, верифицированный)
POST /api/boats/
  Body:
    - name, boat_type, capacity
    - description
    - images: массив файлов (8-12 фото)
    - features: массив чекбоксов (toilet, blankets, raincoats, tea_coffee, fishing_rods)
    - pricing: массив объектов {duration_hours: 2|3, price_per_person: decimal}
    - routes: массив ID маршрутов

# Обновление судна
PUT/PATCH /api/boats/{id}/
  - Только владелец судна может обновлять свое судно

# Удаление судна
DELETE /api/boats/{id}/
  - Мягкое удаление (is_active=False)

# Фото судна
POST /api/boats/{id}/images/
  - Добавление фото в галерею
DELETE /api/boats/{id}/images/{image_id}/
  - Удаление фото

# Особенности судна
POST /api/boats/{id}/features/
  Body: {feature_type: "toilet"}
DELETE /api/boats/{id}/features/{feature_id}/

# Ценообразование
POST /api/boats/{id}/pricing/
  Body: {duration_hours: 2, price_per_person: 4000}
PUT/PATCH /api/boats/{id}/pricing/{pricing_id}/
DELETE /api/boats/{id}/pricing/{pricing_id}/

# Сезонные цены (динамическое ценообразование)
POST /api/boats/{id}/seasonal-pricing/
  Body: {
    date_from: "2025-11-01",
    date_to: "2025-11-30",
    price_multiplier: 1.2  # или price_per_person_override
  }

# Расписание доступности
GET /api/boats/{id}/availability/
  Query params:
    - date_from, date_to: диапазон дат
  Response: список доступных слотов

POST /api/boats/{id}/availability/
  Body: {
    departure_date: "2025-11-07",
    departure_time: "12:00",
    return_time: "14:00"
  }

PUT/PATCH /api/boats/{id}/availability/{availability_id}/
DELETE /api/boats/{id}/availability/{availability_id}/

# Блокировка дат (техобслуживание, личные планы)
POST /api/boats/{id}/block-dates/
  Body: {
    date_from: "2025-11-10",
    date_to: "2025-11-12",
    reason: "Техобслуживание"
  }

# Статистика загрузки
GET /api/boats/{id}/statistics/
  Query params:
    - month: "2025-11"
  Response: статистика бронирований по месяцам
```

---

## 3. API для бронирований (`/api/bookings/`)

### Основные endpoints:

```python
# Список бронирований (единый для всех ролей)
GET /api/bookings/
  Query params:
    - status: фильтр по статусу (pending, deposit_paid, confirmed, cancelled, completed)
    - boat_id: фильтр по судну
    - date_from, date_to: фильтр по датам
  Response: список бронирований с детальной информацией
  Логика фильтрации по роли (автоматически):
    - Для владельца судна: возвращаются бронирования только его судов
    - Для гида: возвращаются только его бронирования (где guide_id = текущий пользователь)
    - Для клиента: возвращаются только его бронирования (где customer_id = текущий пользователь)
  Пример ответа: [
    {
      id: 456,
      trip: {...},
      boat: {...},
      number_of_people: 5,
      guest_name: "Имя группы",
      guest_phone: "89001234567",
      price_per_person: 4000,
      total_price: 20000,
      deposit: 5000,
      remaining_amount: 15000,
      status: "confirmed",
      is_guide_booking: true,  # true если это бронирование гида
      # Дополнительные поля только для гидов:
      guide_commission_per_person: 500,
      guide_total_commission: 2500,
      ...
    }
  ]
  Примечание: 
    - Для гидов в ответе дополнительно включаются поля guide_commission_per_person и guide_total_commission
    - Для клиентов эти поля не возвращаются
    - Для владельцев судов показываются все бронирования их судов (без полей комиссии)

# Детали бронирования
GET /api/bookings/{id}/
  Response: полная информация о бронировании
  Пример ответа: {
    id: 456,
    trip: {...},
    boat: {...},
    number_of_people: 5,
    guest_name: "Имя группы",
    guest_phone: "89001234567",
    price_per_person: 4000,
    total_price: 20000,
    deposit: 5000,
    remaining_amount: 15000,
    status: "confirmed",
    guide: {...},  # если бронирование от гида
    is_guide_booking: true,  # true если бронирование от гида
    # Дополнительные поля только для бронирований гида:
    guide_commission_per_person: 500,
    guide_total_commission: 2500,
    ...
  }

# Создание бронирования
POST /api/bookings/
  Body: {
    trip_id: 123,  # ID из /api/trips/
    number_of_people: 2,
    guest_name: "Людмила",
    guest_phone: "89096678984"
  }
  Response: {
    id: 456,
    trip_id: 123,
    boat: {...},
    start_datetime: "2025-11-22T11:00:00Z",
    end_datetime: "2025-11-22T13:00:00Z",
    number_of_people: 2,
    price_per_person: 4000,
    total_price: 8000,
    deposit: 2000,  # 1000 руб × 2 человека
    remaining_amount: 6000,
    status: "pending",
    # Дополнительные поля только для гидов:
    guide_commission_per_person: 500,  # комиссия за одного туриста
    guide_total_commission: 1000,  # общая комиссия гида
    is_guide_booking: true  # true если бронирует гид, false если клиент
  }
  Логика:
    - Единый endpoint для гидов и клиентов
    - Проверка доступности рейса (trip_id)
    - Проверка свободных мест
    - Расчет стоимости (одинаковая цена для всех)
    - Расчет предоплаты (1000 руб/чел)
    - Расчет остатка к оплате
    - Если пользователь - верифицированный гид:
      * Рассчитывается и возвращается guide_commission_per_person
      * Рассчитывается guide_total_commission = guide_commission_per_person × number_of_people
      * is_guide_booking = true
      * guide_id автоматически устанавливается из текущего пользователя
    - Если пользователь - клиент:
      * Поля guide_commission_* не возвращаются
      * is_guide_booking = false
      * guide_id = null
    - Создание брони со статусом "pending"
    - Отправка уведомлений владельцу судна

# Отмена бронирования
POST /api/bookings/{id}/cancel/
  Body: {reason: "Причина отмены"}
  Логика:
    - Проверка времени до рейса
    - Если > 72 часов: возврат предоплаты, статус "cancelled"
    - Если < 72 часов: предоплата удерживается, статус "cancelled"
    - Если < 3 часов: отмена блокируется (статус "frozen")

# Оплата остатка
POST /api/bookings/{id}/pay-remaining/
  Body: {
    payment_method: "online" | "card" | "cash"
  }
  Логика:
    - Проверка, что до рейса >= 3 часа
    - Расчет остатка к оплате
    - Интеграция с платежным шлюзом (если online)
    - Обновление статуса на "confirmed" (оплачено полностью)
    - Генерация QR-кода или уникального ID для посадки
    - Отправка уведомления

# Посадка (Check-in) - для капитана
POST /api/bookings/{id}/check-in/
  Body: {
    verification_code: "QR-код или ID бронирования"
  }
  Response: {
    verified: true,
    number_of_people: 2,
    status: "boarding_allowed"
  }
  Логика:
    - Проверка кода
    - Проверка статуса "confirmed"
    - Обновление статуса на "completed"
    - Отправка уведомления

# Возврат предоплаты (для владельца судна)
POST /api/bookings/{id}/refund-deposit/
  Body: {reason: "Причина возврата"}
```

---

## 4. API для личного кабинета владельца судна (`/api/dashboard/boat-owner/`)

```python
# Главная панель - метрики
GET /api/dashboard/boat-owner/
  Response: {
    today_stats: {
      bookings_count: 3,
      revenue: 24000,
      upcoming_bookings: 2
    },
    week_stats: {
      bookings_count: 15,
      revenue: 120000,
      occupancy_rate: 75
    },
    recent_bookings: [...],
    upcoming_bookings: [...]
  }

# Календарь бронирований
GET /api/dashboard/boat-owner/calendar/
  Query params:
    - month: "2025-11"
    - boat_id: опционально
  Response: {
    bookings: [...],
    blocked_dates: [...],
    availability: [...]
  }

# Финансы
GET /api/dashboard/boat-owner/finances/
  Query params:
    - period_start, period_end
  Response: {
    revenue: 150000,
    platform_commission: 15000,  # 10-25%
    to_payout: 135000,
    next_payout_date: "2025-11-10",  # каждый понедельник
    payout_history: [...]
  }

# История операций
GET /api/dashboard/boat-owner/transactions/
  Query params:
    - date_from, date_to
    - type: "payment" | "payout" | "commission"
  Response: список транзакций

# Отзывы и рейтинг
GET /api/dashboard/boat-owner/reviews/
  Response: {
    average_rating: 4.8,
    total_reviews: 25,
    recent_reviews: [...]
  }

POST /api/dashboard/boat-owner/reviews/{review_id}/reply/
  Body: {reply_text: "Спасибо за отзыв!"}
```

---

## 5. API для поиска доступных рейсов (`/api/trips/`)

**Единый API для гидов и клиентов.** Основная цена за человека одинаковая для всех. Для верифицированных гидов дополнительно показывается комиссия, которую они получат за приведенных туристов.

```python
# Поиск доступных рейсов
GET /api/trips/
  Query params:
    - date: "2025-11-22" (обязательно)
    - date_from, date_to: альтернатива date (диапазон дат)
    - duration: 2 | 3 (длительность в часах)
    - number_of_people: количество человек (для проверки доступности мест)
    - boat_id: опционально, фильтр по конкретному судну
    - boat_type: опционально, фильтр по типу (boat, yacht, barkas)
    - features: опционально, фильтр по особенностям (toilet, blankets, etc.)
    - route_id: опционально, фильтр по маршруту
  Response: список доступных слотов с ценами
  Пример ответа: [
    {
      id: 123,
      boat: {
        id: 1,
        name: "Михаил",
        boat_type: "boat",
        capacity: 11,
        features: ["toilet", "blankets", "tea_coffee"],
        images: [...]
      },
      departure_date: "2025-11-22",
      departure_time: "11:00",
      return_time: "13:00",
      duration_hours: 2,
      available_spots: 9,  # свободных мест
      price_per_person: 4000,  # одинаковая цена для всех
      route: {
        id: 1,
        name: "Прогулка с китами"
      },
      # Дополнительные поля только для верифицированных гидов:
      guide_commission_per_person: 500,  # комиссия гида за одного туриста
      guide_total_commission: 2500  # общая комиссия за всех туристов (если указано number_of_people=5)
    }
  ]
  
  Логика:
    - Основная цена за человека одинаковая для всех (гидов и клиентов)
    - Если пользователь - верифицированный гид:
      * Рассчитывается и возвращается guide_commission_per_person (комиссия за одного туриста)
      * Если указан number_of_people, рассчитывается guide_total_commission
    - Если пользователь - клиент или не авторизован: поля guide_commission_* не возвращаются
    - Проверяется доступность мест (capacity - уже забронированные места)
    - Фильтруются только активные слоты (BoatAvailability.is_active=True)
    - Исключаются заблокированные даты
```

---

## 6. API для гида (`/api/guide/`)

**Примечание**: Бронирование и просмотр бронирований для гида выполняется через единые endpoints `/api/bookings/`. В этом разделе только специфичные для гида endpoints.

```python
# Статистика по комиссиям
GET /api/guide/commissions/
  Query params:
    - date_from, date_to: период
  Response: {
    total_commission: 15000,  # общая заработанная комиссия за период
    bookings_count: 10,
    pending_commission: 5000,  # комиссия по еще не завершенным бронированиям
    paid_commission: 10000,  # уже полученная комиссия
    commission_history: [...]
  }
```

---

## 7. API для клиента/туриста (`/api/customer/`)

**Примечание**: Бронирование и просмотр бронирований для клиента выполняется через единые endpoints `/api/bookings/`. В этом разделе можно добавить специфичные для клиента endpoints в будущем (например, история отзывов).

---

## 8. API для уведомлений (`/api/notifications/`)

```python
# Список уведомлений
GET /api/notifications/
  Query params:
    - unread_only: true/false
  Response: список уведомлений

# Отметить как прочитанное
PATCH /api/notifications/{id}/mark-read/

# Отметить все как прочитанные
POST /api/notifications/mark-all-read/

# Настройки уведомлений
GET /api/notifications/settings/
PUT /api/notifications/settings/
  Body: {
    push_enabled: true,
    email_enabled: true,
    telegram_enabled: true,
    whatsapp_enabled: true
  }
```

---

## 9. API для маршрутов (`/api/routes/`)

**Примечание**: Маршруты создаются администратором через админку Django. API предоставляет только публичный доступ для получения информации о маршрутах.

```python
# Список всех маршрутов (публичный)
GET /api/routes/
  Response: список всех активных маршрутов
  Пример: [
    {
      id: 1,
      name: "Прогулка с китами",
      description: "Описание маршрута",
      is_active: true
    },
    {
      id: 2,
      name: "Рыбалка в открытом море",
      description: "Описание маршрута",
      is_active: true
    }
  ]

# Детали маршрута (публичный)
GET /api/routes/{id}/
  Response: детальная информация о маршруте
  Пример: {
    id: 1,
    name: "Прогулка с китами",
    description: "Маршрут проходит через места обитания китов...",
    is_active: true,
    boats: [...]  # список судов, которые могут выполнять этот маршрут
  }
```

---

## 10. API для настройки комиссии гидам (`/api/guide-commissions/`)

**Примечание**: Владелец судна может установить индивидуальную комиссию для конкретного гида. Если комиссия не установлена, используется стандартная комиссия платформы.

```python
# Для владельца судна
GET /api/guide-commissions/
  - Список настроек комиссий для гидов

POST /api/guide-commissions/
  Body: {
    guide_id: 5,
    commission_per_person: 500,  # фиксированная сумма за одного туриста
    # или
    commission_percent: 10  # процент от стоимости бронирования
  }

PUT/PATCH /api/guide-commissions/{id}/
DELETE /api/guide-commissions/{id}/

# Для гида
GET /api/guide-commissions/my-commissions/
  - Список комиссий, которые установили для гида владельцы судов
  Response: [
    {
      boat_owner: {...},
      boat: {...},
      commission_per_person: 500,
      commission_percent: null
    }
  ]
```

---

## Дополнительные технические endpoints

```python
# Health check
GET /api/health/

# Версия API
GET /api/version/

# Офлайн-манифест для капитана (кэш бронирований)
GET /api/boat-owner/manifest/
  Query params:
    - boat_id: опционально
    - date: "2025-11-22"
  Response: список бронирований для офлайн-проверки QR-кодов
```

---

## Рекомендации по реализации

1. **Версионирование API**: `/api/v1/...`
2. **Пагинация**: все списковые endpoints с пагинацией
3. **Фильтрация и поиск**: query parameters для фильтров
4. **Права доступа**: проверка ролей и статусов верификации
5. **Валидация**: проверка доступности, пересечений времени, свободных мест
6. **Уведомления**: WebSocket или Server-Sent Events для real-time
7. **Кэширование**: Redis для часто запрашиваемых данных
8. **Документация**: Swagger/OpenAPI (drf-yasg или drf-spectacular)

---

## Статусы бронирований

- `pending` - Ожидает подтверждения (создано, но предоплата еще не внесена)
- `deposit_paid` - Предоплата внесена (активно, ожидает оплаты остатка)
- `confirmed` - Оплачено полностью (готово к посадке)
- `cancelled` - Отменено
- `completed` - Завершено (посадка прошла успешно)
- `frozen` - Заморожено (отмена блокирована, менее 3 часов до рейса)

---

## Логика комиссии гида

**Важно**: Основная цена за человека одинаковая для гидов и клиентов. Гид получает дополнительную комиссию за каждого приведенного туриста.

### Расчет комиссии:

- Комиссия гида рассчитывается как фиксированная сумма за одного туриста (например, 500 руб/чел)
- Или как процент от стоимости бронирования (настраивается администратором)
- Комиссия показывается гиду в:
  - Списке доступных рейсов (`/api/trips/`) - поле `guide_commission_per_person`
  - При создании бронирования (`/api/bookings/`) - поля `guide_commission_per_person` и `guide_total_commission`
  - В деталях и списке бронирований

### Пример расчета:

- Бронирование: 5 человек по 4000 руб/чел = 20000 руб (общая стоимость)
- Комиссия гида: 500 руб/чел × 5 = 2500 руб (заработок гида)
- Гид видит: общая стоимость 20000 руб + свою комиссию 2500 руб
- Клиент платит: 20000 руб (без изменений)

### Выплата комиссии:

- Комиссия начисляется после успешного завершения рейса (статус "completed")
- Гид видит статистику по комиссиям в `/api/guide/commissions/`
- Выплата комиссии производится согласно настройкам платформы

---

## Логика возврата предоплаты

- **Отмена более чем за 72 часа**: возврат 100% предоплаты
- **Отмена менее чем за 72 часа**: предоплата удерживается (невозвратная)
- **Отмена менее чем за 3 часа**: отмена блокируется, оплата остатка обязательна

---

## Логика комиссии платформы

- Комиссия варьируется от 10% до 25%
- Рассчитывается автоматически при создании бронирования
- Выплаты владельцам судов производятся раз в неделю (каждый понедельник)
- Владелец видит в дашборде:
  - Выручку за период
  - Комиссию платформы
  - Чистую сумму к выплате
  - Историю операций

