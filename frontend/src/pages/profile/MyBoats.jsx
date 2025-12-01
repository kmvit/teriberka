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

      // Фильтруем цены, удаляя пустые
      const validPricing = formData.pricing.filter(p => p.price_per_person && p.price_per_person > 0)

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
              const errorList = Array.isArray(errors) ? errors.join(', ') : errors
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
                          Текущие фотографии (новые фото заменят существующие):
                        </p>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          {editingBoat.images.map(img => (
                            <img 
                              key={img.id} 
                              src={img.image_url || img.image} 
                              alt=""
                              style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: 'var(--radius-md)' }}
                            />
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
                            <span>{feature.name}</span>
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
                          <label style={{ fontSize: '0.875rem', color: 'var(--stone)' }}>
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
      </div>
    </div>
  )
}

export default MyBoats

