# Тестирование API

## Установка зависимостей

```bash
pip install -r requirements.txt
```

## Запуск тестов

### Все тесты
```bash
pytest
```

### С покрытием кода
```bash
pytest --cov=apps --cov-report=html
```

### Конкретный файл тестов
```bash
pytest apps/accounts/tests/test_views.py
```

### Конкретный тест
```bash
pytest apps/accounts/tests/test_views.py::TestUserRegistration::test_register_customer
```

### С подробным выводом
```bash
pytest -v
```

### Только быстрые тесты (без БД)
```bash
pytest -m "not django_db"
```

## Структура тестов

### Фикстуры (conftest.py)

Созданы фикстуры для:
- `api_client` - базовый API клиент
- `customer_user`, `customer_client` - клиент и его авторизованный клиент
- `boat_owner_user`, `boat_owner_client` - владелец судна и его клиент
- `guide_user`, `guide_client` - гид и его клиент
- `boat` - тестовое судно
- `boat_with_pricing` - судно с ценами
- `boat_with_features` - судно с особенностями
- `boat_availability` - доступный слот
- `sailing_zone` - маршрут
- `booking` - бронирование клиента
- `guide_booking` - бронирование гида
- `guide_discount` - скидка/комиссия для гида

### Тесты по модулям

#### 1. accounts/tests/test_views.py
- Регистрация пользователей
- Вход в систему
- Профиль пользователя
- Дашборд для разных ролей
- Комиссии гида

#### 2. boats/tests/test_views.py
- Список судов (публичный доступ)
- Детали судна
- Создание судна (требует авторизации)
- Обновление судна
- Расписание доступности

#### 3. bookings/tests/test_views.py
- Создание бронирования
- Список бронирований (с фильтрацией по роли)
- Отмена бронирования (логика возврата)
- Оплата остатка

#### 4. trips/tests/test_views.py
- Поиск доступных рейсов
- Фильтрация по датам, длительности, количеству людей
- Комиссия для гидов

#### 5. guide_commissions/tests/test_views.py
- CRUD операции для комиссий
- Просмотр комиссий гидом

## Примеры использования фикстур

```python
def test_example(customer_client, boat, booking):
    """Пример теста с использованием фикстур"""
    url = reverse('bookings:booking-list')
    response = customer_client.get(url)
    assert response.status_code == 200
```

## Настройка pytest

Файл `pytest.ini` содержит:
- Настройки Django
- Параметры покрытия кода
- Настройки вывода

## Покрытие кода

После запуска тестов с `--cov`, отчет будет доступен:
- В терминале (текстовый формат)
- В `htmlcov/index.html` (HTML отчет)

## Известные проблемы

1. Некоторые тесты могут требовать дополнительной настройки времени для проверки логики отмены
2. Тесты с датами используют относительные даты (завтра, через 2 дня), что может влиять на результаты

## Добавление новых тестов

1. Создайте файл `test_*.py` в соответствующей директории `tests/`
2. Используйте существующие фикстуры из `conftest.py`
3. Следуйте структуре существующих тестов
4. Используйте `@pytest.mark.django_db` для тестов, требующих БД

