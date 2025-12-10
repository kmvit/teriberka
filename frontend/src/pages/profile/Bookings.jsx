import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { bookingsAPI, authAPI, boatsAPI } from '../../services/api'
import '../../styles/Profile.css'

const Bookings = () => {
  const navigate = useNavigate()
  const [bookings, setBookings] = useState([])
  const [calendarData, setCalendarData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [userRole, setUserRole] = useState(null)
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const today = new Date()
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  })
  const [showBlockForm, setShowBlockForm] = useState(false)
  const [showPricingForm, setShowPricingForm] = useState(false)
  const [selectedBoat, setSelectedBoat] = useState(null)
  const [myBoats, setMyBoats] = useState([])
  
  // Форма блокировки
  const [blockForm, setBlockForm] = useState({
    boat_id: '',
    date_from: '',
    date_to: '',
    reason: 'maintenance',
    reason_text: ''
  })
  
  // Форма сезонной цены
  const [pricingForm, setPricingForm] = useState({
    boat_id: '',
    date_from: '',
    date_to: '',
    duration_hours: 2,
    price_per_person: ''
  })

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      navigate('/login')
      return
    }

    // Загружаем информацию о пользователе для определения роли
    const loadUserInfo = async () => {
      try {
        const userData = await authAPI.getProfile()
        setUserRole(userData.role)
        return userData.role
      } catch (err) {
        console.error('Ошибка загрузки профиля:', err)
        return null
      }
    }

    loadUserInfo().then(role => {
      if (role) {
        loadData(role)
        if (role === 'boat_owner') {
          loadMyBoats()
        }
      }
    })
  }, [navigate, selectedMonth])
  
  const loadMyBoats = async () => {
    try {
      const boats = await boatsAPI.getMyBoats()
      setMyBoats(Array.isArray(boats) ? boats : [])
      if (boats.length > 0 && !selectedBoat) {
        setSelectedBoat(boats[0].id)
        setBlockForm(prev => ({ ...prev, boat_id: boats[0].id }))
        setPricingForm(prev => ({ ...prev, boat_id: boats[0].id }))
      }
    } catch (err) {
      // Игнорируем ошибку 403 для гидов
      if (err.response?.status !== 403) {
        console.error('Ошибка загрузки судов:', err)
      }
    }
  }

  const loadData = async (role = null) => {
    setLoading(true)
    setError(null)
    try {
      const currentRole = role || userRole
      const isBoatOwner = currentRole === 'boat_owner'
      
      // Загружаем бронирования для всех ролей
      const bookingsData = await bookingsAPI.getBookings({})
      
      // Календарь загружаем только для владельцев судов
      let calendarDataResult = null
      if (isBoatOwner) {
        try {
          calendarDataResult = await authAPI.getCalendar(selectedMonth)
        } catch (err) {
          // Игнорируем ошибку 403, если пользователь не владелец судна
          if (err.response?.status !== 403) {
            console.error('Ошибка загрузки календаря:', err)
          }
        }
      }
      
      setBookings(Array.isArray(bookingsData) ? bookingsData : bookingsData.results || [])
      setCalendarData(calendarDataResult)
    } catch (err) {
      if (err.response?.status === 401) {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        navigate('/login')
      } else {
        setError('Ошибка загрузки данных')
      }
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    if (dateString.includes('T') || dateString.includes(' ')) {
      return date.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } else {
      return date.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })
    }
  }

  const formatTime = (dateString) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return date.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Генерация календарной сетки
  const generateCalendarGrid = () => {
    if (!calendarData) return null

    const [year, month] = selectedMonth.split('-').map(Number)
    const firstDay = new Date(year, month - 1, 1)
    const lastDay = new Date(year, month, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1 // Понедельник = 0

    const days = []
    
    // Пустые ячейки для дней до начала месяца
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null)
    }

    // Дни месяца
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      const date = new Date(year, month - 1, day)
      const isToday = date.toDateString() === new Date().toDateString()
      
      // Бронирования на этот день
      const dayBookings = calendarData.bookings?.filter(booking => {
        const bookingDate = new Date(booking.start_datetime)
        bookingDate.setHours(0, 0, 0, 0)
        const compareDate = new Date(date)
        compareDate.setHours(0, 0, 0, 0)
        return bookingDate.getTime() === compareDate.getTime()
      }) || []

      // Заблокированные даты на этот день
      const dayBlocked = calendarData.blocked_dates?.filter(blocked => {
        const fromDate = new Date(blocked.date_from)
        fromDate.setHours(0, 0, 0, 0)
        const toDate = new Date(blocked.date_to || blocked.date_from)
        toDate.setHours(23, 59, 59, 999)
        const compareDate = new Date(date)
        compareDate.setHours(0, 0, 0, 0)
        return compareDate >= fromDate && compareDate <= toDate
      }) || []

      // Сезонные цены на этот день
      const dayPricing = calendarData.seasonal_pricing?.filter(pricing => {
        const fromDate = new Date(pricing.date_from)
        fromDate.setHours(0, 0, 0, 0)
        const toDate = new Date(pricing.date_to || pricing.date_from)
        toDate.setHours(23, 59, 59, 999)
        const compareDate = new Date(date)
        compareDate.setHours(0, 0, 0, 0)
        return compareDate >= fromDate && compareDate <= toDate
      }) || []

      days.push({
        day,
        date: dateStr,
        isToday,
        bookings: dayBookings,
        blocked: dayBlocked,
        pricing: dayPricing
      })
    }

    return days
  }

  const handleMonthChange = (e) => {
    setSelectedMonth(e.target.value)
  }

  const goToPreviousMonth = () => {
    const [year, month] = selectedMonth.split('-').map(Number)
    const date = new Date(year, month - 2, 1)
    setSelectedMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`)
  }

  const goToNextMonth = () => {
    const [year, month] = selectedMonth.split('-').map(Number)
    const date = new Date(year, month, 1)
    setSelectedMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`)
  }

  const handleCreateBlock = async (e) => {
    e.preventDefault()
    if (!blockForm.boat_id || !blockForm.date_from) {
      alert('Заполните обязательные поля')
      return
    }

    try {
      await boatsAPI.createBlockedDate(blockForm.boat_id, {
        date_from: blockForm.date_from,
        date_to: blockForm.date_to || blockForm.date_from,
        reason: blockForm.reason,
        reason_text: blockForm.reason_text
      })
      setShowBlockForm(false)
      setBlockForm({
        boat_id: selectedBoat || '',
        date_from: '',
        date_to: '',
        reason: 'maintenance',
        reason_text: ''
      })
      loadData()
    } catch (err) {
      alert('Ошибка создания блокировки: ' + (err.response?.data?.error || err.message))
    }
  }

  const handleDeleteBlock = async (boatId, blockId) => {
    if (!window.confirm('Вы уверены, что хотите удалить эту блокировку?')) {
      return
    }

    try {
      await boatsAPI.deleteBlockedDate(boatId, blockId)
      loadData()
    } catch (err) {
      alert('Ошибка удаления блокировки: ' + (err.response?.data?.error || err.message))
    }
  }

  const handleCreatePricing = async (e) => {
    e.preventDefault()
    if (!pricingForm.boat_id || !pricingForm.date_from || !pricingForm.price_per_person) {
      alert('Заполните обязательные поля')
      return
    }

    try {
      await boatsAPI.createSeasonalPricing(pricingForm.boat_id, {
        date_from: pricingForm.date_from,
        date_to: pricingForm.date_to || pricingForm.date_from,
        duration_hours: pricingForm.duration_hours,
        price_per_person: parseFloat(pricingForm.price_per_person)
      })
      setShowPricingForm(false)
      setPricingForm({
        boat_id: selectedBoat || '',
        date_from: '',
        date_to: '',
        duration_hours: 2,
        price_per_person: ''
      })
      loadData()
    } catch (err) {
      alert('Ошибка создания сезонной цены: ' + (err.response?.data?.error || err.message))
    }
  }

  const handleDeletePricing = async (boatId, pricingId) => {
    if (!window.confirm('Вы уверены, что хотите удалить эту сезонную цену?')) {
      return
    }

    try {
      await boatsAPI.deleteSeasonalPricing(boatId, pricingId)
      loadData()
    } catch (err) {
      alert('Ошибка удаления сезонной цены: ' + (err.response?.data?.error || err.message))
    }
  }

  const handleCancelBooking = async (bookingId) => {
    const reason = window.prompt('Укажите причину отмены (необязательно):')
    if (reason === null) return // Пользователь отменил

    if (!window.confirm('Вы уверены, что хотите отменить это бронирование?')) {
      return
    }

    try {
      const result = await bookingsAPI.cancelBooking(bookingId, reason || '')
      if (result.refund_deposit) {
        alert(`Бронирование отменено. Предоплата будет возвращена: ${result.deposit_amount.toLocaleString('ru-RU')} ₽`)
      } else {
        alert('Бронирование отменено. Предоплата не возвращается (менее 72 часов до рейса).')
      }
      loadData()
    } catch (err) {
      const errorMessage = err.response?.data?.error || 
                          err.response?.data?.detail || 
                          'Ошибка при отмене бронирования'
      alert(errorMessage)
    }
  }

  const handlePayRemaining = async (bookingId) => {
    if (!window.confirm('Вы уверены, что хотите оплатить остаток?')) {
      return
    }

    try {
      const result = await bookingsAPI.payRemaining(bookingId, 'online')
      alert(`Остаток успешно оплачен!\n\nКод для посадки: ${result.verification_code}\n\nПокажите этот код капитану при посадке.`)
      loadData()
    } catch (err) {
      const errorMessage = err.response?.data?.error || 
                          err.response?.data?.detail || 
                          'Ошибка при оплате остатка'
      alert(errorMessage)
    }
  }

  if (loading) {
    return (
      <div className="profile-page">
        <div className="profile-container">
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Загрузка...</p>
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
          <Link to="/profile" className="btn btn-secondary" style={{ marginTop: '1rem' }}>
            Вернуться в профиль
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="profile-page">
      <div className="profile-container">
        <div className="profile-section">
          {/* Заголовок */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <h1 className="section-title">Бронирования</h1>
            <Link to="/profile" className="btn btn-secondary">
              ← Назад к профилю
            </Link>
          </div>

          {/* Календарный вид - только для владельцев судов */}
          {userRole === 'boat_owner' && (
          <div style={{ marginBottom: '3rem' }}>
            <h2 className="section-subtitle" style={{ marginBottom: '1rem' }}>Календарь</h2>
            
            {/* Выбор месяца */}
            <div className="calendar-controls" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <button onClick={goToPreviousMonth} className="btn btn-secondary">
                ← Предыдущий
              </button>
              <input
                type="month"
                value={selectedMonth}
                onChange={handleMonthChange}
                className="month-input"
                style={{
                  padding: '0.5rem 1rem',
                  border: '1px solid var(--cloud)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '1rem'
                }}
              />
              <button onClick={goToNextMonth} className="btn btn-secondary">
                Следующий →
              </button>
            </div>

            {calendarData ? (
              <>
                {/* Визуализация календаря */}
                <div style={{ marginBottom: '2rem' }}>
                  {/* Легенда */}
                  <div style={{ 
                    display: 'flex', 
                    gap: '1rem', 
                    marginBottom: '1rem', 
                    flexWrap: 'wrap',
                    fontSize: '0.875rem',
                    color: 'var(--stone)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ 
                        width: '16px', 
                        height: '16px', 
                        background: 'linear-gradient(135deg, #e8f0f6 0%, #f0f4f8 100%)',
                        border: '2px solid var(--ocean-deep)',
                        borderRadius: 'var(--radius-sm)'
                      }}></div>
                      <span>Сегодня</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ 
                        width: '16px', 
                        height: '16px', 
                        background: '#fff3cd',
                        border: '1px solid #ffc107',
                        borderRadius: 'var(--radius-sm)'
                      }}></div>
                      <span>Заблокировано</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ 
                        width: '16px', 
                        height: '16px', 
                        background: '#e8f5e9',
                        border: '1px solid #4caf50',
                        borderRadius: 'var(--radius-sm)'
                      }}></div>
                      <span>Есть бронирования</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span>🚫</span>
                      <span>Блокировка</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span>💰</span>
                      <span>Сезонная цена</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span>📅</span>
                      <span>Бронирование</span>
                    </div>
                  </div>
                  
                  <div className="calendar-grid-container">
                    <div className="calendar-grid-header">
                      {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(day => (
                        <div key={day} className="calendar-grid-day-header">{day}</div>
                      ))}
                    </div>
                    <div className="calendar-grid">
                      {generateCalendarGrid()?.map((dayData, index) => {
                        if (!dayData) {
                          return <div key={`empty-${index}`} className="calendar-day-empty"></div>
                        }
                        
                        return (
                          <div
                            key={dayData.date}
                            className={`calendar-day ${dayData.isToday ? 'calendar-day-today' : ''} ${
                              dayData.blocked.length > 0 ? 'calendar-day-blocked' : ''
                            } ${
                              dayData.bookings.length > 0 ? 'calendar-day-has-bookings' : ''
                            }`}
                          >
                            <div className="calendar-day-number">{dayData.day}</div>
                            <div className="calendar-day-events">
                              {dayData.blocked.length > 0 && (
                                <div className="calendar-event-blocked" title="Заблокировано">
                                  🚫
                                </div>
                              )}
                              {dayData.pricing.length > 0 && (
                                <div className="calendar-event-pricing" title="Сезонная цена">
                                  💰
                                </div>
                              )}
                              {dayData.bookings.length > 0 && (
                                <div className="calendar-event-booking" title={`${dayData.bookings.length} бронирование(й)`}>
                                  📅 {dayData.bookings.length}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>

                {/* Блокированные даты */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 'var(--font-weight-semibold)', color: '#1a1a1a' }}>
                      🚫 Заблокированные даты
                    </h3>
                    <button
                      onClick={() => setShowBlockForm(!showBlockForm)}
                      className="btn btn-secondary"
                      style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                    >
                      {showBlockForm ? '✕ Отмена' : '+ Добавить блокировку'}
                    </button>
                  </div>

                  {/* Форма создания блокировки */}
                  {showBlockForm && (
                    <form onSubmit={handleCreateBlock} style={{
                      padding: '1rem',
                      background: 'var(--white)',
                      border: '1px solid var(--cloud)',
                      borderRadius: 'var(--radius-md)',
                      marginBottom: '1rem'
                    }}>
                      <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                        <div>
                          <label className="form-label">Судно *</label>
                          <select
                            value={blockForm.boat_id}
                            onChange={(e) => setBlockForm({ ...blockForm, boat_id: e.target.value })}
                            className="form-input"
                            required
                          >
                            <option value="">Выберите судно</option>
                            {myBoats.map(boat => (
                              <option key={boat.id} value={boat.id}>{boat.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="form-label">Дата начала *</label>
                          <input
                            type="date"
                            value={blockForm.date_from}
                            onChange={(e) => setBlockForm({ ...blockForm, date_from: e.target.value })}
                            className="form-input"
                            required
                          />
                        </div>
                        <div>
                          <label className="form-label">Дата окончания</label>
                          <input
                            type="date"
                            value={blockForm.date_to}
                            onChange={(e) => setBlockForm({ ...blockForm, date_to: e.target.value })}
                            className="form-input"
                            min={blockForm.date_from}
                          />
                        </div>
                        <div>
                          <label className="form-label">Причина *</label>
                          <select
                            value={blockForm.reason}
                            onChange={(e) => setBlockForm({ ...blockForm, reason: e.target.value })}
                            className="form-input"
                            required
                          >
                            <option value="maintenance">Техобслуживание</option>
                            <option value="personal">Личные планы</option>
                            <option value="other">Другое</option>
                          </select>
                        </div>
                        <div style={{ gridColumn: '1 / -1' }}>
                          <label className="form-label">Дополнительная информация</label>
                          <textarea
                            value={blockForm.reason_text}
                            onChange={(e) => setBlockForm({ ...blockForm, reason_text: e.target.value })}
                            className="form-input"
                            rows="2"
                            placeholder="Подробное описание причины блокировки"
                          />
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                        <button type="submit" className="btn btn-primary">Создать блокировку</button>
                        <button type="button" onClick={() => setShowBlockForm(false)} className="btn btn-secondary">Отмена</button>
                      </div>
                    </form>
                  )}

                  {calendarData.blocked_dates && calendarData.blocked_dates.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {calendarData.blocked_dates.map((blocked) => (
                        <div key={blocked.id} style={{
                          padding: '0.75rem',
                          background: '#fff3cd',
                          border: '1px solid #ffc107',
                          borderRadius: 'var(--radius-md)',
                          fontSize: '0.875rem',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          gap: '1rem'
                        }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ marginBottom: '0.25rem', color: '#1a1a1a' }}>
                              <strong>{formatDate(blocked.date_from)}</strong>
                              {blocked.date_to !== blocked.date_from && (
                                <> - <strong>{formatDate(blocked.date_to)}</strong></>
                              )}
                            </div>
                            <div style={{ marginTop: '0.25rem', color: '#856404', fontSize: '0.8125rem' }}>
                              {myBoats.find(b => b.id === blocked.boat_id)?.name && (
                                <span style={{ fontWeight: 'var(--font-weight-medium)' }}>
                                  {myBoats.find(b => b.id === blocked.boat_id).name} • 
                                </span>
                              )}
                              {blocked.reason_display}
                              {blocked.reason_text && `: ${blocked.reason_text}`}
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteBlock(blocked.boat_id, blocked.id)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#856404',
                              cursor: 'pointer',
                              fontSize: '1.25rem',
                              padding: '0.25rem',
                              lineHeight: '1'
                            }}
                            title="Удалить блокировку"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    !showBlockForm && (
                      <p style={{ color: 'var(--stone)', fontSize: '0.875rem' }}>Нет заблокированных дат</p>
                    )
                  )}
                </div>

                {/* Сезонные цены */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 'var(--font-weight-semibold)', color: '#1a1a1a' }}>
                      💰 Сезонные цены
                    </h3>
                    <button
                      onClick={() => setShowPricingForm(!showPricingForm)}
                      className="btn btn-secondary"
                      style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                    >
                      {showPricingForm ? '✕ Отмена' : '+ Добавить сезонную цену'}
                    </button>
                  </div>

                  {/* Форма создания сезонной цены */}
                  {showPricingForm && (
                    <form onSubmit={handleCreatePricing} style={{
                      padding: '1rem',
                      background: 'var(--white)',
                      border: '1px solid var(--cloud)',
                      borderRadius: 'var(--radius-md)',
                      marginBottom: '1rem'
                    }}>
                      <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                        <div>
                          <label className="form-label">Судно *</label>
                          <select
                            value={pricingForm.boat_id}
                            onChange={(e) => setPricingForm({ ...pricingForm, boat_id: e.target.value })}
                            className="form-input"
                            required
                          >
                            <option value="">Выберите судно</option>
                            {myBoats.map(boat => (
                              <option key={boat.id} value={boat.id}>{boat.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="form-label">Дата начала *</label>
                          <input
                            type="date"
                            value={pricingForm.date_from}
                            onChange={(e) => setPricingForm({ ...pricingForm, date_from: e.target.value })}
                            className="form-input"
                            required
                          />
                        </div>
                        <div>
                          <label className="form-label">Дата окончания</label>
                          <input
                            type="date"
                            value={pricingForm.date_to}
                            onChange={(e) => setPricingForm({ ...pricingForm, date_to: e.target.value })}
                            className="form-input"
                            min={pricingForm.date_from}
                          />
                        </div>
                        <div>
                          <label className="form-label">Длительность *</label>
                          <select
                            value={pricingForm.duration_hours}
                            onChange={(e) => setPricingForm({ ...pricingForm, duration_hours: parseInt(e.target.value) })}
                            className="form-input"
                            required
                          >
                            <option value={2}>2 часа</option>
                            <option value={3}>3 часа</option>
                          </select>
                        </div>
                        <div>
                          <label className="form-label">Цена за человека (₽) *</label>
                          <input
                            type="number"
                            value={pricingForm.price_per_person}
                            onChange={(e) => setPricingForm({ ...pricingForm, price_per_person: e.target.value })}
                            className="form-input"
                            min="0"
                            step="0.01"
                            required
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                        <button type="submit" className="btn btn-primary">Создать сезонную цену</button>
                        <button type="button" onClick={() => setShowPricingForm(false)} className="btn btn-secondary">Отмена</button>
                      </div>
                    </form>
                  )}

                  {calendarData.seasonal_pricing && calendarData.seasonal_pricing.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {calendarData.seasonal_pricing.map((pricing) => (
                        <div key={pricing.id} style={{
                          padding: '0.75rem',
                          background: '#d1ecf1',
                          border: '1px solid #bee5eb',
                          borderRadius: 'var(--radius-md)',
                          fontSize: '0.875rem',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          gap: '1rem'
                        }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ marginBottom: '0.25rem', color: '#1a1a1a' }}>
                              <strong>{formatDate(pricing.date_from)}</strong>
                              {pricing.date_to !== pricing.date_from && (
                                <> - <strong>{formatDate(pricing.date_to)}</strong></>
                              )}
                            </div>
                            <div style={{ marginTop: '0.25rem', color: '#0c5460', fontSize: '0.8125rem' }}>
                              {myBoats.find(b => b.id === pricing.boat_id)?.name && (
                                <span style={{ fontWeight: 'var(--font-weight-medium)' }}>
                                  {myBoats.find(b => b.id === pricing.boat_id).name} • 
                                </span>
                              )}
                              {pricing.duration_hours_display}: {Math.round(pricing.price_per_person).toLocaleString('ru-RU')} ₽/чел.
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeletePricing(pricing.boat_id, pricing.id)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#0c5460',
                              cursor: 'pointer',
                              fontSize: '1.25rem',
                              padding: '0.25rem',
                              lineHeight: '1'
                            }}
                            title="Удалить сезонную цену"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    !showPricingForm && (
                      <p style={{ color: 'var(--stone)', fontSize: '0.875rem' }}>Нет сезонных цен</p>
                    )
                  )}
                </div>

                {/* Бронирования */}
                {calendarData.bookings && calendarData.bookings.length === 0 ? (
                  <div className="empty-state">
                    <p>Бронирований в этом месяце нет</p>
                  </div>
                ) : (
                  calendarData.bookings && calendarData.bookings.length > 0 && (
                    <div className="calendar-section">
                      <div className="calendar-bookings">
                        {calendarData.bookings.map((booking) => (
                          <div key={booking.id} className="calendar-booking-item">
                            <div className="calendar-booking-date">
                              {formatDate(booking.start_datetime)}
                            </div>
                            <div className="calendar-booking-info">
                              <div className="calendar-booking-time">
                                {formatTime(booking.start_datetime)} - {formatTime(booking.end_datetime)}
                              </div>
                              <div className="calendar-booking-details">
                                {booking.boat?.name} • {booking.number_of_people} чел. • {booking.guest_name || 'Гость'}
                              </div>
                            </div>
                            <div className={`calendar-booking-status booking-status-${booking.status}`}>
                              {booking.status_display}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                )}
              </>
            ) : (
              <div className="empty-state">
                <p>Загрузите календарь</p>
              </div>
            )}
          </div>
          )}

          {/* Лента бронирований */}
          <div>
            <h2 className="section-subtitle" style={{ marginBottom: '1rem' }}>Лента бронирований</h2>
            
            {bookings.length === 0 ? (
              <div className="empty-state">
                <p>Бронирований пока нет</p>
              </div>
            ) : (
              <div className="bookings-list">
                {bookings.map((booking) => (
                  <div key={booking.id} className="booking-card">
                    <div className="booking-header">
                      <div className="booking-date-time">
                        <div className="booking-date-main">
                          {formatDate(booking.start_datetime)}
                        </div>
                        <div className="booking-time">
                          {formatTime(booking.start_datetime)} - {formatTime(booking.end_datetime)}
                        </div>
                      </div>
                      <div className={`booking-status booking-status-${booking.status}`}>
                        {booking.status_display}
                      </div>
                    </div>
                    <div className="booking-body">
                      <div className="booking-event-type">
                        <strong>Мероприятие:</strong> {booking.event_type}
                      </div>
                      <div className="booking-details-grid">
                        <div className="booking-detail-item">
                          <span className="detail-label">Количество людей:</span>
                          <span className="detail-value">{booking.number_of_people}</span>
                        </div>
                        <div className="booking-detail-item">
                          <span className="detail-label">Катер:</span>
                          <span className="detail-value">{booking.boat?.name || 'Не указан'}</span>
                        </div>
                        <div className="booking-detail-item">
                          <span className="detail-label">Ставка за человека:</span>
                          <span className="detail-value">
                            {Math.round(booking.price_per_person || 0).toLocaleString('ru-RU')} ₽
                          </span>
                        </div>
                        <div className="booking-detail-item">
                          <span className="detail-label">Общая стоимость:</span>
                          <span className="detail-value">
                            {Math.round(booking.total_price || 0).toLocaleString('ru-RU')} ₽
                          </span>
                        </div>
                        {booking.deposit && (
                          <div className="booking-detail-item">
                            <span className="detail-label">Внесена предоплата:</span>
                            <span className="detail-value">
                              {Math.round(booking.deposit).toLocaleString('ru-RU')} ₽
                            </span>
                          </div>
                        )}
                        {booking.remaining_amount > 0 && (
                          <div className="booking-detail-item">
                            <span className="detail-label">Остаток к оплате:</span>
                            <span className="detail-value" style={{ color: 'var(--ocean-deep)', fontWeight: 'bold' }}>
                              {Math.round(booking.remaining_amount).toLocaleString('ru-RU')} ₽
                            </span>
                          </div>
                        )}
                        {booking.guest_name && (
                          <div className="booking-detail-item">
                            <span className="detail-label">Имя гостя:</span>
                            <span className="detail-value">{booking.guest_name}</span>
                          </div>
                        )}
                        {booking.guest_phone && (
                          <div className="booking-detail-item">
                            <span className="detail-label">Контактный телефон:</span>
                            <span className="detail-value">
                              <a href={`tel:${booking.guest_phone}`}>{booking.guest_phone}</a>
                            </span>
                          </div>
                        )}
                      </div>
                      
                      {/* Действия для бронирования */}
                      <div className="booking-actions" style={{ 
                        marginTop: '1rem', 
                        paddingTop: '1rem', 
                        borderTop: '1px solid var(--cloud)',
                        display: 'flex',
                        gap: '0.5rem',
                        flexWrap: 'wrap'
                      }}>
                        {/* Оплата остатка - для гида и клиента */}
                        {(userRole === 'guide' || userRole === 'customer') && 
                         booking.status !== 'cancelled' && 
                         booking.status !== 'completed' && 
                         booking.remaining_amount > 0 && (
                          <button
                            className="btn btn-primary"
                            style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                            onClick={() => handlePayRemaining(booking.id)}
                          >
                            Оплатить остаток
                          </button>
                        )}
                        
                        {/* Отмена - для всех ролей, кроме завершенных и отмененных */}
                        {booking.status !== 'cancelled' && booking.status !== 'completed' && (
                          <button
                            className="btn btn-secondary"
                            style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                            onClick={() => handleCancelBooking(booking.id)}
                          >
                            Отменить бронирование
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Bookings
