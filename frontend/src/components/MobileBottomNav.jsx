import { NavLink } from 'react-router-dom'
import { FiCompass, FiMapPin, FiUser } from 'react-icons/fi'
import './MobileBottomNav.css'

const MobileBottomNav = () => {
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

      <NavLink
        to="/profile"
        className={({ isActive }) =>
          `mobile-bottom-nav__item ${isActive ? 'mobile-bottom-nav__item--active' : ''}`
        }
      >
        <FiUser className="mobile-bottom-nav__icon" />
        <span className="mobile-bottom-nav__label">Профиль</span>
      </NavLink>
    </nav>
  )
}

export default MobileBottomNav
