import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authAPI } from '../services/api'
import '../styles/Register.css'

const Register = () => {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    phone: '',
    first_name: '',
    last_name: '',
    password: '',
    password_confirm: '',
    role: 'customer',
  })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

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
  }

  const validateForm = () => {
    const newErrors = {}

    if (!formData.username.trim()) {
      newErrors.username = 'Имя пользователя обязательно'
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email обязателен'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Неверный формат email'
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Телефон обязателен'
    }

    if (!formData.first_name.trim()) {
      newErrors.first_name = 'Имя обязательно'
    }

    if (!formData.last_name.trim()) {
      newErrors.last_name = 'Фамилия обязательна'
    }

    if (!formData.password) {
      newErrors.password = 'Пароль обязателен'
    } else if (formData.password.length < 8) {
      newErrors.password = 'Пароль должен содержать минимум 8 символов'
    }

    if (!formData.password_confirm) {
      newErrors.password_confirm = 'Подтверждение пароля обязательно'
    } else if (formData.password !== formData.password_confirm) {
      newErrors.password_confirm = 'Пароли не совпадают'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    setLoading(true)
    setErrors({})

    try {
      const response = await authAPI.register(formData)
      
      // Сохраняем токен в localStorage
      if (response.token) {
        localStorage.setItem('token', response.token)
        localStorage.setItem('user', JSON.stringify(response.user))
      }

      setSuccess(true)
      
      // Перенаправляем на главную страницу или профиль через 2 секунды
      setTimeout(() => {
        navigate('/')
      }, 2000)
    } catch (error) {
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
            // Обрабатываем вложенные объекты (например, password: {non_field_errors: [...]})
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
        
        setErrors(formattedErrors)
      } else {
        setErrors({ general: 'Произошла ошибка при регистрации. Попробуйте еще раз.' })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="register-container">
      <div className="register-card">
        <h1 className="register-title">Регистрация</h1>
        
        {success && (
          <div className="success-message">
            Регистрация успешна! Вы будете перенаправлены...
          </div>
        )}

        {errors.general && (
          <div className="error-message">{errors.general}</div>
        )}

        <form onSubmit={handleSubmit} className="register-form">
          <div className="form-group">
            <label htmlFor="username">Имя пользователя *</label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              className={errors.username ? 'error' : ''}
            />
            {errors.username && <span className="field-error">{errors.username}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="email">Email *</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className={errors.email ? 'error' : ''}
            />
            {errors.email && <span className="field-error">{errors.email}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="phone">Телефон *</label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="+7 (999) 999-99-99"
              className={errors.phone ? 'error' : ''}
            />
            {errors.phone && <span className="field-error">{errors.phone}</span>}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="first_name">Имя *</label>
              <input
                type="text"
                id="first_name"
                name="first_name"
                value={formData.first_name}
                onChange={handleChange}
                className={errors.first_name ? 'error' : ''}
              />
              {errors.first_name && <span className="field-error">{errors.first_name}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="last_name">Фамилия *</label>
              <input
                type="text"
                id="last_name"
                name="last_name"
                value={formData.last_name}
                onChange={handleChange}
                className={errors.last_name ? 'error' : ''}
              />
              {errors.last_name && <span className="field-error">{errors.last_name}</span>}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="role">Роль *</label>
            <select
              id="role"
              name="role"
              value={formData.role}
              onChange={handleChange}
            >
              <option value="customer">Клиент</option>
              <option value="boat_owner">Владелец катера</option>
              <option value="guide">Гид</option>
            </select>
            <small className="role-hint">
              {formData.role === 'boat_owner' && 
                'Для владельцев катеров требуется верификация документов'}
            </small>
          </div>

          <div className="form-group">
            <label htmlFor="password">Пароль *</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className={errors.password ? 'error' : ''}
            />
            {errors.password && <span className="field-error">{errors.password}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="password_confirm">Подтверждение пароля *</label>
            <input
              type="password"
              id="password_confirm"
              name="password_confirm"
              value={formData.password_confirm}
              onChange={handleChange}
              className={errors.password_confirm ? 'error' : ''}
            />
            {errors.password_confirm && (
              <span className="field-error">{errors.password_confirm}</span>
            )}
          </div>

          <button
            type="submit"
            className="submit-button"
            disabled={loading}
          >
            {loading ? 'Регистрация...' : 'Зарегистрироваться'}
          </button>
        </form>

        <div className="register-footer">
          <p>
            Уже есть аккаунт? <a href="/login">Войти</a>
          </p>
        </div>
      </div>
    </div>
  )
}

export default Register

