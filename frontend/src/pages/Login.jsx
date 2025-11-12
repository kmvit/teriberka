import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { authAPI } from '../services/api'
import '../styles/Login.css'

const Login = () => {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    email: '',
    password: '',
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

    if (!formData.password) {
      newErrors.password = 'Пароль обязателен'
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
      const response = await authAPI.login(formData)
      
      // Сохраняем токен в localStorage
      if (response.token) {
        localStorage.setItem('token', response.token)
        localStorage.setItem('user', JSON.stringify(response.user))
      }

      // Перенаправляем на профиль
      navigate('/profile')
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
        
        setErrors(formattedErrors)
      } else {
        setErrors({ general: 'Произошла ошибка при авторизации. Попробуйте еще раз.' })
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
            />
            {errors.email && <span className="form-error">{errors.email}</span>}
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
              placeholder="Введите пароль"
            />
            {errors.password && <span className="form-error">{errors.password}</span>}
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-full"
            disabled={loading}
          >
            <span>{loading ? 'Вход...' : 'Войти'}</span>
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

