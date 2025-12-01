import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { bookingsAPI } from '../../services/api'
import '../../styles/Profile.css'

const Bookings = () => {
  const navigate = useNavigate()
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      navigate('/login')
      return
    }

    loadBookings()
  }, [navigate])

  const loadBookings = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await bookingsAPI.getBookings({})
      setBookings(Array.isArray(data) ? data : data.results || [])
    } catch (err) {
      if (err.response?.status === 401) {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        navigate('/login')
      } else {
        setError('Ошибка загрузки бронирований')
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

  if (loading) {
    return (
      <div className="profile-page">
        <div className="profile-container">
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Загрузка бронирований...</p>
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
            <h1 className="section-title">Бронирования</h1>
            <Link to="/profile" className="btn btn-secondary">
              ← Назад к профилю
            </Link>
          </div>

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
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Bookings

