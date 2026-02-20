import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { tripsAPI, bookingsAPI, authAPI } from '../services/api'
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
  const [showBookingForm, setShowBookingForm] = useState(false)
  const [bookingForm, setBookingForm] = useState({
    number_of_people: 1,
    guest_name: '',
    guest_phone: '',
    promo_code: ''
  })
  const [bookingLoading, setBookingLoading] = useState(false)
  const [bookingError, setBookingError] = useState(null)
  const [numberOfPeopleError, setNumberOfPeopleError] = useState(null)
  const [user, setUser] = useState(null)
  const [promoCodePreview, setPromoCodePreview] = useState(null)
  const [promoCodeLoading, setPromoCodeLoading] = useState(false)
  const [promoCodeError, setPromoCodeError] = useState(null)
  const [hotelPaymentLink, setHotelPaymentLink] = useState('')

  useEffect(() => {
    loadTripDetail()
    loadUserInfo()
  }, [tripId])

  const loadUserInfo = async () => {
    const token = localStorage.getItem('token')
    if (token) {
      try {
        const userData = await authAPI.getProfile()
        setUser(userData)
        // Заполняем форму данными пользователя, если они есть
        if (userData.first_name || userData.last_name) {
          setBookingForm(prev => ({
            ...prev,
            guest_name: `${userData.first_name || ''} ${userData.last_name || ''}`.trim()
          }))
        }
        if (userData.phone) {
          setBookingForm(prev => ({
            ...prev,
            guest_phone: userData.phone
          }))
        }
      } catch (err) {
        // Игнорируем ошибки загрузки профиля
        console.log('Не удалось загрузить профиль пользователя')
      }
    }
  }

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

  const isHotelUser = user?.role === 'hotel'

  const getBookButtonLabel = () => (isHotelUser ? 'Забронировать для гостя' : 'Забронировать')

  const handleCopyHotelLink = async () => {
    if (!hotelPaymentLink) return
    try {
      await navigator.clipboard.writeText(hotelPaymentLink)
      alert('Ссылка скопирована в буфер обмена')
    } catch (err) {
      alert('Не удалось скопировать ссылку. Скопируйте вручную.')
    }
  }

  const handleBook = () => {
    const token = localStorage.getItem('token')
    if (!token) {
      alert('Для бронирования необходимо войти в систему')
      navigate('/login')
      return
    }
    setHotelPaymentLink('')
    setShowBookingForm(true)
  }

  const handleBookingFormChange = (e) => {
    const { name, value } = e.target
    setBookingForm(prev => ({
      ...prev,
      [name]: name === 'number_of_people'
        ? (value === '' ? '' : (isNaN(parseInt(value)) ? '' : parseInt(value)))
        : value
    }))
    setBookingError(null)

    // Сбрасываем preview промокода при изменении количества людей
    if (name === 'number_of_people') {
      setPromoCodePreview(null)
      setPromoCodeError(null)
    }

    // Валидация количества людей в реальном времени
    if (name === 'number_of_people') {
      const numPeople = value === '' ? null : parseInt(value)
      if (numPeople !== null) {
        if (numPeople < 1 || numPeople > 11) {
          setNumberOfPeopleError('Количество людей должно быть от 1 до 11')
        } else if (trip && numPeople > trip.available_spots) {
          setNumberOfPeopleError(`Недостаточно свободных мест. Доступно: ${trip.available_spots}`)
        } else {
          setNumberOfPeopleError(null)
        }
      } else {
        setNumberOfPeopleError(null)
      }
    }
  }

  const calculateBookingPrice = () => {
    const numPeople = parseInt(bookingForm.number_of_people) || 0
    if (!trip || !numPeople) return { total: 0, deposit: 0, remaining: 0, discount: 0 }

    // Если есть предварительный расчет с промокодом, используем его
    if (promoCodePreview && promoCodePreview.number_of_people === numPeople) {
      return {
        total: promoCodePreview.total_price,
        deposit: promoCodePreview.deposit,
        remaining: promoCodePreview.remaining_amount,
        discount: promoCodePreview.total_discount || 0,
        originalTotal: promoCodePreview.original_price,
        guideDiscount: promoCodePreview.guide_discount_amount || 0,
        promoDiscount: promoCodePreview.promo_code?.discount_amount || 0
      }
    }

    // Расчет без промокода (стандартный)
    const pricePerPerson = parseFloat(trip.price_per_person) || 0
    const total = pricePerPerson * numPeople
    const deposit = 1000 * numPeople // Предоплата 1000 руб/чел
    const remaining = total - deposit
    return {
      total,
      deposit,
      remaining: Math.max(0, remaining),
      discount: 0,
      originalTotal: total,
      guideDiscount: 0,
      promoDiscount: 0
    }
  }

  const handleApplyPromoCode = async () => {
    const promoCode = bookingForm.promo_code.trim()
    
    setPromoCodeLoading(true)
    setPromoCodeError(null)

    try {
      // Формируем данные для preview
      const bookingData = {
        trip_id: parseInt(tripId),
        number_of_people: parseInt(bookingForm.number_of_people),
        guest_name: bookingForm.guest_name.trim() || 'Preview',
        guest_phone: bookingForm.guest_phone.trim() || '+70000000000',
        promo_code: promoCode || undefined
      }

      const preview = await bookingsAPI.previewBooking(bookingData)
      setPromoCodePreview(preview)
      
      // Если промокод пустой и preview вернул данные без промокода, сбрасываем preview
      if (!promoCode) {
        setPromoCodePreview(null)
      }
    } catch (err) {
      const errorData = err.response?.data
      let errorMessage = 'Ошибка при проверке'
      
      if (typeof errorData === 'object') {
        if (errorData.promo_code) {
          errorMessage = Array.isArray(errorData.promo_code) ? errorData.promo_code[0] : errorData.promo_code
        } else if (errorData.error) {
          errorMessage = errorData.error
        } else if (errorData.detail) {
          errorMessage = errorData.detail
        }
      }
      
      setPromoCodeError(errorMessage)
      setPromoCodePreview(null)
    } finally {
      setPromoCodeLoading(false)
    }
  }

  const handlePromoCodeChange = (e) => {
    const value = e.target.value
    setBookingForm(prev => ({
      ...prev,
      promo_code: value
    }))

    // Если промокод очищен, сбрасываем preview
    if (!value.trim()) {
      setPromoCodePreview(null)
      setPromoCodeError(null)
    }
  }

  const handleSubmitBooking = async (e) => {
    e.preventDefault()
    setBookingLoading(true)
    setBookingError(null)
    setHotelPaymentLink('')

    // Валидация
    if (!bookingForm.guest_name.trim()) {
      setBookingError('Укажите имя гостя')
      setBookingLoading(false)
      return
    }
    if (!bookingForm.guest_phone.trim()) {
      setBookingError('Укажите контактный телефон')
      setBookingLoading(false)
      return
    }
    const numPeople = parseInt(bookingForm.number_of_people)
    if (!numPeople || numPeople < 1 || numPeople > 11) {
      setBookingError('Количество людей должно быть от 1 до 11')
      setBookingLoading(false)
      return
    }
    if (numPeople > trip.available_spots) {
      setBookingError(`Недостаточно свободных мест. Доступно: ${trip.available_spots}`)
      setBookingLoading(false)
      return
    }

    try {
      const bookingData = {
        trip_id: parseInt(tripId),
        number_of_people: parseInt(bookingForm.number_of_people),
        guest_name: bookingForm.guest_name.trim(),
        guest_phone: bookingForm.guest_phone.trim(),
        promo_code: bookingForm.promo_code.trim() || undefined,
        preview: false  // Явно указываем что это реальное бронирование
      }

      const createdBooking = isHotelUser
        ? await bookingsAPI.createHotelBooking({
            trip_id: bookingData.trip_id,
            number_of_people: bookingData.number_of_people,
            guest_name: bookingData.guest_name,
            guest_phone: bookingData.guest_phone
          })
        : await bookingsAPI.createBooking(bookingData)
      
      // ОТЛАДКА: смотрим что пришло
      console.log('=== BOOKING CREATED ===')
      console.log('Full response:', createdBooking)
      console.log('Payment URL:', createdBooking.payment_url)
      console.log('Has payment_url?', !!createdBooking.payment_url)
      
      if (isHotelUser) {
        setHotelPaymentLink(createdBooking.payment_url || '')
        setBookingLoading(false)
        return
      }

      // Проверяем, есть ли URL для оплаты
      if (createdBooking.payment_url) {
        console.log('Redirecting to payment:', createdBooking.payment_url)
        // Перенаправляем на страницу оплаты Т-Банка
        window.location.href = createdBooking.payment_url
      } else {
        console.log('No payment_url, showing fallback message')
        // Показываем успешное сообщение (fallback)
        alert(`Бронирование создано!\n\nПредоплата: ${calculateBookingPrice().deposit.toLocaleString('ru-RU')} ₽\nОстаток к оплате: ${calculateBookingPrice().remaining.toLocaleString('ru-RU')} ₽\n\nОстаток необходимо оплатить за 3 часа до выхода в море.`)
        
        // Закрываем форму и перенаправляем на страницу бронирований
        setShowBookingForm(false)
        navigate('/profile/bookings')
      }
    } catch (err) {
      console.error('=== BOOKING ERROR ===')
      console.error('Error:', err)
      console.error('Response:', err.response)
      const errorMessage = err.response?.data?.error || 
                          err.response?.data?.detail || 
                          err.response?.data?.non_field_errors?.[0] ||
                          'Ошибка при создании бронирования'
      setBookingError(errorMessage)
      setBookingLoading(false)
    }
  }

  const handleCloseBookingForm = () => {
    setShowBookingForm(false)
    setBookingError(null)
    setNumberOfPeopleError(null)
    setPromoCodePreview(null)
    setPromoCodeError(null)
    setPromoCodeLoading(false)
    setHotelPaymentLink('')
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

      {routes.length > 0 && (
        <div className="trip-detail-route">
          <h2>{routes[0].name}</h2>
          {routes[0].description && (
            <p className="route-description">{routes[0].description}</p>
          )}
        </div>
      )}

      <div className="trip-detail-content">
        <div className="trip-detail-main">
          <div className="trip-detail-images">
            {images.length > 0 ? (
              <ImageCarousel
                images={images.map(img => ({
                  url: img.thumbnail_url || img.image_url || img.image?.url || img.url,
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
            <div className="trip-detail-info-block">
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
              <div className="schedule-item">
                <span className="schedule-label">Цена за человека:</span>
                <span className="schedule-value price-value">
                  {parseFloat(trip.price_per_person).toLocaleString('ru-RU')} ₽
                </span>
              </div>
              <div className="schedule-item">
                <span className="schedule-label">Доступно мест:</span>
                <span className="schedule-value">
                  {trip.available_spots} из {boat.capacity || 0}
                </span>
              </div>
            </div>

            {trip.available_spots > 0 ? (
              <button className="btn btn-primary btn-block btn-book" onClick={handleBook}>
                {getBookButtonLabel()}
              </button>
            ) : (
              <button className="btn btn-secondary btn-block btn-book" disabled>
                Нет свободных мест
              </button>
            )}
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
              {boat.dock && (
                <div className="boat-info-item">
                  <span className="boat-info-label">Как пройти:</span>
                  <span className="boat-info-value">
                    {boat.dock.yandex_location_url ? (
                      <a 
                        href={boat.dock.yandex_location_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        style={{ color: 'var(--ocean-deep)', textDecoration: 'underline' }}
                      >
                        {boat.dock.name || 'Открыть на карте'}
                      </a>
                    ) : (
                      boat.dock.name || 'Не указан'
                    )}
                  </span>
                </div>
              )}
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
        </div>
      </div>

      {modalImages && (
        <ImageModal
          images={modalImages}
          currentIndex={modalIndex}
          onClose={handleCloseModal}
        />
      )}

      {/* Модальное окно бронирования */}
      {showBookingForm && (
        <div className="booking-modal-overlay" onClick={handleCloseBookingForm}>
          <div className="booking-modal" onClick={(e) => e.stopPropagation()}>
            <div className="booking-modal-header">
              <h2>Бронирование рейса</h2>
              <button className="booking-modal-close" onClick={handleCloseBookingForm}>×</button>
            </div>
            
            <form onSubmit={handleSubmitBooking} className="booking-form">
              {bookingError && (
                <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
                  {bookingError}
                </div>
              )}

              <div className="form-group">
                <label className="form-label">
                  Количество людей *
                </label>
                <input
                  type="number"
                  name="number_of_people"
                  value={bookingForm.number_of_people || ''}
                  onChange={handleBookingFormChange}
                  min="1"
                  max={Math.min(11, trip.available_spots)}
                  className={`form-input ${numberOfPeopleError ? 'form-input-error' : ''}`}
                  required
                />
                {numberOfPeopleError ? (
                  <small className="form-error" style={{ display: 'block', marginTop: '0.5rem', color: '#ff4444' }}>
                    {numberOfPeopleError}
                  </small>
                ) : (
                  <small className="form-hint">
                    Доступно мест: {trip.available_spots} из {boat.capacity || 0}
                  </small>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">
                  Имя гостя *
                </label>
                <input
                  type="text"
                  name="guest_name"
                  value={bookingForm.guest_name}
                  onChange={handleBookingFormChange}
                  className="form-input"
                  placeholder="Введите имя"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  Контактный телефон *
                </label>
                <input
                  type="tel"
                  name="guest_phone"
                  value={bookingForm.guest_phone}
                  onChange={handleBookingFormChange}
                  className="form-input"
                  placeholder="+79001234567"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  Промокод
                </label>
                <div className="promo-code-group">
                  <input
                    type="text"
                    name="promo_code"
                    value={bookingForm.promo_code}
                    onChange={handlePromoCodeChange}
                    className="form-input promo-code-input"
                    placeholder="Введите промокод"
                  />
                  <button
                    type="button"
                    className="btn btn-secondary btn-apply-promo"
                    onClick={handleApplyPromoCode}
                    disabled={promoCodeLoading || !bookingForm.promo_code.trim()}
                  >
                    {promoCodeLoading ? 'Проверка...' : 'Применить'}
                  </button>
                </div>
                {promoCodeError && (
                  <small className="form-error" style={{ display: 'block', marginTop: '0.5rem', color: '#ff4444' }}>
                    {promoCodeError}
                  </small>
                )}
                {promoCodePreview && promoCodePreview.promo_code && (
                  <small className="form-success" style={{ display: 'block', marginTop: '0.5rem', color: '#0ef9f2' }}>
                    Промокод применен: скидка {promoCodePreview.promo_code.discount_amount.toLocaleString('ru-RU')} ₽
                  </small>
                )}
              </div>

              <div className="booking-summary">
                <h3>Расчет стоимости</h3>
                <div className="booking-summary-item">
                  <span>Цена за человека:</span>
                  <span>{parseFloat(trip.price_per_person).toLocaleString('ru-RU')} ₽</span>
                </div>
                <div className="booking-summary-item">
                  <span>Количество людей:</span>
                  <span>{bookingForm.number_of_people}</span>
                </div>
                {calculateBookingPrice().originalTotal > calculateBookingPrice().total && (
                  <>
                    <div className="booking-summary-item">
                      <span>Стоимость без скидок:</span>
                      <span>{calculateBookingPrice().originalTotal.toLocaleString('ru-RU')} ₽</span>
                    </div>
                    {calculateBookingPrice().guideDiscount > 0 && (
                      <div className="booking-summary-item">
                        <span>Скидка гида:</span>
                        <span>-{calculateBookingPrice().guideDiscount.toLocaleString('ru-RU')} ₽</span>
                      </div>
                    )}
                    {calculateBookingPrice().promoDiscount > 0 && (
                      <div className="booking-summary-item promo-discount">
                        <span>Скидка по промокоду:</span>
                        <span>-{calculateBookingPrice().promoDiscount.toLocaleString('ru-RU')} ₽</span>
                      </div>
                    )}
                    <div className="booking-summary-item booking-summary-subtotal">
                      <span>Итого со скидками:</span>
                      <span>{calculateBookingPrice().total.toLocaleString('ru-RU')} ₽</span>
                    </div>
                  </>
                )}
                <div className="booking-summary-item booking-summary-total">
                  <span>Общая стоимость:</span>
                  <span>{calculateBookingPrice().total.toLocaleString('ru-RU')} ₽</span>
                </div>
                <div className="booking-summary-item booking-summary-deposit">
                  <span>Предоплата (1000 ₽/чел):</span>
                  <span>{calculateBookingPrice().deposit.toLocaleString('ru-RU')} ₽</span>
                </div>
                <div className="booking-summary-item booking-summary-remaining">
                  <span>Остаток к оплате:</span>
                  <span>{calculateBookingPrice().remaining.toLocaleString('ru-RU')} ₽</span>
                </div>
                <div className="booking-summary-note">
                  <small>
                    * Остаток необходимо оплатить за 3 часа до выхода в море
                  </small>
                </div>
              </div>

            {hotelPaymentLink && (
              <div className="hotel-payment-link-block">
                <h3>Ссылка для предоплаты гостю</h3>
                <p>
                  Отправьте эту ссылку гостю для внесения предоплаты. После оплаты предоплаты вы сможете создать ссылку для полной оплаты в разделе "Мои бронирования" в профиле.
                  Система автоматически начислит кешбэк после полной оплаты бронирования.
                </p>
                <div className="hotel-payment-link-row">
                  <input
                    type="text"
                    value={hotelPaymentLink}
                    readOnly
                    className="form-input"
                    style={{ flex: 1 }}
                  />
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ marginTop: '1rem' }}
                  onClick={handleCopyHotelLink}
                >
                  Скопировать
                </button>
              </div>
            )}

              <div className="booking-form-actions">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={bookingLoading}
                >
                  {bookingLoading ? 'Создание бронирования...' : getBookButtonLabel()}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleCloseBookingForm}
                  disabled={bookingLoading}
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default TripDetail

