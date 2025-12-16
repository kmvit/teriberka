import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { blogAPI } from '../services/api'
import { FiCalendar, FiEye, FiArrowLeft } from 'react-icons/fi'
import '../styles/BlogDetail.css'

const BlogDetail = () => {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [article, setArticle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadArticle()
  }, [slug])

  const loadArticle = async () => {
    setLoading(true)
    setError(null)

    try {
      const data = await blogAPI.getArticleDetail(slug)
      setArticle(data)
    } catch (err) {
      setError(err.response?.data?.error || 'Статья не найдена')
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
      <div className="blog-detail-page">
        <div className="blog-detail-container">
          <div className="blog-loading">Загрузка статьи...</div>
        </div>
      </div>
    )
  }

  if (error || !article) {
    return (
      <div className="blog-detail-page">
        <div className="blog-detail-container">
          <div className="blog-error">{error || 'Статья не найдена'}</div>
          <Link to="/blog" className="blog-back-link">
            <FiArrowLeft /> Вернуться к списку статей
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="blog-detail-page">
      <div className="blog-detail-container">
        <button
          className="blog-back-button"
          onClick={() => navigate('/blog')}
        >
          <FiArrowLeft /> Назад к статьям
        </button>

        <article className="blog-article">
          {article.category && (
            <Link
              to={`/blog?category=${article.category.id}`}
              className="blog-article-category-link"
            >
              {article.category.name}
            </Link>
          )}

          <h1 className="blog-article-title">{article.title}</h1>

          <div className="blog-article-meta">
            {article.published_at && (
              <span className="blog-article-date">
                <FiCalendar /> {formatDate(article.published_at)}
              </span>
            )}
            {article.views_count > 0 && (
              <span className="blog-article-views">
                <FiEye /> {article.views_count} просмотров
              </span>
            )}
          </div>

          {article.image_url && (
            <div className="blog-article-image-wrapper">
              <img
                src={article.image_url}
                alt={article.title}
                className="blog-article-image"
              />
            </div>
          )}

          {article.excerpt && (
            <p className="blog-article-excerpt">{article.excerpt}</p>
          )}

          <div
            className="blog-article-content"
            dangerouslySetInnerHTML={{ __html: article.content }}
          />
        </article>
      </div>
    </div>
  )
}

export default BlogDetail

