import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { tripsAPI } from '../services/api'
import ImageCarousel from '../components/ImageCarousel'
import ImageModal from '../components/ImageModal'
import '../styles/TripDetail.css'

const TripDetail = () => {
  const { tripId } = useParams()
  const navigate = useNavigate()
  const [trip, setTrip] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [modalImages, setModalImages] = useState(null)
  const [modalIndex, setModalIndex] = useState(0)

  useEffect(() => {
    loadTripDetail()
  }, [tripId])

  const loadTripDetail = async () => {
    setLoading(true)
    setError(null)

    try {
      const data = await tripsAPI.getTripDetail(tripId)
      setTrip(data)
    } catch (err) {
      setError(err.response?.data?.detail || err.response?.data?.error || 'Ошибка при загрузке рейса')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }

  const formatTime = (timeString) => {
    if (!timeString) return ''
    const [hours, minutes] = timeString.split(':')
    return `${hours}:${minutes}`
  }


  const boatTypeLabels = {
    boat: 'Катер',
    yacht: 'Яхта',
    barkas: 'Баркас'
  }

  const handleImageClick = (clickedIndex) => {
    if (trip?.boat?.images && trip.boat.images.length > 0) {
      const images = trip.boat.images.map(img => ({
        url: img.image_url || img.image?.url || img.url,
        order: img.order || 0
      }))
      setModalImages(images)
      setModalIndex(clickedIndex || 0)
    }
  }

  const handleCloseModal = () => {
    setModalImages(null)
    setModalIndex(0)
  }

  const handleBook = () => {
    // TODO: Реализовать бронирование
    alert('Функция бронирования будет реализована позже')
  }

  if (loading) {
    return (
      <div className="trip-detail-container">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Загрузка информации о рейсе...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="trip-detail-container">
        <div className="alert alert-error">
          {error}
        </div>
        <button className="btn btn-secondary" onClick={() => navigate('/')}>
          Вернуться к списку рейсов
        </button>
      </div>
    )
  }

  if (!trip) {
    return (
      <div className="trip-detail-container">
        <div className="alert alert-error">
          Рейс не найден
        </div>
        <button className="btn btn-secondary" onClick={() => navigate('/')}>
          Вернуться к списку рейсов
        </button>
      </div>
    )
  }

  const boat = trip.boat || {}
  const images = boat.images || []
  const features = boat.features || []
  const routes = trip.route || []

  return (
    <div className="trip-detail-container">
      <button className="btn btn-secondary btn-back" onClick={() => navigate('/')}>
        ← Назад к списку рейсов
      </button>

      <div className="trip-detail-content">
        <div className="trip-detail-main">
          <div className="trip-detail-images">
            {images.length > 0 ? (
              <ImageCarousel
                images={images.map(img => ({
                  url: img.image_url || img.image?.url || img.url,
                  order: img.order || 0
                }))}
                onImageClick={handleImageClick}
              />
            ) : (
              <div className="trip-detail-no-image">
                <p>Изображения отсутствуют</p>
              </div>
            )}
          </div>

          <div className="trip-detail-info">
            {routes.length > 0 && (
              <div className="trip-detail-route">
                <h2>{routes[0].name}</h2>
                {routes[0].description && (
                  <p className="route-description">{routes[0].description}</p>
                )}
              </div>
            )}

            <div className="trip-detail-schedule">
              <h3>Расписание рейса</h3>
              <div className="schedule-item">
                <span className="schedule-label">Дата:</span>
                <span className="schedule-value">{formatDate(trip.departure_date)}</span>
              </div>
              <div className="schedule-item">
                <span className="schedule-label">Время отправления:</span>
                <span className="schedule-value">{formatTime(trip.departure_time)}</span>
              </div>
              <div className="schedule-item">
                <span className="schedule-label">Время возвращения:</span>
                <span className="schedule-value">{formatTime(trip.return_time)}</span>
              </div>
              <div className="schedule-item">
                <span className="schedule-label">Длительность:</span>
                <span className="schedule-value">
                  {trip.duration_hours} {trip.duration_hours === 2 ? 'часа' : 'часов'}
                </span>
              </div>
            </div>

            <div className="trip-detail-pricing">
              <h3>Цена</h3>
              <div className="price-info">
                <span className="price-label">Цена за человека:</span>
                <span className="price-value">
                  {parseFloat(trip.price_per_person).toLocaleString('ru-RU')} ₽
                </span>
              </div>
              <div className="availability-info">
                <span className="availability-label">Доступно мест:</span>
                <span className="availability-value">
                  {trip.available_spots} из {boat.capacity || 0}
                </span>
              </div>
            </div>

            <button className="btn btn-primary btn-block btn-book" onClick={handleBook}>
              Забронировать
            </button>
          </div>
        </div>

        <div className="trip-detail-boat">
          <h3>Информация о судне</h3>
          
          <div className="boat-info-section">
            <h4>{boat.name || 'Судно'}</h4>
            <div className="boat-info-grid">
              <div className="boat-info-item">
                <span className="boat-info-label">Тип судна:</span>
                <span className="boat-info-value">
                  {boatTypeLabels[boat.boat_type] || boat.boat_type_display || 'Не указан'}
                </span>
              </div>
              <div className="boat-info-item">
                <span className="boat-info-label">Вместимость:</span>
                <span className="boat-info-value">{boat.capacity || 0} человек</span>
              </div>
              {boat.owner && (
                <div className="boat-info-item">
                  <span className="boat-info-label">Капитан:</span>
                  <span className="boat-info-value">
                    {boat.owner.first_name || ''} {boat.owner.last_name || ''}
                    {!boat.owner.first_name && !boat.owner.last_name && boat.owner.email && (
                      boat.owner.email.split('@')[0]
                    )}
                    {!boat.owner.first_name && !boat.owner.last_name && !boat.owner.email && 'Капитан'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {boat.description && (
            <div className="boat-description-section">
              <h4>Описание</h4>
              <p>{boat.description}</p>
            </div>
          )}

          {features.length > 0 && (
            <div className="boat-features-section">
              <h4>Особенности судна</h4>
              <ul className="features-list">
                {features.map((feature) => (
                  <li key={feature.id || feature.name}>
                    {feature.name || (typeof feature === 'string' ? feature : '')}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {boat.pricing && boat.pricing.length > 0 && (
            <div className="boat-pricing-section">
              <h4>Цены на рейсы</h4>
              <div className="pricing-list">
                {boat.pricing.map((pricing) => (
                  <div key={pricing.id} className="pricing-item">
                    <span className="pricing-duration">
                      {pricing.duration_hours_display || `${pricing.duration_hours} часа`}
                    </span>
                    <span className="pricing-price">
                      {parseFloat(pricing.price_per_person).toLocaleString('ru-RU')} ₽
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {modalImages && (
        <ImageModal
          images={modalImages}
          currentIndex={modalIndex}
          onClose={handleCloseModal}
        />
      )}
    </div>
  )
}

export default TripDetail

