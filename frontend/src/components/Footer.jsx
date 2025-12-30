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
            <div className="footer-social-icons">
              {settings.whatsapp_url && (
                <a href={settings.whatsapp_url} target="_blank" rel="noopener noreferrer" className="footer-social-icon-link" title="WhatsApp">
                  <FaWhatsapp className="footer-social-icon" />
                </a>
              )}
              {settings.telegram_url && (
                <a href={settings.telegram_url} target="_blank" rel="noopener noreferrer" className="footer-social-icon-link" title="Telegram">
                  <FaTelegram className="footer-social-icon" />
                </a>
              )}
              {settings.vk_url && (
                <a href={settings.vk_url} target="_blank" rel="noopener noreferrer" className="footer-social-icon-link" title="ВКонтакте">
                  <FaVk className="footer-social-icon" />
                </a>
              )}
              {settings.max_url && (
                <a href={settings.max_url} target="_blank" rel="noopener noreferrer" className="footer-social-icon-link" title="Max">
                  <span className="footer-social-icon-text">M</span>
                </a>
              )}
            </div>
            <div className="footer-contacts-social">
              <a href={`tel:${settings.phone_raw}`} className="footer-contact-social-item">
                <FiPhone className="footer-contact-social-icon" />
                <span>{settings.phone}</span>
              </a>
              {settings.email && (
                <a href={`mailto:${settings.email}`} className="footer-contact-social-item">
                  <FiMail className="footer-contact-social-icon" />
                  <span>{settings.email}</span>
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
              <Link to="/faq" className="footer-link">
                Информация
              </Link>
              <Link to="/policy" className="footer-link">
                Политика конфиденциальности
              </Link>
            </nav>
          </div>
        </div>

        {/* Информация о туроператоре */}
        {settings.tour_operator_info && (
          <div className="footer-tour-operator">
            <div className="footer-tour-operator-content">
              <div className="footer-tour-operator-text">
                {settings.tour_operator_info.split('\n').map((line, index) => (
                  <p key={index}>{line}</p>
                ))}
              </div>
            </div>
          </div>
        )}

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

