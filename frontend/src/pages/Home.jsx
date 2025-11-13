import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import '../styles/Home.css'

const Home = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState(null)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      setIsAuthenticated(true)
      // Пытаемся получить данные пользователя из localStorage
      const userData = localStorage.getItem('user')
      if (userData) {
        try {
          setUser(JSON.parse(userData))
        } catch (e) {
          // Игнорируем ошибку парсинга
        }
      }
    }
  }, [])

  return (
    <div className="home-container">
      <div className="home-hero">
        <div className="home-content">
          <h1 className="home-title">
            Добро пожаловать в Териберку
          </h1>
          <p className="home-subtitle">
            Бронируйте морские прогулки и экскурсии на катерах в одном из самых красивых мест Кольского полуострова
          </p>
          
          <div className="home-actions">
            {isAuthenticated ? (
              <Link to="/profile" className="btn btn-primary btn-large">
                <span>Перейти в профиль</span>
              </Link>
            ) : (
              <>
                <Link to="/register" className="btn btn-primary btn-large">
                  <span>Начать</span>
                </Link>
                <Link to="/login" className="btn btn-secondary btn-large">
                  <span>Войти</span>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Home

