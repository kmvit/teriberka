# Тестирование API

## Установка зависимостей

```bash
pip install -r requirements.txt
```

## Запуск сервера

```bash
python manage.py runserver
```

## Доступные endpoints

### 1. API для судов (`/api/boats/`)

#### Список судов (публичный)
```bash
GET /api/boats/
Query params:
  - search: поиск по названию
  - boat_type: фильтр по типу (boat, yacht, barkas)
  - min_capacity, max_capacity: фильтр по вместимости
  - features: фильтр по особенностям (toilet, blankets, etc.)
  - available_date: фильтр по доступности на дату (YYYY-MM-DD)
```

#### Детали судна (публичный)
```bash
GET /api/boats/{id}/
```

#### Создание судна (требует авторизации, только для верифицированных владельцев)
```bash
POST /api/boats/
Headers:
  Authorization: Token {your_token}
Body:
{
  "name": "Михаил",
  "boat_type": "boat",
  "capacity": 11,
  "description": "Описание судна",
  "images": [file1, file2, ...],  # массив файлов
  "features": ["toilet", "blankets", "tea_coffee"],
  "pricing": [
    {"duration_hours": 2, "price_per_person": 4000},
    {"duration_hours": 3, "price_per_person": 5000}
  ],
  "route_ids": [1, 2]  # опционально
}
```

#### Обновление судна
```bash
PUT/PATCH /api/boats/{id}/
Headers:
  Authorization: Token {your_token}
```

#### Удаление судна (мягкое удаление)
```bash
DELETE /api/boats/{id}/
Headers:
  Authorization: Token {your_token}
```

#### Управление фото
```bash
POST /api/boats/{id}/add_image/
  Body: form-data с полем "image"
  
DELETE /api/boats/{id}/images/{image_id}/
```

#### Управление особенностями
```bash
POST /api/boats/{id}/add_feature/
  Body: {"feature_type": "toilet"}
  
DELETE /api/boats/{id}/features/{feature_id}/
```

#### Управление ценами
```bash
POST /api/boats/{id}/add_pricing/
  Body: {"duration_hours": 2, "price_per_person": 4000}
  
PUT/PATCH /api/boats/{id}/pricing/{pricing_id}/
  
DELETE /api/boats/{id}/pricing/{pricing_id}/
```

#### Расписание доступности
```bash
GET /api/boats/{id}/availability/
  Query params: date_from, date_to
  
POST /api/boats/{id}/availability/
  Body: {
    "departure_date": "2025-11-22",
    "departure_time": "11:00",
    "return_time": "13:00"
  }
  
PUT/PATCH /api/boats/{id}/availability/{availability_id}/
  
DELETE /api/boats/{id}/availability/{availability_id}/
```

#### Статистика
```bash
GET /api/boats/{id}/statistics/
  Query params: month (формат: "2025-11")
```

### 2. API для маршрутов (`/api/routes/`)

#### Список маршрутов (публичный)
```bash
GET /api/routes/
```

#### Детали маршрута (публичный)
```bash
GET /api/routes/{id}/
```

## Примеры тестирования с curl

### Получить список судов
```bash
curl http://localhost:8000/api/boats/
```

### Получить детали судна
```bash
curl http://localhost:8000/api/boats/1/
```

### Создать судно (требует токен)
```bash
curl -X POST http://localhost:8000/api/boats/ \
  -H "Authorization: Token YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Тестовое судно",
    "boat_type": "boat",
    "capacity": 11,
    "description": "Описание",
    "features": ["toilet"],
    "pricing": [{"duration_hours": 2, "price_per_person": 4000}]
  }'
```

### Получить список маршрутов
```bash
curl http://localhost:8000/api/routes/
```

### 3. API для поиска доступных рейсов (`/api/trips/`)

#### Поиск доступных рейсов (публичный)
```bash
GET /api/trips/
Query params:
  - date: "2025-11-22" (обязательно) или
  - date_from, date_to: диапазон дат
  - duration: 2 | 3 (длительность в часах)
  - number_of_people: количество человек
  - boat_id: фильтр по судну
  - boat_type: фильтр по типу
  - features: фильтр по особенностям
  - route_id: фильтр по маршруту
```

Пример:
```bash
curl "http://localhost:8000/api/trips/?date=2025-11-22&duration=2&number_of_people=2"
```

### 4. API для бронирований (`/api/bookings/`)

#### Создание бронирования (требует авторизации)
```bash
POST /api/bookings/
Headers:
  Authorization: Token {your_token}
Body:
{
  "trip_id": 123,  # ID из /api/trips/
  "number_of_people": 2,
  "guest_name": "Людмила",
  "guest_phone": "89096678984"
}
```

#### Список бронирований (автоматическая фильтрация по роли)
```bash
GET /api/bookings/
Headers:
  Authorization: Token {your_token}
Query params:
  - status: фильтр по статусу
  - boat_id: фильтр по судну
  - date_from, date_to: фильтр по датам
```

#### Детали бронирования
```bash
GET /api/bookings/{id}/
Headers:
  Authorization: Token {your_token}
```

#### Отмена бронирования
```bash
POST /api/bookings/{id}/cancel/
Headers:
  Authorization: Token {your_token}
Body:
{
  "reason": "Причина отмены"
}
```

#### Оплата остатка
```bash
POST /api/bookings/{id}/pay-remaining/
Headers:
  Authorization: Token {your_token}
Body:
{
  "payment_method": "online"  # online, card, cash
}
```

#### Посадка (Check-in) - для владельца судна
```bash
POST /api/bookings/{id}/check-in/
Headers:
  Authorization: Token {your_token}
Body:
{
  "verification_code": "BOOK-123"  # опционально
}
```

## Проверка работоспособности

1. Убедитесь, что сервер запущен:
   ```bash
   python manage.py runserver
   ```

2. Проверьте доступность endpoints:
   ```bash
   # Список судов
   curl http://localhost:8000/api/boats/
   
   # Список маршрутов
   curl http://localhost:8000/api/routes/
   ```

3. Проверьте авторизацию (если нужно):
   - Зарегистрируйтесь через `/api/accounts/register/`
   - Войдите через `/api/accounts/login/` и получите токен
   - Используйте токен в заголовке `Authorization: Token {token}`

## Известные проблемы

- Если django-filter не установлен, установите: `pip install django-filter==24.3`
- Убедитесь, что все миграции применены: `python manage.py migrate`

