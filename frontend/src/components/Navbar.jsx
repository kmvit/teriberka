import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { FiPhone, FiUser, FiLogOut, FiUserPlus } from 'react-icons/fi'
import '../styles/Navbar.css'

const Navbar = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState(null)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [currentLanguage, setCurrentLanguage] = useState('ru')
  const [isAuthDropdownOpen, setIsAuthDropdownOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      setIsAuthenticated(true)
      const userData = localStorage.getItem('user')
      if (userData) {
        try {
          setUser(JSON.parse(userData))
        } catch (e) {
          // Игнорируем ошибку парсинга
        }
      }
    } else {
      setIsAuthenticated(false)
      setUser(null)
    }
    // Закрываем меню при смене страницы
    setIsMobileMenuOpen(false)
    setIsAuthDropdownOpen(false)
  }, [location])

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

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-logo" onClick={() => setIsMobileMenuOpen(false)}>
          <span className="navbar-logo-text">Териберка</span>
        </Link>
        
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
          <a href="tel:+71231231212" className="navbar-phone">
            <FiPhone className="navbar-phone-icon" />
            <span className="navbar-phone-text">+7(123)123-12-12</span>
          </a>

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

