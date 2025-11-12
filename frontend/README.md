# Teriberka Frontend

React приложение для бронирования катеров в Териберке.

## Установка

```bash
npm install
```

## Настройка переменных окружения

Проект использует переменные окружения для настройки API URL.

### Для разработки

Файл `.env` уже создан с настройками для локальной разработки:
```
VITE_API_BASE_URL=http://localhost:8000/api
```

### Для production

При сборке для production используется файл `.env.production`:
```
VITE_API_BASE_URL=/api
```

Для настройки на сервере создайте файл `.env.production` в директории `frontend/`:
```bash
cd /opt/teriberka/frontend
nano .env.production
```

Укажите URL вашего API:
- Относительный путь (рекомендуется): `/api` - будет работать через Nginx прокси
- Полный URL: `http://your-domain.com/api` или `https://your-domain.com/api`

## Запуск

```bash
npm run dev
```

Приложение будет доступно по адресу http://localhost:3000

## Сборка

```bash
# Для production (использует .env.production)
npm run build
```

Собранные файлы будут в директории `dist/`

## Структура проекта

- `src/pages/` - страницы приложения
- `src/components/` - переиспользуемые компоненты
- `src/services/` - API сервисы
- `src/styles/` - CSS стили

