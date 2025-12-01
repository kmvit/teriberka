import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { authAPI } from '../../services/api'
import '../../styles/Profile.css'

const Calendar = () => {
  const navigate = useNavigate()
  const [calendarData, setCalendarData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const today = new Date()
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  })

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      navigate('/login')
      return
    }

    loadCalendar()
  }, [navigate, selectedMonth])

  const loadCalendar = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await authAPI.getCalendar(selectedMonth)
      setCalendarData(data)
    } catch (err) {
      if (err.response?.status === 401) {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        navigate('/login')
      } else {
        setError('Ошибка загрузки календаря')
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

  if (loading) {
    return (
      <div className="profile-page">
        <div className="profile-container">
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Загрузка календаря...</p>
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
        {/* Заголовок */}
        <div className="profile-section">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <h1 className="section-title">Календарь бронирований</h1>
            <Link to="/profile" className="btn btn-secondary">
              ← Назад к профилю
            </Link>
          </div>

          {/* Выбор месяца */}
          <div className="calendar-controls" style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
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

          {calendarData && calendarData.bookings ? (
            calendarData.bookings.length === 0 ? (
              <div className="empty-state">
                <p>Бронирований в этом месяце нет</p>
              </div>
            ) : (
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
          ) : (
            <div className="empty-state">
              <p>Загрузите календарь</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Calendar

