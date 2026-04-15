import { useState, useEffect } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { authAPI, siteSettingsAPI } from '../../services/api'
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
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [telegramStatus, setTelegramStatus] = useState({ is_linked: false, telegram_chat_id: null })
  const [telegramLoading, setTelegramLoading] = useState(false)
  const [maxStatus, setMaxStatus] = useState({ is_linked: false, max_chat_id: null })
  const [maxLoading, setMaxLoading] = useState(false)
  const [siteSettings, setSiteSettings] = useState(null)

  const formatDate = (dateString) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    if (dateString.includes('T') || dateString.includes(' ')) {
      return date.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Moscow'
      })
    } else {
      return date.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'Europe/Moscow'
      })
    }
  }

  const formatDateOnly = (dateString) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Europe/Moscow'
    })
  }

  /** Время выхода — всегда в московском времени (рейсы по МСК) */
  const formatTime = (dateString) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return date.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Moscow'
    })
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
        // Исправляем URL аватарки, если он относительный
        if (userData.avatar && userData.avatar.startsWith('/media/')) {
          const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'
          const baseUrl = apiBaseUrl.replace('/api', '')
          userData.avatar = baseUrl + userData.avatar
        }
        setUser(userData)
        
        // Загружаем статус Telegram
        loadTelegramStatus()
        loadMaxStatus()
        
        // Загружаем настройки сайта
        loadSiteSettings()
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

  // Загрузка статуса Telegram
  const loadTelegramStatus = async () => {
    try {
      const response = await authAPI.getTelegramStatus()
      setTelegramStatus(response)
    } catch (err) {
      console.error('Ошибка загрузки статуса Telegram:', err)
    }
  }

  // Загрузка статуса MAX
  const loadMaxStatus = async () => {
    try {
      const response = await authAPI.getMaxStatus()
      setMaxStatus(response)
    } catch (err) {
      console.error('Ошибка загрузки статуса MAX:', err)
    }
  }

  // Загрузка настроек сайта
  const loadSiteSettings = async () => {
    try {
      const response = await siteSettingsAPI.getSettings()
      setSiteSettings(response)
    } catch (err) {
      console.error('Ошибка загрузки настроек сайта:', err)
    }
  }

  // Отвязка Telegram
  const handleTelegramUnlink = async () => {
    if (!confirm('Вы уверены, что хотите отключить Telegram уведомления?')) {
      return
    }
    
    setTelegramLoading(true)
    try {
      await authAPI.unlinkTelegram()
      setTelegramStatus({ is_linked: false, telegram_chat_id: null })
      alert('Telegram успешно отключен')
    } catch (err) {
      alert('Ошибка отключения Telegram: ' + (err.response?.data?.error || err.message))
    } finally {
      setTelegramLoading(false)
    }
  }

  // Отвязка MAX
  const handleMaxUnlink = async () => {
    if (!confirm('Вы уверены, что хотите отключить MAX уведомления?')) {
      return
    }

    setMaxLoading(true)
    try {
      await authAPI.unlinkMax()
      setMaxStatus({ is_linked: false, max_chat_id: null })
      alert('MAX успешно отключен')
    } catch (err) {
      alert('Ошибка отключения MAX: ' + (err.response?.data?.error || err.message))
    } finally {
      setMaxLoading(false)
    }
  }

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
      if (storedUser && storedUser !== 'undefined' && storedUser.trim() !== '') {
        try {
          const userObj = JSON.parse(storedUser)
          localStorage.setItem('user', JSON.stringify({ ...userObj, ...updatedUser }))
        } catch (parseError) {
          // Если не удалось распарсить, просто сохраняем новые данные
          console.warn('Ошибка парсинга данных из localStorage:', parseError)
          localStorage.setItem('user', JSON.stringify(updatedUser))
        }
      } else {
        // Если данных нет, просто сохраняем новые
        localStorage.setItem('user', JSON.stringify(updatedUser))
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

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Проверяем тип файла
    if (!file.type.startsWith('image/')) {
      alert('Пожалуйста, выберите изображение')
      return
    }

    // Проверяем размер файла (максимум 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Размер файла не должен превышать 5MB')
      return
    }

    setUploadingAvatar(true)
    console.log('📷 Начало загрузки аватарки:', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type
    })
    try {
      const updatedUser = await authAPI.updateProfile({ avatar: file })
      console.log('✅ Аватарка успешно загружена:', {
        userId: updatedUser.id,
        avatarUrl: updatedUser.avatar,
        userEmail: updatedUser.email
      })
      // Исправляем URL аватарки, если он относительный
      if (updatedUser.avatar && updatedUser.avatar.startsWith('/media/')) {
        const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'
        const baseUrl = apiBaseUrl.replace('/api', '')
        updatedUser.avatar = baseUrl + updatedUser.avatar
        console.log('🔗 URL аватарки исправлен:', updatedUser.avatar)
      }
      setUser(updatedUser)
      // Обновляем данные в localStorage
      const storedUser = localStorage.getItem('user')
      if (storedUser && storedUser !== 'undefined' && storedUser.trim() !== '') {
        try {
          const userObj = JSON.parse(storedUser)
          localStorage.setItem('user', JSON.stringify({ ...userObj, ...updatedUser }))
        } catch (parseError) {
          // Если не удалось распарсить, просто сохраняем новые данные
          console.warn('Ошибка парсинга данных из localStorage:', parseError)
          localStorage.setItem('user', JSON.stringify(updatedUser))
        }
      } else {
        // Если данных нет, просто сохраняем новые
        localStorage.setItem('user', JSON.stringify(updatedUser))
      }
    } catch (err) {
      console.error('Ошибка загрузки аватарки:', err)
      const errorMessage = err.response?.data?.error || 
                          err.response?.data?.detail || 
                          (typeof err.response?.data === 'string' ? err.response.data : null) ||
                          err.message || 
                          'Неизвестная ошибка'
      alert('Ошибка загрузки аватарки: ' + errorMessage)
    } finally {
      setUploadingAvatar(false)
      // Сбрасываем значение input, чтобы можно было загрузить тот же файл снова
      e.target.value = ''
    }
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
    if (user.role === 'hotel') return 'Гостиница'
    return 'Пользователь'
  }

  const getRoleIcon = () => {
    if (!user) return '👤'
    if (user.role === 'boat_owner') return '⛵'
    if (user.role === 'guide') return '🧭'
    if (user.role === 'hotel') return '🏨'
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
  
  // Проверяем, требуется ли верификация
  // Админы не требуют верификации
  const requiresVerification = user.requires_verification === true
  const isVerified = user.verification_status === 'verified'

  // Если требуется верификация, показываем только форму верификации
  // Админы пропускают эту проверку
  if (requiresVerification && !isVerified && (user.role === 'boat_owner' || user.role === 'guide') && !user.is_staff) {
    return (
      <div className="profile-page">
        <div className="profile-container">
          <div className="profile-header">
            <div className="profile-avatar">
              <div className="avatar-circle" style={{ position: 'relative' }}>
                {user.avatar ? (
                  <img 
                    src={user.avatar} 
                    alt="Аватарка" 
                    style={{ 
                      width: '100%', 
                      height: '100%', 
                      objectFit: 'cover', 
                      borderRadius: '50%' 
                    }} 
                  />
                ) : (
                  getInitials()
                )}
                <label 
                  htmlFor="avatar-upload" 
                  className="avatar-upload-btn"
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    backgroundColor: 'var(--ocean)',
                    color: 'white',
                    borderRadius: '50%',
                    width: '40px',
                    height: '40px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    fontSize: '20px',
                    border: '3px solid white',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                    transition: 'all 0.2s ease',
                    zIndex: 20
                  }}
                  title="Нажмите, чтобы загрузить аватарку"
                  onMouseEnter={(e) => {
                    e.target.style.transform = 'scale(1.1)'
                    e.target.style.backgroundColor = 'var(--ocean-deep)'
                    e.target.style.boxShadow = '0 6px 16px rgba(0,0,0,0.5)'
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = 'scale(1)'
                    e.target.style.backgroundColor = 'var(--ocean)'
                    e.target.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)'
                  }}
                >
                  📷
                </label>
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  disabled={uploadingAvatar}
                  style={{ display: 'none' }}
                />
              </div>
            </div>
            <div className="profile-header-info">
              <h1 className="profile-name">{getGreeting()}</h1>
              <p className="profile-role">{getRoleLabel()}</p>
            </div>
          </div>

          <div className="profile-section" style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div className="alert alert-warning" style={{ marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>
                Требуется верификация
              </h2>
              <p style={{ marginBottom: '0.5rem' }}>
                Для доступа к функциям кабинета необходимо пройти верификацию.
                Пожалуйста, загрузите документы для проверки администратором.
              </p>
              
              {user.role === 'boat_owner' && (
                <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: 'rgba(255, 255, 255, 0.07)', borderRadius: '8px', textAlign: 'left' }}>
                  <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem', fontWeight: 'var(--font-weight-medium)', textAlign: 'left' }}>
                    Необходимые документы для капитана:
                  </h3>
                  <ol style={{ margin: 0, paddingLeft: '1.5rem', lineHeight: '1.8', textAlign: 'left' }}>
                    <li style={{ textAlign: 'left', marginBottom: '0.5rem' }}>
                      <strong>Лицензия</strong> — выдаётся Федеральной службой по надзору в сфере транспорта
                    </li>
                    <li style={{ textAlign: 'left', marginBottom: '0.5rem' }}>
                      <strong>Бортовой номер</strong> — для маломерных судов (до 20 метров в длину, до 12 человек). 
                      <br />
                      <span style={{ fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.6)' }}>
                        Судно не должно быть в реестре ГИМС МЧС России для коммерческих перевозок
                      </span>
                    </li>
                    <li style={{ textAlign: 'left', marginBottom: '0.5rem' }}>
                      <strong>Судовой билет</strong> — для маломерных судов, используемых в коммерческих целях, 
                      или прогулочных судов (до 12 метров в длину, до 12 пассажиров)
                    </li>
                  </ol>
                </div>
              )}
              
              {user.role === 'guide' && (
                <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: 'rgba(255, 255, 255, 0.07)', borderRadius: '8px', textAlign: 'left' }}>
                  <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem', fontWeight: 'var(--font-weight-medium)', textAlign: 'left' }}>
                    Необходимые документы для гида:
                  </h3>
                  <ul style={{ margin: 0, paddingLeft: '1.5rem', lineHeight: '1.8', textAlign: 'left' }}>
                    <li style={{ textAlign: 'left' }}>Паспорт или водительские права для подтверждения личности</li>
                    <li style={{ textAlign: 'left' }}>Лицензия или аттестат гида</li>
                  </ul>
                </div>
              )}
              
              {user.verification_status === 'pending' && (
                <p style={{ marginTop: '1rem', fontWeight: 'var(--font-weight-medium)' }}>
                  Ваши документы на проверке. Ожидайте решения администратора.
                </p>
              )}
              {user.verification_status === 'rejected' && (
                <p style={{ marginTop: '1rem', color: 'var(--error)', fontWeight: 'var(--font-weight-medium)' }}>
                  Верификация отклонена. Пожалуйста, загрузите документы повторно.
                </p>
              )}
            </div>

            {(user.verification_status === 'not_verified' || user.verification_status === 'rejected') && (
              <div style={{ textAlign: 'center' }}>
                <a
                  href="/profile/verification"
                  className="btn btn-primary"
                  style={{ fontSize: '1rem', padding: '0.75rem 2rem' }}
                >
                  Загрузить документы
                </a>
              </div>
            )}

            {user.verification_status === 'pending' && (
              <div className="profile-section">
                <h3 className="dashboard-title">Статус верификации</h3>
                <div style={{ padding: '1rem', backgroundColor: 'rgba(14, 249, 242, 0.1)', borderRadius: '8px' }}>
                  <p style={{ marginBottom: '0.5rem' }}>
                    <strong>Статус:</strong> На проверке
                  </p>
                  {user.verification_submitted_at && (
                    <p style={{ marginBottom: 0, fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.6)' }}>
                      Документы отправлены: {formatDate(user.verification_submitted_at)}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="profile-page">
      <div className="profile-container">
        {/* Заголовок профиля */}
        <div className="profile-header">
          <div className="profile-avatar">
            <div className="avatar-circle" style={{ position: 'relative' }}>
              {user.avatar ? (
                <img 
                  src={user.avatar} 
                  alt="Аватарка" 
                  style={{ 
                    width: '100%', 
                    height: '100%', 
                    objectFit: 'cover', 
                    borderRadius: '50%' 
                  }} 
                />
              ) : (
                getInitials()
              )}
              <label 
                htmlFor="avatar-upload-main" 
                className="avatar-upload-btn"
                style={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  backgroundColor: 'var(--ocean)',
                  color: 'white',
                  borderRadius: '50%',
                  width: '40px',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: '20px',
                  border: '3px solid white',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                  transition: 'all 0.2s ease',
                  zIndex: 20
                }}
                title="Нажмите, чтобы загрузить аватарку"
                onMouseEnter={(e) => {
                  e.target.style.transform = 'scale(1.1)'
                  e.target.style.backgroundColor = 'var(--ocean-deep)'
                  e.target.style.boxShadow = '0 6px 16px rgba(0,0,0,0.5)'
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'scale(1)'
                  e.target.style.backgroundColor = 'var(--ocean)'
                  e.target.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)'
                }}
              >
                📷
              </label>
              <input
                id="avatar-upload-main"
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                disabled={uploadingAvatar}
                style={{ display: 'none' }}
              />
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
                  <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>Имя:</span>
                  <span style={{ fontWeight: 'var(--font-weight-medium)', color: '#ffffff' }}>{user.first_name || '—'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                  <span>📝</span>
                  <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>Фамилия:</span>
                  <span style={{ fontWeight: 'var(--font-weight-medium)', color: '#ffffff' }}>{user.last_name || '—'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                  <span>📞</span>
                  <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>Телефон:</span>
                  <span style={{ fontWeight: 'var(--font-weight-medium)', color: '#ffffff' }}>{user.phone || '—'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                  <span>✉️</span>
                  <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>Email:</span>
                  <span style={{ fontWeight: 'var(--font-weight-medium)', color: '#ffffff' }}>{user.email}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', marginTop: '0.5rem', padding: '0.5rem', backgroundColor: telegramStatus.is_linked ? 'rgba(76, 175, 80, 0.1)' : 'rgba(158, 158, 158, 0.1)', borderRadius: '4px' }}>
                  <span>{telegramStatus.is_linked ? '✅' : '📱'}</span>
                  <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>Telegram:</span>
                  {telegramStatus.is_linked ? (
                    <span style={{ fontWeight: 'var(--font-weight-medium)', color: '#4CAF50', flex: 1 }}>
                      Подключен (ID: {telegramStatus.telegram_chat_id})
                    </span>
                  ) : (
                    <span style={{ fontWeight: 'var(--font-weight-medium)', color: 'rgba(255, 255, 255, 0.6)', flex: 1 }}>
                      Не подключен
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', padding: '0.5rem', backgroundColor: maxStatus.is_linked ? 'rgba(76, 175, 80, 0.1)' : 'rgba(158, 158, 158, 0.1)', borderRadius: '4px' }}>
                  <span>{maxStatus.is_linked ? '✅' : '💬'}</span>
                  <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>MAX:</span>
                  {maxStatus.is_linked ? (
                    <span style={{ fontWeight: 'var(--font-weight-medium)', color: '#4CAF50', flex: 1 }}>
                      Подключен (ID: {maxStatus.max_chat_id})
                    </span>
                  ) : (
                    <span style={{ fontWeight: 'var(--font-weight-medium)', color: 'rgba(255, 255, 255, 0.6)', flex: 1 }}>
                      Не подключен
                    </span>
                  )}
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
                {telegramStatus.is_linked ? (
                  <button
                    onClick={handleTelegramUnlink}
                    className="btn btn-secondary"
                    disabled={telegramLoading}
                    style={{ fontSize: '0.875rem', padding: '0.5rem 1rem', backgroundColor: '#f44336', color: 'white' }}
                  >
                    {telegramLoading ? 'Отключение...' : '🔕 Отключить Telegram'}
                  </button>
                ) : (
                  <a
                    href={`https://t.me/${siteSettings?.telegram_bot_username || 'teriberka_bot'}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary"
                    style={{ fontSize: '0.875rem', padding: '0.5rem 1rem', backgroundColor: '#0088cc', color: 'white', textDecoration: 'none', textAlign: 'center' }}
                  >
                    📱 Подключить Telegram
                  </a>
                )}
                {maxStatus.is_linked ? (
                  <button
                    onClick={handleMaxUnlink}
                    className="btn btn-secondary"
                    disabled={maxLoading}
                    style={{ fontSize: '0.875rem', padding: '0.5rem 1rem', backgroundColor: '#f44336', color: 'white' }}
                  >
                    {maxLoading ? 'Отключение...' : '🔕 Отключить MAX'}
                  </button>
                ) : (
                  <a
                    href={siteSettings?.max_url || 'https://max.ru'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary"
                    style={{ fontSize: '0.875rem', padding: '0.5rem 1rem', backgroundColor: '#6f42c1', color: 'white', textDecoration: 'none', textAlign: 'center' }}
                  >
                    💬 Подключить MAX
                  </a>
                )}
              </>
            ) : isEditing ? (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                    <span>👤</span>
                    <span style={{ color: 'rgba(255, 255, 255, 0.6)', minWidth: '70px' }}>Имя:</span>
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
                    <span style={{ color: 'rgba(255, 255, 255, 0.6)', minWidth: '70px' }}>Фамилия:</span>
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
                    <span style={{ color: 'rgba(255, 255, 255, 0.6)', minWidth: '70px' }}>Телефон:</span>
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
                    <span style={{ color: 'rgba(255, 255, 255, 0.6)', minWidth: '70px' }}>Email:</span>
                    <span style={{ fontWeight: 'var(--font-weight-medium)', color: '#ffffff', flex: 1 }}>{user.email}</span>
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
                    <label style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.6)' }}>Текущий пароль *</label>
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
                    <label style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.6)' }}>Новый пароль *</label>
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
                    <label style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.6)' }}>Подтвердите *</label>
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
        {user.role === 'boat_owner' && !user.is_staff && (
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
        {user.role === 'guide' && !user.is_staff && (
          <div className="profile-navigation">
            <Link to="/profile/bookings" className="profile-nav-link">
              <span className="nav-icon">📋</span>
              <span className="nav-text">Мои бронирования</span>
            </Link>
          </div>
        )}

        {/* Навигация для клиента */}
        {user.role === 'customer' && !user.is_staff && (
          <div className="profile-navigation">
            <Link to="/profile/bookings" className="profile-nav-link">
              <span className="nav-icon">📋</span>
              <span className="nav-text">Мои бронирования</span>
            </Link>
          </div>
        )}

        {/* Навигация для гостиницы */}
        {user.role === 'hotel' && !user.is_staff && (
          <div className="profile-navigation">
            <Link to="/profile/bookings" className="profile-nav-link">
              <span className="nav-icon">📋</span>
              <span className="nav-text">Мои бронирования</span>
            </Link>
          </div>
        )}

        {/* Навигация для админа */}
        {user.is_staff && (
          <div className="profile-navigation">
            <Link to="/profile/admin/captains" className="profile-nav-link">
              <span className="nav-icon">👥</span>
              <span className="nav-text">Управление капитанами</span>
            </Link>
          </div>
        )}

        {/* Дашборд (если есть) */}
        {user.role === 'boat_owner' && !user.is_staff && dashboard.today_stats && (
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
                  {[...dashboard.upcoming_bookings]
                    .sort((a, b) => new Date(a.start_datetime) - new Date(b.start_datetime))
                    .slice(0, 3)
                    .map((booking) => (
                    <div key={booking.id} className="booking-card-mini">
                      <div className="booking-date">
                        {formatDateOnly(booking.start_datetime)}
                      </div>
                      <div className="booking-info">
                        <div className="booking-event">{booking.event_type}</div>
                        <div className="booking-details">
                          Выход: {formatTime(booking.start_datetime)} – {formatTime(booking.end_datetime)} • {booking.number_of_people} чел. • {booking.guest_name || 'Гость'}
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

        {user.role === 'hotel' && !user.is_staff && dashboard.bookings_count !== undefined && (
          <div className="dashboard-section">
            <h2 className="dashboard-title">Статистика гостиницы</h2>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon">📋</div>
                <div className="stat-content">
                  <div className="stat-value">{dashboard.bookings_count || 0}</div>
                  <div className="stat-label">Бронирований</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">💰</div>
                <div className="stat-content">
                  <div className="stat-value">
                    {dashboard.total_cashback
                      ? `${Math.round(dashboard.total_cashback).toLocaleString('ru-RU')} ₽`
                      : '0 ₽'}
                  </div>
                  <div className="stat-label">Кешбэк за всё</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">⏳</div>
                <div className="stat-content">
                  <div className="stat-value">
                    {dashboard.pending_cashback
                      ? `${Math.round(dashboard.pending_cashback).toLocaleString('ru-RU')} ₽`
                      : '0 ₽'}
                  </div>
                  <div className="stat-label">Ожидаемый кешбэк</div>
                </div>
              </div>
            </div>
            {dashboard.upcoming_bookings && dashboard.upcoming_bookings.length > 0 && (
              <div className="upcoming-bookings-section">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <h3 className="section-subtitle">Ближайшие бронирования</h3>
                  <Link to="/profile/bookings" className="btn btn-link" style={{ fontSize: '0.875rem' }}>
                    Все бронирования →
                  </Link>
                </div>
                <div className="bookings-list">
                  {[...dashboard.upcoming_bookings]
                    .sort((a, b) => new Date(a.start_datetime) - new Date(b.start_datetime))
                    .slice(0, 3)
                    .map((booking) => (
                    <div key={booking.id} className="booking-card-mini">
                      <div className="booking-date">
                        {formatDateOnly(booking.start_datetime)}
                      </div>
                      <div className="booking-info">
                        <div className="booking-event">{booking.event_type || booking.boat?.name}</div>
                        <div className="booking-details">
                          Выход: {formatTime(booking.start_datetime)} – {formatTime(booking.end_datetime)} • {booking.number_of_people} чел. • {booking.guest_name || 'Гость'}
                          {booking.boat && ` • ${booking.boat.name}`}
                        </div>
                      </div>
                      <div className="booking-price">
                        {booking.hotel_cashback_amount
                          ? `${Math.round(booking.hotel_cashback_amount).toLocaleString('ru-RU')} ₽ кешбэк`
                          : `${Math.round(booking.total_price || 0).toLocaleString('ru-RU')} ₽`}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {user.role === 'guide' && !user.is_staff && dashboard.bookings_count !== undefined && (
          <div className="dashboard-section">
            <h2 className="dashboard-title">Статистика</h2>
            <div className="stats-grid">
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
                  {[...dashboard.upcoming_bookings]
                    .sort((a, b) => new Date(a.start_datetime) - new Date(b.start_datetime))
                    .slice(0, 3)
                    .map((booking) => (
                    <div key={booking.id} className="booking-card-mini">
                      <div className="booking-date">
                        {formatDateOnly(booking.start_datetime)}
                      </div>
                      <div className="booking-info">
                        <div className="booking-event">{booking.event_type || booking.boat?.name}</div>
                        <div className="booking-details">
                          Выход: {formatTime(booking.start_datetime)} – {formatTime(booking.end_datetime)} • {booking.number_of_people} чел. • {booking.guest_name || 'Гость'}
                          {booking.boat && ` • ${booking.boat.name}`}
                        </div>
                      </div>
                      <div className="booking-price">
                        {booking.guide_booking_amount 
                          ? `${Math.round(booking.guide_booking_amount).toLocaleString('ru-RU')} ₽`
                          : '—'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {user.role === 'customer' && !user.is_staff && dashboard.total_bookings !== undefined && (
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
                  {[...dashboard.upcoming_bookings]
                    .sort((a, b) => new Date(a.start_datetime) - new Date(b.start_datetime))
                    .slice(0, 3)
                    .map((booking) => (
                    <div key={booking.id} className="booking-card-mini">
                      <div className="booking-date">
                        {formatDateOnly(booking.start_datetime)}
                      </div>
                      <div className="booking-info">
                        <div className="booking-event">{booking.event_type || booking.boat?.name}</div>
                        <div className="booking-details">
                          Выход: {formatTime(booking.start_datetime)} – {formatTime(booking.end_datetime)} • {booking.number_of_people} чел. • {booking.boat?.name || 'Судно'}
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

