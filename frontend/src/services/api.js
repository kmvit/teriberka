import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Добавляем токен в заголовки при наличии (кроме публичных эндпоинтов)
api.interceptors.request.use(
  (config) => {
    // Публичные эндпоинты, для которых не нужна аутентификация
    const publicEndpoints = [
      '/accounts/register/', 
      '/accounts/login/', 
      '/accounts/verify-email/',
      '/accounts/password-reset/',
      '/accounts/password-reset-confirm/'
    ]
    const isPublicEndpoint = publicEndpoints.some(endpoint => 
      config.url?.includes(endpoint)
    )
    
    // Добавляем токен только если это не публичный эндпоинт
    if (!isPublicEndpoint) {
      const token = localStorage.getItem('token')
      if (token) {
        config.headers.Authorization = `Token ${token}`
      }
    }
    
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

export const authAPI = {
  register: async (userData) => {
    const response = await api.post('/accounts/register/', userData)
    return response.data
  },
  
  login: async (credentials) => {
    const response = await api.post('/accounts/login/', credentials)
    return response.data
  },
  
  getProfile: async () => {
    const response = await api.get('/accounts/profile/')
    return response.data
  },
  
  requestPasswordReset: async (email) => {
    const response = await api.post('/accounts/password-reset/', { email })
    return response.data
  },
  
  confirmPasswordReset: async (token, email, password, passwordConfirm) => {
    const response = await api.post('/accounts/password-reset-confirm/', {
      token,
      email,
      password,
      password_confirm: passwordConfirm
    })
    return response.data
  },
  
  verifyEmail: async (token, email) => {
    const response = await api.post('/accounts/verify-email/', {
      token,
      email
    })
    return response.data
  },
  
  // Методы для личного кабинета капитана
  getCalendar: async (month, boatId) => {
    const params = {}
    if (month) params.month = month
    if (boatId) params.boat_id = boatId
    const response = await api.get('/accounts/profile/calendar/', { params })
    return response.data
  },
  
  getFinances: async (periodStart, periodEnd) => {
    const params = {}
    if (periodStart) params.period_start = periodStart
    if (periodEnd) params.period_end = periodEnd
    const response = await api.get('/accounts/profile/finances/', { params })
    return response.data
  },
  
  getTransactions: async () => {
    const response = await api.get('/accounts/profile/transactions/')
    return response.data
  },
  
  getReviews: async () => {
    const response = await api.get('/accounts/profile/reviews/')
    return response.data
  },
}

export const bookingsAPI = {
  getBookings: async (params = {}) => {
    const response = await api.get('/v1/bookings/', { params })
    return response.data
  },
  
  getBookingDetail: async (id) => {
    const response = await api.get(`/v1/bookings/${id}/`)
    return response.data
  },
}

export const tripsAPI = {
  searchTrips: async (params) => {
    const response = await api.get('/v1/trips/', { params })
    return response.data
  },
  
  getTripDetail: async (tripId) => {
    const response = await api.get(`/v1/trips/${tripId}/`)
    return response.data
  },
}

export const boatsAPI = {
  getFeatures: async () => {
    const response = await api.get('/v1/boats/features/')
    return response.data
  },
  
  getMyBoats: async () => {
    const response = await api.get('/v1/boats/my-boats/')
    return response.data
  },
  
  getBoatDetail: async (id) => {
    const response = await api.get(`/v1/boats/${id}/`)
    return response.data
  },
  
  createBoat: async (boatData) => {
    const formData = new FormData()
    
    // Добавляем основные поля
    formData.append('name', boatData.name)
    formData.append('boat_type', boatData.boat_type)
    formData.append('capacity', boatData.capacity)
    formData.append('description', boatData.description || '')
    formData.append('is_active', boatData.is_active !== false)
    
    // Добавляем изображения
    if (boatData.images && boatData.images.length > 0) {
      boatData.images.forEach((image) => {
        formData.append('images', image)
      })
    }
    
    // Добавляем особенности
    if (boatData.features && boatData.features.length > 0) {
      boatData.features.forEach((featureId) => {
        formData.append('features', featureId)
      })
    }
    
    // Добавляем цены как JSON строку (проще и надежнее)
    if (boatData.pricing !== undefined && Array.isArray(boatData.pricing)) {
      formData.append('pricing', JSON.stringify(boatData.pricing))
    }
    
    // Добавляем маршруты
    if (boatData.route_ids && boatData.route_ids.length > 0) {
      boatData.route_ids.forEach((routeId) => {
        formData.append('route_ids', routeId)
      })
    }
    
    const response = await api.post('/v1/boats/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  },
  
  updateBoat: async (id, boatData) => {
    const formData = new FormData()
    
    // Добавляем основные поля только если они определены
    if (boatData.name !== undefined) formData.append('name', boatData.name)
    if (boatData.boat_type !== undefined) formData.append('boat_type', boatData.boat_type)
    if (boatData.capacity !== undefined) formData.append('capacity', String(boatData.capacity))
    if (boatData.description !== undefined) formData.append('description', boatData.description || '')
    if (boatData.is_active !== undefined) formData.append('is_active', boatData.is_active ? 'true' : 'false')
    
    // Добавляем изображения (если новые)
    if (boatData.images && boatData.images.length > 0) {
      boatData.images.forEach((image) => {
        formData.append('images', image)
      })
    }
    
    // Добавляем особенности (всегда передаем массив через FormData)
    if (boatData.features !== undefined && Array.isArray(boatData.features)) {
      // Если массив не пустой, добавляем каждый элемент
      if (boatData.features.length > 0) {
        boatData.features.forEach((featureId) => {
          formData.append('features', String(featureId))
        })
      }
      // Для пустого массива не добавляем поле вообще - это сохранит существующие особенности
      // Если нужно удалить все особенности, нужно будет добавить специальную логику
    }
    
    // Добавляем цены как JSON строку (проще и надежнее)
    if (boatData.pricing !== undefined && Array.isArray(boatData.pricing)) {
      formData.append('pricing', JSON.stringify(boatData.pricing))
    }
    
    // Добавляем маршруты
    if (boatData.route_ids !== undefined) {
      if (Array.isArray(boatData.route_ids)) {
        boatData.route_ids.forEach((routeId) => {
          formData.append('route_ids', String(routeId))
        })
      }
    }
    
    const response = await api.patch(`/v1/boats/${id}/`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  },
  
  deleteBoat: async (id) => {
    const response = await api.delete(`/v1/boats/${id}/`)
    return response.data
  },
  
  deleteBoatImage: async (boatId, imageId) => {
    const response = await api.delete(`/v1/boats/${boatId}/images/${imageId}/`)
    return response.data
  },
  
  // Блокировка дат
  getBlockedDates: async (boatId) => {
    const response = await api.get(`/v1/boats/${boatId}/blocked-dates/`)
    return response.data
  },
  
  createBlockedDate: async (boatId, blockedDateData) => {
    const response = await api.post(`/v1/boats/${boatId}/blocked-dates/`, blockedDateData)
    return response.data
  },
  
  deleteBlockedDate: async (boatId, blockedDateId) => {
    const response = await api.delete(`/v1/boats/${boatId}/blocked-dates/${blockedDateId}/`)
    return response.data
  },
  
  // Сезонные цены
  getSeasonalPricing: async (boatId) => {
    const response = await api.get(`/v1/boats/${boatId}/seasonal-pricing/`)
    return response.data
  },
  
  createSeasonalPricing: async (boatId, pricingData) => {
    const response = await api.post(`/v1/boats/${boatId}/seasonal-pricing/`, pricingData)
    return response.data
  },
  
  updateSeasonalPricing: async (boatId, pricingId, pricingData) => {
    const response = await api.patch(`/v1/boats/${boatId}/seasonal-pricing/${pricingId}/`, pricingData)
    return response.data
  },
  
  deleteSeasonalPricing: async (boatId, pricingId) => {
    const response = await api.delete(`/v1/boats/${boatId}/seasonal-pricing/${pricingId}/`)
    return response.data
  },
  
  // Статистика
  getBoatStatistics: async (boatId, month) => {
    const params = month ? { month } : {}
    const response = await api.get(`/v1/boats/${boatId}/statistics/`, { params })
    return response.data
  },
  
  // Расписание доступности
  getBoatAvailability: async (boatId, dateFrom, dateTo) => {
    const params = {}
    if (dateFrom) params.date_from = dateFrom
    if (dateTo) params.date_to = dateTo
    const response = await api.get(`/v1/boats/${boatId}/availability/`, { params })
    return response.data
  },
  
  createBoatAvailability: async (boatId, availabilityData) => {
    const response = await api.post(`/v1/boats/${boatId}/availability/`, availabilityData)
    return response.data
  },
  
  updateBoatAvailability: async (boatId, availabilityId, availabilityData) => {
    const response = await api.patch(`/v1/boats/${boatId}/availability/${availabilityId}/`, availabilityData)
    return response.data
  },
  
  deleteBoatAvailability: async (boatId, availabilityId) => {
    const response = await api.delete(`/v1/boats/${boatId}/availability/${availabilityId}/`)
    return response.data
  },
  
  // Маршруты (зоны плавания)
  getSailingZones: async () => {
    const response = await api.get('/v1/boats/sailing-zones/')
    return response.data
  },
  
  createSailingZone: async (zoneData) => {
    const response = await api.post('/v1/boats/sailing-zones/', zoneData)
    return response.data
  },
  
  updateSailingZone: async (zoneId, zoneData) => {
    const response = await api.patch(`/v1/boats/sailing-zones/${zoneId}/`, zoneData)
    return response.data
  },
  
  deleteSailingZone: async (zoneId) => {
    const response = await api.delete(`/v1/boats/sailing-zones/${zoneId}/`)
    return response.data
  },
}

export default api

