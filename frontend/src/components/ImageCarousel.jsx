import { useState, useEffect } from 'react'
import './ImageCarousel.css'

const ImageCarousel = ({ images, onImageClick, currentImageIndex }) => {
  const [currentIndex, setCurrentIndex] = useState(currentImageIndex || 0)

  if (!images || images.length === 0) {
    return (
      <div className="image-carousel">
        <div className="image-carousel-placeholder">
          <svg width="80" height="80" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 16L8.586 11.414C9.367 10.633 10.633 10.633 11.414 11.414L16 16M14 14L15.586 12.414C16.367 11.633 17.633 11.633 18.414 12.414L20 14M14 8H14.01M6 20H18C19.105 20 20 19.105 20 18V6C20 4.895 19.105 4 18 4H6C4.895 4 4 4.895 4 6V18C4 19.105 4.895 20 6 20Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>Нет фото</span>
        </div>
      </div>
    )
  }

  const sortedImages = [...images].sort((a, b) => (a.order || 0) - (b.order || 0))
  
  // Убеждаемся, что currentIndex в пределах массива
  useEffect(() => {
    if (currentIndex >= sortedImages.length && sortedImages.length > 0) {
      setCurrentIndex(0)
    }
  }, [sortedImages.length, currentIndex])
  
  const safeIndex = Math.min(currentIndex, Math.max(0, sortedImages.length - 1))
  const currentImage = sortedImages[safeIndex]
  
  // Получаем URL изображения
  const getImageUrl = (img) => {
    if (!img) return ''
    if (typeof img === 'string') return img
    return img.url || img
  }

  const handlePrev = (e) => {
    e.stopPropagation()
    setCurrentIndex((prev) => (prev === 0 ? sortedImages.length - 1 : prev - 1))
  }

  const handleNext = (e) => {
    e.stopPropagation()
    setCurrentIndex((prev) => (prev === sortedImages.length - 1 ? 0 : prev + 1))
  }

  const handleImageClick = () => {
    if (onImageClick) {
      onImageClick(safeIndex)
    }
  }

  return (
    <div className="image-carousel">
      <div 
        className="image-carousel-main"
        onClick={handleImageClick}
        style={{ cursor: 'pointer' }}
      >
        <img 
          src={getImageUrl(currentImage)} 
          alt={`Изображение ${safeIndex + 1}`}
          className="image-carousel-image"
          loading="lazy"
          decoding="async"
        />
        
        {sortedImages.length > 1 && (
          <>
            <button 
              className="image-carousel-nav image-carousel-nav-prev"
              onClick={handlePrev}
              aria-label="Предыдущее изображение"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <button 
              className="image-carousel-nav image-carousel-nav-next"
              onClick={handleNext}
              aria-label="Следующее изображение"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            
            <div className="image-carousel-indicators">
              {sortedImages.map((_, index) => (
                <button
                  key={index}
                  className={`image-carousel-indicator ${index === safeIndex ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    setCurrentIndex(index)
                  }}
                  aria-label={`Перейти к изображению ${index + 1}`}
                />
              ))}
            </div>
            
            <div className="image-carousel-counter">
              {safeIndex + 1} / {sortedImages.length}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default ImageCarousel

