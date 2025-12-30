import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { FiPhone, FiMapPin, FiMail } from 'react-icons/fi'
import { FaWhatsapp, FaTelegram, FaVk } from 'react-icons/fa'
import { siteSettingsAPI } from '../services/api'
import './Footer.css'

const Footer = () => {
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const data = await siteSettingsAPI.getSettings()
        setSettings(data)
      } catch (err) {
        console.error('Ошибка загрузки настроек сайта:', err)
      } finally {
        setLoading(false)
      }
    }

    loadSettings()
  }, [])

  if (loading || !settings) {
    return (
      <footer className="footer">
        <div className="footer-container">
          <div className="footer-content">
            <p>Загрузка...</p>
          </div>
        </div>
      </footer>
    )
  }

  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-content">
          {/* Информация о компании */}
          <div className="footer-section">
            <Link to="/" className="footer-logo">
              <span className="footer-logo-text">{settings.site_name}</span>
            </Link>
            <div className="footer-company-info">
              <p className="footer-company-description">
                {settings.company_description}
              </p>
            </div>
          </div>

          {/* Мы в соц сетях */}
          <div className="footer-section">
            <h3 className="footer-title">Мы в соц сетях</h3>
            <div className="footer-social">
              <a href={`tel:${settings.phone_raw}`} className="footer-social-item">
                <FiPhone className="footer-social-icon" />
                <span>{settings.phone}</span>
              </a>
              {settings.whatsapp_url && (
                <a href={settings.whatsapp_url} target="_blank" rel="noopener noreferrer" className="footer-social-item">
                  <FaWhatsapp className="footer-social-icon" />
                  <span>WhatsApp</span>
                </a>
              )}
              {settings.telegram_url && (
                <a href={settings.telegram_url} target="_blank" rel="noopener noreferrer" className="footer-social-item">
                  <FaTelegram className="footer-social-icon" />
                  <span>Telegram</span>
                </a>
              )}
              {settings.vk_url && (
                <a href={settings.vk_url} target="_blank" rel="noopener noreferrer" className="footer-social-item">
                  <FaVk className="footer-social-icon" />
                  <span>ВКонтакте</span>
                </a>
              )}
            </div>
          </div>

          {/* Реквизиты */}
          <div className="footer-section">
            <h3 className="footer-title">Реквизиты</h3>
            <div className="footer-contacts">
              <div className="footer-contact-item">
                <span>{settings.legal_name}</span>
              </div>
              <div className="footer-contact-item">
                <span>ИНН: {settings.inn}</span>
              </div>
              <div className="footer-contact-item">
                <span>{settings.address}</span>
              </div>
            </div>
          </div>

          {/* Ссылки */}
          <div className="footer-section">
            <h3 className="footer-title">Информация</h3>
            <nav className="footer-links">
              <a href="#" className="footer-link">
                Информация
              </a>
              <a href="#" className="footer-link">
                Политика конфиденциальности
              </a>
            </nav>
          </div>
        </div>

        {/* Копирайт */}
        <div className="footer-bottom">
          <p className="footer-copyright">
            © {new Date().getFullYear()} {settings.site_name}. Все права защищены.
          </p>
        </div>
      </div>
    </footer>
  )
}

export default Footer

