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
  const [selectedDayBookings, setSelectedDayBookings] = useState(null)
  const [showBookingModal, setShowBookingModal] = useState(false)
  const [showBlockSeatsForm, setShowBlockSeatsForm] = useState(false)
  const [blockedSeats, setBlockedSeats] = useState([])
  const [fullPaymentLinks, setFullPaymentLinks] = useState({}) // Хранение ссылок на полную оплату по booking.id
  const [creatingPaymentLink, setCreatingPaymentLink] = useState(null) // ID бронирования, для которого создается ссылка
  
  // Форма блокировки
  const [blockForm, setBlockForm] = useState({
    boat_id: '',
    date_from: '',
    date_to: '',
    reason: 'maintenance',
    reason_text: ''
  })
  
  // Форма блокировки мест
  const [blockSeatsForm, setBlockSeatsForm] = useState({
    boat_id: '',
    trip_id: '',
    number_of_people: 1
  })
  const [availableTrips, setAvailableTrips] = useState([])
  
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

    loadUserInfo().then(async role => {
      if (role) {
        loadData(role)
        if (role === 'boat_owner') {
          await loadMyBoats()
          loadBlockedSeats()
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
      
      // Обрабатываем данные бронирований (может быть массив или объект с results)
      let bookingsList = []
      if (bookingsData) {
        if (Array.isArray(bookingsData)) {
          bookingsList = bookingsData
        } else if (bookingsData.results && Array.isArray(bookingsData.results)) {
          bookingsList = bookingsData.results
        }
      }
      console.log('📊 Loaded bookings:', { 
        role: currentRole, 
        bookingsCount: bookingsList.length,
        bookings: bookingsList 
      })
      setBookings(bookingsList)
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
        minute: '2-digit',
        timeZone: 'Europe/Moscow'
      })
    } else {
      return date.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })
    }
  }

  /** Только дата без времени — для заголовка брони, где время в отдельной строке (выход с X до Y) */
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

  const handlePayRemaining = async (bookingId) => {
    if (!window.confirm('Вы уверены, что хотите оплатить остаток?')) {
      return
    }

    try {
      const result = await bookingsAPI.payRemaining(bookingId, 'online')
      
      // Проверяем, есть ли URL для оплаты
      if (result.payment_url) {
        // Перенаправляем на страницу оплаты Т-Банка
        window.location.href = result.payment_url
      } else {
        // Fallback для старой логики
        alert(`Остаток успешно оплачен!\n\nКод для посадки: ${result.verification_code}\n\nПокажите этот код капитану при посадке.`)
        setShowBookingModal(false)
        loadData()
      }
    } catch (err) {
      const errorMessage = err.response?.data?.error || 
                          err.response?.data?.detail || 
                          'Ошибка при оплате остатка'
      alert(errorMessage)
    }
  }

  const handleContactManager = () => {
    window.open('https://wa.me/79118018282', '_blank')
  }

  // Функция для формирования текста с информацией о брони
  const generateShareText = (booking) => {
    const date = formatDate(booking.start_datetime)
    const time = `${formatTime(booking.start_datetime)} - ${formatTime(booking.end_datetime)}`
    const boatName = booking.boat?.name || 'Не указан'
    const dockName = booking.boat?.dock?.name || ''
    const dockUrl = booking.boat?.dock?.yandex_location_url || ''
    const isGuideBooking = booking.is_guide_booking || booking.guide
    const guideName = booking.guide?.first_name && booking.guide?.last_name 
      ? `${booking.guide.first_name} ${booking.guide.last_name}`.trim()
      : booking.guide?.first_name || booking.guide?.email?.split('@')[0] || 'Гид'
    const guidePhone = booking.guide?.phone || ''
    
    // Заголовок с названием причала или катера
    let text = ''
    if (dockName) {
      text += `Точка сбора ${dockName}\n\n`
    } else {
      text += `Бронирование на катер "${boatName}"\n\n`
    }
    
    // Основная информация о бронировании
    text += `⚓️ "${boatName}": готовимся к выходу в море! 🌊\n`
    text += `📅 Дата и время: ${date}, ${time}\n`
    text += `👥 Количество человек: ${booking.number_of_people}\n\n`
    
    // Место сбора
    if (dockName || dockUrl) {
      text += `📌 Место сбора:`
      if (dockName) {
        text += ` ${dockName}`
      }
      if (dockUrl) {
        text += `\n📍 Ссылка на карту: ${dockUrl}`
      } else {
        text += `\n📍`
      }
      text += `\n\n`
    }
    
    // Код для посадки
    if (booking.status === 'confirmed') {
      text += `✅ Код для посадки: BOOK-${booking.id}\n`
      text += `📢 На месте сбора: четко называйте судно "${boatName}" и код BOOK-${booking.id}! 🗣️\n\n`
    }
    
    // Важные напоминания
    text += `⚠️ Важно! Пограничный контроль:\n`
    text += `• Паспорта (оригинал или копия) для взрослых 🆔\n`
    text += `• Свидетельство о рождении для детей 👶\n\n`
    
    text += `⚠️ Техника безопасности:\n`
    text += `• Соблюдайте все инструкции капитана 📜\n`
    text += `• Надевайте спасательные жилеты при необходимости 🦺\n\n`
    
    // Контакты - только если бронирование от гида
    if (isGuideBooking && guidePhone) {
      text += `📞 Контакты:\n`
      text += `• Гид ${guideName}: ${guidePhone} 👨\n\n`
    }
    
    // Правила
    text += `🚫 На борту: алкоголь строго запрещен! ⛔\n\n`
    
    text += `Спасибо за понимание! 🤗 Желаем приятной морской прогулки! 🐋`
    
    return text
  }

  // Функция для копирования информации в буфер обмена
  const handleShare = async (booking, e) => {
    if (e) {
      e.stopPropagation()
    }
    
    const shareText = generateShareText(booking)
    
    try {
      await navigator.clipboard.writeText(shareText)
      alert('Информация о бронировании скопирована в буфер обмена!')
    } catch (err) {
      // Fallback для старых браузеров
      const textArea = document.createElement('textarea')
      textArea.value = shareText
      textArea.style.position = 'fixed'
      textArea.style.opacity = '0'
      document.body.appendChild(textArea)
      textArea.select()
      try {
        document.execCommand('copy')
        alert('Информация о бронировании скопирована в буфер обмена!')
      } catch (err) {
        alert('Не удалось скопировать информацию. Попробуйте скопировать вручную.')
      }
      document.body.removeChild(textArea)
    }
  }


  const handleCheckIn = async (bookingId) => {
    try {
      const result = await bookingsAPI.checkIn(bookingId)
      alert(`Посадка подтверждена!\n\n${result.message}\nКоличество пассажиров: ${result.number_of_people}`)
      setShowBookingModal(false)
      loadData()
    } catch (err) {
      const errorMessage = err.response?.data?.error || 
                          err.response?.data?.detail || 
                          'Ошибка при подтверждении посадки'
      alert(errorMessage)
    }
  }

  const loadBlockedSeats = async () => {
    try {
      const blocked = await bookingsAPI.getBlockedSeats()
      setBlockedSeats(Array.isArray(blocked) ? blocked : [])
    } catch (err) {
      console.error('Ошибка загрузки заблокированных мест:', err)
    }
  }

  const loadAvailableTrips = async (boatId) => {
    if (!boatId) {
      setAvailableTrips([])
      return
    }
    try {
      // Для владельца судна загружаем все активные рейсы без ограничения по датам
      // Не передаем dateFrom и dateTo, чтобы получить все рейсы
      const trips = await boatsAPI.getBoatAvailability(boatId, null, null)
      
      if (!Array.isArray(trips)) {
        setAvailableTrips([])
        return
      }
      
      // Сортируем рейсы по дате и времени отправления
      const sortedTrips = trips.sort((a, b) => {
        const dateA = new Date(a.departure_date + ' ' + (a.departure_time || '00:00'))
        const dateB = new Date(b.departure_date + ' ' + (b.departure_time || '00:00'))
        return dateA - dateB
      })
      
      setAvailableTrips(sortedTrips)
    } catch (err) {
      console.error('Ошибка загрузки доступных рейсов:', err)
      setAvailableTrips([])
    }
  }

  const handleBlockSeats = async (e) => {
    e.preventDefault()
    if (!blockSeatsForm.boat_id || !blockSeatsForm.trip_id || !blockSeatsForm.number_of_people) {
      alert('Заполните все обязательные поля')
      return
    }

    try {
      await bookingsAPI.blockSeats({
        trip_id: parseInt(blockSeatsForm.trip_id),
        number_of_people: parseInt(blockSeatsForm.number_of_people)
      })
      alert('Места успешно заблокированы')
      setShowBlockSeatsForm(false)
      setBlockSeatsForm({
        boat_id: '',
        trip_id: '',
        number_of_people: 1
      })
      setAvailableTrips([])
      loadBlockedSeats()
      loadData()
    } catch (err) {
      const errorMessage = err.response?.data?.error || 
                          err.response?.data?.detail || 
                          'Ошибка при блокировке мест'
      alert(errorMessage)
    }
  }

  const handleUnblockSeats = async (bookingId) => {
    if (!window.confirm('Вы уверены, что хотите разблокировать эти места?')) {
      return
    }

    try {
      await bookingsAPI.unblockSeats(bookingId)
      alert('Места успешно разблокированы')
      loadBlockedSeats()
      loadData()
    } catch (err) {
      const errorMessage = err.response?.data?.error || 
                          err.response?.data?.detail || 
                          'Ошибка при разблокировке мест'
      alert(errorMessage)
    }
  }

  const handleCreateFullPaymentLink = async (bookingId) => {
    setCreatingPaymentLink(bookingId)
    try {
      const result = await bookingsAPI.createFullPaymentLink(bookingId)
      setFullPaymentLinks(prev => ({
        ...prev,
        [bookingId]: result.payment_url
      }))
      alert('Ссылка на полную оплату создана!')
    } catch (err) {
      const errorMessage = err.response?.data?.error || 
                          err.response?.data?.detail || 
                          'Ошибка при создании ссылки на оплату'
      alert(errorMessage)
    } finally {
      setCreatingPaymentLink(null)
    }
  }

  const handleCopyPaymentLink = async (paymentUrl) => {
    try {
      await navigator.clipboard.writeText(paymentUrl)
      alert('Ссылка скопирована в буфер обмена!')
    } catch (err) {
      alert('Не удалось скопировать ссылку. Скопируйте вручную.')
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

  console.log('🏨 Bookings page render:', { userRole, bookingsCount: bookings.length })
  
  return (
    <div className="profile-page">
      <div className="profile-container">
        <div className="profile-section">
          {/* Заголовок */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <h1 className="section-title">
              Бронирования
              {userRole && (
                <span style={{ fontSize: '0.875rem', color: 'var(--stone)', marginLeft: '1rem', fontWeight: 'normal' }}>
                  ({userRole})
                </span>
              )}
            </h1>
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
                            onClick={() => {
                              if (dayData.bookings.length > 0) {
                                setSelectedDayBookings(dayData.bookings)
                                setShowBookingModal(true)
                              }
                            }}
                            style={{
                              cursor: dayData.bookings.length > 0 ? 'pointer' : 'default'
                            }}
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
                              {dayData.bookings.length > 0 && (() => {
                                // Группируем бронирования по катерам
                                const bookingsByBoat = new Map()
                                dayData.bookings.forEach(booking => {
                                  if (booking.boat) {
                                    const boatId = booking.boat.id
                                    if (!bookingsByBoat.has(boatId)) {
                                      bookingsByBoat.set(boatId, {
                                        name: booking.boat.name || 'Не указан',
                                        capacity: booking.boat.capacity || 0,
                                        bookings: []
                                      })
                                    }
                                    bookingsByBoat.get(boatId).bookings.push(booking)
                                  }
                                })
                                
                                // Подсчитываем для каждого катера количество забронированных людей
                                const boatsData = Array.from(bookingsByBoat.values()).map(boatData => ({
                                  name: boatData.name,
                                  capacity: boatData.capacity,
                                  bookedPeople: boatData.bookings.reduce((sum, booking) => sum + (booking.number_of_people || 0), 0)
                                }))
                                
                                return (
                                  <div className="calendar-day-bookings-info" style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.2rem',
                                    width: '100%',
                                    marginTop: '0.25rem'
                                  }}>
                                    {boatsData.map((boatData, idx) => (
                                      <div
                                        key={idx}
                                        style={{
                                          fontSize: '0.7rem',
                                          lineHeight: '1.3',
                                          color: '#1a1a1a',
                                          fontWeight: 'var(--font-weight-medium)',
                                          padding: '0.2rem',
                                          background: 'rgba(255, 255, 255, 0.9)',
                                          borderRadius: '3px',
                                          border: '1px solid rgba(76, 175, 80, 0.4)'
                                        }}
                                        title={`${boatData.name}: ${boatData.bookedPeople} из ${boatData.capacity}`}
                                      >
                                        <div style={{ 
                                          fontWeight: 'var(--font-weight-semibold)',
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          whiteSpace: 'nowrap',
                                          marginBottom: '0.1rem',
                                          fontSize: '0.7rem'
                                        }}>
                                          {boatData.name}
                                        </div>
                                        <div style={{ 
                                          color: '#2e7d32',
                                          fontSize: '0.65rem',
                                          fontWeight: 'var(--font-weight-medium)'
                                        }}>
                                          {boatData.bookedPeople} из {boatData.capacity}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )
                              })()}
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

                {/* Блокировка мест для капитана - всегда видна для владельца судна */}
                {userRole === 'boat_owner' && (
                        <div style={{ marginBottom: '2rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                            <h2 className="section-subtitle">Блокировка мест (внешняя продажа)</h2>
                            <button
                              className="btn btn-primary"
                              onClick={async () => {
                                setShowBlockSeatsForm(!showBlockSeatsForm)
                                if (!showBlockSeatsForm && myBoats.length > 0 && !blockSeatsForm.boat_id) {
                                  const boatId = myBoats[0].id
                                  setBlockSeatsForm(prev => ({ ...prev, boat_id: boatId }))
                                  await loadAvailableTrips(boatId)
                                } else if (!showBlockSeatsForm) {
                                  setBlockSeatsForm({
                                    boat_id: '',
                                    trip_id: '',
                                    number_of_people: 1
                                  })
                                  setAvailableTrips([])
                                }
                              }}
                              style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                            >
                              {showBlockSeatsForm ? '✕ Отмена' : '+ Заблокировать места'}
                            </button>
                          </div>

                          {showBlockSeatsForm && (
                            <form onSubmit={handleBlockSeats} style={{
                              background: 'var(--cloud-light)',
                              padding: '1.5rem',
                              borderRadius: 'var(--radius-md)',
                              marginBottom: '1.5rem'
                            }}>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                                <div>
                                  <label className="form-label">Судно *</label>
                                  <select
                                    value={blockSeatsForm.boat_id}
                                    onChange={async (e) => {
                                      const boatId = e.target.value
                                      setBlockSeatsForm({ ...blockSeatsForm, boat_id: boatId, trip_id: '' })
                                      if (boatId) {
                                        await loadAvailableTrips(boatId)
                                      } else {
                                        setAvailableTrips([])
                                      }
                                    }}
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
                                  <label className="form-label">Рейс *</label>
                                  <select
                                    value={blockSeatsForm.trip_id}
                                    onChange={(e) => setBlockSeatsForm({ ...blockSeatsForm, trip_id: e.target.value })}
                                    className="form-input"
                                    required
                                    disabled={!blockSeatsForm.boat_id || availableTrips.length === 0}
                                  >
                                    <option value="">{availableTrips.length === 0 && blockSeatsForm.boat_id ? 'Нет доступных рейсов' : 'Выберите рейс'}</option>
                                    {availableTrips.map(trip => {
                                      const dateStr = trip.departure_date
                                      const formattedDate = dateStr ? formatDate(dateStr) : ''
                                      const timeStr = trip.departure_time ? (trip.departure_time.length === 5 ? trip.departure_time : trip.departure_time.substring(0, 5)) : ''
                                      const returnTimeStr = trip.return_time ? (trip.return_time.length === 5 ? trip.return_time : trip.return_time.substring(0, 5)) : ''
                                      return (
                                        <option key={trip.id} value={trip.id}>
                                          {formattedDate} {timeStr} - {returnTimeStr}
                                        </option>
                                      )
                                    })}
                                  </select>
                                </div>
                                <div>
                                  <label className="form-label">Количество мест *</label>
                            <div style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '0.5rem',
                              position: 'relative'
                            }}>
                              <button
                                type="button"
                                onClick={() => {
                                  const newValue = Math.max(1, blockSeatsForm.number_of_people - 1)
                                  setBlockSeatsForm({ ...blockSeatsForm, number_of_people: newValue })
                                }}
                                className="number-input-btn number-input-btn-minus"
                                disabled={blockSeatsForm.number_of_people <= 1}
                                aria-label="Уменьшить количество"
                              >
                                −
                              </button>
                                  <input
                                    type="number"
                                    min="1"
                                    max="11"
                                    value={blockSeatsForm.number_of_people}
                                    onChange={(e) => {
                                      const value = parseInt(e.target.value) || 1
                                      const clampedValue = Math.max(1, Math.min(11, value))
                                      setBlockSeatsForm({ ...blockSeatsForm, number_of_people: clampedValue })
                                    }}
                                    className="form-input form-input-number"
                                    required
                                style={{ flex: 1, textAlign: 'center' }}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const newValue = Math.min(11, blockSeatsForm.number_of_people + 1)
                                  setBlockSeatsForm({ ...blockSeatsForm, number_of_people: newValue })
                                }}
                                className="number-input-btn number-input-btn-plus"
                                disabled={blockSeatsForm.number_of_people >= 11}
                                aria-label="Увеличить количество"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                          <button type="submit" className="btn btn-primary">Заблокировать места</button>
                          <button type="button" onClick={() => setShowBlockSeatsForm(false)} className="btn btn-secondary">Отмена</button>
                        </div>
                      </form>
                    )}

                    {blockedSeats.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem', fontWeight: 'var(--font-weight-medium)' }}>Активные блокировки мест</h3>
                        {blockedSeats.map((blocked) => (
                          <div key={blocked.id} style={{
                            padding: '0.75rem',
                            background: '#e8f5e9',
                            border: '1px solid #4caf50',
                            borderRadius: 'var(--radius-md)',
                            fontSize: '0.875rem',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            gap: '1rem'
                          }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ marginBottom: '0.25rem', color: '#1a1a1a' }}>
                                <strong>{formatDate(blocked.start_datetime)}</strong>
                                {' '}
                                {formatTime(blocked.start_datetime)} – {formatTime(blocked.end_datetime)}
                              </div>
                              <div style={{ marginTop: '0.25rem', color: '#2e7d32', fontSize: '0.8125rem' }}>
                                {blocked.boat?.name && (
                                  <span style={{ fontWeight: 'var(--font-weight-medium)' }}>
                                    {blocked.boat.name} • 
                                  </span>
                                )}
                                {' '}Заблокировано мест: {blocked.number_of_people}
                                {blocked.notes && blocked.notes.replace('[БЛОКИРОВКА]', '').trim() && (
                                  <> • {blocked.notes.replace('[БЛОКИРОВКА]', '').trim()}</>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => handleUnblockSeats(blocked.id)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#2e7d32',
                                cursor: 'pointer',
                                fontSize: '1.25rem',
                                padding: '0.25rem',
                                lineHeight: '1'
                              }}
                              title="Разблокировать места"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      !showBlockSeatsForm && (
                        <p style={{ color: 'var(--stone)', fontSize: '0.875rem' }}>Нет заблокированных мест</p>
                      )
                    )}
                  </div>
                )}

                {/* Бронирования */}
                {calendarData.bookings && calendarData.bookings.length === 0 ? (
                  <div className="empty-state">
                    <p>Бронирований в этом месяце нет</p>
                  </div>
                ) : (
                  calendarData.bookings && calendarData.bookings.length > 0 && (
                    <>
                      
                      <div className="calendar-section">
                        <h2 className="section-subtitle" style={{ marginBottom: '1rem' }}>Лента бронирований</h2>
                        <div className="calendar-bookings">
                        {[...calendarData.bookings]
                          .sort((a, b) => new Date(a.start_datetime) - new Date(b.start_datetime))
                          .map((booking) => (
                          <div 
                            key={booking.id} 
                            className="calendar-booking-item"
                            onClick={() => {
                              setSelectedDayBookings([booking])
                              setShowBookingModal(true)
                            }}
                            style={{
                              cursor: 'pointer',
                              transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = 'translateX(4px)'
                              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = 'translateX(0)'
                              e.currentTarget.style.boxShadow = 'none'
                            }}
                          >
                            <div className="calendar-booking-date">
                              {formatDateOnly(booking.start_datetime)}
                            </div>
                            <div className="calendar-booking-info">
                              <div className="calendar-booking-time">
                                Выход: {formatTime(booking.start_datetime)} – {formatTime(booking.end_datetime)}
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
                    </>
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

          {/* Список бронирований для клиентов и гидов */}
          {(userRole === 'customer' || userRole === 'guide') && (
            <div style={{ marginBottom: '3rem' }}>
              <h2 className="section-subtitle" style={{ marginBottom: '1rem' }}>Мои бронирования</h2>
              
              {bookings.length === 0 ? (
                <div className="empty-state">
                  <p>У вас пока нет бронирований</p>
                </div>
              ) : (
                <div className="bookings-list" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {bookings
                    .sort((a, b) => new Date(b.start_datetime) - new Date(a.start_datetime))
                    .map((booking) => (
                    <div 
                      key={booking.id} 
                      className="booking-card"
                      style={{
                        padding: '1.5rem',
                        background: 'var(--white)',
                        border: '1px solid var(--cloud)',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                      onClick={() => {
                        setSelectedDayBookings([booking])
                        setShowBookingModal(true)
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--ocean-deep)'
                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--cloud)'
                        e.currentTarget.style.boxShadow = 'none'
                      }}
                    >
                      <div className="booking-header" style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'flex-start',
                        marginBottom: '1rem',
                        flexWrap: 'wrap',
                        gap: '1rem'
                      }}>
                        <div className="booking-date-time">
                          <div className="booking-date-main" style={{ 
                            fontSize: '1.125rem', 
                            fontWeight: 'var(--font-weight-semibold)',
                            color: '#1a1a1a',
                            marginBottom: '0.25rem'
                          }}>
                            {formatDateOnly(booking.start_datetime)}
                          </div>
                          <div className="booking-time" style={{ 
                            fontSize: '0.875rem', 
                            color: 'var(--stone)'
                          }}>
                            Выход: {formatTime(booking.start_datetime)} – {formatTime(booking.end_datetime)}
                          </div>
                        </div>
                        <div className={`booking-status booking-status-${booking.status}`} style={{
                          padding: '0.5rem 1rem',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.875rem',
                          fontWeight: 'var(--font-weight-medium)',
                          whiteSpace: 'nowrap'
                        }}>
                          {booking.status_display}
                        </div>
                      </div>
                      <div className="booking-body">
                        <div className="booking-event-type" style={{ 
                          marginBottom: '0.75rem',
                          fontSize: '0.9375rem',
                          color: '#1a1a1a'
                        }}>
                          <strong>Мероприятие:</strong> {booking.event_type}
                        </div>
                        <div className="booking-details-grid" style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                          gap: '0.75rem',
                          fontSize: '0.875rem'
                        }}>
                          <div className="booking-detail-item" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <span className="detail-label" style={{ color: 'var(--stone)', fontSize: '0.8125rem' }}>Судно:</span>
                            <span className="detail-value" style={{ color: '#1a1a1a', fontWeight: 'var(--font-weight-medium)' }}>
                              {booking.boat?.name || 'Не указан'}
                            </span>
                          </div>
                          {booking.boat?.dock && (
                            <div className="booking-detail-item" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                              <span className="detail-label" style={{ color: 'var(--stone)', fontSize: '0.8125rem' }}>Как пройти:</span>
                              <span className="detail-value" style={{ color: '#1a1a1a', fontWeight: 'var(--font-weight-medium)' }}>
                                {booking.boat.dock.yandex_location_url ? (
                                  <a 
                                    href={booking.boat.dock.yandex_location_url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    style={{ color: 'var(--ocean-deep)', textDecoration: 'underline' }}
                                  >
                                    {booking.boat.dock.name || 'Открыть на карте'}
                                  </a>
                                ) : (
                                  booking.boat.dock.name || 'Не указан'
                                )}
                              </span>
                            </div>
                          )}
                          <div className="booking-detail-item" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <span className="detail-label" style={{ color: 'var(--stone)', fontSize: '0.8125rem' }}>Количество людей:</span>
                            <span className="detail-value" style={{ color: '#1a1a1a', fontWeight: 'var(--font-weight-medium)' }}>
                              {booking.number_of_people}
                            </span>
                          </div>
                          <div className="booking-detail-item" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <span className="detail-label" style={{ color: 'var(--stone)', fontSize: '0.8125rem' }}>Общая стоимость:</span>
                            <span className="detail-value" style={{ color: '#1a1a1a', fontWeight: 'var(--font-weight-semibold)' }}>
                              {userRole === 'guide' && booking.guide_booking_amount
                                ? `${Math.round(booking.guide_booking_amount).toLocaleString('ru-RU')} ₽`
                                : `${Math.round(booking.total_price || 0).toLocaleString('ru-RU')} ₽`}
                            </span>
                          </div>
                          {booking.remaining_amount > 0 && (
                            <div className="booking-detail-item" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                              <span className="detail-label" style={{ color: 'var(--stone)', fontSize: '0.8125rem' }}>Остаток к оплате:</span>
                              <span className="detail-value" style={{ color: 'var(--ocean-deep)', fontWeight: 'var(--font-weight-semibold)' }}>
                                {Math.round(booking.remaining_amount).toLocaleString('ru-RU')} ₽
                              </span>
                              <small style={{ color: 'var(--stone)', fontSize: '0.75rem' }}>
                                Оплатить за 1 час до выхода в море
                              </small>
                            </div>
                          )}
                        </div>
                        
                        {/* Кнопки действий в карточке */}
                        <div style={{ 
                          marginTop: '1rem', 
                          paddingTop: '1rem', 
                          borderTop: '1px solid var(--cloud)',
                          display: 'flex',
                          gap: '0.5rem',
                          flexWrap: 'wrap',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            {/* Кнопка оплаты остатка */}
                            {(userRole === 'guide' || userRole === 'customer') && 
                             booking.status !== 'cancelled' && 
                             booking.status !== 'completed' && 
                             booking.remaining_amount > 0 && (
                              <button
                                className="btn btn-primary"
                                style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                                onClick={(e) => {
                                  e.stopPropagation() // Предотвращаем открытие модального окна
                                  handlePayRemaining(booking.id)
                                }}
                              >
                                Оплатить остаток
                              </button>
                            )}
                            
                            {/* Связаться с менеджером - для всех активных бронирований */}
                            {booking.status !== 'cancelled' && booking.status !== 'completed' && (
                              <button
                                className="btn btn-secondary"
                                style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                                onClick={(e) => {
                                  e.stopPropagation() // Предотвращаем открытие модального окна
                                  handleContactManager()
                                }}
                              >
                                Связаться с менеджером
                              </button>
                            )}
                          </div>
                          
                          {/* Кнопка поделиться - всегда видна */}
                          <button
                            className="btn btn-secondary"
                            style={{ 
                              fontSize: '0.875rem', 
                              padding: '0.5rem 1rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem'
                            }}
                            onClick={(e) => handleShare(booking, e)}
                            title="Скопировать информацию о бронировании"
                          >
                            📋 Поделиться
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Список бронирований для гостиниц */}
          {userRole === 'hotel' && (
            <div style={{ marginBottom: '3rem' }}>
              <h2 className="section-subtitle" style={{ marginBottom: '1rem' }}>
                Мои бронирования
                <span style={{ fontSize: '0.875rem', color: 'var(--stone)', marginLeft: '1rem', fontWeight: 'normal' }}>
                  (Гостиница)
                </span>
              </h2>
              
              {bookings.length === 0 ? (
                <div className="empty-state">
                  <p>У вас пока нет бронирований</p>
                </div>
              ) : (
                <div className="bookings-list" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {bookings
                    .sort((a, b) => new Date(b.start_datetime) - new Date(a.start_datetime))
                    .map((booking) => (
                    <div 
                      key={booking.id} 
                      className="booking-card"
                      style={{
                        padding: '1.5rem',
                        background: 'var(--white)',
                        border: '1px solid var(--cloud)',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                      onClick={() => {
                        setSelectedDayBookings([booking])
                        setShowBookingModal(true)
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--ocean-deep)'
                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--cloud)'
                        e.currentTarget.style.boxShadow = 'none'
                      }}
                    >
                      <div className="booking-header" style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'flex-start',
                        marginBottom: '1rem',
                        flexWrap: 'wrap',
                        gap: '1rem'
                      }}>
                        <div className="booking-date-time">
                          <div className="booking-date-main" style={{ 
                            fontSize: '1.125rem', 
                            fontWeight: 'var(--font-weight-semibold)',
                            color: '#1a1a1a',
                            marginBottom: '0.25rem'
                          }}>
                            {formatDateOnly(booking.start_datetime)}
                          </div>
                          <div className="booking-time" style={{ 
                            fontSize: '0.875rem', 
                            color: 'var(--stone)'
                          }}>
                            Выход: {formatTime(booking.start_datetime)} – {formatTime(booking.end_datetime)}
                          </div>
                        </div>
                        <div className={`booking-status booking-status-${booking.status}`} style={{
                          padding: '0.5rem 1rem',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.875rem',
                          fontWeight: 'var(--font-weight-medium)',
                          whiteSpace: 'nowrap'
                        }}>
                          {booking.status_display}
                        </div>
                      </div>
                      <div className="booking-body">
                        <div className="booking-event-type" style={{ 
                          marginBottom: '0.75rem',
                          fontSize: '0.9375rem',
                          color: '#1a1a1a'
                        }}>
                          <strong>Мероприятие:</strong> {booking.event_type}
                        </div>
                        <div className="booking-details-grid" style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                          gap: '0.75rem',
                          fontSize: '0.875rem'
                        }}>
                          <div className="booking-detail-item" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <span className="detail-label" style={{ color: 'var(--stone)', fontSize: '0.8125rem' }}>Судно:</span>
                            <span className="detail-value" style={{ color: '#1a1a1a', fontWeight: 'var(--font-weight-medium)' }}>
                              {booking.boat?.name || 'Не указан'}
                            </span>
                          </div>
                          <div className="booking-detail-item" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <span className="detail-label" style={{ color: 'var(--stone)', fontSize: '0.8125rem' }}>Гость:</span>
                            <span className="detail-value" style={{ color: '#1a1a1a', fontWeight: 'var(--font-weight-medium)' }}>
                              {booking.guest_name}
                            </span>
                          </div>
                          <div className="booking-detail-item" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <span className="detail-label" style={{ color: 'var(--stone)', fontSize: '0.8125rem' }}>Количество людей:</span>
                            <span className="detail-value" style={{ color: '#1a1a1a', fontWeight: 'var(--font-weight-medium)' }}>
                              {booking.number_of_people}
                            </span>
                          </div>
                          <div className="booking-detail-item" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <span className="detail-label" style={{ color: 'var(--stone)', fontSize: '0.8125rem' }}>Общая стоимость:</span>
                            <span className="detail-value" style={{ color: '#1a1a1a', fontWeight: 'var(--font-weight-semibold)' }}>
                              {Math.round(booking.total_price || 0).toLocaleString('ru-RU')} ₽
                            </span>
                          </div>
                          {booking.deposit > 0 && (
                            <div className="booking-detail-item" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                              <span className="detail-label" style={{ color: 'var(--stone)', fontSize: '0.8125rem' }}>Внесена предоплата:</span>
                              <span className="detail-value" style={{ color: '#1a1a1a', fontWeight: 'var(--font-weight-medium)' }}>
                                {Math.round(booking.deposit).toLocaleString('ru-RU')} ₽
                              </span>
                            </div>
                          )}
                          {booking.remaining_amount > 0 && (
                            <div className="booking-detail-item" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                              <span className="detail-label" style={{ color: 'var(--stone)', fontSize: '0.8125rem' }}>Остаток к оплате:</span>
                              <span className="detail-value" style={{ color: 'var(--ocean-deep)', fontWeight: 'var(--font-weight-semibold)' }}>
                                {Math.round(booking.remaining_amount).toLocaleString('ru-RU')} ₽
                              </span>
                              <small style={{ color: 'var(--stone)', fontSize: '0.75rem' }}>
                                Оплатить за 1 час до выхода в море
                              </small>
                            </div>
                          )}
                          {/* Статус оплаты */}
                          {(() => {
                            const deposit = Number(booking.deposit) || 0
                            const remaining = Number(booking.remaining_amount) || 0
                            
                            if (deposit > 0 && remaining === 0) {
                              return (
                                <div className="booking-detail-item" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                  <span className="detail-label" style={{ color: 'var(--stone)', fontSize: '0.8125rem' }}>Статус оплаты:</span>
                                  <span className="detail-value" style={{ color: '#4caf50', fontWeight: 'var(--font-weight-semibold)' }}>
                                    Полная оплата внесена
                                  </span>
                                </div>
                              )
                            } else if (deposit > 0 && remaining > 0) {
                              return (
                                <div className="booking-detail-item" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                  <span className="detail-label" style={{ color: 'var(--stone)', fontSize: '0.8125rem' }}>Статус оплаты:</span>
                                  <span className="detail-value" style={{ color: '#ff9800', fontWeight: 'var(--font-weight-semibold)' }}>
                                    Предоплата внесена
                                  </span>
                                </div>
                              )
                            } else {
                              return (
                                <div className="booking-detail-item" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                  <span className="detail-label" style={{ color: 'var(--stone)', fontSize: '0.8125rem' }}>Статус оплаты:</span>
                                  <span className="detail-value" style={{ color: '#f44336', fontWeight: 'var(--font-weight-semibold)' }}>
                                    Ожидает оплаты
                                  </span>
                                </div>
                              )
                            }
                          })()}
                          {booking.hotel_cashback_amount > 0 && (
                            <div className="booking-detail-item" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                              <span className="detail-label" style={{ color: 'var(--stone)', fontSize: '0.8125rem' }}>Кешбэк гостинице:</span>
                              <span className="detail-value" style={{ color: '#4caf50', fontWeight: 'var(--font-weight-semibold)' }}>
                                {Math.round(booking.hotel_cashback_amount).toLocaleString('ru-RU')} ₽
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
          )}

          {/* Модальное окно с информацией о бронированиях */}
          {showBookingModal && selectedDayBookings && (
            <div className="booking-modal-overlay" onClick={() => setShowBookingModal(false)}>
              <div className="booking-modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="booking-modal-header">
                  <h2 className="booking-modal-title">Бронирования</h2>
                  <button 
                    className="booking-modal-close"
                    onClick={() => setShowBookingModal(false)}
                    aria-label="Закрыть"
                  >
                    ×
                  </button>
                </div>
                <div className="booking-modal-body">
                  {/* Общая информация по катерам */}
                  {selectedDayBookings && selectedDayBookings.length > 0 && (() => {
                    // Группируем бронирования по катерам
                    const bookingsByBoat = new Map()
                    selectedDayBookings.forEach(booking => {
                      if (booking.boat) {
                        const boatId = booking.boat.id
                        if (!bookingsByBoat.has(boatId)) {
                          bookingsByBoat.set(boatId, {
                            name: booking.boat.name || 'Не указан',
                            capacity: booking.boat.capacity || 0,
                            bookings: []
                          })
                        }
                        bookingsByBoat.get(boatId).bookings.push(booking)
                      }
                    })
                    
                    // Подсчитываем для каждого катера количество забронированных людей
                    const boatsData = Array.from(bookingsByBoat.values()).map(boatData => ({
                      name: boatData.name,
                      capacity: boatData.capacity,
                      bookedPeople: boatData.bookings.reduce((sum, booking) => sum + (booking.number_of_people || 0), 0)
                    }))
                    
                    return (
                      <div style={{
                        marginBottom: '1.5rem',
                        padding: '1rem',
                        background: '#f5f5f5',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--cloud)'
                      }}>
                        <h3 style={{
                          fontSize: '0.9375rem',
                          fontWeight: 'var(--font-weight-semibold)',
                          color: '#1a1a1a',
                          marginBottom: '0.75rem'
                        }}>
                          Общая информация
                        </h3>
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.5rem'
                        }}>
                          {boatsData.map((boatData, idx) => (
                            <div
                              key={idx}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '0.5rem',
                                background: 'var(--white)',
                                borderRadius: 'var(--radius-sm)',
                                border: '1px solid var(--cloud)'
                              }}
                            >
                              <span style={{
                                fontWeight: 'var(--font-weight-semibold)',
                                color: '#1a1a1a',
                                fontSize: '0.875rem'
                              }}>
                                {boatData.name}
                              </span>
                              <span style={{
                                color: '#2e7d32',
                                fontSize: '0.875rem',
                                fontWeight: 'var(--font-weight-medium)'
                              }}>
                                {boatData.bookedPeople} из {boatData.capacity}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })()}
                  
                  {selectedDayBookings.map((booking) => (
                    <div key={booking.id} className="booking-card">
                      <div className="booking-header">
                        <div className="booking-date-time">
                          <div className="booking-date-main">
                            {formatDateOnly(booking.start_datetime)}
                          </div>
                          <div className="booking-time">
                            Выход: {formatTime(booking.start_datetime)} – {formatTime(booking.end_datetime)}
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
                            <span className="detail-label">Судно:</span>
                            <span className="detail-value">{booking.boat?.name || 'Не указан'}</span>
                          </div>
                          {booking.boat?.dock && (
                            <div className="booking-detail-item">
                              <span className="detail-label">Как пройти:</span>
                              <span className="detail-value">
                                {booking.boat.dock.yandex_location_url ? (
                                  <a 
                                    href={booking.boat.dock.yandex_location_url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    style={{ color: 'var(--ocean-deep)', textDecoration: 'underline' }}
                                  >
                                    {booking.boat.dock.name || 'Открыть на карте'}
                                  </a>
                                ) : (
                                  booking.boat.dock.name || 'Не указан'
                                )}
                              </span>
                            </div>
                          )}
                          <div className="booking-detail-item">
                            <span className="detail-label">Ставка за человека:</span>
                            <span className="detail-value">
                              {Math.round(booking.price_per_person || 0).toLocaleString('ru-RU')} ₽
                            </span>
                          </div>
                          <div className="booking-detail-item">
                            <span className="detail-label">Общая стоимость:</span>
                            <span className="detail-value">
                              {userRole === 'guide' && booking.guide_booking_amount
                                ? `${Math.round(booking.guide_booking_amount).toLocaleString('ru-RU')} ₽`
                                : `${Math.round(booking.total_price || 0).toLocaleString('ru-RU')} ₽`}
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
                              <small style={{ color: 'var(--stone)', fontSize: '0.75rem', display: 'block', marginTop: '0.25rem' }}>
                                Оплатить за 1 час до выхода в море
                              </small>
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
                        
                        {/* Код для посадки - показывается только для полностью оплаченных бронирований */}
                        {booking.status === 'confirmed' && (
                          <div style={{
                            marginTop: '1rem',
                            padding: '1rem',
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            borderRadius: '8px',
                            textAlign: 'center'
                          }}>
                            <div style={{
                              background: 'white',
                              borderRadius: '6px',
                              padding: '1rem'
                            }}>
                              <p style={{ 
                                fontSize: '0.875rem', 
                                color: '#666', 
                                marginBottom: '0.5rem',
                                fontWeight: 'var(--font-weight-medium)'
                              }}>
                                {userRole === 'boat_owner' ? 'Код для проверки при посадке:' : 'Код для посадки:'}
                              </p>
                              <p style={{ 
                                fontSize: '1.5rem', 
                                fontWeight: 'var(--font-weight-bold)',
                                color: '#667eea',
                                fontFamily: 'monospace',
                                letterSpacing: '2px',
                                margin: '0'
                              }}>
                                BOOK-{booking.id}
                              </p>
                              {userRole === 'boat_owner' ? (
                                <p style={{ 
                                  fontSize: '0.75rem', 
                                  color: '#999', 
                                  marginTop: '0.5rem',
                                  marginBottom: '0'
                                }}>
                                  Клиент должен предъявить этот код при посадке
                                </p>
                              ) : (
                                <p style={{ 
                                  fontSize: '0.75rem', 
                                  color: '#999', 
                                  marginTop: '0.5rem',
                                  marginBottom: '0'
                                }}>
                                  Покажите этот код капитану при посадке
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {/* Ссылка на полную оплату для гостиницы */}
                        {userRole === 'hotel' && fullPaymentLinks[booking.id] && (
                          <div style={{
                            marginTop: '1rem',
                            padding: '1rem',
                            background: '#e8f5e9',
                            border: '1px solid #4caf50',
                            borderRadius: 'var(--radius-md)'
                          }}>
                            <h4 style={{ 
                              fontSize: '0.9375rem', 
                              fontWeight: 'var(--font-weight-semibold)',
                              color: '#1a1a1a',
                              marginBottom: '0.5rem'
                            }}>
                              Ссылка для полной оплаты гостю
                            </h4>
                            <p style={{ fontSize: '0.875rem', color: 'var(--stone)', marginBottom: '0.75rem' }}>
                              Отправьте эту ссылку гостю для полной оплаты бронирования:
                            </p>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              <input
                                type="text"
                                value={fullPaymentLinks[booking.id]}
                                readOnly
                                className="form-input"
                                style={{ flex: 1, fontSize: '0.875rem' }}
                              />
                              <button
                                className="btn btn-secondary"
                                style={{ fontSize: '0.875rem', padding: '0.5rem 1rem', whiteSpace: 'nowrap' }}
                                onClick={() => handleCopyPaymentLink(fullPaymentLinks[booking.id])}
                              >
                                Скопировать
                              </button>
                            </div>
                          </div>
                        )}
                        
                        {/* Действия для бронирования */}
                        <div className="booking-actions" style={{ 
                          marginTop: '1rem', 
                          paddingTop: '1rem', 
                          borderTop: '1px solid var(--cloud)',
                          display: 'flex',
                          gap: '0.5rem',
                          flexWrap: 'wrap'
                        }}>
                          {/* Создание ссылки на полную оплату - для гостиницы */}
                          {userRole === 'hotel' && 
                           (booking.status === 'reserved' || booking.status === 'pending') &&
                           !fullPaymentLinks[booking.id] && (
                            <button
                              className="btn btn-primary"
                              style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                              onClick={() => handleCreateFullPaymentLink(booking.id)}
                              disabled={creatingPaymentLink === booking.id}
                            >
                              {creatingPaymentLink === booking.id ? 'Создание...' : 'Создать ссылку для полной оплаты'}
                            </button>
                          )}
                          
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
                          
                          {/* Подтверждение посадки - для капитана */}
                          {userRole === 'boat_owner' && booking.status === 'confirmed' && (
                            <button
                              className="btn btn-success"
                              style={{ 
                                fontSize: '0.875rem', 
                                padding: '0.5rem 1rem',
                                background: '#4CAF50',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                fontWeight: 'var(--font-weight-medium)',
                                cursor: 'pointer'
                              }}
                              onClick={() => {
                                if (window.confirm('Вы уверены, что хотите подтвердить посадку?')) {
                                  handleCheckIn(booking.id)
                                }
                              }}
                            >
                              ✓ Подтвердить посадку
                            </button>
                          )}
                          
                          {/* Связаться с менеджером - для всех ролей, кроме завершенных и отмененных */}
                          {booking.status !== 'cancelled' && booking.status !== 'completed' && (
                            <button
                              className="btn btn-secondary"
                              style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                              onClick={handleContactManager}
                            >
                              Связаться с менеджером
                            </button>
                          )}
                          
                          {/* Кнопка поделиться */}
                          <button
                            className="btn btn-secondary"
                            style={{ 
                              fontSize: '0.875rem', 
                              padding: '0.5rem 1rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              marginLeft: 'auto'
                            }}
                            onClick={(e) => handleShare(booking, e)}
                            title="Скопировать информацию о бронировании"
                          >
                            📋 Поделиться
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Bookings
