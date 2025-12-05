import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { boatsAPI } from '../../services/api'
import '../../styles/Profile.css'
import '../../styles/components.css'

const MyBoats = () => {
  const navigate = useNavigate()
  const [boats, setBoats] = useState([])
  const [features, setFeatures] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editingBoat, setEditingBoat] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    boat_type: 'boat',
    capacity: 1,
    description: '',
    is_active: true,
    images: [],
    features: [],
    pricing: [{ duration_hours: 2, price_per_person: '' }, { duration_hours: 3, price_per_person: '' }]
  })
  const [formError, setFormError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  
  // Расписание
  const [showScheduleForm, setShowScheduleForm] = useState(false)
  const [selectedBoatForSchedule, setSelectedBoatForSchedule] = useState(null)
  const [scheduleForm, setScheduleForm] = useState({
    departure_date: '',
    departure_time: '12:00',
    return_time: '14:00',
    is_active: true
  })
  const [boatSchedules, setBoatSchedules] = useState({}) // { boatId: [schedules] }
  
  // Маршруты
  const [showRoutesForm, setShowRoutesForm] = useState(false)
  const [selectedBoatForRoutes, setSelectedBoatForRoutes] = useState(null)
  const [sailingZones, setSailingZones] = useState([])
  const [selectedRouteIds, setSelectedRouteIds] = useState([])

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      navigate('/login')
      return
    }

    loadBoats()
    loadFeatures()
  }, [navigate])

  const loadBoats = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await boatsAPI.getMyBoats()
      setBoats(Array.isArray(data) ? data : [])
    } catch (err) {
      if (err.response?.status === 401) {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        navigate('/login')
      } else {
        setError('Ошибка загрузки судов')
      }
    } finally {
      setLoading(false)
    }
  }

  const loadFeatures = async () => {
    try {
      const data = await boatsAPI.getFeatures()
      const featuresArray = Array.isArray(data) ? data : (data?.results || [])
      setFeatures(featuresArray)
      console.log('Загружены особенности:', featuresArray)
    } catch (err) {
      console.error('Ошибка загрузки особенностей:', err)
      setFeatures([])
    }
  }

  const loadBoatSchedule = async (boatId) => {
    try {
      const schedules = await boatsAPI.getBoatAvailability(boatId)
      setBoatSchedules(prev => ({
        ...prev,
        [boatId]: Array.isArray(schedules) ? schedules : []
      }))
    } catch (err) {
      console.error('Ошибка загрузки расписания:', err)
      setBoatSchedules(prev => ({
        ...prev,
        [boatId]: []
      }))
    }
  }

  const loadSailingZones = async () => {
    try {
      const data = await boatsAPI.getSailingZones()
      setSailingZones(Array.isArray(data) ? data : (data?.results || []))
    } catch (err) {
      console.error('Ошибка загрузки маршрутов:', err)
      setSailingZones([])
    }
  }

  const handleOpenScheduleForm = async (boat) => {
    setSelectedBoatForSchedule(boat)
    setScheduleForm({
      departure_date: '',
      departure_time: '12:00',
      return_time: '14:00',
      is_active: true
    })
    await loadBoatSchedule(boat.id)
    setShowScheduleForm(true)
  }

  const handleCreateSchedule = async (e) => {
    e.preventDefault()
    if (!scheduleForm.departure_date || !scheduleForm.departure_time || !scheduleForm.return_time) {
      alert('Заполните все обязательные поля')
      return
    }

    try {
      await boatsAPI.createBoatAvailability(selectedBoatForSchedule.id, scheduleForm)
      setScheduleForm({
        departure_date: '',
        departure_time: '12:00',
        return_time: '14:00',
        is_active: true
      })
      await loadBoatSchedule(selectedBoatForSchedule.id)
    } catch (err) {
      alert('Ошибка создания расписания: ' + (err.response?.data?.error || err.message))
    }
  }

  const handleDeleteSchedule = async (scheduleId) => {
    if (!window.confirm('Вы уверены, что хотите удалить это расписание?')) {
      return
    }

    try {
      await boatsAPI.deleteBoatAvailability(selectedBoatForSchedule.id, scheduleId)
      await loadBoatSchedule(selectedBoatForSchedule.id)
    } catch (err) {
      alert('Ошибка удаления расписания: ' + (err.response?.data?.error || err.message))
    }
  }

  const handleOpenRoutesForm = async (boat) => {
    setSelectedBoatForRoutes(boat)
    await loadSailingZones()
    // Загружаем текущие маршруты судна
    const boatDetail = await boatsAPI.getBoatDetail(boat.id)
    const currentRouteIds = boatDetail.sailing_zones?.map(zone => 
      typeof zone === 'object' ? zone.id : zone
    ) || []
    setSelectedRouteIds(currentRouteIds)
    setShowRoutesForm(true)
  }

  const handleSaveRoutes = async () => {
    try {
      await boatsAPI.updateBoat(selectedBoatForRoutes.id, {
        route_ids: selectedRouteIds
      })
      setShowRoutesForm(false)
      setSelectedBoatForRoutes(null)
      loadBoats() // Перезагружаем список судов
    } catch (err) {
      alert('Ошибка сохранения маршрутов: ' + (err.response?.data?.error || err.message))
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Вы уверены, что хотите удалить это судно?')) {
      return
    }

    try {
      await boatsAPI.deleteBoat(id)
      setBoats(boats.filter(boat => boat.id !== id))
    } catch (err) {
      alert('Ошибка удаления судна: ' + (err.response?.data?.error || err.message))
    }
  }

  const handleDeleteImage = async (imageId) => {
    if (!editingBoat) return
    
    if (!window.confirm('Вы уверены, что хотите удалить это фото?')) {
      return
    }

    try {
      await boatsAPI.deleteBoatImage(editingBoat.id, imageId)
      // Обновляем список фотографий в editingBoat
      setEditingBoat({
        ...editingBoat,
        images: editingBoat.images.filter(img => img.id !== imageId)
      })
    } catch (err) {
      alert('Ошибка удаления фото: ' + (err.response?.data?.error || err.message))
    }
  }

  const handleEdit = async (boat) => {
    try {
      // Загружаем детальную информацию о судне, чтобы получить полные данные включая pricing
      const boatDetail = await boatsAPI.getBoatDetail(boat.id)
      
      setEditingBoat(boatDetail)
      
      // Обрабатываем особенности - могут быть строками или объектами
      let featuresIds = []
      if (boatDetail.features && Array.isArray(boatDetail.features)) {
        featuresIds = boatDetail.features.map(f => {
          if (typeof f === 'object' && f.id) {
            return f.id
          }
          // Если это строка (название), ищем ID в списке доступных особенностей
          const feature = features.find(feature => feature.name === f || feature.id === f)
          return feature ? feature.id : null
        }).filter(id => id !== null)
      }
      
      // Формируем pricing: создаем массив с 2 и 3 часами, заполняя существующие данные
      const pricing = [
        { duration_hours: 2, price_per_person: '' },
        { duration_hours: 3, price_per_person: '' }
      ]
      
      if (boatDetail.pricing && Array.isArray(boatDetail.pricing)) {
        boatDetail.pricing.forEach(p => {
          const index = pricing.findIndex(pr => pr.duration_hours === p.duration_hours)
          if (index !== -1) {
            // Преобразуем цену в число, если она пришла как строка или Decimal
            const price = typeof p.price_per_person === 'string' 
              ? parseFloat(p.price_per_person) 
              : (typeof p.price_per_person === 'number' ? p.price_per_person : '')
            pricing[index].price_per_person = price || ''
          }
        })
      }
      
      setFormData({
        name: boatDetail.name || '',
        boat_type: boatDetail.boat_type || 'boat',
        capacity: boatDetail.capacity || 1,
        description: boatDetail.description || '',
        is_active: boatDetail.is_active !== false,
        images: [],
        features: featuresIds,
        pricing: pricing
      })
      setShowForm(true)
    } catch (err) {
      alert('Ошибка загрузки данных судна: ' + (err.response?.data?.error || err.message))
    }
  }

  const handleAddNew = () => {
    setEditingBoat(null)
    setFormData({
      name: '',
      boat_type: 'boat',
      capacity: 1,
      description: '',
      is_active: true,
      images: [],
      features: [],
      pricing: [{ duration_hours: 2, price_per_person: '' }, { duration_hours: 3, price_per_person: '' }]
    })
    setFormError(null)
    setShowForm(true)
  }

  const handleInputChange = (e) => {
    const { name, value, type, checked, files } = e.target
    
    if (type === 'file') {
      setFormData(prev => ({
        ...prev,
        images: Array.from(files)
      }))
    } else if (type === 'checkbox') {
      setFormData(prev => ({
        ...prev,
        [name]: checked
      }))
    } else if (name === 'capacity') {
      setFormData(prev => ({
        ...prev,
        [name]: parseInt(value) || 1
      }))
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }))
    }
  }

  const handleFeatureToggle = (featureId) => {
    setFormData(prev => ({
      ...prev,
      features: prev.features.includes(featureId)
        ? prev.features.filter(id => id !== featureId)
        : [...prev.features, featureId]
    }))
  }

  const handlePricingChange = (index, field, value) => {
    setFormData(prev => {
      const newPricing = [...prev.pricing]
      newPricing[index] = {
        ...newPricing[index],
        [field]: field === 'price_per_person' 
          ? (value === '' ? '' : (isNaN(parseFloat(value)) ? '' : parseFloat(value)))
          : value
      }
      return { ...prev, pricing: newPricing }
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError(null)
    setSubmitting(true)

    try {
      // Валидация
      if (!formData.name.trim()) {
        throw new Error('Название судна обязательно')
      }
      if (formData.capacity < 1 || formData.capacity > 11) {
        throw new Error('Вместимость должна быть от 1 до 11 человек')
      }

      // Фильтруем цены, удаляя пустые и преобразуя в правильный формат
      const validPricing = formData.pricing
        .filter(p => p.price_per_person && p.price_per_person > 0)
        .map(p => ({
          duration_hours: parseInt(p.duration_hours),
          price_per_person: parseFloat(p.price_per_person)
        }))

      const boatData = {
        ...formData,
        pricing: validPricing
      }

      if (editingBoat) {
        await boatsAPI.updateBoat(editingBoat.id, boatData)
      } else {
        await boatsAPI.createBoat(boatData)
      }

      setShowForm(false)
      setEditingBoat(null)
      loadBoats()
    } catch (err) {
      // Обработка ошибок валидации
      let errorMessage = 'Ошибка сохранения судна'
      if (err.response?.data) {
        if (typeof err.response.data === 'string') {
          errorMessage = err.response.data
        } else if (err.response.data.error) {
          errorMessage = err.response.data.error
        } else if (err.response.data.detail) {
          errorMessage = err.response.data.detail
        } else if (typeof err.response.data === 'object') {
          // Форматируем ошибки валидации
          const validationErrors = Object.entries(err.response.data)
            .map(([field, errors]) => {
              const fieldName = field === 'name' ? 'Название' :
                               field === 'capacity' ? 'Вместимость' :
                               field === 'boat_type' ? 'Тип судна' :
                               field === 'pricing' ? 'Цены' :
                               field === 'features' ? 'Особенности' : field
              let errorList = ''
              if (Array.isArray(errors)) {
                errorList = errors.join(', ')
              } else if (typeof errors === 'object') {
                errorList = JSON.stringify(errors)
              } else {
                errorList = String(errors)
              }
              return `${fieldName}: ${errorList}`
            })
            .join('\n')
          errorMessage = validationErrors || errorMessage
        }
      } else if (err.message) {
        errorMessage = err.message
      }
      setFormError(errorMessage)
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditingBoat(null)
    setFormError(null)
    setFormData({
      name: '',
      boat_type: 'boat',
      capacity: 1,
      description: '',
      is_active: true,
      images: [],
      features: [],
      pricing: [{ duration_hours: 2, price_per_person: '' }, { duration_hours: 3, price_per_person: '' }]
    })
  }

  if (loading) {
    return (
      <div className="profile-page">
        <div className="profile-container">
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Загрузка судов...</p>
          </div>
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
            <h1 className="section-title">Мои суда</h1>
            <div style={{ display: 'flex', gap: '1rem' }}>
              {!showForm && (
                <>
                  <button className="btn btn-primary" onClick={handleAddNew}>
                    + Добавить судно
                  </button>
                  <Link to="/profile" className="btn btn-secondary">
                    ← Назад к профилю
                  </Link>
                </>
              )}
              {showForm && (
                <button className="btn btn-secondary" onClick={handleCancel}>
                  ← Назад к судам
                </button>
              )}
            </div>
          </div>

          {error && (
            <div className="alert alert-error" style={{ marginBottom: '1.5rem' }}>
              {error}
            </div>
          )}

          {/* Форма добавления/редактирования */}
          {showForm && (
            <div className="boat-form-section" style={{ 
              background: 'var(--white)', 
              borderRadius: 'var(--radius-lg)', 
              padding: '2rem', 
              marginBottom: '2rem',
              border: '1px solid var(--cloud)'
            }}>
              <h2 className="section-subtitle" style={{ marginBottom: '1.5rem' }}>
                {editingBoat ? 'Редактирование судна' : 'Добавление нового судна'}
              </h2>

              {formError && (
                <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
                  {formError}
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div className="form-grid" style={{ display: 'grid', gap: '1.5rem' }}>
                  {/* Название */}
                  <div className="form-group">
                    <label className="form-label">Название судна *</label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="form-input"
                      required
                      placeholder="Например: Тереберка-1"
                    />
                  </div>

                  {/* Тип судна */}
                  <div className="form-group">
                    <label className="form-label">Тип судна *</label>
                    <select
                      name="boat_type"
                      value={formData.boat_type}
                      onChange={handleInputChange}
                      className="form-input"
                      required
                    >
                      <option value="boat">Катер</option>
                      <option value="yacht">Яхта</option>
                      <option value="barkas">Баркас</option>
                    </select>
                  </div>

                  {/* Вместимость */}
                  <div className="form-group">
                    <label className="form-label">Вместимость (чел.) *</label>
                    <input
                      type="number"
                      name="capacity"
                      value={formData.capacity}
                      onChange={handleInputChange}
                      className="form-input"
                      min="1"
                      max="11"
                      required
                    />
                    <small style={{ color: 'var(--stone)', fontSize: '0.875rem', marginTop: '0.25rem', display: 'block' }}>
                      Максимум 11 человек (12 включая капитана)
                    </small>
                  </div>

                  {/* Описание */}
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Описание и особенности</label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      className="form-input"
                      rows="4"
                      placeholder="Опишите судно, его особенности..."
                    />
                  </div>

                  {/* Фото */}
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Фотографии</label>
                    <input
                      type="file"
                      name="images"
                      onChange={handleInputChange}
                      className="form-input"
                      accept="image/*"
                      multiple
                    />
                    {editingBoat && editingBoat.images && editingBoat.images.length > 0 && (
                      <div style={{ marginTop: '1rem' }}>
                        <p style={{ fontSize: '0.875rem', color: 'var(--stone)', marginBottom: '0.5rem' }}>
                          Текущие фотографии (новые фото будут добавлены к существующим):
                        </p>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          {editingBoat.images.map(img => (
                            <div key={img.id} style={{ position: 'relative', display: 'inline-block' }}>
                              <img 
                                src={img.image_url || img.image} 
                                alt=""
                                style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: 'var(--radius-md)' }}
                              />
                              <button
                                type="button"
                                onClick={() => handleDeleteImage(img.id)}
                                style={{
                                  position: 'absolute',
                                  top: '4px',
                                  right: '4px',
                                  background: 'rgba(220, 53, 69, 0.9)',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '50%',
                                  width: '24px',
                                  height: '24px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '14px',
                                  fontWeight: 'bold',
                                  lineHeight: '1',
                                  padding: 0
                                }}
                                title="Удалить фото"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Особенности */}
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Особенности</label>
                    {features.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '0.5rem' }}>
                        {features.map(feature => (
                          <label key={feature.id} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={formData.features.includes(feature.id)}
                              onChange={() => handleFeatureToggle(feature.id)}
                              style={{ marginRight: '0.5rem' }}
                            />
                            <span style={{ color: '#1a1a1a' }}>{feature.name}</span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <p style={{ color: 'var(--stone)', fontSize: '0.875rem', marginTop: '0.5rem' }}>
                        Особенности отсутствуют. Добавьте их в админ-панели.
                      </p>
                    )}
                  </div>

                  {/* Цены */}
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Стоимость за человека</label>
                    <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
                      {formData.pricing.map((price, index) => (
                        <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <label style={{ fontSize: '0.875rem', color: '#1a1a1a', fontWeight: 'var(--font-weight-medium)' }}>
                            {price.duration_hours === 2 ? '2 часа' : '3 часа'}
                          </label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <input
                              type="number"
                              value={price.price_per_person !== undefined && price.price_per_person !== null && price.price_per_person !== '' ? price.price_per_person : ''}
                              onChange={(e) => handlePricingChange(index, 'price_per_person', e.target.value)}
                              className="form-input"
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                            />
                            <span style={{ color: 'var(--stone)' }}>₽</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Активность */}
                  <div className="form-group">
                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        name="is_active"
                        checked={formData.is_active}
                        onChange={handleInputChange}
                        style={{ marginRight: '0.5rem' }}
                      />
                      <span>Судно активно</span>
                    </label>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                  <button type="submit" className="btn btn-primary" disabled={submitting}>
                    {submitting ? 'Сохранение...' : editingBoat ? 'Сохранить изменения' : 'Добавить судно'}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={handleCancel} disabled={submitting}>
                    Отмена
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Список судов */}
          {!showForm && (
            <>
              {boats.length === 0 ? (
                <div className="empty-state">
                  <p>У вас пока нет судов</p>
                  <button className="btn btn-primary" onClick={handleAddNew} style={{ marginTop: '1rem' }}>
                    Добавить первое судно
                  </button>
                </div>
              ) : (
                <div className="boats-list" style={{ display: 'grid', gap: '1.5rem' }}>
                  {boats.map((boat) => (
                    <div key={boat.id} className="boat-card" style={{
                      background: 'var(--white)',
                      borderRadius: 'var(--radius-lg)',
                      padding: '1.5rem',
                      boxShadow: 'var(--shadow-md)',
                      border: '1px solid var(--cloud)',
                      transition: 'var(--transition-base)'
                    }}>
                      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                        {/* Изображение */}
                        {boat.first_image && (
                          <img
                            src={boat.first_image}
                            alt={boat.name}
                            style={{
                              width: '200px',
                              height: '150px',
                              objectFit: 'cover',
                              borderRadius: 'var(--radius-md)',
                              flexShrink: 0
                            }}
                          />
                        )}

                        {/* Информация */}
                        <div style={{ flex: 1, minWidth: '300px' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                            <div>
                              <h3 style={{ fontSize: '1.5rem', fontWeight: 'var(--font-weight-bold)', color: '#1a1a1a', margin: '0 0 0.5rem 0' }}>
                                {boat.name}
                              </h3>
                              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.875rem', color: 'var(--stone)' }}>
                                <span>{boat.boat_type_display}</span>
                                <span>•</span>
                                <span>Вместимость: {boat.capacity} чел.</span>
                                {!boat.is_active && (
                                  <>
                                    <span>•</span>
                                    <span style={{ color: '#dc3545' }}>Неактивно</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {boat.description && (
                            <p style={{ color: 'var(--stone)', marginBottom: '1rem', lineHeight: '1.6' }}>
                              {boat.description}
                            </p>
                          )}

                          {boat.features && boat.features.length > 0 && (
                            <div style={{ marginBottom: '1rem' }}>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                {boat.features.map((feature, idx) => (
                                  <span
                                    key={idx}
                                    style={{
                                      background: 'var(--ocean-light)',
                                      color: 'var(--white)',
                                      padding: '0.25rem 0.75rem',
                                      borderRadius: 'var(--radius-sm)',
                                      fontSize: '0.875rem'
                                    }}
                                  >
                                    {feature}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {boat.min_price && (
                            <div style={{ marginBottom: '1rem' }}>
                              <strong style={{ color: 'var(--ocean-deep)' }}>
                                От {Math.round(boat.min_price).toLocaleString('ru-RU')} ₽/чел.
                              </strong>
                            </div>
                          )}

                          {/* Действия */}
                          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                            <button
                              className="btn btn-primary"
                              onClick={() => handleOpenScheduleForm(boat)}
                              style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                            >
                              📅 Расписание
                            </button>
                            <button
                              className="btn btn-primary"
                              onClick={() => handleOpenRoutesForm(boat)}
                              style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                            >
                              🗺️ Маршруты
                            </button>
                            <button
                              className="btn btn-secondary"
                              onClick={() => handleEdit(boat)}
                              style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                            >
                              Редактировать
                            </button>
                            <button
                              className="btn btn-secondary"
                              onClick={() => handleDelete(boat.id)}
                              style={{ 
                                fontSize: '0.875rem', 
                                padding: '0.5rem 1rem',
                                background: '#fff',
                                color: '#dc3545',
                                borderColor: '#dc3545'
                              }}
                            >
                              Удалить
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Модальное окно расписания */}
        {showScheduleForm && selectedBoatForSchedule && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem'
          }}>
            <div style={{
              background: 'var(--white)',
              borderRadius: 'var(--radius-lg)',
              padding: '2rem',
              maxWidth: '600px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: 'var(--shadow-lg)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 className="section-subtitle" style={{ margin: 0 }}>
                  Расписание: {selectedBoatForSchedule.name}
                </h2>
                <button
                  onClick={() => {
                    setShowScheduleForm(false)
                    setSelectedBoatForSchedule(null)
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    fontSize: '1.5rem',
                    cursor: 'pointer',
                    color: 'var(--stone)',
                    padding: '0.25rem 0.5rem'
                  }}
                >
                  ×
                </button>
              </div>

              {/* Форма добавления расписания */}
              <form onSubmit={handleCreateSchedule} style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
                  <div>
                    <label className="form-label">Дата выхода *</label>
                    <input
                      type="date"
                      value={scheduleForm.departure_date}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, departure_date: e.target.value })}
                      className="form-input"
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label">Время выхода *</label>
                    <input
                      type="time"
                      value={scheduleForm.departure_time}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, departure_time: e.target.value })}
                      className="form-input"
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label">Время возвращения *</label>
                    <input
                      type="time"
                      value={scheduleForm.return_time}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, return_time: e.target.value })}
                      className="form-input"
                      required
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                  <button type="submit" className="btn btn-primary">Добавить расписание</button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowScheduleForm(false)
                      setSelectedBoatForSchedule(null)
                    }}
                    className="btn btn-secondary"
                  >
                    Закрыть
                  </button>
                </div>
              </form>

              {/* Список расписаний */}
              {boatSchedules[selectedBoatForSchedule.id] && boatSchedules[selectedBoatForSchedule.id].length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 'var(--font-weight-semibold)', marginBottom: '0.5rem', color: '#1a1a1a' }}>
                    Текущее расписание:
                  </h3>
                  {boatSchedules[selectedBoatForSchedule.id].map((schedule) => (
                    <div key={schedule.id} style={{
                      padding: '1rem',
                      background: 'var(--white)',
                      border: '1px solid var(--cloud)',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '1rem'
                    }}>
                      <div>
                        <div style={{ fontWeight: 'var(--font-weight-semibold)', marginBottom: '0.25rem', color: '#1a1a1a' }}>
                          {new Date(schedule.departure_date).toLocaleDateString('ru-RU', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                          })}
                        </div>
                        <div style={{ fontSize: '0.875rem', color: 'var(--stone)' }}>
                          {schedule.departure_time} - {schedule.return_time}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteSchedule(schedule.id)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#dc3545',
                          cursor: 'pointer',
                          fontSize: '1.25rem',
                          padding: '0.25rem',
                          lineHeight: '1'
                        }}
                        title="Удалить расписание"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: 'var(--stone)', fontSize: '0.875rem', textAlign: 'center' }}>
                  Расписание пока не добавлено
                </p>
              )}
            </div>
          </div>
        )}

        {/* Модальное окно маршрутов */}
        {showRoutesForm && selectedBoatForRoutes && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem'
          }}>
            <div style={{
              background: 'var(--white)',
              borderRadius: 'var(--radius-lg)',
              padding: '2rem',
              maxWidth: '600px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: 'var(--shadow-lg)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 className="section-subtitle" style={{ margin: 0 }}>
                  Маршруты: {selectedBoatForRoutes.name}
                </h2>
                <button
                  onClick={() => {
                    setShowRoutesForm(false)
                    setSelectedBoatForRoutes(null)
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    fontSize: '1.5rem',
                    cursor: 'pointer',
                    color: 'var(--stone)',
                    padding: '0.25rem 0.5rem'
                  }}
                >
                  ×
                </button>
              </div>

              {sailingZones.length > 0 ? (
                <>
                  <div style={{ marginBottom: '1.5rem' }}>
                    <label className="form-label">Выберите маршруты для этого судна:</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
                      {sailingZones.map((zone) => (
                        <label key={zone.id} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={selectedRouteIds.includes(zone.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedRouteIds([...selectedRouteIds, zone.id])
                              } else {
                                setSelectedRouteIds(selectedRouteIds.filter(id => id !== zone.id))
                              }
                            }}
                            style={{ marginRight: '0.75rem', width: '18px', height: '18px' }}
                          />
                          <div>
                            <div style={{ fontWeight: 'var(--font-weight-semibold)', color: '#1a1a1a' }}>
                              {zone.name}
                            </div>
                            {zone.description && (
                              <div style={{ fontSize: '0.875rem', color: 'var(--stone)', marginTop: '0.25rem' }}>
                                {zone.description}
                              </div>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={handleSaveRoutes} className="btn btn-primary">
                      Сохранить маршруты
                    </button>
                    <button
                      onClick={() => {
                        setShowRoutesForm(false)
                        setSelectedBoatForRoutes(null)
                      }}
                      className="btn btn-secondary"
                    >
                      Отмена
                    </button>
                  </div>
                </>
              ) : (
                <div>
                  <p style={{ color: 'var(--stone)', marginBottom: '1rem' }}>
                    Маршруты пока не созданы. Обратитесь к администратору для добавления маршрутов.
                  </p>
                  <button
                    onClick={() => {
                      setShowRoutesForm(false)
                      setSelectedBoatForRoutes(null)
                    }}
                    className="btn btn-secondary"
                  >
                    Закрыть
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default MyBoats

