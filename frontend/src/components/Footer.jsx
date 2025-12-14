import { FiPhone, FiMapPin, FiMail } from 'react-icons/fi'
import './Footer.css'

const Footer = () => {
  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-content">
          {/* Информация о компании */}
          <div className="footer-section">
            <h3 className="footer-title">О компании</h3>
            <div className="footer-company-info">
              <p className="footer-company-name">ИП Иванов Иван Иванович</p>
              <p className="footer-inn">ИНН: 123456789012</p>
            </div>
          </div>

          {/* Контакты */}
          <div className="footer-section">
            <h3 className="footer-title">Контакты</h3>
            <div className="footer-contacts">
              <a href="tel:+71231231212" className="footer-contact-item">
                <FiPhone className="footer-icon" />
                <span>+7 (123) 123-12-12</span>
              </a>
              <a href="mailto:info@teriberka.ru" className="footer-contact-item">
                <FiMail className="footer-icon" />
                <span>info@teriberka.ru</span>
              </a>
              <div className="footer-contact-item">
                <FiMapPin className="footer-icon" />
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

