import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { bookingsAPI } from '../services/api'
import '../styles/Payment.css'

function PaymentSuccess() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [countdown, setCountdown] = useState(5)
  const [isVerifying, setIsVerifying] = useState(true)
  const [verificationError, setVerificationError] = useState(null)
  
  const bookingId = searchParams.get('booking_id')
  const paymentType = searchParams.get('type') // 'deposit' или 'remaining'
  
  useEffect(() => {
    // Проверяем статус платежа при загрузке страницы
    const verifyPayment = async () => {
      if (!bookingId) {
        setVerificationError('ID бронирования не найден')
        setIsVerifying(false)
        return
      }
      
      try {
        console.log('Проверяем статус бронирования:', bookingId)
        // Получаем данные бронирования, чтобы найти соответствующий платеж
        const booking = await bookingsAPI.getBookingDetail(bookingId)
        console.log('Данные бронирования:', booking)
        
        // Находим последний платеж нужного типа
        const payments = booking.payments || []
        const relevantPayment = payments
          .filter(p => p.payment_type === paymentType)
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]
        
        if (relevantPayment) {
          console.log('Найден платеж:', relevantPayment)
          // Проверяем статус платежа через API Т-Банка
          // Это обновит статус в БД
          const { paymentsAPI } = await import('../services/api')
          await paymentsAPI.checkPaymentStatus(relevantPayment.id)
          console.log('Статус платежа проверен')
        } else {
          console.warn('Платеж не найден')
        }
        
        setIsVerifying(false)
      } catch (error) {
        console.error('Ошибка при проверке статуса платежа:', error)
        setVerificationError('Не удалось проверить статус платежа')
        setIsVerifying(false)
      }
    }
    
    verifyPayment()
  }, [bookingId, paymentType])
  
  useEffect(() => {
    // Обратный отсчет для автоматического перенаправления
    // Начинаем отсчет только после проверки платежа
    if (isVerifying) return
    
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
  }, [navigate, isVerifying])
  
  const handleGoToBookings = () => {
    navigate('/profile/bookings')
  }
  
  return (
    <div className="payment-result-page">
      <div className="payment-result-container">
        {isVerifying ? (
          <>
            <div className="payment-verifying">
              <div className="spinner"></div>
            </div>
            <h1 className="payment-result-title">Проверяем статус платежа...</h1>
            <p className="payment-info-text">Пожалуйста, подождите</p>
          </>
        ) : (
          <>
            <div className="payment-success-icon">
              <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="40" cy="40" r="40" fill="#4CAF50"/>
                <path d="M25 40L35 50L55 30" stroke="white" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            
            {verificationError && (
              <div className="verification-warning">
                <p>⚠️ {verificationError}</p>
                <p className="warning-subtext">Платеж принят, но статус будет обновлен позже</p>
              </div>
            )}
            
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
          </>
        )}
      </div>
    </div>
  )
}

export default PaymentSuccess
