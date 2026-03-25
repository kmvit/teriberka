import { useState, useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { FiPhone, FiUser, FiLogOut, FiUserPlus, FiBell, FiHelpCircle } from 'react-icons/fi'
import { siteSettingsAPI } from '../services/api'
import '../styles/Navbar.css'

const Navbar = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState(null)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [currentLanguage, setCurrentLanguage] = useState('ru')
  const [isAuthDropdownOpen, setIsAuthDropdownOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    try {
      return localStorage.getItem('notifications-enabled') === 'true'
    } catch {
      return false
    }
  })
  const [phone, setPhone] = useState(null)
  const [phoneRaw, setPhoneRaw] = useState(null)
  const location = useLocation()
  const navbarRef = useRef(null)

  const checkAuth = () => {
    const token = localStorage.getItem('token')
    setIsAuthenticated(!!token)
    if (token) {
      const userData = localStorage.getItem('user')
      if (userData) {
        try {
          setUser(JSON.parse(userData))
        } catch (e) {
          // Игнорируем ошибку парсинга
        }
      } else {
        setUser(null)
      }
    } else {
      setUser(null)
    }
  }

  useEffect(() => {
    checkAuth()
    setIsMobileMenuOpen(false)
    setIsAuthDropdownOpen(false)
  }, [location])

  // Синхронизация авторизации при возврате на вкладку (после логина в другой вкладке/попапе)
  useEffect(() => {
    const onFocus = () => checkAuth()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const data = await siteSettingsAPI.getSettings()
        if (data.phone) {
          setPhone(data.phone)
        }
        if (data.phone_raw) {
          setPhoneRaw(data.phone_raw)
        }
      } catch (err) {
        console.error('Ошибка загрузки настроек сайта:', err)
      }
    }

    loadSettings()
  }, [])

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()

    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setIsAuthenticated(false)
    setUser(null)
    setIsMobileMenuOpen(false)
    window.location.href = '/'
  }

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen)
  }

  const handleLanguageChange = (lang) => {
    setCurrentLanguage(lang)
    // TODO: Здесь будет логика смены языка
    console.log('Язык изменен на:', lang)
  }

  const toggleAuthDropdown = () => {
    setIsAuthDropdownOpen(!isAuthDropdownOpen)
  }

  const toggleNotifications = () => {
    const next = !notificationsEnabled
    setNotificationsEnabled(next)
    try {
      localStorage.setItem('notifications-enabled', String(next))
    } catch {}
  }

  return (
    <nav className={`navbar ${isScrolled ? 'navbar--scrolled' : ''}`} ref={navbarRef}>
      <div className="navbar-container">
        <Link to="/" className="navbar-logo" onClick={() => setIsMobileMenuOpen(false)}>
          <img
            src="/favicon.svg"
            alt=""
            className="navbar-logo-icon"
          />
          <span className="navbar-logo-text">Териберка</span>
        </Link>
        
        {/* Иконки в шапке — только на мобильных, всегда видны */}
        <div className="navbar-header-icons">
          <Link
            to="/faq"
            className="navbar-icon-btn navbar-icon-btn--mobile"
            onClick={() => setIsMobileMenuOpen(false)}
            title="FAQ"
            aria-label="FAQ"
          >
            <FiHelpCircle className="navbar-icon-btn__icon" />
          </Link>
          {isAuthenticated && (
            <button
              type="button"
              className={`navbar-icon-btn navbar-icon-btn--mobile ${notificationsEnabled ? 'navbar-icon-btn--active' : ''}`}
              onClick={toggleNotifications}
              title={notificationsEnabled ? 'Уведомления включены' : 'Включить уведомления'}
              aria-label={notificationsEnabled ? 'Уведомления включены' : 'Включить уведомления'}
            >
              <FiBell className="navbar-icon-btn__icon" />
            </button>
          )}
        </div>

        <button 
          className="navbar-toggle"
          onClick={toggleMobileMenu}
          aria-label="Toggle menu"
        >
          <span className={isMobileMenuOpen ? 'navbar-toggle-icon open' : 'navbar-toggle-icon'}>
            <span></span>
            <span></span>
            <span></span>
          </span>
        </button>
        
        {isMobileMenuOpen && (
          <div 
            className="navbar-overlay"
            onClick={() => setIsMobileMenuOpen(false)}
          ></div>
        )}
        
        <div className={`navbar-menu ${isMobileMenuOpen ? 'active' : ''}`}>
          {/* Пункт меню "О Териберке" */}
          <Link
            to="/blog"
            className="navbar-link"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <span>О Териберке</span>
          </Link>

          {/* Пункт меню "FAQ" */}
          <Link
            to="/faq"
            className="navbar-link"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <span>FAQ</span>
          </Link>

          {/* Номер телефона */}
          {phone && phoneRaw && (
            <a href={`tel:${phoneRaw}`} className="navbar-phone">
              <FiPhone className="navbar-phone-icon" />
              <span className="navbar-phone-text">{phone}</span>
            </a>
          )}

          {/* Переключатель языков */}
          <div className="navbar-language">
            <button 
              className={`language-btn ${currentLanguage === 'ru' ? 'active' : ''}`}
              onClick={() => handleLanguageChange('ru')}
              title="Русский язык"
            >
              <span className="language-text">RU</span>
            </button>
            <button 
              className={`language-btn ${currentLanguage === 'cn' ? 'active' : ''}`}
              onClick={() => handleLanguageChange('cn')}
              title="中文"
            >
              <span className="language-text">CH</span>
            </button>
          </div>

          {/* Авторизация */}
          <div className="navbar-auth">
            {isAuthenticated ? (
              <>
                <button className="navbar-auth-toggle" onClick={toggleAuthDropdown}>
                  <FiUser className="navbar-link-icon" />
                  <span>Профиль</span>
                </button>
                {isAuthDropdownOpen && (
                  <div className="navbar-auth-dropdown">
                    <Link to="/profile" className="navbar-link" onClick={() => {setIsMobileMenuOpen(false); setIsAuthDropdownOpen(false);}}>
                      <FiUser className="navbar-link-icon" />
                      <span>Профиль</span>
                    </Link>
                    <button onClick={handleLogout} className="navbar-link">
                      <FiLogOut className="navbar-link-icon" />
                      <span>Выйти</span>
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                <button className="navbar-auth-toggle" onClick={toggleAuthDropdown}>
                  <FiUser className="navbar-link-icon" />
                  <span>Вход</span>
                </button>
                {isAuthDropdownOpen && (
                  <div className="navbar-auth-dropdown">
                    <Link to="/login" className="navbar-link" onClick={() => {setIsMobileMenuOpen(false); setIsAuthDropdownOpen(false);}}>
                      <FiUser className="navbar-link-icon" />
                      <span>Войти</span>
                    </Link>
                    <Link to="/register" className="navbar-link" onClick={() => {setIsMobileMenuOpen(false); setIsAuthDropdownOpen(false);}}>
                      <FiUserPlus className="navbar-link-icon" />
                      <span>Регистрация</span>
                    </Link>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}

export default Navbar

