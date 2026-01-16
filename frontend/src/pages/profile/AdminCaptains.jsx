import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { authAPI, adminAPI } from '../../services/api'
import '../../styles/Profile.css'

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
        <div style={{ 
          marginBottom: '2rem', 
          padding: '1.5rem', 
          backgroundColor: 'white', 
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ marginBottom: '1rem', fontSize: '1.125rem' }}>Фильтры</h3>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 'bold' }}>
                Капитан
              </label>
              <select
                value={selectedCaptain}
                onChange={(e) => setSelectedCaptain(e.target.value)}
                className="form-input"
                style={{ width: '100%' }}
              >
                <option value="">Все капитаны</option>
                {captains.map(captain => (
                  <option key={captain.id} value={captain.id}>
                    {captain.first_name || ''} {captain.last_name || ''} ({captain.email})
                  </option>
                ))}
              </select>
            </div>
            
            <div style={{ minWidth: '150px' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 'bold' }}>
                Дата начала
              </label>
              <input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className="form-input"
                style={{ width: '100%' }}
              />
            </div>
            
            <div style={{ minWidth: '150px' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 'bold' }}>
                Дата окончания
              </label>
              <input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className="form-input"
                style={{ width: '100%' }}
              />
            </div>
          </div>
        </div>

        {/* Сводка по капитанам */}
        {captainsSummary.length > 0 && (
          <div style={{ marginBottom: '2rem' }}>
            <h3 style={{ marginBottom: '1rem', fontSize: '1.125rem' }}>Сводка по капитанам</h3>
            <div style={{ 
              overflowX: 'auto',
              backgroundColor: 'white',
              borderRadius: '12px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--ocean-light)', borderBottom: '2px solid var(--ocean)' }}>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 'bold', color: '#1a1a1a' }}>Капитан</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 'bold', color: '#1a1a1a' }}>Выручка</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 'bold', color: '#1a1a1a' }}>Комиссия</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 'bold', color: '#1a1a1a' }}>К выплате</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 'bold', color: '#1a1a1a' }}>Людей</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 'bold', color: '#1a1a1a' }}>Бронирований</th>
                  </tr>
                </thead>
                <tbody>
                  {captainsSummary.map((summary, idx) => (
                    <tr key={summary.captain_id} style={{ 
                      borderBottom: '1px solid #e0e0e0',
                      backgroundColor: idx % 2 === 0 ? 'white' : '#f9f9f9'
                    }}>
                      <td style={{ padding: '0.75rem', color: '#1a1a1a' }}>{summary.captain_name}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right', color: '#1a1a1a' }}>{formatCurrency(summary.revenue)}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right', color: '#d32f2f', fontWeight: 'bold' }}>
                        -{formatCurrency(summary.platform_commission)}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right', color: '#2e7d32', fontWeight: 'bold' }}>
                        {formatCurrency(summary.to_payout)}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right', color: '#1a1a1a' }}>{summary.total_people}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right', color: '#1a1a1a' }}>{summary.bookings_count}</td>
                    </tr>
                  ))}
                  {captainsSummary.length > 1 && (
                    <tr style={{ 
                      backgroundColor: 'var(--ocean-light)', 
                      fontWeight: 'bold',
                      borderTop: '2px solid var(--ocean)'
                    }}>
                      <td style={{ padding: '0.75rem', color: '#1a1a1a' }}>ИТОГО</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right', color: '#1a1a1a' }}>
                        {formatCurrency(captainsSummary.reduce((sum, s) => sum + s.revenue, 0))}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right', color: '#d32f2f', fontWeight: 'bold' }}>
                        -{formatCurrency(captainsSummary.reduce((sum, s) => sum + s.platform_commission, 0))}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right', color: '#2e7d32', fontWeight: 'bold' }}>
                        {formatCurrency(captainsSummary.reduce((sum, s) => sum + s.to_payout, 0))}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right', color: '#1a1a1a' }}>
                        {captainsSummary.reduce((sum, s) => sum + s.total_people, 0)}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right', color: '#1a1a1a' }}>
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
            <h3 style={{ marginBottom: '1rem', fontSize: '1.125rem' }}>Детализация по датам</h3>
            <div style={{ 
              overflowX: 'auto',
              backgroundColor: 'white',
              borderRadius: '12px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1000px' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--ocean-light)', borderBottom: '2px solid var(--ocean)' }}>
                    <th rowSpan="2" style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 'bold', position: 'sticky', left: 0, backgroundColor: 'var(--ocean-light)', zIndex: 10, color: '#1a1a1a', whiteSpace: 'nowrap', minWidth: '150px', verticalAlign: 'middle' }}>
                      Дата
                    </th>
                    {captainsInData.map(captain => (
                      <th key={captain.id} colSpan="4" style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 'bold', borderLeft: '1px solid #e0e0e0', color: '#1a1a1a' }}>
                        {captain.name}
                      </th>
                    ))}
                  </tr>
                  <tr style={{ backgroundColor: 'var(--ocean-light)', borderBottom: '2px solid var(--ocean)' }}>
                    {captainsInData.map(captain => (
                      <React.Fragment key={captain.id}>
                        <th style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 'normal', fontSize: '0.875rem', borderLeft: '1px solid #e0e0e0', color: '#1a1a1a', whiteSpace: 'nowrap' }}>
                          Люди
                        </th>
                        <th style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 'normal', fontSize: '0.875rem', color: '#1a1a1a', whiteSpace: 'nowrap' }}>
                          Выручка
                        </th>
                        <th style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 'normal', fontSize: '0.875rem', color: '#1a1a1a', whiteSpace: 'nowrap' }}>
                          Комиссия
                        </th>
                        <th style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 'normal', fontSize: '0.875rem', color: '#1a1a1a', whiteSpace: 'nowrap' }}>
                          К выплате
                        </th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dates.map((date, dateIdx) => {
                    const dateRow = groupedByDate[date]
                    return (
                      <tr key={date} style={{ 
                        borderBottom: '1px solid #e0e0e0',
                        backgroundColor: dateIdx % 2 === 0 ? 'white' : '#f9f9f9'
                      }}>
                        <td style={{ 
                          padding: '0.75rem', 
                          fontWeight: 'bold',
                          position: 'sticky',
                          left: 0,
                          backgroundColor: dateIdx % 2 === 0 ? 'white' : '#f9f9f9',
                          zIndex: 5,
                          color: '#1a1a1a',
                          whiteSpace: 'nowrap',
                          minWidth: '150px'
                        }}>
                          {formatDate(date)}
                        </td>
                        {captainsInData.map(captain => {
                          const captainData = dateRow[captain.id]
                          if (!captainData) {
                            return (
                              <React.Fragment key={captain.id}>
                                <td style={{ padding: '0.75rem', textAlign: 'right', borderLeft: '1px solid #e0e0e0', color: '#1a1a1a' }}>—</td>
                                <td style={{ padding: '0.75rem', textAlign: 'right', color: '#1a1a1a' }}>—</td>
                                <td style={{ padding: '0.75rem', textAlign: 'right', color: '#1a1a1a' }}>—</td>
                                <td style={{ padding: '0.75rem', textAlign: 'right', color: '#1a1a1a' }}>—</td>
                              </React.Fragment>
                            )
                          }
                          return (
                            <React.Fragment key={captain.id}>
                              <td style={{ padding: '0.75rem', textAlign: 'right', borderLeft: '1px solid #e0e0e0', color: '#1a1a1a' }}>
                                {captainData.people} чел.
                              </td>
                              <td style={{ padding: '0.75rem', textAlign: 'right', color: '#1a1a1a' }}>
                                {formatCurrency(captainData.revenue)}
                              </td>
                              <td style={{ padding: '0.75rem', textAlign: 'right', color: '#d32f2f', fontWeight: 'bold' }}>
                                -{formatCurrency(captainData.platform_commission)}
                              </td>
                              <td style={{ padding: '0.75rem', textAlign: 'right', color: '#2e7d32', fontWeight: 'bold' }}>
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
