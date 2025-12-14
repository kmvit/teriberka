import { Link } from 'react-router-dom'
import { FiPhone, FiMapPin, FiMail } from 'react-icons/fi'
import { FaWhatsapp, FaTelegram, FaVk } from 'react-icons/fa'
import './Footer.css'

const Footer = () => {
  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-content">
          {/* Информация о компании */}
          <div className="footer-section">
            <Link to="/" className="footer-logo">
              <span className="footer-logo-text">Териберка</span>
            </Link>
            <div className="footer-company-info">
              <p className="footer-company-description">
                Организация морских прогулок и экскурсий в Териберке
              </p>
            </div>
          </div>

          {/* Мы в соц сетях */}
          <div className="footer-section">
            <h3 className="footer-title">Мы в соц сетях</h3>
            <div className="footer-social">
              <a href="tel:+71231231212" className="footer-social-item">
                <FiPhone className="footer-social-icon" />
                <span>+7 (123) 123-12-12</span>
              </a>
              <a href="https://wa.me/71231231212" target="_blank" rel="noopener noreferrer" className="footer-social-item">
                <FaWhatsapp className="footer-social-icon" />
                <span>WhatsApp</span>
              </a>
              <a href="https://t.me/teriberka" target="_blank" rel="noopener noreferrer" className="footer-social-item">
                <FaTelegram className="footer-social-icon" />
                <span>Telegram</span>
              </a>
              <a href="https://vk.com/teriberka" target="_blank" rel="noopener noreferrer" className="footer-social-item">
                <FaVk className="footer-social-icon" />
                <span>ВКонтакте</span>
              </a>
            </div>
          </div>

          {/* Реквизиты */}
          <div className="footer-section">
            <h3 className="footer-title">Реквизиты</h3>
            <div className="footer-contacts">
              <div className="footer-contact-item">
                <span>ИП Иванов Иван Иванович</span>
              </div>
              <div className="footer-contact-item">
                <span>ИНН: 123456789012</span>
              </div>
              <div className="footer-contact-item">
                <span>Мурманская область, село Териберка, ул. Морская, д. 1</span>
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
            © {new Date().getFullYear()} Териберка. Все права защищены.
          </p>
        </div>
      </div>
    </footer>
  )
}

export default Footer

