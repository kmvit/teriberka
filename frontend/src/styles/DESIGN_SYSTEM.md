# Дизайн-система Teriberka

Океанская тематика с спокойными, умиротворяющими цветами для сервиса бронирования суден.

## 🎨 Цветовая палитра

### Основные цвета океана
- `--ocean-deep` / `colors.ocean.deep` - `#1e3a5f` - Глубокий синий океан (заголовки, важные элементы)
- `--ocean-medium` / `colors.ocean.medium` - `#2d5a87` - Средний синий (кнопки, акценты)
- `--ocean-light` / `colors.ocean.light` - `#4a90c2` - Светлый синий (hover состояния)
- `--ocean-pale` / `colors.ocean.pale` - `#6ba8d1` - Бледно-голубой (фоны, границы)

### Бирюзовые оттенки
- `--turquoise-deep` / `colors.turquoise.deep` - `#1a5f5f` - Глубокая бирюза
- `--turquoise-medium` / `colors.turquoise.medium` - `#2d8a8a` - Средняя бирюза
- `--turquoise-light` / `colors.turquoise.light` - `#4fc4c4` - Светлая бирюза

### Нейтральные цвета
- `--white` / `colors.neutral.white` - `#ffffff` - Белый
- `--snow` / `colors.neutral.snow` - `#f8f9fa` - Почти белый (фоны)
- `--cloud` / `colors.neutral.cloud` - `#e8ecef` - Облачный (границы)
- `--mist` / `colors.neutral.mist` - `#d1d9e0` - Туманный (неактивные)
- `--stone` / `colors.neutral.stone` - `#6c757d` - Каменный (вторичный текст)
- `--charcoal` / `colors.neutral.charcoal` - `#2c3e50` - Угольный (основной текст)

### Акцентные цвета
- `--coral` / `colors.accent.coral` - `#ff6b6b` - Коралловый (важные действия)
- `--sand` / `colors.accent.sand` - `#f4e4bc` - Песочный (теплые акценты)
- `--pearl` / `colors.accent.pearl` - `#f0f4f8` - Жемчужный (светлые фоны)

## 📝 Использование

### В CSS файлах

```css
.my-component {
  background: var(--ocean-medium);
  color: var(--white);
  padding: var(--spacing-lg);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-ocean);
}

.my-button {
  background: var(--gradient-ocean);
  transition: var(--transition-base);
}
```

### В React компонентах (JavaScript)

```jsx
import { colors, spacing, borderRadius, gradients } from '../styles/design-tokens';

const MyComponent = () => {
  return (
    <div style={{
      background: gradients.ocean,
      color: colors.neutral.white,
      padding: spacing.lg,
      borderRadius: borderRadius.md,
    }}>
      Контент
    </div>
  );
};
```

### В React компонентах (CSS-in-JS или styled-components)

```jsx
import { colors, spacing } from '../styles/design-tokens';

const StyledButton = styled.button`
  background: ${colors.ocean.medium};
  color: ${colors.neutral.white};
  padding: ${spacing.sm} ${spacing.lg};
  border-radius: ${borderRadius.md};
  
  &:hover {
    background: ${colors.ocean.light};
  }
`;
```

## 🎯 Примеры использования

### Кнопки

```jsx
// Используя готовые стили
import { buttonStyles } from '../styles/design-tokens';

<button style={buttonStyles.primary}>
  Основная кнопка
</button>

<button style={buttonStyles.secondary}>
  Вторичная кнопка
</button>

<button style={buttonStyles.accent}>
  Акцентная кнопка
</button>
```

### Карточки

```jsx
import { cardStyles } from '../styles/design-tokens';

<div style={cardStyles.default}>
  Обычная карточка
</div>

<div style={cardStyles.elevated}>
  Карточка с тенью
</div>
```

## 📐 Типографика

```css
.heading {
  font-family: var(--font-heading);
  font-size: var(--font-size-3xl);
  font-weight: var(--font-weight-bold);
  line-height: var(--line-height-tight);
  color: var(--ocean-deep);
}

.body-text {
  font-family: var(--font-primary);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-normal);
  line-height: var(--line-height-normal);
  color: var(--charcoal);
}
```

## 🎨 Градиенты

- `--gradient-ocean` - Основной океанский градиент
- `--gradient-ocean-light` - Светлый океанский градиент
- `--gradient-turquoise` - Бирюзовый градиент
- `--gradient-sunset` - Градиент заката (коралловый + песочный)

## 📦 Структура файлов

- `design-system.css` - CSS переменные для использования в стилях
- `design-tokens.js` - JavaScript константы для использования в компонентах
- `DESIGN_SYSTEM.md` - Документация (этот файл)

## 💡 Рекомендации

1. **Основной цвет** - используйте `ocean-medium` для основных кнопок и акцентов
2. **Фоны** - используйте `snow` или `pearl` для светлых фонов
3. **Текст** - используйте `charcoal` для основного текста, `stone` для вторичного
4. **Градиенты** - используйте `gradient-ocean` для важных элементов (кнопки, заголовки)
5. **Тени** - используйте `shadow-ocean` для карточек и модальных окон

## 🔄 Обновление дизайн-системы

При изменении цветов или других токенов:
1. Обновите значения в `design-system.css`
2. Обновите соответствующие значения в `design-tokens.js`
3. Обновите эту документацию
4. Проверьте все компоненты на соответствие новой палитре

