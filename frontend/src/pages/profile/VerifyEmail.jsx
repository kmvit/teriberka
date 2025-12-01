import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { authAPI } from '../../services/api'
import '../../styles/Login.css'

const VerifyEmail = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState(null)
  const [token, setToken] = useState('')
  const [email, setEmail] = useState('')

  useEffect(() => {
    // Получаем токен и email из URL параметров
    const urlToken = searchParams.get('token')
    const urlEmail = searchParams.get('email')
    
    if (urlToken && urlEmail) {
      setToken(urlToken)
      setEmail(urlEmail)
      verifyEmail(urlToken, urlEmail)
    } else {
      setError('Отсутствуют необходимые параметры для подтверждения')
      setLoading(false)
    }
  }, [searchParams])

  const verifyEmail = async (token, email) => {
    try {
      const response = await authAPI.verifyEmail(token, email)
      
      // Сохраняем токен и пользователя, если они есть в ответе
      if (response.token) {
        localStorage.setItem('token', response.token)
        localStorage.setItem('user', JSON.stringify(response.user))
      }
      
      setSuccess(true)
      
      // Перенаправляем на профиль через 3 секунды
      setTimeout(() => {
        navigate('/profile')
      }, 3000)
    } catch (err) {
      if (err.response && err.response.data) {
        setError(err.response.data.error || 'Ошибка подтверждения email')
      } else {
        setError('Произошла ошибка при подтверждении email')
      }
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="page-container page-container-ocean">
        <div className="card login-card container-narrow">
          <h1 className="page-title">Подтверждение email</h1>
          <div className="text-center">Проверка...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container page-container-ocean">
      <div className="card login-card container-narrow">
        <h1 className="page-title">Подтверждение email</h1>
        
        {success ? (
          <div className="alert alert-success">
            <p><strong>Email успешно подтвержден!</strong></p>
            <p style={{ marginTop: '1rem' }}>
              Ваш аккаунт активирован. Вы будете перенаправлены в личный кабинет через несколько секунд...
            </p>
            <p style={{ marginTop: '1rem' }}>
              <Link to="/profile">Перейти в личный кабинет сейчас</Link>
            </p>
          </div>
        ) : (
          <>
            {error && (
              <div className="alert alert-error">
                <p><strong>Ошибка подтверждения</strong></p>
                <p style={{ marginTop: '0.5rem', marginBottom: 0 }}>{error}</p>
              </div>
            )}

            <div className="page-footer">
              <p>
                <Link to="/login">Вернуться к входу</Link>
              </p>
              <p style={{ marginTop: '0.5rem' }}>
                Не получили письмо? <Link to="/register">Зарегистрироваться снова</Link>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default VerifyEmail

