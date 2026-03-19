import { useState, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { FiHome, FiAnchor, FiCalendar, FiUser, FiLogIn } from 'react-icons/fi'
import { FaTelegram } from 'react-icons/fa'
import { siteSettingsAPI } from '../services/api'
import './MobileBottomNav.css'

const DEFAULT_TELEGRAM_URL = 'https://t.me/SeaTeribas_bot'

const MobileBottomNav = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [telegramUrl, setTelegramUrl] = useState(DEFAULT_TELEGRAM_URL)
  const location = useLocation()

  useEffect(() => {
    const token = localStorage.getItem('token')
    setIsAuthenticated(!!token)
  }, [location])

  useEffect(() => {
    siteSettingsAPI.getSettings().then((data) => {
      if (data?.telegram_url) setTelegramUrl(data.telegram_url)
    }).catch(() => {})
  }, [])

  return (
    <nav className="mobile-bottom-nav">
      <NavLink
        to="/"
        end
        className={({ isActive }) =>
          `mobile-bottom-nav__item ${isActive ? 'mobile-bottom-nav__item--active' : ''}`
        }
      >
        <FiHome className="mobile-bottom-nav__icon" />
        <span className="mobile-bottom-nav__label">Главная</span>
      </NavLink>

      <NavLink
        to="/pier"
        className={({ isActive }) =>
          `mobile-bottom-nav__item ${isActive ? 'mobile-bottom-nav__item--active' : ''}`
        }
      >
        <FiAnchor className="mobile-bottom-nav__icon" />
        <span className="mobile-bottom-nav__label">Причал</span>
      </NavLink>

      {isAuthenticated ? (
        <NavLink
          to="/profile/bookings"
          className={({ isActive }) =>
            `mobile-bottom-nav__item ${isActive ? 'mobile-bottom-nav__item--active' : ''}`
          }
        >
          <FiCalendar className="mobile-bottom-nav__icon" />
          <span className="mobile-bottom-nav__label">Бронирования</span>
        </NavLink>
      ) : (
        <NavLink
          to="/login"
          className={({ isActive }) =>
            `mobile-bottom-nav__item ${isActive ? 'mobile-bottom-nav__item--active' : ''}`
          }
        >
          <FiCalendar className="mobile-bottom-nav__icon" />
          <span className="mobile-bottom-nav__label">Бронирования</span>
        </NavLink>
      )}

      <a
        href={telegramUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mobile-bottom-nav__item"
      >
        <FaTelegram className="mobile-bottom-nav__icon" />
        <span className="mobile-bottom-nav__label">Помощь</span>
      </a>

      {isAuthenticated ? (
        <NavLink
          to="/profile"
          className={({ isActive }) =>
            `mobile-bottom-nav__item ${isActive ? 'mobile-bottom-nav__item--active' : ''}`
          }
        >
          <FiUser className="mobile-bottom-nav__icon" />
          <span className="mobile-bottom-nav__label">Профиль</span>
        </NavLink>
      ) : (
        <NavLink
          to="/login"
          className={({ isActive }) =>
            `mobile-bottom-nav__item ${isActive ? 'mobile-bottom-nav__item--active' : ''}`
          }
        >
          <FiLogIn className="mobile-bottom-nav__icon" />
          <span className="mobile-bottom-nav__label">Вход</span>
        </NavLink>
      )}
    </nav>
  )
}

export default MobileBottomNav
