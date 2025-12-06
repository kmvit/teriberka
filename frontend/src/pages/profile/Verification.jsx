import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authAPI } from '../../services/api'
import '../../styles/Register.css'

const Verification = () => {
  const navigate = useNavigate()
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files)
    setFiles(selectedFiles)
    setError(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (files.length === 0) {
      setError('Пожалуйста, выберите хотя бы один файл')
      return
    }

    setLoading(true)
    setError(null)

    try {
      await authAPI.uploadVerification(files)
      setSuccess(true)
      // Обновляем профиль после успешной загрузки
      setTimeout(() => {
        navigate('/profile')
      }, 2000)
    } catch (err) {
      if (err.response && err.response.data) {
        const serverErrors = err.response.data
        if (typeof serverErrors === 'string') {
          setError(serverErrors)
        } else if (serverErrors.detail) {
          setError(serverErrors.detail)
        } else if (serverErrors.non_field_errors) {
          setError(Array.isArray(serverErrors.non_field_errors) 
            ? serverErrors.non_field_errors[0] 
            : serverErrors.non_field_errors)
        } else {
          setError('Ошибка загрузки документов. Попробуйте еще раз.')
        }
      } else {
        setError('Произошла ошибка при загрузке документов')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveFile = (index) => {
    setFiles(files.filter((_, i) => i !== index))
  }

  if (success) {
    return (
      <div className="page-container page-container-ocean">
        <div className="card register-card container-narrow">
          <h1 className="page-title">Документы загружены</h1>
          <div className="alert alert-success">
            <p><strong>Документы успешно загружены!</strong></p>
            <p style={{ marginTop: '1rem' }}>
              Ваши документы отправлены на проверку. Ожидайте рассмотрения администратором.
            </p>
            <p style={{ marginTop: '1rem' }}>
              Вы будете перенаправлены в личный кабинет...
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container page-container-ocean">
      <div className="card register-card container-narrow">
        <h1 className="page-title">Верификация</h1>
        
        <p style={{ marginBottom: '1.5rem', color: 'var(--stone)' }}>
          Для продолжения работы необходимо загрузить документы для верификации.
          Загрузите все необходимые документы и фотографии одним или несколькими файлами.
        </p>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: '1.5rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="form">
          <div className="form-group">
            <label htmlFor="documents" className="form-label">
              Документы и фотографии *
            </label>
            <input
              type="file"
              id="documents"
              multiple
              accept="image/*,.pdf,.doc,.docx"
              onChange={handleFileChange}
              className="form-input"
              disabled={loading}
            />
            <small className="form-hint">
              Вы можете выбрать несколько файлов. Поддерживаются изображения (JPG, PNG) и документы (PDF, DOC, DOCX)
            </small>
          </div>

          {files.length > 0 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Выбранные файлы:</h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {files.map((file, index) => (
                  <li
                    key={index}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.5rem',
                      marginBottom: '0.5rem',
                      backgroundColor: 'var(--ocean-light)',
                      borderRadius: '4px'
                    }}
                  >
                    <span style={{ fontSize: '0.875rem' }}>{file.name}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(index)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--ocean-deep)',
                        cursor: 'pointer',
                        fontSize: '1.2rem',
                        padding: '0 0.5rem'
                      }}
                      disabled={loading}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary btn-full"
            disabled={loading || files.length === 0}
          >
            {loading ? 'Загрузка...' : 'Отправить на проверку'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default Verification

