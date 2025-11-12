/**
 * Дизайн-токены Teriberka
 * JavaScript константы для использования в React компонентах
 */

export const colors = {
  // Основные цвета океана
  ocean: {
    deep: '#1e3a5f',
    medium: '#2d5a87',
    light: '#4a90c2',
    pale: '#6ba8d1',
  },
  
  // Бирюзовые оттенки
  turquoise: {
    deep: '#1a5f5f',
    medium: '#2d8a8a',
    light: '#4fc4c4',
  },
  
  // Нейтральные цвета
  neutral: {
    white: '#ffffff',
    snow: '#f8f9fa',
    cloud: '#e8ecef',
    mist: '#d1d9e0',
    stone: '#6c757d',
    charcoal: '#2c3e50',
  },
  
  // Акцентные цвета
  accent: {
    coral: '#ff6b6b',
    coralLight: '#ff8e8e',
    sand: '#f4e4bc',
    pearl: '#f0f4f8',
  },
  
  // Статусные цвета
  status: {
    success: '#28a745',
    successLight: '#d4edda',
    warning: '#ffc107',
    warningLight: '#fff3cd',
    error: '#dc3545',
    errorLight: '#f8d7da',
    info: '#17a2b8',
    infoLight: '#d1ecf1',
  },
}

export const typography = {
  fontFamily: {
    primary: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
    heading: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  fontSize: {
    xs: '0.75rem',    // 12px
    sm: '0.875rem',   // 14px
    base: '1rem',     // 16px
    lg: '1.125rem',   // 18px
    xl: '1.25rem',    // 20px
    '2xl': '1.5rem',  // 24px
    '3xl': '1.875rem', // 30px
    '4xl': '2.25rem', // 36px
  },
  fontWeight: {
    light: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  lineHeight: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.75,
  },
}

export const spacing = {
  xs: '0.25rem',   // 4px
  sm: '0.5rem',   // 8px
  md: '1rem',     // 16px
  lg: '1.5rem',   // 24px
  xl: '2rem',     // 32px
  '2xl': '3rem',  // 48px
  '3xl': '4rem',  // 64px
}

export const borderRadius = {
  sm: '0.25rem',  // 4px
  md: '0.5rem',   // 8px
  lg: '0.75rem',  // 12px
  xl: '1rem',     // 16px
  full: '9999px',
}

export const shadows = {
  sm: '0 1px 2px 0 rgba(30, 58, 95, 0.05)',
  md: '0 4px 6px -1px rgba(30, 58, 95, 0.1), 0 2px 4px -1px rgba(30, 58, 95, 0.06)',
  lg: '0 10px 15px -3px rgba(30, 58, 95, 0.1), 0 4px 6px -2px rgba(30, 58, 95, 0.05)',
  xl: '0 20px 25px -5px rgba(30, 58, 95, 0.1), 0 10px 10px -5px rgba(30, 58, 95, 0.04)',
  ocean: '0 10px 40px rgba(30, 58, 95, 0.15)',
}

export const gradients = {
  ocean: 'linear-gradient(135deg, #1e3a5f 0%, #2d5a87 50%, #4a90c2 100%)',
  oceanLight: 'linear-gradient(135deg, #4a90c2 0%, #6ba8d1 100%)',
  turquoise: 'linear-gradient(135deg, #1a5f5f 0%, #2d8a8a 50%, #4fc4c4 100%)',
  sunset: 'linear-gradient(135deg, #ff6b6b 0%, #ff8e8e 50%, #f4e4bc 100%)',
  overlay: 'linear-gradient(180deg, rgba(30, 58, 95, 0.8) 0%, rgba(30, 58, 95, 0.4) 100%)',
}

export const transitions = {
  fast: '0.15s ease',
  base: '0.3s ease',
  slow: '0.5s ease',
}

export const zIndex = {
  dropdown: 1000,
  sticky: 1020,
  fixed: 1030,
  modalBackdrop: 1040,
  modal: 1050,
  popover: 1060,
  tooltip: 1070,
}

// Готовые стили для часто используемых элементов
export const buttonStyles = {
  primary: {
    background: gradients.ocean,
    color: colors.neutral.white,
    borderRadius: borderRadius.md,
    padding: `${spacing.sm} ${spacing.lg}`,
    fontWeight: typography.fontWeight.semibold,
    transition: transitions.base,
    boxShadow: shadows.md,
  },
  secondary: {
    background: colors.neutral.white,
    color: colors.ocean.medium,
    border: `2px solid ${colors.ocean.medium}`,
    borderRadius: borderRadius.md,
    padding: `${spacing.sm} ${spacing.lg}`,
    fontWeight: typography.fontWeight.semibold,
    transition: transitions.base,
  },
  accent: {
    background: colors.accent.coral,
    color: colors.neutral.white,
    borderRadius: borderRadius.md,
    padding: `${spacing.sm} ${spacing.lg}`,
    fontWeight: typography.fontWeight.semibold,
    transition: transitions.base,
    boxShadow: shadows.md,
  },
}

export const cardStyles = {
  default: {
    background: colors.neutral.white,
    borderRadius: borderRadius.lg,
    boxShadow: shadows.ocean,
    padding: spacing.xl,
  },
  elevated: {
    background: colors.neutral.white,
    borderRadius: borderRadius.lg,
    boxShadow: shadows.xl,
    padding: spacing.xl,
  },
}

export default {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
  gradients,
  transitions,
  zIndex,
  buttonStyles,
  cardStyles,
}

