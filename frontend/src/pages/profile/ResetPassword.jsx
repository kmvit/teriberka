import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { authAPI } from '../../services/api'
import '../../styles/Login.css'

const ResetPassword = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    passwordConfirm: '',
  })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [token, setToken] = useState('')

  useEffect(() => {
    // Получаем токен из URL параметров
    const urlToken = searchParams.get('token')
    const urlEmail = searchParams.get('email')
    
    if (urlToken) {
      setToken(urlToken)
    }
    if (urlEmail) {
      setFormData(prev => ({ ...prev, email: urlEmail }))
    }
  }, [searchParams])

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
    } else if (formData.password.length < 8) {
      newErrors.password = 'Пароль должен содержать минимум 8 символов'
    }

    if (!formData.passwordConfirm) {
      newErrors.passwordConfirm = 'Подтверждение пароля обязательно'
    } else if (formData.password !== formData.passwordConfirm) {
      newErrors.passwordConfirm = 'Пароли не совпадают'
    }

    if (!token) {
      newErrors.general = 'Токен отсутствует. Пожалуйста, используйте ссылку из письма.'
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
      await authAPI.confirmPasswordReset(
        token,
        formData.email,
        formData.password,
        formData.passwordConfirm
      )
      setSuccess(true)
      // Перенаправляем на страницу входа через 3 секунды
      setTimeout(() => {
        navigate('/login')
      }, 3000)
    } catch (error) {
      if (error.response && error.response.data) {
        const serverErrors = error.response.data
        
        const formattedErrors = {}
        
        Object.keys(serverErrors).forEach((key) => {
          if (Array.isArray(serverErrors[key])) {
            formattedErrors[key] = serverErrors[key][0]
          } else if (typeof serverErrors[key] === 'object') {
            if (serverErrors[key].non_field_errors) {
              formattedErrors[key] = serverErrors[key].non_field_errors[0]
            } else {
              formattedErrors[key] = Object.values(serverErrors[key])[0]
            }
          } else {
            formattedErrors[key] = serverErrors[key]
          }
        })
        
        if (serverErrors.non_field_errors) {
          formattedErrors.general = Array.isArray(serverErrors.non_field_errors)
            ? serverErrors.non_field_errors[0]
            : serverErrors.non_field_errors
        }
        
        if (Object.keys(formattedErrors).length === 0) {
          formattedErrors.general = 'Произошла ошибка. Попробуйте еще раз.'
        }
        
        setErrors(formattedErrors)
      } else {
        setErrors({ general: 'Произошла ошибка при сбросе пароля. Попробуйте еще раз.' })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-container page-container-ocean">
      <div className="card login-card container-narrow">
        <h1 className="page-title">Сброс пароля</h1>
        
        {success ? (
          <div className="alert alert-success">
            <p>Пароль успешно изменен!</p>
            <p style={{ marginTop: '1rem' }}>
              Вы будете перенаправлены на страницу входа через несколько секунд...
            </p>
            <p style={{ marginTop: '1rem' }}>
              <Link to="/login">Перейти к входу сейчас</Link>
            </p>
          </div>
        ) : (
          <>
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
                  disabled={!!searchParams.get('email')}
                />
                {errors.email && <span className="form-error">{errors.email}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="password" className="form-label">Новый пароль *</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className={`form-input ${errors.password ? 'error' : ''}`}
                  placeholder="Введите новый пароль"
                />
                {errors.password && <span className="form-error">{errors.password}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="passwordConfirm" className="form-label">Подтверждение пароля *</label>
                <input
                  type="password"
                  id="passwordConfirm"
                  name="passwordConfirm"
                  value={formData.passwordConfirm}
                  onChange={handleChange}
                  className={`form-input ${errors.passwordConfirm ? 'error' : ''}`}
                  placeholder="Подтвердите новый пароль"
                />
                {errors.passwordConfirm && <span className="form-error">{errors.passwordConfirm}</span>}
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-full"
                disabled={loading}
              >
                <span>{loading ? 'Сброс пароля...' : 'Сбросить пароль'}</span>
              </button>
            </form>

            <div className="page-footer">
              <p>
                <Link to="/login">Вернуться к входу</Link>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default ResetPassword

