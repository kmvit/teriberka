import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { blogAPI } from '../services/api'
import { FiCalendar, FiEye } from 'react-icons/fi'
import '../styles/BlogList.css'

const BlogList = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const [articles, setArticles] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedCategory, setSelectedCategory] = useState(
    searchParams.get('category') || ''
  )
  const [nextPage, setNextPage] = useState(null)
  const [previousPage, setPreviousPage] = useState(null)

  useEffect(() => {
    loadCategories()
    loadArticles()
  }, [selectedCategory])

  const loadCategories = async () => {
    try {
      const data = await blogAPI.getCategories()
      setCategories(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Ошибка загрузки категорий:', err)
    }
  }

  const loadArticles = async () => {
    setLoading(true)
    setError(null)

    try {
      const params = {}
      if (selectedCategory) {
        params.category = selectedCategory
      }

      const data = await blogAPI.getArticles(params)
      
      if (data.results) {
        setArticles(data.results)
        setNextPage(data.next)
        setPreviousPage(data.previous)
      } else if (Array.isArray(data)) {
        setArticles(data)
        setNextPage(null)
        setPreviousPage(null)
      } else {
        setArticles([])
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка при загрузке статей')
      setArticles([])
    } finally {
      setLoading(false)
    }
  }

  const handleCategoryChange = (categoryId) => {
    const newCategory = categoryId === selectedCategory ? '' : categoryId
    setSelectedCategory(newCategory)
    
    if (newCategory) {
      setSearchParams({ category: newCategory })
    } else {
      setSearchParams({})
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
    <div className="blog-list-page">
      <div className="blog-list-container">
        <div className="blog-header">
          <h1 className="blog-list-title">О Териберке</h1>
          <p className="blog-subtitle">Полезные статьи и информация о посёлке</p>
        </div>

        {/* Горизонтальный фильтр категорий */}
        <div className="blog-filter-bar">
          <button
            className={`blog-filter-btn ${!selectedCategory ? 'active' : ''}`}
            onClick={() => handleCategoryChange('')}
          >
            Все статьи
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              className={`blog-filter-btn ${selectedCategory == category.id ? 'active' : ''}`}
              onClick={() => handleCategoryChange(category.id)}
            >
              {category.name}
              {category.articles_count > 0 && (
                <span className="blog-filter-count">{category.articles_count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Контент со статьями */}
        {loading ? (
          <div className="blog-loading">Загрузка статей...</div>
        ) : error ? (
          <div className="blog-error">{error}</div>
        ) : articles.length > 0 ? (
          <>
            <div className="blog-articles-grid">
              {articles.map((article) => (
                <Link
                  key={article.id}
                  to={`/blog/${article.slug}`}
                  className="blog-article-card"
                >
                  {article.thumbnail_url && (
                    <div className="blog-article-image">
                      <img src={article.thumbnail_url} alt={article.title} />
                      {article.category && (
                        <span className="blog-article-category">
                          {article.category.name}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="blog-article-content">
                    <h2 className="blog-article-title">{article.title}</h2>
                    <div className="blog-article-meta">
                      {article.published_at && (
                        <span className="blog-article-date">
                          <FiCalendar /> {formatDate(article.published_at)}
                        </span>
                      )}
                      {article.views_count > 0 && (
                        <span className="blog-article-views">
                          <FiEye /> {article.views_count}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Пагинация */}
            {(nextPage || previousPage) && (
              <div className="blog-pagination">
                {previousPage && (
                  <button
                    className="blog-pagination-btn"
                    onClick={() => loadArticles()}
                  >
                    Назад
                  </button>
                )}
                {nextPage && (
                  <button
                    className="blog-pagination-btn"
                    onClick={() => loadArticles()}
                  >
                    Вперед
                  </button>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="blog-empty">Статьи пока не опубликованы</div>
        )}
      </div>
    </div>
  )
}

export default BlogList
