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
}

export default api

