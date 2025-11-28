import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { tripsAPI, boatsAPI } from '../services/api'
import ImageCarousel from '../components/ImageCarousel'
import ImageModal from '../components/ImageModal'
import '../styles/Home.css'
import '../styles/SearchTrips.css'

const Home = () => {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useState({
    date: '',
    number_of_people: '',
    duration: '',
    boat_type: '',
    features: [],
  })
  const [trips, setTrips] = useState([])
  const [availableFeatures, setAvailableFeatures] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showFilters, setShowFilters] = useState(false)
  const [modalImages, setModalImages] = useState(null)
  const [modalIndex, setModalIndex] = useState(0)

  const today = new Date().toISOString().split('T')[0]
  // Получаем дату через 30 дней для диапазона поиска
  const futureDate = new Date()
  futureDate.setDate(futureDate.getDate() + 30)
  const dateTo = futureDate.toISOString().split('T')[0]

  useEffect(() => {
    // Загружаем список особенностей и все рейсы по умолчанию
    loadFeatures()
    loadAllTrips()
  }, [])

  const loadFeatures = async () => {
    try {
      const data = await boatsAPI.getFeatures()
      setAvailableFeatures(data.results || data || [])
    } catch (err) {
      console.error('Ошибка загрузки особенностей:', err)
    }
  }

  const loadAllTrips = async () => {
    setLoading(true)
    setError(null)

    try {
      const params = {
        date_from: today,
        date_to: dateTo,
      }

      const data = await tripsAPI.searchTrips(params)
      setTrips(data)
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка при загрузке рейсов')
      setTrips([])
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setSearchParams(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleFeatureToggle = (featureId) => {
    setSearchParams(prev => ({
      ...prev,
      features: prev.features.includes(featureId)
        ? prev.features.filter(f => f !== featureId)
        : [...prev.features, featureId]
    }))
  }

  const handleSearch = async (e) => {
    e?.preventDefault()
    
    setLoading(true)
    setError(null)

    try {
      const params = {}

      // Если указана дата, используем её, иначе диапазон
      if (searchParams.date) {
        params.date = searchParams.date
      } else {
        params.date_from = today
        params.date_to = dateTo
      }

      if (searchParams.number_of_people) {
        params.number_of_people = parseInt(searchParams.number_of_people)
      }

      if (searchParams.duration) {
        params.duration = parseInt(searchParams.duration)
      }

      if (searchParams.boat_type) {
        params.boat_type = searchParams.boat_type
      }

      if (searchParams.features.length > 0) {
        params.features = searchParams.features
      }

      const data = await tripsAPI.searchTrips(params)
      setTrips(data)
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка при поиске рейсов')
      setTrips([])
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

  const handleImageClick = (trip) => {
    return (clickedIndex) => {
      let images = trip.boat?.images || []
      
      // Если images пустой, но есть first_image, создаем массив с одним изображением
      if (images.length === 0 && trip.boat?.first_image) {
        images = [{ url: trip.boat.first_image }]
      }
      
      if (images.length > 0) {
        setModalImages(images)
        setModalIndex(clickedIndex || 0)
      }
    }
  }

  const handleCloseModal = () => {
    setModalImages(null)
    setModalIndex(0)
  }

  return (
    <div className="home-container">
      <div className="home-trips-section">
        <div className="home-trips-container">
          <h2 className="home-section-title">Доступные рейсы</h2>
          
          <form className="search-trips-form" onSubmit={handleSearch}>
            <div className="search-form-main">
              <div className="form-group">
                <label htmlFor="date" className="form-label">
                  Дата выхода
                </label>
                <input
                  type="date"
                  id="date"
                  name="date"
                  value={searchParams.date}
                  onChange={handleInputChange}
                  min={today}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label htmlFor="number_of_people" className="form-label">
                  Количество человек
                </label>
                <input
                  type="number"
                  id="number_of_people"
                  name="number_of_people"
                  value={searchParams.number_of_people}
                  onChange={handleInputChange}
                  min="1"
                  max="11"
                  className="form-input"
                  placeholder="Например: 2"
                />
              </div>

              <button type="submit" className="btn btn-primary btn-search" disabled={loading}>
                {loading ? 'Поиск...' : 'Применить фильтры'}
              </button>
            </div>

            <div className="search-form-filters">
              <button
                type="button"
                className="btn btn-secondary btn-filters-toggle"
                onClick={() => setShowFilters(!showFilters)}
              >
                {showFilters ? 'Скрыть фильтры' : 'Дополнительные фильтры'}
              </button>

              {showFilters && (
                <div className="filters-panel">
                  <div className="form-group">
                    <label htmlFor="duration" className="form-label">
                      Длительность
                    </label>
                    <select
                      id="duration"
                      name="duration"
                      value={searchParams.duration}
                      onChange={handleInputChange}
                      className="form-input"
                    >
                      <option value="">Любая</option>
                      <option value="2">2 часа</option>
                      <option value="3">3 часа</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="boat_type" className="form-label">
                      Тип судна
                    </label>
                    <select
                      id="boat_type"
                      name="boat_type"
                      value={searchParams.boat_type}
                      onChange={handleInputChange}
                      className="form-input"
                    >
                      <option value="">Любой</option>
                      <option value="boat">Катер</option>
                      <option value="yacht">Яхта</option>
                      <option value="barkas">Баркас</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Особенности</label>
                    <div className="features-checkboxes">
                      {availableFeatures.length > 0 ? (
                        availableFeatures.map((feature) => (
                          <label key={feature.id} className="checkbox-label">
                            <input
                              type="checkbox"
                              checked={searchParams.features.includes(feature.id)}
                              onChange={() => handleFeatureToggle(feature.id)}
                            />
                            <span>{feature.name}</span>
                          </label>
                        ))
                      ) : (
                        <p style={{ color: 'var(--stone)', fontSize: '0.875rem' }}>
                          Загрузка особенностей...
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </form>

          {error && (
            <div className="alert alert-error">
              {error}
            </div>
          )}

          {loading && (
            <div className="loading-container">
              <div className="loading-spinner"></div>
              <p>Загрузка рейсов...</p>
            </div>
          )}

          {!loading && trips.length > 0 && (
            <div className="trips-results">
              <h3 className="results-title">
                Найдено рейсов: {trips.length}
              </h3>
              <div className="trips-grid">
                {trips.map((trip) => (
                  <div key={trip.id} className="trip-card">
                    <ImageCarousel 
                      images={
                        (trip.boat?.images && trip.boat.images.length > 0)
                          ? trip.boat.images
                          : (trip.boat?.first_image)
                          ? [{ url: trip.boat.first_image, order: 0 }]
                          : []
                      }
                      onImageClick={handleImageClick(trip)}
                    />
                    <div className="trip-card-content">
                      {trip.route && trip.route.length > 0 && (
                        <div className="trip-card-event">
                          {trip.route[0].name}
                        </div>
                      )}
                      
                      <div className="trip-card-info">
                        <div className="trip-info-item">
                          <span className="trip-info-label">Дата:</span>
                          <span className="trip-info-value">
                            {formatDate(trip.departure_date)}
                          </span>
                        </div>
                        <div className="trip-info-item">
                          <span className="trip-info-label">Время:</span>
                          <span className="trip-info-value">
                            {formatTime(trip.departure_time)} - {formatTime(trip.return_time)}
                          </span>
                        </div>
                        <div className="trip-info-item">
                          <span className="trip-info-label">Длительность:</span>
                          <span className="trip-info-value">
                            {trip.duration_hours} {trip.duration_hours === 2 ? 'часа' : 'часов'}
                          </span>
                        </div>
                        <div className="trip-info-item">
                          <span className="trip-info-label">Доступно мест:</span>
                          <span className="trip-info-value">
                            {trip.available_spots} из {trip.boat?.capacity || 0}
                          </span>
                        </div>
                      </div>

                      <div className="trip-card-pricing">
                        <div className="trip-price">
                          <span className="trip-price-label">Цена за человека:</span>
                          <span className="trip-price-value">
                            {parseFloat(trip.price_per_person).toLocaleString('ru-RU')} ₽
                          </span>
                        </div>
                      </div>

                      <button 
                        className="btn btn-primary btn-block"
                        onClick={() => navigate(`/trips/${trip.id}`)}
                      >
                        Подробнее
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!loading && trips.length === 0 && (
            <div className="no-results">
              <p>Рейсы не найдены. Попробуйте изменить параметры поиска.</p>
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

export default Home

