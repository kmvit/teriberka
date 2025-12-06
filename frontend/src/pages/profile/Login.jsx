import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { authAPI } from '../../services/api'
import '../../styles/Login.css'

const MAX_ATTEMPTS = 3
const BLOCK_DURATION = 5 * 60 * 1000 // 5 минут в миллисекундах

const Login = () => {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [failedAttempts, setFailedAttempts] = useState(0)
  const [isBlocked, setIsBlocked] = useState(false)
  const [blockUntil, setBlockUntil] = useState(null)
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [showPassword, setShowPassword] = useState(false)

  // Проверяем блокировку при загрузке компонента
  useEffect(() => {
    const savedBlockUntil = localStorage.getItem('loginBlockUntil')
    if (savedBlockUntil) {
      const blockTime = parseInt(savedBlockUntil, 10)
      const now = Date.now()
      if (blockTime > now) {
        setIsBlocked(true)
        setBlockUntil(blockTime)
      } else {
        // Блокировка истекла
        localStorage.removeItem('loginBlockUntil')
        localStorage.removeItem('loginFailedAttempts')
      }
    }
    
    const savedAttempts = localStorage.getItem('loginFailedAttempts')
    if (savedAttempts) {
      setFailedAttempts(parseInt(savedAttempts, 10))
    }
  }, [])

  // Таймер обратного отсчета
  useEffect(() => {
    if (!isBlocked || !blockUntil) return

    const interval = setInterval(() => {
      const now = Date.now()
      const remaining = Math.max(0, blockUntil - now)
      setTimeRemaining(Math.ceil(remaining / 1000))

      if (remaining <= 0) {
        setIsBlocked(false)
        setBlockUntil(null)
        setFailedAttempts(0)
        localStorage.removeItem('loginBlockUntil')
        localStorage.removeItem('loginFailedAttempts')
        clearInterval(interval)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [isBlocked, blockUntil])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
    // Очищаем ошибку для этого поля при изменении
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[name]
        return newErrors
      })
    }
    
    // При изменении email сбрасываем счетчик попыток
    if (name === 'email') {
      setFailedAttempts(0)
      localStorage.removeItem('loginFailedAttempts')
    }
  }

  const validateForm = () => {
    const newErrors = {}

    if (!formData.email.trim()) {
      newErrors.email = 'Email обязателен'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Неверный формат email'
    }

    if (!formData.password) {
      newErrors.password = 'Пароль обязателен'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (isBlocked) {
      return
    }
    
    if (!validateForm()) {
      return
    }

    setLoading(true)
    setErrors({})

    try {
      const response = await authAPI.login(formData)
      
      // Успешный вход - сбрасываем счетчик попыток
      setFailedAttempts(0)
      localStorage.removeItem('loginFailedAttempts')
      localStorage.removeItem('loginBlockUntil')
      
      // Сохраняем токен в localStorage
      if (response.token) {
        localStorage.setItem('token', response.token)
        localStorage.setItem('user', JSON.stringify(response.user))
      }

      // Перенаправляем на профиль
      navigate('/profile')
    } catch (error) {
      // Увеличиваем счетчик неудачных попыток
      const newAttempts = failedAttempts + 1
      setFailedAttempts(newAttempts)
      localStorage.setItem('loginFailedAttempts', newAttempts.toString())
      
      // Если достигнут лимит попыток - блокируем
      if (newAttempts >= MAX_ATTEMPTS) {
        const blockTime = Date.now() + BLOCK_DURATION
        setIsBlocked(true)
        setBlockUntil(blockTime)
        localStorage.setItem('loginBlockUntil', blockTime.toString())
        setErrors({ 
          general: `Превышено количество попыток входа. Попробуйте снова через ${Math.ceil(BLOCK_DURATION / 60000)} минут.` 
        })
        setLoading(false)
        return
      }
      
      if (error.response && error.response.data) {
        // Обрабатываем ошибки валидации от сервера
        const serverErrors = error.response.data
        
        // Преобразуем ошибки Django REST Framework в формат для формы
        const formattedErrors = {}
        
        // Обрабатываем ошибки полей
        Object.keys(serverErrors).forEach((key) => {
          if (Array.isArray(serverErrors[key])) {
            formattedErrors[key] = serverErrors[key][0]
          } else if (typeof serverErrors[key] === 'object') {
            // Обрабатываем вложенные объекты
            if (serverErrors[key].non_field_errors) {
              formattedErrors[key] = serverErrors[key].non_field_errors[0]
            } else {
              formattedErrors[key] = Object.values(serverErrors[key])[0]
            }
          } else {
            formattedErrors[key] = serverErrors[key]
          }
        })
        
        // Обрабатываем non_field_errors
        if (serverErrors.non_field_errors) {
          formattedErrors.general = Array.isArray(serverErrors.non_field_errors)
            ? serverErrors.non_field_errors[0]
            : serverErrors.non_field_errors
        }
        
        // Если нет конкретных ошибок полей, показываем общую ошибку
        if (Object.keys(formattedErrors).length === 0) {
          formattedErrors.general = 'Неверный email или пароль'
        }
        
        // Добавляем информацию о количестве оставшихся попыток
        const remainingAttempts = MAX_ATTEMPTS - newAttempts
        if (remainingAttempts > 0) {
          formattedErrors.general = `${formattedErrors.general || 'Неверный email или пароль'} (осталось попыток: ${remainingAttempts})`
        }
        
        setErrors(formattedErrors)
      } else {
        const remainingAttempts = MAX_ATTEMPTS - newAttempts
        setErrors({ 
          general: `Произошла ошибка при авторизации. Попробуйте еще раз.${remainingAttempts > 0 ? ` (осталось попыток: ${remainingAttempts})` : ''}` 
        })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-container page-container-ocean">
      <div className="card login-card container-narrow">
        <h1 className="page-title">Вход</h1>
        
        {errors.general && (
          <div className="alert alert-error">{errors.general}</div>
        )}

        {isBlocked && (
          <div className="alert alert-error">
            <strong>Доступ заблокирован</strong>
            <p style={{ marginTop: '0.5rem', marginBottom: 0 }}>
              Превышено количество попыток входа. 
              {timeRemaining > 0 && (
                <span> Попробуйте снова через {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}</span>
              )}
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="form">
          <div className="form-group">
            <label htmlFor="email" className="form-label">Email *</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className={`form-input ${errors.email ? 'error' : ''}`}
              placeholder="your@email.com"
              disabled={isBlocked}
            />
            {errors.email && <span className="form-error">{errors.email}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label">Пароль *</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className={`form-input ${errors.password ? 'error' : ''}`}
                placeholder="Введите пароль"
                disabled={isBlocked}
                style={{ paddingRight: '40px' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isBlocked}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: isBlocked ? 'not-allowed' : 'pointer',
                  padding: '5px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isBlocked ? 'var(--stone)' : 'var(--ocean-deep)',
                  fontSize: '1.2rem',
                  opacity: isBlocked ? 0.5 : 1
                }}
                tabIndex={-1}
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
            {errors.password && <span className="form-error">{errors.password}</span>}
          </div>

          <div style={{ marginBottom: '1rem', textAlign: 'right' }}>
            <Link 
              to="/forgot-password" 
              style={{ 
                fontSize: '0.9rem', 
                color: 'var(--ocean-deep)',
                fontWeight: 'var(--font-weight-medium)',
                textDecoration: 'underline',
                textDecorationColor: 'var(--ocean-medium)'
              }}
            >
              Забыли пароль?
            </Link>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-full"
            disabled={loading || isBlocked}
          >
            <span>{loading ? 'Вход...' : isBlocked ? 'Заблокировано' : 'Войти'}</span>
          </button>
        </form>

        <div className="page-footer">
          <p>
            Нет аккаунта? <Link to="/register">Зарегистрироваться</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default Login

