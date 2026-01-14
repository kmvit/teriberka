import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import '../styles/Payment.css'

function PaymentSuccess() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [countdown, setCountdown] = useState(5)
  
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
  
  const handleGoToBookings = () => {
    navigate('/profile/bookings')
  }
  
  return (
    <div className="payment-result-page">
      <div className="payment-result-container">
        <div className="payment-success-icon">
          <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="40" cy="40" r="40" fill="#4CAF50"/>
            <path d="M25 40L35 50L55 30" stroke="white" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        
        <h1 className="payment-result-title">Оплата прошла успешно!</h1>
        
        {paymentType === 'deposit' && (
          <div className="payment-result-message">
            <p>Предоплата за бронирование #{bookingId} успешно принята.</p>
            <p className="payment-info-text">
              Остаток необходимо оплатить за 3 часа до выхода в море. 
              Вы получите уведомление с напоминанием.
            </p>
          </div>
        )}
        
        {paymentType === 'remaining' && (
          <div className="payment-result-message">
            <p>Остаток за бронирование #{bookingId} успешно оплачен.</p>
            <p className="payment-info-text">
              Бронирование полностью оплачено! Покажите код бронирования капитану при посадке.
            </p>
            <div className="verification-code-box">
              <p className="verification-label">Код для посадки:</p>
              <p className="verification-code">BOOK-{bookingId}</p>
            </div>
          </div>
        )}
        
        <div className="payment-result-actions">
          <button 
            className="btn btn-primary"
            onClick={handleGoToBookings}
          >
            Перейти к бронированиям
          </button>
        </div>
        
        <p className="payment-redirect-text">
          Автоматическое перенаправление через {countdown} сек...
        </p>
      </div>
    </div>
  )
}

export default PaymentSuccess
