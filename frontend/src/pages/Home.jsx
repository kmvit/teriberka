import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { tripsAPI, boatsAPI } from '../services/api'
import ImageCarousel from '../components/ImageCarousel'
import ImageModal from '../components/ImageModal'
import { FiCalendar, FiUsers, FiAnchor, FiClock, FiFilter, FiSearch, FiMapPin, FiRotateCcw } from 'react-icons/fi'
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
  const [loadingFeatures, setLoadingFeatures] = useState(false)
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
    setLoadingFeatures(true)
    try {
      const data = await boatsAPI.getFeatures()
      console.log('Получены особенности:', data)
      // Обрабатываем разные форматы ответа (с пагинацией или без)
      if (Array.isArray(data)) {
        setAvailableFeatures(data)
      } else if (data && data.results && Array.isArray(data.results)) {
        setAvailableFeatures(data.results)
      } else if (data && Array.isArray(data)) {
        setAvailableFeatures(data)
      } else {
        console.warn('Неожиданный формат данных особенностей:', data)
        setAvailableFeatures([])
      }
    } catch (err) {
      console.error('Ошибка загрузки особенностей:', err)
      console.error('URL:', err.config?.url)
      console.error('Детали ошибки:', err.response?.data)
      setAvailableFeatures([])
    } finally {
      setLoadingFeatures(false)
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

  const handleResetFilters = () => {
    setSearchParams({
      date: '',
      number_of_people: '',
      duration: '',
      boat_type: '',
      features: [],
    })
    // Перезагружаем все рейсы после сброса фильтров
    loadAllTrips()
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

  const scrollToTrips = (e) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    console.log('Кнопка нажата, прокручиваем к рейсам')
    const tripsSection = document.querySelector('.home-trips-section')
    if (tripsSection) {
      const yOffset = -20 // Небольшой отступ сверху
      const y = tripsSection.getBoundingClientRect().top + window.pageYOffset + yOffset
      window.scrollTo({ top: y, behavior: 'smooth' })
      console.log('Прокрутка выполнена')
    } else {
      console.error('Секция с рейсами не найдена')
    }
  }

  return (
    <div className="home-container">
      {/* Hero Section */}
      <div className="home-hero">
        <div className="home-hero-container">
          <div className="home-hero-content">
            <h1 className="home-hero-title">
              Откройте северный ледовитый океан
            </h1>
            <p className="home-hero-subtitle">
              Ваше незабываемое приключение в Териберке начинается здесь
            </p>
            {/* Полная форма поиска в hero */}
            <form className="hero-search-form" onSubmit={handleSearch}>
              <div className="hero-search-main">
                <div className="form-group form-group-with-icon">
                  <label htmlFor="hero-date" className="form-label">
                    <FiCalendar className="form-label-icon" />
                    Дата выхода
                  </label>
                  <div className={`input-wrapper input-wrapper-date ${!searchParams.date ? 'input-empty' : ''}`} data-placeholder="Например: 12.12.2025">
                    <FiCalendar className="input-icon" />
                    <input
                      type="date"
                      id="hero-date"
                      name="date"
                      value={searchParams.date}
                      onChange={handleInputChange}
                      min={today}
                      className="form-input form-input-with-icon"
                    />
                  </div>
                </div>

                <div className="form-group form-group-with-icon">
                  <label htmlFor="hero-people" className="form-label">
                    <FiUsers className="form-label-icon" />
                    Количество человек
                  </label>
                  <div className="input-wrapper">
                    <FiUsers className="input-icon" />
                    <input
                      type="number"
                      id="hero-people"
                      name="number_of_people"
                      value={searchParams.number_of_people}
                      onChange={handleInputChange}
                      min="1"
                      max="11"
                      className="form-input form-input-with-icon"
                      placeholder="Например: 2"
                    />
                  </div>
                </div>

                <div className="form-group form-group-with-icon">
                  <label htmlFor="hero-boat-type" className="form-label">
                    <FiAnchor className="form-label-icon" />
                    Тип судна
                  </label>
                  <div className="input-wrapper">
                    <FiAnchor className="input-icon" />
                    <select
                      id="hero-boat-type"
                      name="boat_type"
                      value={searchParams.boat_type}
                      onChange={handleInputChange}
                      className="form-input form-input-with-icon form-select"
                    >
                      <option value="">Любой</option>
                      <option value="boat">Катер</option>
                      <option value="yacht">Яхта</option>
                      <option value="barkas">Баркас</option>
                    </select>
                  </div>
                </div>

                <button type="submit" className="btn btn-hero btn-search" disabled={loading}>
                  <FiSearch className="btn-icon" />
                  {loading ? 'Поиск...' : 'Найти рейсы'}
                </button>
              </div>

              <div className="hero-search-filters">
                <div className="hero-search-filters-buttons">
                  <button
                    type="button"
                    className="btn btn-secondary btn-filters-toggle"
                    onClick={() => setShowFilters(!showFilters)}
                  >
                    <FiFilter className="btn-icon" />
                    {showFilters ? 'Скрыть фильтры' : 'Дополнительные фильтры'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-reset-filters"
                    onClick={handleResetFilters}
                    disabled={loading}
                  >
                    <FiRotateCcw className="btn-icon" />
                    Сбросить фильтры
                  </button>
                </div>

                {showFilters && (
                  <div className="hero-filters-panel">
                    <div className="form-group form-group-with-icon">
                      <label htmlFor="hero-duration" className="form-label">
                        <FiClock className="form-label-icon" />
                        Длительность
                      </label>
                      <div className="input-wrapper">
                        <FiClock className="input-icon" />
                        <select
                          id="hero-duration"
                          name="duration"
                          value={searchParams.duration}
                          onChange={handleInputChange}
                          className="form-input form-input-with-icon form-select"
                        >
                          <option value="">Любая</option>
                          <option value="2">2 часа</option>
                          <option value="3">3 часа</option>
                        </select>
                      </div>
                    </div>

                    <div className="form-group form-group-features">
                      <label className="form-label">
                        <FiFilter className="form-label-icon" />
                        Особенности
                      </label>
                      <div className="hero-features-checkboxes">
                        {loadingFeatures ? (
                          <p className="features-loading">
                            Загрузка особенностей...
                          </p>
                        ) : availableFeatures.length > 0 ? (
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
                          <p className="features-empty">
                            Особенности не найдены
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>

      <div className="home-trips-section">
        <div className="home-trips-container">
          <h2 className="home-section-title">Доступные рейсы</h2>

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
                    <div className="trip-card-image-wrapper">
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
                      {trip.boat?.name && (
                        <div className="trip-card-boat-name-overlay">
                          <FiAnchor className="trip-card-boat-icon" />
                          {trip.boat.name}
                        </div>
                      )}
                    </div>
                    <div className="trip-card-content">
                      {trip.route && trip.route.length > 0 && (
                        <div className="trip-card-event">
                          <FiMapPin className="trip-card-event-icon" />
                          {trip.route[0].name}
                        </div>
                      )}
                      
                      <div className="trip-card-info">
                        <div className="trip-info-item">
                          <FiCalendar className="trip-info-icon" />
                          <span className="trip-info-label">Дата:</span>
                          <span className="trip-info-value">
                            {formatDate(trip.departure_date)}
                          </span>
                        </div>
                        <div className="trip-info-item">
                          <FiClock className="trip-info-icon" />
                          <span className="trip-info-label">Время:</span>
                          <span className="trip-info-value">
                            {formatTime(trip.departure_time)} - {formatTime(trip.return_time)}
                          </span>
                        </div>
                        <div className="trip-info-item">
                          <FiClock className="trip-info-icon" />
                          <span className="trip-info-label">Длительность:</span>
                          <span className="trip-info-value">
                            {trip.duration_hours} {trip.duration_hours === 2 ? 'часа' : 'часов'}
                          </span>
                        </div>
                        <div className="trip-info-item">
                          <FiUsers className="trip-info-icon" />
                          <span className="trip-info-label">Доступно мест:</span>
                          <span className="trip-info-value">
                            {trip.available_spots} из {trip.boat?.capacity || 0}
                          </span>
                        </div>
                        {trip.boat?.dock && (
                          <div className="trip-info-item">
                            <FiMapPin className="trip-info-icon" />
                            <span className="trip-info-label">Как пройти:</span>
                            <span className="trip-info-value">
                              {trip.boat.dock.yandex_location_url ? (
                                <a 
                                  href={trip.boat.dock.yandex_location_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  style={{ color: 'var(--ocean-deep)', textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                                >
                                  <FiMapPin style={{ fontSize: '0.875rem' }} />
                                  {trip.boat.dock.name || 'Открыть на карте'}
                                </a>
                              ) : (
                                trip.boat.dock.name || 'Не указан'
                              )}
                            </span>
                          </div>
                        )}
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

