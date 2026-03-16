import { useState, useEffect } from 'react'
import { FiDownload, FiX, FiShare } from 'react-icons/fi'
import './InstallPrompt.css'

const DISMISSED_KEY = 'pwa-install-dismissed'
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function isInStandaloneMode() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    navigator.standalone === true
}

const InstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [showIOSHint, setShowIOSHint] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (isInStandaloneMode()) return

    const dismissed = localStorage.getItem(DISMISSED_KEY)
    if (dismissed && Date.now() - Number(dismissed) < DISMISS_DURATION_MS) {
      return
    }

    if (isIOS()) {
      setShowIOSHint(true)
      setVisible(true)
      return
    }

    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setVisible(true)
    }

    window.addEventListener('beforeinstallprompt', handler)

    const installedHandler = () => {
      setVisible(false)
      setDeferredPrompt(null)
    }
    window.addEventListener('appinstalled', installedHandler)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', installedHandler)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setVisible(false)
    }
    setDeferredPrompt(null)
  }

  const handleDismiss = () => {
    setVisible(false)
    localStorage.setItem(DISMISSED_KEY, String(Date.now()))
    setDeferredPrompt(null)
  }

  if (!visible) return null

  return (
    <div className="install-prompt">
      <div className="install-prompt-content">
        {showIOSHint ? (
          <>
            <FiShare className="install-prompt-icon" />
            <div className="install-prompt-text">
              <strong>Установите приложение</strong>
              <span>
                Нажмите <FiShare className="install-prompt-inline-icon" /> и выберите «На экран "Домой"»
              </span>
            </div>
          </>
        ) : (
          <>
            <FiDownload className="install-prompt-icon" />
            <div className="install-prompt-text">
              <strong>Установите приложение</strong>
              <span>Быстрый доступ к бронированию</span>
            </div>
            <button className="install-prompt-btn" onClick={handleInstall}>
              Установить
            </button>
          </>
        )}
        <button className="install-prompt-close" onClick={handleDismiss} aria-label="Закрыть">
          <FiX />
        </button>
      </div>
    </div>
  )
}

export default InstallPrompt
