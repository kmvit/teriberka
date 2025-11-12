import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { authAPI } from '../services/api'
import '../styles/Profile.css'

const Profile = () => {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const loadProfile = async () => {
      const token = localStorage.getItem('token')
      if (!token) {
        navigate('/login')
        return
      }

      try {
        const userData = await authAPI.getProfile()
        setUser(userData)
      } catch (err) {
        if (err.response?.status === 401) {
          localStorage.removeItem('token')
          localStorage.removeItem('user')
          navigate('/login')
        } else {
          setError('Ошибка загрузки профиля')
        }
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
  }, [navigate])

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/login')
  }

  if (loading) {
    return (
      <div className="page-container page-container-ocean">
        <div className="card container-narrow">
          <div className="text-center">Загрузка...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="page-container page-container-ocean">
        <div className="card container-narrow">
          <div className="alert alert-error">{error}</div>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  // Получаем имя для приветствия
  const getGreeting = () => {
    if (user.first_name) {
      return `Привет, ${user.first_name}!`
    }
    if (user.email) {
      const name = user.email.split('@')[0]
      return `Привет, ${name}!`
    }
    return 'Привет!'
  }

  return (
    <div className="page-container page-container-ocean">
      <div className="card container-narrow profile-card">
        <h1 className="page-title">Личный кабинет</h1>
        
        <div className="profile-content">
          <div className="profile-greeting">
            <h2 className="section-title">{getGreeting()}</h2>
            <p className="profile-subtitle">Добро пожаловать в ваш личный кабинет</p>
          </div>

          <div className="profile-info">
            <div className="info-item">
              <label className="info-label">Email:</label>
              <div className="info-value">{user.email}</div>
            </div>

            {user.phone && (
              <div className="info-item">
                <label className="info-label">Телефон:</label>
                <div className="info-value">{user.phone}</div>
              </div>
            )}

            {user.first_name && (
              <div className="info-item">
                <label className="info-label">Имя:</label>
                <div className="info-value">{user.first_name}</div>
              </div>
            )}

            {user.last_name && (
              <div className="info-item">
                <label className="info-label">Фамилия:</label>
                <div className="info-value">{user.last_name}</div>
              </div>
            )}

            <div className="info-item">
              <label className="info-label">Роль:</label>
              <div className="info-value">
                {user.role === 'customer' && 'Клиент'}
                {user.role === 'boat_owner' && 'Владелец катера'}
                {user.role === 'guide' && 'Гид'}
              </div>
            </div>
          </div>

          <div className="profile-actions">
            <button 
              className="btn btn-secondary btn-full"
              onClick={handleLogout}
            >
              Выйти
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Profile

