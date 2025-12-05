import { useState, useEffect } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { authAPI } from '../../services/api'
import '../../styles/Profile.css'

const Profile = () => {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    first_name: '',
    last_name: '',
    phone: ''
  })
  const [saving, setSaving] = useState(false)
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [passwordForm, setPasswordForm] = useState({
    old_password: '',
    new_password: '',
    new_password_confirm: ''
  })
  const [passwordError, setPasswordError] = useState(null)
  const [changingPassword, setChangingPassword] = useState(false)

  const formatDate = (dateString) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    // Проверяем, есть ли время в строке
    if (dateString.includes('T') || dateString.includes(' ')) {
      return date.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } else {
      // Только дата без времени
      return date.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })
    }
  }

  // Загрузка профиля
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

  const handleStartEdit = () => {
    setEditForm({
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      phone: user.phone || ''
    })
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditForm({
      first_name: '',
      last_name: '',
      phone: ''
    })
  }

  const handleSaveEdit = async () => {
    setSaving(true)
    try {
      const updatedUser = await authAPI.updateProfile(editForm)
      setUser(updatedUser)
      setIsEditing(false)
      // Обновляем данные в localStorage, если там хранится информация о пользователе
      const storedUser = localStorage.getItem('user')
      if (storedUser) {
        const userObj = JSON.parse(storedUser)
        localStorage.setItem('user', JSON.stringify({ ...userObj, ...updatedUser }))
      }
    } catch (err) {
      alert('Ошибка сохранения: ' + (err.response?.data?.error || err.response?.data?.detail || err.message))
    } finally {
      setSaving(false)
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setEditForm(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handlePasswordChange = (e) => {
    const { name, value } = e.target
    setPasswordForm(prev => ({
      ...prev,
      [name]: value
    }))
    setPasswordError(null)
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    setPasswordError(null)
    setChangingPassword(true)

    // Валидация
    if (!passwordForm.old_password || !passwordForm.new_password || !passwordForm.new_password_confirm) {
      setPasswordError('Заполните все поля')
      setChangingPassword(false)
      return
    }

    if (passwordForm.new_password !== passwordForm.new_password_confirm) {
      setPasswordError('Новые пароли не совпадают')
      setChangingPassword(false)
      return
    }

    if (passwordForm.new_password.length < 8) {
      setPasswordError('Пароль должен содержать минимум 8 символов')
      setChangingPassword(false)
      return
    }

    try {
      await authAPI.changePassword(
        passwordForm.old_password,
        passwordForm.new_password,
        passwordForm.new_password_confirm
      )
      setShowChangePassword(false)
      setPasswordForm({
        old_password: '',
        new_password: '',
        new_password_confirm: ''
      })
      alert('Пароль успешно изменен')
    } catch (err) {
      const errorMessage = err.response?.data?.old_password?.[0] || 
                          err.response?.data?.new_password?.[0] ||
                          err.response?.data?.detail ||
                          err.response?.data?.error ||
                          'Ошибка смены пароля'
      setPasswordError(errorMessage)
    } finally {
      setChangingPassword(false)
    }
  }

  const handleCancelPasswordChange = () => {
    setShowChangePassword(false)
    setPasswordForm({
      old_password: '',
      new_password: '',
      new_password_confirm: ''
    })
    setPasswordError(null)
  }

  // Получаем имя для приветствия
  const getGreeting = () => {
    if (!user) return 'Пользователь'
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
    if (!user) return 'Пользователь'
    if (user.role === 'customer') return 'Клиент'
    if (user.role === 'boat_owner') return 'Владелец катера'
    if (user.role === 'guide') return 'Гид'
    return 'Пользователь'
  }

  const getRoleIcon = () => {
    if (!user) return '👤'
    if (user.role === 'boat_owner') return '⛵'
    if (user.role === 'guide') return '🧭'
    return '👤'
  }

  const getInitials = () => {
    if (!user) return 'U'
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
          </div>
          <div className="profile-personal-info" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginLeft: 'auto', minWidth: '250px' }}>
            {!isEditing && !showChangePassword ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                  <span>👤</span>
                  <span style={{ color: 'var(--stone)' }}>Имя:</span>
                  <span style={{ fontWeight: 'var(--font-weight-medium)', color: '#1a1a1a' }}>{user.first_name || '—'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                  <span>📝</span>
                  <span style={{ color: 'var(--stone)' }}>Фамилия:</span>
                  <span style={{ fontWeight: 'var(--font-weight-medium)', color: '#1a1a1a' }}>{user.last_name || '—'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                  <span>📞</span>
                  <span style={{ color: 'var(--stone)' }}>Телефон:</span>
                  <span style={{ fontWeight: 'var(--font-weight-medium)', color: '#1a1a1a' }}>{user.phone || '—'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                  <span>✉️</span>
                  <span style={{ color: 'var(--stone)' }}>Email:</span>
                  <span style={{ fontWeight: 'var(--font-weight-medium)', color: '#1a1a1a' }}>{user.email}</span>
                </div>
                <button
                  onClick={handleStartEdit}
                  className="btn btn-secondary"
                  style={{ marginTop: '0.5rem', fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                >
                  ✏️ Редактировать
                </button>
                <button
                  onClick={() => setShowChangePassword(true)}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                >
                  🔒 Сменить пароль
                </button>
              </>
            ) : isEditing ? (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                    <span>👤</span>
                    <span style={{ color: 'var(--stone)', minWidth: '70px' }}>Имя:</span>
                    <input
                      type="text"
                      name="first_name"
                      value={editForm.first_name}
                      onChange={handleInputChange}
                      className="form-input"
                      style={{ fontSize: '0.875rem', padding: '0.375rem 0.5rem', flex: 1 }}
                      placeholder="Введите имя"
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                    <span>📝</span>
                    <span style={{ color: 'var(--stone)', minWidth: '70px' }}>Фамилия:</span>
                    <input
                      type="text"
                      name="last_name"
                      value={editForm.last_name}
                      onChange={handleInputChange}
                      className="form-input"
                      style={{ fontSize: '0.875rem', padding: '0.375rem 0.5rem', flex: 1 }}
                      placeholder="Введите фамилию"
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                    <span>📞</span>
                    <span style={{ color: 'var(--stone)', minWidth: '70px' }}>Телефон:</span>
                    <input
                      type="tel"
                      name="phone"
                      value={editForm.phone}
                      onChange={handleInputChange}
                      className="form-input"
                      style={{ fontSize: '0.875rem', padding: '0.375rem 0.5rem', flex: 1 }}
                      placeholder="+79001234567"
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                    <span>✉️</span>
                    <span style={{ color: 'var(--stone)', minWidth: '70px' }}>Email:</span>
                    <span style={{ fontWeight: 'var(--font-weight-medium)', color: '#1a1a1a', flex: 1 }}>{user.email}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button
                    onClick={handleSaveEdit}
                    className="btn btn-primary"
                    disabled={saving}
                    style={{ fontSize: '0.875rem', padding: '0.5rem 1rem', flex: 1 }}
                  >
                    {saving ? 'Сохранение...' : '💾 Сохранить'}
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="btn btn-secondary"
                    disabled={saving}
                    style={{ fontSize: '0.875rem', padding: '0.5rem 1rem', flex: 1 }}
                  >
                    Отмена
                  </button>
                </div>
              </>
            ) : showChangePassword ? (
              <>
                <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {passwordError && (
                    <div className="alert alert-error" style={{ fontSize: '0.75rem', padding: '0.5rem' }}>
                      {passwordError}
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--stone)' }}>Текущий пароль *</label>
                    <input
                      type="password"
                      name="old_password"
                      value={passwordForm.old_password}
                      onChange={handlePasswordChange}
                      className="form-input"
                      required
                      style={{ fontSize: '0.875rem', padding: '0.375rem 0.5rem' }}
                      placeholder="Текущий пароль"
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--stone)' }}>Новый пароль *</label>
                    <input
                      type="password"
                      name="new_password"
                      value={passwordForm.new_password}
                      onChange={handlePasswordChange}
                      className="form-input"
                      required
                      minLength={8}
                      style={{ fontSize: '0.875rem', padding: '0.375rem 0.5rem' }}
                      placeholder="Минимум 8 символов"
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--stone)' }}>Подтвердите *</label>
                    <input
                      type="password"
                      name="new_password_confirm"
                      value={passwordForm.new_password_confirm}
                      onChange={handlePasswordChange}
                      className="form-input"
                      required
                      minLength={8}
                      style={{ fontSize: '0.875rem', padding: '0.375rem 0.5rem' }}
                      placeholder="Повторите пароль"
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={changingPassword}
                      style={{ fontSize: '0.875rem', padding: '0.5rem 1rem', flex: 1 }}
                    >
                      {changingPassword ? 'Сохранение...' : '💾 Сохранить'}
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelPasswordChange}
                      className="btn btn-secondary"
                      disabled={changingPassword}
                      style={{ fontSize: '0.875rem', padding: '0.5rem 1rem', flex: 1 }}
                    >
                      Отмена
                    </button>
                  </div>
                </form>
              </>
            ) : null}
          </div>
        </div>

        {/* Навигация для капитана */}
        {user.role === 'boat_owner' && (
          <div className="profile-navigation">
            <Link to="/profile/boats" className="profile-nav-link">
              <span className="nav-icon">⛵</span>
              <span className="nav-text">Мои суда</span>
            </Link>
            <Link to="/profile/bookings" className="profile-nav-link">
              <span className="nav-icon">📋</span>
              <span className="nav-text">Бронирования</span>
            </Link>
            <Link to="/profile/finances" className="profile-nav-link">
              <span className="nav-icon">💰</span>
              <span className="nav-text">Финансы</span>
            </Link>
          </div>
        )}

        {/* Навигация для гида */}
        {user.role === 'guide' && (
          <div className="profile-navigation">
            <Link to="/profile/bookings" className="profile-nav-link">
              <span className="nav-icon">📋</span>
              <span className="nav-text">Мои бронирования</span>
            </Link>
            <Link to="/profile/finances" className="profile-nav-link">
              <span className="nav-icon">💰</span>
              <span className="nav-text">Комиссии</span>
            </Link>
          </div>
        )}

        {/* Навигация для клиента */}
        {user.role === 'customer' && (
          <div className="profile-navigation">
            <Link to="/profile/bookings" className="profile-nav-link">
              <span className="nav-icon">📋</span>
              <span className="nav-text">Мои бронирования</span>
            </Link>
          </div>
        )}

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
              {dashboard.week_stats && (
                <div className="stat-card">
                  <div className="stat-icon">💵</div>
                  <div className="stat-content">
                    <div className="stat-value">
                      {dashboard.week_stats.revenue 
                        ? `${Math.round(dashboard.week_stats.revenue).toLocaleString('ru-RU')} ₽`
                        : '0 ₽'}
                    </div>
                    <div className="stat-label">Доход за неделю</div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Ближайшие бронирования */}
            {dashboard.upcoming_bookings && dashboard.upcoming_bookings.length > 0 && (
              <div className="upcoming-bookings-section">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <h3 className="section-subtitle">Ближайшие бронирования</h3>
                  <Link to="/profile/bookings" className="btn btn-link" style={{ fontSize: '0.875rem' }}>
                    Все бронирования →
                  </Link>
                </div>
                <div className="bookings-list">
                  {dashboard.upcoming_bookings.slice(0, 3).map((booking) => (
                    <div key={booking.id} className="booking-card-mini">
                      <div className="booking-date">
                        {formatDate(booking.start_datetime)}
                      </div>
                      <div className="booking-info">
                        <div className="booking-event">{booking.event_type}</div>
                        <div className="booking-details">
                          {booking.number_of_people} чел. • {booking.guest_name || 'Гость'}
                        </div>
                      </div>
                      <div className="booking-price">
                        {Math.round(booking.total_price || 0).toLocaleString('ru-RU')} ₽
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {user.role === 'guide' && dashboard.total_commission !== undefined && (
          <div className="dashboard-section">
            <h2 className="dashboard-title">Статистика</h2>
            <div className="stats-grid">
              <div className="stat-card stat-card-primary">
                <div className="stat-icon">💵</div>
                <div className="stat-content">
                  <div className="stat-value">
                    {Math.round(dashboard.total_commission || 0).toLocaleString('ru-RU')} ₽
                  </div>
                  <div className="stat-label">Заработано комиссий</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">⏳</div>
                <div className="stat-content">
                  <div className="stat-value">
                    {Math.round(dashboard.pending_commission || 0).toLocaleString('ru-RU')} ₽
                  </div>
                  <div className="stat-label">Ожидаемая комиссия</div>
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
            
            {/* Ближайшие бронирования */}
            {dashboard.upcoming_bookings && dashboard.upcoming_bookings.length > 0 && (
              <div className="upcoming-bookings-section">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <h3 className="section-subtitle">Ближайшие бронирования</h3>
                  <Link to="/profile/bookings" className="btn btn-link" style={{ fontSize: '0.875rem' }}>
                    Все бронирования →
                  </Link>
                </div>
                <div className="bookings-list">
                  {dashboard.upcoming_bookings.slice(0, 3).map((booking) => (
                    <div key={booking.id} className="booking-card-mini">
                      <div className="booking-date">
                        {formatDate(booking.start_datetime)}
                      </div>
                      <div className="booking-info">
                        <div className="booking-event">{booking.event_type || booking.boat?.name}</div>
                        <div className="booking-details">
                          {booking.number_of_people} чел. • {booking.guest_name || 'Гость'}
                          {booking.boat && ` • ${booking.boat.name}`}
                        </div>
                      </div>
                      <div className="booking-price">
                        {booking.guide_total_commission 
                          ? `${Math.round(booking.guide_total_commission).toLocaleString('ru-RU')} ₽`
                          : '—'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
                  <div className="stat-value">{dashboard.upcoming_bookings_count || 0}</div>
                  <div className="stat-label">Предстоящих</div>
                </div>
              </div>
            </div>
            
            {/* Ближайшие бронирования */}
            {dashboard.upcoming_bookings && dashboard.upcoming_bookings.length > 0 && (
              <div className="upcoming-bookings-section">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <h3 className="section-subtitle">Ближайшие бронирования</h3>
                  <Link to="/profile/bookings" className="btn btn-link" style={{ fontSize: '0.875rem' }}>
                    Все бронирования →
                  </Link>
                </div>
                <div className="bookings-list">
                  {dashboard.upcoming_bookings.slice(0, 3).map((booking) => (
                    <div key={booking.id} className="booking-card-mini">
                      <div className="booking-date">
                        {formatDate(booking.start_datetime)}
                      </div>
                      <div className="booking-info">
                        <div className="booking-event">{booking.event_type || booking.boat?.name}</div>
                        <div className="booking-details">
                          {booking.number_of_people} чел. • {booking.boat?.name || 'Судно'}
                        </div>
                      </div>
                      <div className="booking-price">
                        {Math.round(booking.total_price || 0).toLocaleString('ru-RU')} ₽
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Действия */}
        <div className="profile-section">
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
    </div>
  )
}

export default Profile

