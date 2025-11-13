import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { authAPI } from '../services/api'
import '../styles/Register.css'

const Register = () => {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    email: '',
    first_name: '',
    phone: '',
    password: '',
    password_confirm: '',
    role: 'customer',
  })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

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

    if (!formData.email.trim()) {
      newErrors.email = 'Email обязателен'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Неверный формат email'
    }

    if (!formData.first_name.trim()) {
      newErrors.first_name = 'Имя обязательно'
    } else if (formData.first_name.trim().length < 2) {
      newErrors.first_name = 'Имя должно содержать минимум 2 символа'
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Телефон обязателен'
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
        
        // Перенаправляем на профиль сразу после сохранения токена
        navigate('/profile')
      } else {
        setErrors({ general: 'Токен не получен. Попробуйте войти вручную.' })
      }
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
    <div className="page-container page-container-ocean">
      <div className="card register-card container-narrow">
        <h1 className="page-title">Регистрация</h1>
        
        {errors.general && (
          <div className="alert alert-error">{errors.general}</div>
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
            />
            {errors.email && <span className="form-error">{errors.email}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="first_name" className="form-label">Имя *</label>
            <input
              type="text"
              id="first_name"
              name="first_name"
              value={formData.first_name}
              onChange={handleChange}
              className={`form-input ${errors.first_name ? 'error' : ''}`}
              placeholder="Ваше имя"
            />
            {errors.first_name && <span className="form-error">{errors.first_name}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="phone" className="form-label">Телефон *</label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="+7 (999) 999-99-99"
              className={`form-input ${errors.phone ? 'error' : ''}`}
            />
            {errors.phone && <span className="form-error">{errors.phone}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="role" className="form-label">Роль *</label>
            <select
              id="role"
              name="role"
              value={formData.role}
              onChange={handleChange}
              className="form-select"
            >
              <option value="customer">Клиент</option>
              <option value="boat_owner">Владелец катера</option>
              <option value="guide">Гид</option>
            </select>
            <small className="form-hint">
              {formData.role === 'boat_owner' && 
                'Для владельцев катеров требуется верификация документов'}
            </small>
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label">Пароль *</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className={`form-input ${errors.password ? 'error' : ''}`}
            />
            {errors.password && <span className="form-error">{errors.password}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="password_confirm" className="form-label">Подтверждение пароля *</label>
            <input
              type="password"
              id="password_confirm"
              name="password_confirm"
              value={formData.password_confirm}
              onChange={handleChange}
              className={`form-input ${errors.password_confirm ? 'error' : ''}`}
            />
            {errors.password_confirm && (
              <span className="form-error">{errors.password_confirm}</span>
            )}
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-full"
            disabled={loading}
          >
            <span>{loading ? 'Регистрация...' : 'Зарегистрироваться'}</span>
          </button>
        </form>

        <div className="page-footer">
          <p>
            Уже есть аккаунт? <Link to="/login">Войти</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default Register

