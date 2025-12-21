import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { faqAPI } from '../services/api'
import { FiCalendar, FiEye, FiArrowLeft } from 'react-icons/fi'
import '../styles/FAQDetail.css'

const FAQDetail = () => {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [page, setPage] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadPage()
  }, [slug])

  const loadPage = async () => {
    setLoading(true)
    setError(null)

    try {
      const data = await faqAPI.getPageDetail(slug)
      setPage(data)
    } catch (err) {
      setError(err.response?.data?.error || 'Страница FAQ не найдена')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return date.toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="faq-detail-page">
        <div className="faq-detail-container">
          <div className="faq-loading">Загрузка страницы FAQ...</div>
        </div>
      </div>
    )
  }

  if (error || !page) {
    return (
      <div className="faq-detail-page">
        <div className="faq-detail-container">
          <div className="faq-error">{error || 'Страница FAQ не найдена'}</div>
          <button
            className="faq-back-button"
            onClick={() => navigate('/faq')}
          >
            <FiArrowLeft /> Вернуться к списку FAQ
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="faq-detail-page">
      <div className="faq-detail-container">
        <button
          className="faq-back-button"
          onClick={() => navigate('/faq')}
        >
          <FiArrowLeft /> Назад к FAQ
        </button>

        <article className="faq-page">
          <h1 className="faq-page-title">{page.title}</h1>

          <div className="faq-page-meta">
            {page.published_at && (
              <span className="faq-page-date">
                <FiCalendar /> {formatDate(page.published_at)}
              </span>
            )}
            {page.views_count > 0 && (
              <span className="faq-page-views">
                <FiEye /> {page.views_count} просмотров
              </span>
            )}
          </div>

          {page.image_url && (
            <div className="faq-page-image-wrapper">
              <img
                src={page.image_url}
                alt={page.title}
                className="faq-page-image"
              />
            </div>
          )}

          {page.excerpt && (
            <p className="faq-page-excerpt">{page.excerpt}</p>
          )}

          <div
            className="faq-page-content"
            dangerouslySetInnerHTML={{ __html: page.content }}
          />
        </article>
      </div>
    </div>
  )
}

export default FAQDetail

