import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import '../styles/Navbar.css'

const Navbar = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState(null)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
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
    // Закрываем мобильное меню при смене страницы
    setIsMobileMenuOpen(false)
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
          {isAuthenticated ? (
            <>
              <Link to="/profile" className="navbar-link" onClick={() => setIsMobileMenuOpen(false)}>
                Профиль
              </Link>
              <button onClick={handleLogout} className="navbar-link navbar-link-button">
                Выйти
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="navbar-link" onClick={() => setIsMobileMenuOpen(false)}>
                Войти
              </Link>
              <Link to="/register" className="btn btn-primary btn-small" onClick={() => setIsMobileMenuOpen(false)}>
                Регистрация
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}

export default Navbar

