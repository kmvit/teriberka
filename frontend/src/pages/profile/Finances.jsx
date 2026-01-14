import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { authAPI } from '../../services/api'
import '../../styles/Profile.css'

const Finances = () => {
  const navigate = useNavigate()
  const [financesData, setFinancesData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [userRole, setUserRole] = useState(null)

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
      } catch (err) {
        console.error('Ошибка загрузки профиля:', err)
      }
    }

    loadUserInfo()
    loadFinances()
  }, [navigate])

  const loadFinances = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await authAPI.getFinances()
      setFinancesData(data)
    } catch (err) {
      if (err.response?.status === 401) {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        navigate('/login')
      } else {
        setError('Ошибка загрузки финансов')
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

  if (loading) {
    return (
      <div className="profile-page">
        <div className="profile-container">
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Загрузка финансов...</p>
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
            <h1 className="section-title">Финансы</h1>
            <Link to="/profile" className="btn btn-secondary">
              ← Назад к профилю
            </Link>
          </div>

          {financesData ? (
            <div className="finances-section">
              <div className="finances-summary">
                {userRole === 'boat_owner' ? (
                  <>
                    <div className="finance-card">
                      <div className="finance-icon">💵</div>
                      <div className="finance-content">
                        <div className="finance-label">Выручка</div>
                        <div className="finance-value">
                          {Math.round(financesData.revenue || 0).toLocaleString('ru-RU')} ₽
                        </div>
                      </div>
                    </div>
                    <div className="finance-card">
                      <div className="finance-icon">📉</div>
                      <div className="finance-content">
                        <div className="finance-label">Комиссия платформы</div>
                        <div className="finance-value finance-value-negative">
                          {Math.round(financesData.platform_commission || 0) > 0 ? '-' : ''}{Math.round(financesData.platform_commission || 0).toLocaleString('ru-RU')} ₽
                        </div>
                      </div>
                    </div>
                    <div className="finance-card finance-card-primary">
                      <div className="finance-icon">💰</div>
                      <div className="finance-content">
                        <div className="finance-label">К выплате</div>
                        <div className="finance-value finance-value-primary">
                          {Math.round(financesData.to_payout || 0).toLocaleString('ru-RU')} ₽
                        </div>
                      </div>
                    </div>
                  </>
                ) : userRole === 'guide' ? (
                  <>
                    <div className="finance-card finance-card-primary">
                      <div className="finance-icon">💵</div>
                      <div className="finance-content">
                        <div className="finance-label">Заработано комиссий</div>
                        <div className="finance-value finance-value-primary">
                          {Math.round(financesData.total_commission || 0).toLocaleString('ru-RU')} ₽
                        </div>
                      </div>
                    </div>
                    <div className="finance-card">
                      <div className="finance-icon">⏳</div>
                      <div className="finance-content">
                        <div className="finance-label">Ожидаемая комиссия</div>
                        <div className="finance-value">
                          {Math.round(financesData.pending_commission || 0).toLocaleString('ru-RU')} ₽
                        </div>
                      </div>
                    </div>
                    <div className="finance-card">
                      <div className="finance-icon">💰</div>
                      <div className="finance-content">
                        <div className="finance-label">К выплате</div>
                        <div className="finance-value">
                          {Math.round(financesData.to_payout || 0).toLocaleString('ru-RU')} ₽
                        </div>
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
              {financesData.payout_history && financesData.payout_history.length > 0 && (
                <div className="payout-history">
                  <h3 className="section-subtitle">История выплат</h3>
                  <div className="history-list">
                    {financesData.payout_history.map((item, index) => (
                      <div key={index} className="history-item">
                        <div className="history-date">{item.date}</div>
                        <div className="history-description">{item.description}</div>
                        <div className="history-amount">{item.amount}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="empty-state">
              <p>Финансовая информация недоступна</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Finances

