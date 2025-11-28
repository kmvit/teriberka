import { useState, useEffect, useCallback } from 'react'
import './ImageModal.css'

const ImageModal = ({ images, currentIndex, onClose }) => {
  if (!images || images.length === 0) {
    return null
  }

  const sortedImages = [...images].sort((a, b) => (a.order || 0) - (b.order || 0))
  const [index, setIndex] = useState(currentIndex || 0)
  const currentImage = sortedImages[index]
  
  // Получаем URL изображения
  const getImageUrl = (img) => {
    if (!img) return ''
    if (typeof img === 'string') return img
    return img.url || img
  }

  useEffect(() => {
    if (currentIndex !== undefined) {
      setIndex(currentIndex)
    }
  }, [currentIndex])

  const handlePrev = useCallback((e) => {
    e?.stopPropagation()
    setIndex((prev) => (prev === 0 ? sortedImages.length - 1 : prev - 1))
  }, [sortedImages.length])

  const handleNext = useCallback((e) => {
    e?.stopPropagation()
    setIndex((prev) => (prev === sortedImages.length - 1 ? 0 : prev + 1))
  }, [sortedImages.length])

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        handlePrev(e)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        handleNext(e)
      }
    }

    document.addEventListener('keydown', handleEscape)
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'unset'
    }
  }, [handlePrev, handleNext, onClose])

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div className="image-modal" onClick={handleBackdropClick}>
      <button 
        className="image-modal-close"
        onClick={onClose}
        aria-label="Закрыть"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {sortedImages.length > 1 && (
        <>
          <button 
            className="image-modal-nav image-modal-nav-prev"
            onClick={handlePrev}
            aria-label="Предыдущее изображение"
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button 
            className="image-modal-nav image-modal-nav-next"
            onClick={handleNext}
            aria-label="Следующее изображение"
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </>
      )}

      <div className="image-modal-content">
        <img 
          src={getImageUrl(currentImage)} 
          alt={`Изображение ${index + 1}`}
          className="image-modal-image"
        />
        
        {sortedImages.length > 1 && (
          <div className="image-modal-info">
            <div className="image-modal-counter">
              {index + 1} / {sortedImages.length}
            </div>
            <div className="image-modal-indicators">
              {sortedImages.map((_, i) => (
                <button
                  key={i}
                  className={`image-modal-indicator ${i === index ? 'active' : ''}`}
                  onClick={() => setIndex(i)}
                  aria-label={`Перейти к изображению ${i + 1}`}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ImageModal

