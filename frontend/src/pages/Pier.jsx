import { FiAnchor } from 'react-icons/fi'
import '../styles/Pier.css'

const Pier = () => {
  return (
    <div className="pier-page">
      <div className="pier-placeholder">
        <FiAnchor className="pier-placeholder-icon" />
        <h1 className="pier-placeholder-title">Причал</h1>
        <p className="pier-placeholder-text">Скоро здесь появится информация о причале</p>
      </div>
    </div>
  )
}

export default Pier
