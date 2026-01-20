import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { authAPI, adminAPI } from '../../services/api'
import '../../styles/Profile.css'
import './AdminCaptains.css'

const AdminCaptains = () => {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [captains, setCaptains] = useState([])
  const [tableData, setTableData] = useState([])
  const [captainsSummary, setCaptainsSummary] = useState([])
  const [loading, setLoading] = useState(true)
  const [dataLoading, setDataLoading] = useState(false)
  const [error, setError] = useState(null)
  
  // Фильтры
  const [selectedCaptain, setSelectedCaptain] = useState('')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')

  // Проверка прав доступа
  useEffect(() => {
    const checkAccess = async () => {
      const token = localStorage.getItem('token')
      if (!token) {
        navigate('/login')
        return
      }

      try {
        const userData = await authAPI.getProfile()
        if (!userData.is_staff) {
          navigate('/profile')
          return
        }
        setUser(userData)
      } catch (err) {
        if (err.response?.status === 401) {
          localStorage.removeItem('token')
          navigate('/login')
        } else {
          setError('Ошибка загрузки профиля')
        }
      }
    }

    checkAccess()
  }, [navigate])

  // Загрузка списка капитанов
  useEffect(() => {
    if (!user?.is_staff) return

    const loadCaptains = async () => {
      try {
        const data = await adminAPI.getCaptains()
        setCaptains(data)
      } catch (err) {
        setError('Ошибка загрузки капитанов: ' + (err.response?.data?.detail || err.message))
      } finally {
        setLoading(false)
      }
    }

    loadCaptains()
  }, [user])

  // Загрузка финансовых данных
  const loadFinancesData = async () => {
    if (!user?.is_staff) return

    setDataLoading(true)
    try {
      const data = await adminAPI.getFinancesTable(
        selectedCaptain || null,
        periodStart || null,
        periodEnd || null
      )
      setTableData(data.table_data || [])
      setCaptainsSummary(data.captains_summary || [])
    } catch (err) {
      setError('Ошибка загрузки данных: ' + (err.response?.data?.detail || err.message))
    } finally {
      setDataLoading(false)
    }
  }

  // Загрузка данных при изменении фильтров
  useEffect(() => {
    if (user?.is_staff && !loading) {
      loadFinancesData()
    }
  }, [selectedCaptain, periodStart, periodEnd, user, loading])

  // Установка периода по умолчанию (текущая неделя)
  useEffect(() => {
    if (!periodStart && !periodEnd) {
      const now = new Date()
      const monday = new Date(now)
      monday.setDate(now.getDate() - now.getDay() + 1) // Понедельник текущей недели
      const sunday = new Date(monday)
      sunday.setDate(monday.getDate() + 6) // Воскресенье

      setPeriodStart(monday.toISOString().split('T')[0])
      setPeriodEnd(sunday.toISOString().split('T')[0])
    }
  }, [])

  const formatDate = (dateString) => {
    if (!dateString) return '—'
    const date = new Date(dateString)
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }

  const formatCurrency = (amount) => {
    return Math.round(amount || 0).toLocaleString('ru-RU') + ' ₽'
  }

  // Группировка данных по датам
  const groupedByDate = {}
  tableData.forEach(row => {
    if (!groupedByDate[row.date]) {
      groupedByDate[row.date] = {}
    }
    groupedByDate[row.date][row.captain_id] = row
  })

  // Получаем уникальные даты
  const dates = Object.keys(groupedByDate).sort()

  // Получаем уникальных капитанов из данных
  const captainsInData = captainsSummary.map(c => ({
    id: c.captain_id,
    name: c.captain_name,
    email: c.captain_email
  }))

  if (loading && !user) {
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

  if (error && !user) {
    return (
      <div className="profile-page">
        <div className="profile-container">
          <div className="alert alert-error">{error}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="profile-page">
      <div className="profile-container">
        <div className="profile-header">
          <h1 className="profile-name">Финансы капитанов</h1>
          <p className="profile-role">Административная панель</p>
        </div>

        {/* Фильтры */}
        <div className="admin-filters">
          <h3 className="admin-filters-title">Фильтры</h3>
          <div className="admin-filters-grid">
            <div className="admin-filter-item">
              <label>Капитан</label>
              <select
                value={selectedCaptain}
                onChange={(e) => setSelectedCaptain(e.target.value)}
                className="form-input"
              >
                <option value="">Все капитаны</option>
                {captains.map(captain => (
                  <option key={captain.id} value={captain.id}>
                    {captain.first_name || ''} {captain.last_name || ''} ({captain.email})
                  </option>
                ))}
              </select>
            </div>
            
            <div className="admin-filter-item">
              <label>Дата начала</label>
              <input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className="form-input"
              />
            </div>
            
            <div className="admin-filter-item">
              <label>Дата окончания</label>
              <input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className="form-input"
              />
            </div>
          </div>
        </div>

        {/* Сводка по капитанам */}
        {captainsSummary.length > 0 && (
          <div style={{ marginBottom: '2rem' }}>
            <h3 className="admin-section-title">Сводка по капитанам</h3>
            <div className="admin-table-container">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Капитан</th>
                    <th className="admin-table-number">Выручка</th>
                    <th className="admin-table-number">Комиссия</th>
                    <th className="admin-table-number">К выплате</th>
                    <th className="admin-table-number">Людей</th>
                    <th className="admin-table-number">Бронирований</th>
                  </tr>
                </thead>
                <tbody>
                  {captainsSummary.map((summary, idx) => (
                    <tr key={summary.captain_id} className={idx % 2 === 0 ? '' : 'admin-table-row-alt'}>
                      <td>{summary.captain_name}</td>
                      <td className="admin-table-number">{formatCurrency(summary.revenue)}</td>
                      <td className="admin-table-number admin-table-negative">
                        -{formatCurrency(summary.platform_commission)}
                      </td>
                      <td className="admin-table-number admin-table-positive">
                        {formatCurrency(summary.to_payout)}
                      </td>
                      <td className="admin-table-number">{summary.total_people}</td>
                      <td className="admin-table-number">{summary.bookings_count}</td>
                    </tr>
                  ))}
                  {captainsSummary.length > 1 && (
                    <tr className="admin-table-total">
                      <td>ИТОГО</td>
                      <td className="admin-table-number">
                        {formatCurrency(captainsSummary.reduce((sum, s) => sum + s.revenue, 0))}
                      </td>
                      <td className="admin-table-number admin-table-negative">
                        -{formatCurrency(captainsSummary.reduce((sum, s) => sum + s.platform_commission, 0))}
                      </td>
                      <td className="admin-table-number admin-table-positive">
                        {formatCurrency(captainsSummary.reduce((sum, s) => sum + s.to_payout, 0))}
                      </td>
                      <td className="admin-table-number">
                        {captainsSummary.reduce((sum, s) => sum + s.total_people, 0)}
                      </td>
                      <td className="admin-table-number">
                        {captainsSummary.reduce((sum, s) => sum + s.bookings_count, 0)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Детальная таблица по датам */}
        {dataLoading ? (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Загрузка данных...</p>
          </div>
        ) : dates.length === 0 ? (
          <div className="alert alert-info">Нет данных за выбранный период</div>
        ) : (
          <div>
            <h3 className="admin-section-title">Детализация по датам</h3>
            <div className="admin-table-container admin-table-details">
              <table className="admin-table admin-table-dates">
                <thead>
                  <tr>
                    <th rowSpan="2" className="admin-table-date-header">
                      Дата
                    </th>
                    {captainsInData.map(captain => (
                      <th key={captain.id} colSpan="4" className="admin-table-captain-header">
                        {captain.name}
                      </th>
                    ))}
                  </tr>
                  <tr>
                    {captainsInData.map(captain => (
                      <React.Fragment key={captain.id}>
                        <th className="admin-table-subheader">Люди</th>
                        <th className="admin-table-subheader">Выручка</th>
                        <th className="admin-table-subheader">Комиссия</th>
                        <th className="admin-table-subheader">К выплате</th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dates.map((date, dateIdx) => {
                    const dateRow = groupedByDate[date]
                    return (
                      <tr key={date} className={dateIdx % 2 === 0 ? '' : 'admin-table-row-alt'}>
                        <td className="admin-table-date-cell">
                          {formatDate(date)}
                        </td>
                        {captainsInData.map(captain => {
                          const captainData = dateRow[captain.id]
                          if (!captainData) {
                            return (
                              <React.Fragment key={captain.id}>
                                <td className="admin-table-number">—</td>
                                <td className="admin-table-number">—</td>
                                <td className="admin-table-number">—</td>
                                <td className="admin-table-number">—</td>
                              </React.Fragment>
                            )
                          }
                          return (
                            <React.Fragment key={captain.id}>
                              <td className="admin-table-number">
                                {captainData.people} чел.
                              </td>
                              <td className="admin-table-number">
                                {formatCurrency(captainData.revenue)}
                              </td>
                              <td className="admin-table-number admin-table-negative">
                                -{formatCurrency(captainData.platform_commission)}
                              </td>
                              <td className="admin-table-number admin-table-positive">
                                {formatCurrency(captainData.to_payout)}
                              </td>
                            </React.Fragment>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AdminCaptains
