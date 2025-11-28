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
      <div className="profile-page">
        <div className="profile-container">
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Загрузка профиля...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="profile-page">
        <div className="profile-container">
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
      const firstName = user.first_name.trim()
      const capitalizedName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase()
      return capitalizedName
    }
    if (user.email) {
      return user.email.split('@')[0]
    }
    return 'Пользователь'
  }

  const getRoleLabel = () => {
    if (user.role === 'customer') return 'Клиент'
    if (user.role === 'boat_owner') return 'Владелец катера'
    if (user.role === 'guide') return 'Гид'
    return 'Пользователь'
  }

  const getRoleIcon = () => {
    if (user.role === 'boat_owner') return '⛵'
    if (user.role === 'guide') return '🧭'
    return '👤'
  }

  const getInitials = () => {
    if (user.first_name && user.last_name) {
      return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase()
    }
    if (user.first_name) {
      return user.first_name[0].toUpperCase()
    }
    if (user.email) {
      return user.email[0].toUpperCase()
    }
    return 'U'
  }

  const dashboard = user.dashboard || {}

  return (
    <div className="profile-page">
      <div className="profile-container">
        {/* Заголовок профиля */}
        <div className="profile-header">
          <div className="profile-avatar">
            <div className="avatar-circle">
              {getInitials()}
            </div>
            <div className="role-badge">
              <span className="role-icon">{getRoleIcon()}</span>
            </div>
          </div>
          <div className="profile-header-info">
            <h1 className="profile-name">{getGreeting()}</h1>
            <p className="profile-role">{getRoleLabel()}</p>
            {user.email && <p className="profile-email">{user.email}</p>}
          </div>
        </div>

        {/* Дашборд (если есть) */}
        {user.role === 'boat_owner' && dashboard.today_stats && (
          <div className="dashboard-section">
            <h2 className="dashboard-title">Статистика</h2>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon">📅</div>
                <div className="stat-content">
                  <div className="stat-value">{dashboard.today_stats.bookings_count || 0}</div>
                  <div className="stat-label">Бронирований сегодня</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">💰</div>
                <div className="stat-content">
                  <div className="stat-value">
                    {dashboard.today_stats.revenue 
                      ? `${Math.round(dashboard.today_stats.revenue).toLocaleString('ru-RU')} ₽`
                      : '0 ₽'}
                  </div>
                  <div className="stat-label">Доход сегодня</div>
                </div>
              </div>
              {dashboard.week_stats && (
                <div className="stat-card">
                  <div className="stat-icon">📊</div>
                  <div className="stat-content">
                    <div className="stat-value">{dashboard.week_stats.bookings_count || 0}</div>
                    <div className="stat-label">Бронирований за неделю</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {user.role === 'guide' && dashboard.total_commission !== undefined && (
          <div className="dashboard-section">
            <h2 className="dashboard-title">Комиссии</h2>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon">💵</div>
                <div className="stat-content">
                  <div className="stat-value">
                    {Math.round(dashboard.total_commission || 0).toLocaleString('ru-RU')} ₽
                  </div>
                  <div className="stat-label">Общая комиссия</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">📋</div>
                <div className="stat-content">
                  <div className="stat-value">{dashboard.bookings_count || 0}</div>
                  <div className="stat-label">Всего бронирований</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {user.role === 'customer' && dashboard.total_bookings !== undefined && (
          <div className="dashboard-section">
            <h2 className="dashboard-title">Мои бронирования</h2>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon">🎫</div>
                <div className="stat-content">
                  <div className="stat-value">{dashboard.total_bookings || 0}</div>
                  <div className="stat-label">Всего бронирований</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">📅</div>
                <div className="stat-content">
                  <div className="stat-value">{dashboard.upcoming_bookings || 0}</div>
                  <div className="stat-label">Предстоящих</div>
                </div>
              </div>
            </div>
              </div>
            )}

        {/* Информация о профиле */}
        <div className="profile-section">
          <h2 className="section-title">Личная информация</h2>
          <div className="info-grid">
            {user.first_name && (
              <div className="info-card">
                <div className="info-icon">👤</div>
                <div className="info-content">
                  <div className="info-label">Имя</div>
                <div className="info-value">{user.first_name}</div>
                </div>
              </div>
            )}
            {user.last_name && (
              <div className="info-card">
                <div className="info-icon">📝</div>
                <div className="info-content">
                  <div className="info-label">Фамилия</div>
                <div className="info-value">{user.last_name}</div>
                </div>
              </div>
            )}
            {user.phone && (
              <div className="info-card">
                <div className="info-icon">📞</div>
                <div className="info-content">
                  <div className="info-label">Телефон</div>
                  <div className="info-value">{user.phone}</div>
                </div>
              </div>
            )}
            <div className="info-card">
              <div className="info-icon">✉️</div>
              <div className="info-content">
                <div className="info-label">Email</div>
                <div className="info-value">{user.email}</div>
              </div>
              </div>
            </div>
          </div>

        {/* Действия */}
          <div className="profile-actions">
            <button 
              className="btn btn-secondary btn-full"
              onClick={handleLogout}
            >
            Выйти из аккаунта
            </button>
        </div>
      </div>
    </div>
  )
}

export default Profile

