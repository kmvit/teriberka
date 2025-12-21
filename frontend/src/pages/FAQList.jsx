import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { faqAPI } from '../services/api'
import { FiCalendar, FiEye } from 'react-icons/fi'
import '../styles/FAQList.css'

const FAQList = () => {
  const [pages, setPages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [nextPage, setNextPage] = useState(null)
  const [previousPage, setPreviousPage] = useState(null)

  useEffect(() => {
    loadPages()
  }, [])

  const loadPages = async () => {
    setLoading(true)
    setError(null)

    try {
      const data = await faqAPI.getPages()
      
      // Обрабатываем разные форматы ответа (с пагинацией или без)
      if (data.results) {
        setPages(data.results)
        setNextPage(data.next)
        setPreviousPage(data.previous)
      } else if (Array.isArray(data)) {
        setPages(data)
        setNextPage(null)
        setPreviousPage(null)
      } else {
        setPages([])
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка при загрузке страниц FAQ')
      setPages([])
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

  return (
    <div className="faq-list-page">
      <div className="faq-list-container">
        <h1 className="faq-list-title">Часто задаваемые вопросы</h1>
        
        <main className="faq-content">
          {loading ? (
            <div className="faq-loading">Загрузка страниц FAQ...</div>
          ) : error ? (
            <div className="faq-error">{error}</div>
          ) : pages.length > 0 ? (
            <>
              <div className="faq-pages-list">
                {pages.map((page) => (
                  <Link
                    key={page.id}
                    to={`/faq/${page.slug}`}
                    className="faq-page-card"
                  >
                    {page.thumbnail_url && (
                      <div className="faq-page-image">
                        <img src={page.thumbnail_url} alt={page.title} />
                      </div>
                    )}
                    <div className="faq-page-content">
                      <h2 className="faq-page-title">{page.title}</h2>
                      {page.excerpt && (
                        <p className="faq-page-excerpt">{page.excerpt}</p>
                      )}
                      <div className="faq-page-meta">
                        {page.published_at && (
                          <span className="faq-page-date">
                            <FiCalendar /> {formatDate(page.published_at)}
                          </span>
                        )}
                        {page.views_count > 0 && (
                          <span className="faq-page-views">
                            <FiEye /> {page.views_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>

              {/* Пагинация */}
              {(nextPage || previousPage) && (
                <div className="faq-pagination">
                  {previousPage && (
                    <button
                      className="faq-pagination-btn"
                      onClick={() => {
                        loadPages()
                      }}
                    >
                      Назад
                    </button>
                  )}
                  {nextPage && (
                    <button
                      className="faq-pagination-btn"
                      onClick={() => {
                        loadPages()
                      }}
                    >
                      Вперед
                    </button>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="faq-empty">Страницы FAQ пока не добавлены</div>
          )}
        </main>
      </div>
    </div>
  )
}

export default FAQList

