import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import '../styles/Payment.css'

function PaymentFail() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [countdown, setCountdown] = useState(10)
  
  const bookingId = searchParams.get('booking_id')
  const paymentType = searchParams.get('type') // 'deposit' или 'remaining'
  
  useEffect(() => {
    // Обратный отсчет для автоматического перенаправления
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          navigate('/profile/bookings')
          return 0
        }
        return prev - 1
      })
    }, 1000)
    
    return () => clearInterval(timer)
  }, [navigate])
  
  const handleTryAgain = () => {
    navigate('/profile/bookings')
  }
  
  const handleContactSupport = () => {
    window.open('https://wa.me/79118018282', '_blank')
  }
  
  return (
    <div className="payment-result-page">
      <div className="payment-result-container">
        <div className="payment-fail-icon">
          <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="40" cy="40" r="40" fill="#f44336"/>
            <path d="M30 30L50 50M50 30L30 50" stroke="white" strokeWidth="5" strokeLinecap="round"/>
          </svg>
        </div>
        
        <h1 className="payment-result-title">Оплата не прошла</h1>
        
        {paymentType === 'deposit' && (
          <div className="payment-result-message">
            <p>К сожалению, предоплата за бронирование #{bookingId} не была завершена.</p>
            <p className="payment-info-text">
              Бронирование сохранено, но для его подтверждения необходимо внести предоплату.
            </p>
          </div>
        )}
        
        {paymentType === 'remaining' && (
          <div className="payment-result-message">
            <p>К сожалению, оплата остатка за бронирование #{bookingId} не прошла.</p>
            <p className="payment-info-text">
              Попробуйте оплатить снова. Оплата остатка обязательна за 3 часа до выхода в море.
            </p>
          </div>
        )}
        
        <div className="payment-fail-reasons">
          <p className="reasons-title">Возможные причины:</p>
          <ul>
            <li>Недостаточно средств на карте</li>
            <li>Карта заблокирована или истек срок действия</li>
            <li>Неверные данные карты</li>
            <li>Превышен лимит по операциям</li>
            <li>Отказ банка-эмитента</li>
          </ul>
        </div>
        
        <div className="payment-result-actions">
          <button 
            className="btn btn-primary"
            onClick={handleTryAgain}
          >
            Попробовать снова
          </button>
          <button 
            className="btn btn-secondary"
            onClick={handleContactSupport}
          >
            Связаться с поддержкой
          </button>
        </div>
        
        <p className="payment-redirect-text">
          Автоматическое перенаправление через {countdown} сек...
        </p>
      </div>
    </div>
  )
}

export default PaymentFail
