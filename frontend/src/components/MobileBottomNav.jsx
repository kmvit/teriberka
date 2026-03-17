import { useState, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { FiCompass, FiMapPin, FiUser, FiLogIn } from 'react-icons/fi'
import './MobileBottomNav.css'

const MobileBottomNav = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const location = useLocation()

  useEffect(() => {
    const token = localStorage.getItem('token')
    setIsAuthenticated(!!token)
  }, [location])

  return (
    <nav className="mobile-bottom-nav">
      <NavLink
        to="/"
        end
        className={({ isActive }) =>
          `mobile-bottom-nav__item ${isActive ? 'mobile-bottom-nav__item--active' : ''}`
        }
      >
        <FiCompass className="mobile-bottom-nav__icon" />
        <span className="mobile-bottom-nav__label">Рейсы</span>
      </NavLink>

      <NavLink
        to="/blog"
        className={({ isActive }) =>
          `mobile-bottom-nav__item ${isActive ? 'mobile-bottom-nav__item--active' : ''}`
        }
      >
        <FiMapPin className="mobile-bottom-nav__icon" />
        <span className="mobile-bottom-nav__label">О Териберке</span>
      </NavLink>

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
