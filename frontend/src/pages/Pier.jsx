import { useState, useEffect } from 'react'
import { boatsAPI } from '../services/api'
import { FiAnchor, FiUsers, FiMapPin, FiNavigation } from 'react-icons/fi'
import '../styles/Pier.css'

const BOAT_TYPE_ICONS = {
  boat: '\u2693',
  yacht: '\u26F5',
  barkas: '\u{1F6A2}',
}

const Pier = () => {
  const [docks, setDocks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const loadDocks = async () => {
      try {
        const data = await boatsAPI.getDocks()
        const list = Array.isArray(data) ? data : data?.results ?? []
        setDocks(list)
      } catch (err) {
        console.error('Ошибка загрузки причалов:', err)
        setError('Не удалось загрузить информацию о причалах')
      } finally {
        setLoading(false)
      }
    }
    loadDocks()
  }, [])

  if (loading) {
    return (
      <div className="pier-page">
        <div className="pier-loading">
          <FiAnchor className="pier-loading-icon" />
          <span>Загрузка причалов...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="pier-page">
        <div className="pier-error">
          <p>{error}</p>
        </div>
      </div>
    )
  }

  const totalBoats = docks.reduce((sum, d) => sum + (d.boats?.length || 0), 0)

  return (
    <div className="pier-page">
      <div className="pier-container">
        <header className="pier-header">
          <FiAnchor className="pier-header-icon" />
          <h1 className="pier-title">Причалы</h1>
          <p className="pier-subtitle">
            {docks.length}{' '}
            {docks.length === 1 ? 'причал' : docks.length < 5 ? 'причала' : 'причалов'}
            {' \u2022 '}
            {totalBoats}{' '}
            {totalBoats === 1 ? 'судно' : totalBoats < 5 ? 'судна' : 'судов'}
          </p>
        </header>

        {docks.length === 0 ? (
          <div className="pier-empty">
            <FiAnchor className="pier-empty-icon" />
            <p>Пока нет доступных причалов</p>
          </div>
        ) : (
          <div className="pier-list">
            {docks.map((dock) => (
              <section key={dock.id} className="pier-dock-card">
                <div className="pier-dock-header">
                  <div className="pier-dock-info">
                    <div className="pier-dock-name-row">
                      <FiNavigation className="pier-dock-icon" />
                      <h2 className="pier-dock-name">{dock.name}</h2>
                    </div>
                    {dock.description && (
                      <p className="pier-dock-description">{dock.description}</p>
                    )}
                  </div>
                  {dock.yandex_location_url && (
                    <a
                      href={dock.yandex_location_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="pier-dock-map-link"
                    >
                      <FiMapPin />
                      <span>На карте</span>
                    </a>
                  )}
                </div>

                {dock.boats && dock.boats.length > 0 ? (
                  <div className="pier-boats-grid">
                    {dock.boats.map((boat) => (
                      <div key={boat.id} className="pier-boat-card">
                        <div className="pier-boat-image-wrapper">
                          {boat.first_image ? (
                            <img
                              src={boat.first_image}
                              alt={boat.name}
                              className="pier-boat-image"
                              loading="lazy"
                            />
                          ) : (
                            <div className="pier-boat-image-placeholder">
                              <FiAnchor />
                            </div>
                          )}
                          <span className="pier-boat-type-badge">
                            {BOAT_TYPE_ICONS[boat.boat_type] || '\u2693'}{' '}
                            {boat.boat_type_display}
                          </span>
                        </div>
                        <div className="pier-boat-info">
                          <h3 className="pier-boat-name">{boat.name}</h3>
                          <div className="pier-boat-meta">
                            <span className="pier-boat-meta-item">
                              <FiUsers />
                              {boat.capacity} чел.
                            </span>
                            {boat.owner_name && (
                              <span className="pier-boat-meta-item pier-boat-captain">
                                {boat.owner_name}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="pier-dock-empty">
                    <span>Нет пришвартованных судов</span>
                  </div>
                )}
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Pier
