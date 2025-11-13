import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { authAPI } from '../services/api'
import '../styles/Login.css'

const ForgotPassword = () => {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    email: '',
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

    if (!formData.email.trim()) {
      newErrors.email = 'Email обязателен'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Неверный формат email'
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
    setSuccess(false)

    try {
      await authAPI.requestPasswordReset(formData.email)
      setSuccess(true)
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
        setErrors({ general: 'Произошла ошибка при отправке запроса. Попробуйте еще раз.' })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-container page-container-ocean">
      <div className="card login-card container-narrow">
        <h1 className="page-title">Восстановление пароля</h1>
        
        {success ? (
          <div className="alert alert-success">
            <p>Если пользователь с таким email существует, на него будет отправлено письмо с инструкциями по восстановлению пароля.</p>
            <p style={{ marginTop: '1rem' }}>
              <Link to="/login">Вернуться к входу</Link>
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
                />
                {errors.email && <span className="form-error">{errors.email}</span>}
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-full"
                disabled={loading}
              >
                <span>{loading ? 'Отправка...' : 'Отправить'}</span>
              </button>
            </form>

            <div className="page-footer">
              <p>
                Вспомнили пароль? <Link to="/login">Войти</Link>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default ForgotPassword

