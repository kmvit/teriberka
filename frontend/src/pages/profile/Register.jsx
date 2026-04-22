import { useState, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import ReCAPTCHA from 'react-google-recaptcha'
import { authAPI } from '../../services/api'
import '../../styles/Register.css'

// Site Key (публичный) — НЕ путать с Secret Key! В .env backend нужен Secret Key
const RECAPTCHA_SITE_KEY = (import.meta.env.VITE_RECAPTCHA_SITE_KEY || '').trim()

const REG_TYPE_EMAIL = 'email'
const REG_TYPE_PHONE = 'phone'

const Register = () => {
  const navigate = useNavigate()
  const [regType, setRegType] = useState(REG_TYPE_EMAIL)
  const [formData, setFormData] = useState({
    email: '',
    first_name: '',
    last_name: '',
    phone: '',
    password: '',
    password_confirm: '',
    role: 'customer',
    // для регистрации по телефону
    code: '',
  })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [registeredEmail, setRegisteredEmail] = useState('')
  const [phoneCodeSent, setPhoneCodeSent] = useState(false)
  const [codeCooldown, setCodeCooldown] = useState(0)
  const [showPassword, setShowPassword] = useState(false)
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false)
  const recaptchaRef = useRef(null)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[name]
        return newErrors
      })
    }
  }

  const switchRegType = (type) => {
    setRegType(type)
    setErrors({})
    setSuccess(false)
    setPhoneCodeSent(false)
    setFormData((prev) => ({
      ...prev,
      code: '',
    }))
  }

  const validateEmailForm = () => {
    const newErrors = {}
    if (!formData.email.trim()) {
      newErrors.email = 'Email обязателен'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Неверный формат email'
    }
    if (!formData.first_name.trim()) {
      newErrors.first_name = 'Имя обязательно'
    } else if (formData.first_name.trim().length < 2) {
      newErrors.first_name = 'Имя должно содержать минимум 2 символа'
    }
    if (!formData.phone.trim()) {
      newErrors.phone = 'Телефон обязателен'
    }
    if (!formData.password) {
      newErrors.password = 'Пароль обязателен'
    } else if (formData.password.length < 8) {
      newErrors.password = 'Пароль должен содержать минимум 8 символов'
    }
    if (!formData.password_confirm) {
      newErrors.password_confirm = 'Подтверждение пароля обязательно'
    } else if (formData.password !== formData.password_confirm) {
      newErrors.password_confirm = 'Пароли не совпадают'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const validatePhoneForm = () => {
    const newErrors = {}
    if (!phoneCodeSent) {
      if (!formData.phone.trim()) {
        newErrors.phone = 'Введите номер телефона'
      } else if (!/^[+]?[\d\s\-()]{10,}$/.test(formData.phone.replace(/\s/g, ''))) {
        newErrors.phone = 'Неверный формат номера'
      }
    } else {
      if (!formData.code || formData.code.length !== 6) {
        newErrors.code = 'Введите 6-значный код из SMS'
      }
      if (formData.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
        newErrors.email = 'Неверный формат email'
      }
      if (!formData.first_name.trim()) {
        newErrors.first_name = 'Имя обязательно'
      } else if (formData.first_name.trim().length < 2) {
        newErrors.first_name = 'Имя должно содержать минимум 2 символа'
      }
      if (!formData.password) {
        newErrors.password = 'Пароль обязателен'
      } else if (formData.password.length < 8) {
        newErrors.password = 'Пароль должен содержать минимум 8 символов'
      }
      if (!formData.password_confirm) {
        newErrors.password_confirm = 'Подтверждение пароля обязательно'
      } else if (formData.password !== formData.password_confirm) {
        newErrors.password_confirm = 'Пароли не совпадают'
      }
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSendCode = async (e) => {
    e.preventDefault()
    if (!formData.phone.trim()) {
      setErrors({ phone: 'Введите номер телефона' })
      return
    }
    if (!/^[+]?[\d\s\-()]{10,}$/.test(formData.phone.replace(/\s/g, ''))) {
      setErrors({ phone: 'Неверный формат номера' })
      return
    }
    if (RECAPTCHA_SITE_KEY && !recaptchaRef.current?.getValue?.()) {
      setErrors({ captcha_token: 'Подтвердите, что вы не робот' })
      return
    }
    setLoading(true)
    setErrors({})
    try {
      const captchaToken = RECAPTCHA_SITE_KEY ? recaptchaRef.current?.getValue?.() || '' : ''
      await authAPI.sendPhoneCode(formData.phone, captchaToken)
      setPhoneCodeSent(true)
      setCodeCooldown(60)
      recaptchaRef.current?.reset?.()
      const interval = setInterval(() => {
        setCodeCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(interval)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } catch (error) {
      const data = error.response?.data
      const msg = data?.phone?.[0] || data?.captcha_token?.[0] || data?.detail || 'Не удалось отправить код. Попробуйте позже.'
      setErrors({
        ...(data?.phone && { phone: data.phone[0] }),
        ...(data?.captcha_token && { captcha_token: data.captcha_token[0] }),
        ...(!data?.phone && !data?.captcha_token && { phone: msg }),
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitEmail = async (e) => {
    e.preventDefault()
    if (!validateEmailForm()) return
    setLoading(true)
    setErrors({})
    try {
      const response = await authAPI.register({
        email: formData.email,
        first_name: formData.first_name,
        last_name: formData.last_name || '',
        phone: formData.phone,
        password: formData.password,
        password_confirm: formData.password_confirm,
        role: formData.role,
        client: 'web',
      })
      setSuccess(true)
      setRegisteredEmail(response.email || formData.email)
    } catch (error) {
      formatAndSetErrors(error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitPhone = async (e) => {
    e.preventDefault()
    if (!validatePhoneForm()) return
    setLoading(true)
    setErrors({})
    try {
      const response = await authAPI.registerByPhone({
        phone: formData.phone,
        code: formData.code,
        email: formData.email?.trim() || '',
        first_name: formData.first_name,
        last_name: formData.last_name || '',
        password: formData.password,
        password_confirm: formData.password_confirm,
        role: formData.role,
      })
      if (response.token) {
        localStorage.setItem('token', response.token)
        if (response.user) {
          localStorage.setItem('user', JSON.stringify(response.user))
        }
        navigate('/profile')
      } else {
        setSuccess(true)
      }
    } catch (error) {
      formatAndSetErrors(error)
    } finally {
      setLoading(false)
    }
  }

  const formatAndSetErrors = (error) => {
    const data = error.response?.data
    if (!data) {
      setErrors({ general: 'Произошла ошибка. Попробуйте еще раз.' })
      return
    }
    const formatted = {}
    Object.keys(data).forEach((key) => {
      const val = data[key]
      if (Array.isArray(val)) formatted[key] = val[0]
      else if (val?.non_field_errors) formatted.general = val.non_field_errors[0]
      else if (typeof val === 'object') formatted[key] = Object.values(val)[0]
      else formatted[key] = val
    })
    if (data.non_field_errors) {
      formatted.general = Array.isArray(data.non_field_errors)
        ? data.non_field_errors[0]
        : data.non_field_errors
    }
    setErrors(formatted)
  }

  const formatInput = (type) => ({
    position: 'absolute',
    right: '10px',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '5px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--stone)',
    fontSize: '1.2rem',
  })

  return (
    <div className="page-container">
      <div className="card register-card container-narrow">
        <h1 className="page-title">Регистрация</h1>

        {/* Выбор способа регистрации */}
        <div className="register-type-tabs" style={{ marginBottom: '1.5rem' }}>
          <button
            type="button"
            className={`register-tab ${regType === REG_TYPE_EMAIL ? 'active' : ''}`}
            onClick={() => switchRegType(REG_TYPE_EMAIL)}
          >
            Через email
          </button>
          <button
            type="button"
            className={`register-tab ${regType === REG_TYPE_PHONE ? 'active' : ''}`}
            onClick={() => switchRegType(REG_TYPE_PHONE)}
          >
            Через телефон
          </button>
        </div>

        {regType === REG_TYPE_EMAIL && success ? (
          <div className="alert alert-success">
            <p><strong>Регистрация успешна!</strong></p>
            <p style={{ marginTop: '1rem' }}>
              На ваш email <strong>{registeredEmail}</strong> отправлено письмо с подтверждением.
            </p>
            <p style={{ marginTop: '0.5rem' }}>
              Пожалуйста, проверьте почту и перейдите по ссылке для активации аккаунта.
            </p>
            <p style={{ marginTop: '1rem' }}>
              <Link to="/login">Перейти к входу</Link>
            </p>
          </div>
        ) : regType === REG_TYPE_EMAIL ? (
          <>
            {errors.general && <div className="alert alert-error">{errors.general}</div>}
            <form onSubmit={handleSubmitEmail} className="form">
              <div className="form-group">
                <label htmlFor="email" className="form-label">Email *</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className={`form-input ${errors.email ? 'error' : ''}`}
                />
                {errors.email && <span className="form-error">{errors.email}</span>}
              </div>
              <div className="form-group">
                <label htmlFor="first_name" className="form-label">Имя *</label>
                <input
                  type="text"
                  id="first_name"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleChange}
                  className={`form-input ${errors.first_name ? 'error' : ''}`}
                  placeholder="Ваше имя"
                />
                {errors.first_name && <span className="form-error">{errors.first_name}</span>}
              </div>
              <div className="form-group">
                <label htmlFor="phone" className="form-label">Телефон *</label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+7 (999) 999-99-99"
                  className={`form-input ${errors.phone ? 'error' : ''}`}
                />
                {errors.phone && <span className="form-error">{errors.phone}</span>}
              </div>
              <div className="form-group">
                <label htmlFor="role" className="form-label">Роль *</label>
                <select
                  id="role"
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  className="form-select"
                >
                  <option value="customer">Клиент</option>
                  <option value="boat_owner">Владелец катера</option>
                  <option value="guide">Гид</option>
                  <option value="hotel">Гостиница</option>
                </select>
                <small className="form-hint">
                  {formData.role === 'boat_owner' &&
                    'Для владельцев катеров требуется верификация документов'}
                </small>
              </div>
              <div className="form-group">
                <label htmlFor="password" className="form-label">Пароль *</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    className={`form-input ${errors.password ? 'error' : ''}`}
                    style={{ paddingRight: '40px' }}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} style={formatInput()} tabIndex={-1}>
                    {showPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
                {errors.password && <span className="form-error">{errors.password}</span>}
              </div>
              <div className="form-group">
                <label htmlFor="password_confirm" className="form-label">Подтверждение пароля *</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPasswordConfirm ? 'text' : 'password'}
                    id="password_confirm"
                    name="password_confirm"
                    value={formData.password_confirm}
                    onChange={handleChange}
                    className={`form-input ${errors.password_confirm ? 'error' : ''}`}
                    style={{ paddingRight: '40px' }}
                  />
                  <button type="button" onClick={() => setShowPasswordConfirm(!showPasswordConfirm)} style={formatInput()} tabIndex={-1}>
                    {showPasswordConfirm ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
                {errors.password_confirm && (
                  <span className="form-error">{errors.password_confirm}</span>
                )}
              </div>
              <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                {loading ? 'Регистрация...' : 'Зарегистрироваться'}
              </button>
            </form>
          </>
        ) : (
          <>
            {errors.general && <div className="alert alert-error">{errors.general}</div>}
            <form onSubmit={phoneCodeSent ? handleSubmitPhone : handleSendCode} className="form">
              {!phoneCodeSent ? (
                <div className="form-group">
                  <label htmlFor="phone_reg" className="form-label">Номер телефона *</label>
                  <input
                    type="tel"
                    id="phone_reg"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="+7 (999) 999-99-99"
                    className={`form-input ${errors.phone ? 'error' : ''}`}
                  />
                  {errors.phone && <span className="form-error">{errors.phone}</span>}
                  {RECAPTCHA_SITE_KEY && (
                    <div className="recaptcha-wrapper form-group">
                      <ReCAPTCHA
                        ref={recaptchaRef}
                        sitekey={RECAPTCHA_SITE_KEY}
                        theme="light"
                        size="normal"
                        hl="ru"
                      />
                      {errors.captcha_token && (
                        <span className="form-error">{errors.captcha_token}</span>
                      )}
                      <p className="form-hint" style={{ marginTop: '0.25rem', fontSize: '0.85rem' }}>
                        Если капча не отображается, отключите блокировщик рекламы
                      </p>
                    </div>
                  )}
                  <p className="form-hint" style={{ marginTop: '0.5rem' }}>
                    На указанный номер будет отправлено SMS с кодом подтверждения
                  </p>
                  <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                    {loading ? 'Отправка...' : 'Получить код'}
                  </button>
                </div>
              ) : (
                <>
                  <div className="form-group">
                    <label className="form-label">Номер телефона</label>
                    <p style={{ margin: 0 }}>{formData.phone}</p>
                  </div>
                  <div className="form-group">
                    <label htmlFor="code" className="form-label">Код из SMS *</label>
                    <input
                      type="text"
                      id="code"
                      name="code"
                      value={formData.code}
                      onChange={handleChange}
                      placeholder="000000"
                      maxLength={6}
                      className={`form-input ${errors.code ? 'error' : ''}`}
                      style={{ letterSpacing: '0.5em', textAlign: 'center' }}
                    />
                    {errors.code && <span className="form-error">{errors.code}</span>}
                    {codeCooldown > 0 ? (
                      <p className="form-hint">Повторная отправка через {codeCooldown} сек.</p>
                    ) : (
                      <>
                        {RECAPTCHA_SITE_KEY && (
                          <div className="recaptcha-wrapper" style={{ marginTop: '0.5rem' }}>
                            <ReCAPTCHA
                              ref={recaptchaRef}
                              sitekey={RECAPTCHA_SITE_KEY}
                              theme="light"
                              size="normal"
                              hl="ru"
                            />
                            {errors.captcha_token && (
                              <span className="form-error">{errors.captcha_token}</span>
                            )}
                          </div>
                        )}
                        <button
                          type="button"
                          className="btn-link"
                          onClick={handleSendCode}
                          style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}
                        >
                          Отправить код повторно
                        </button>
                      </>
                    )}
                  </div>
                  <div className="form-group">
                    <label htmlFor="email_phone" className="form-label">Email (необязательно)</label>
                    <input
                      type="email"
                      id="email_phone"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      className={`form-input ${errors.email ? 'error' : ''}`}
                      placeholder="your@email.com"
                    />
                    {errors.email && <span className="form-error">{errors.email}</span>}
                  </div>
                  <div className="form-group">
                    <label htmlFor="first_name_phone" className="form-label">Имя *</label>
                    <input
                      type="text"
                      id="first_name_phone"
                      name="first_name"
                      value={formData.first_name}
                      onChange={handleChange}
                      className={`form-input ${errors.first_name ? 'error' : ''}`}
                      placeholder="Ваше имя"
                    />
                    {errors.first_name && <span className="form-error">{errors.first_name}</span>}
                  </div>
                  <div className="form-group">
                    <label htmlFor="last_name_phone" className="form-label">Фамилия</label>
                    <input
                      type="text"
                      id="last_name_phone"
                      name="last_name"
                      value={formData.last_name}
                      onChange={handleChange}
                      className="form-input"
                      placeholder="Фамилия (необязательно)"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="role_phone" className="form-label">Роль *</label>
                    <select
                      id="role_phone"
                      name="role"
                      value={formData.role}
                      onChange={handleChange}
                      className="form-select"
                    >
                      <option value="customer">Клиент</option>
                      <option value="boat_owner">Владелец катера</option>
                      <option value="guide">Гид</option>
                      <option value="hotel">Гостиница</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="password_phone" className="form-label">Пароль *</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        id="password_phone"
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        className={`form-input ${errors.password ? 'error' : ''}`}
                        style={{ paddingRight: '40px' }}
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} style={formatInput()} tabIndex={-1}>
                        {showPassword ? '👁️' : '👁️‍🗨️'}
                      </button>
                    </div>
                    {errors.password && <span className="form-error">{errors.password}</span>}
                  </div>
                  <div className="form-group">
                    <label htmlFor="password_confirm_phone" className="form-label">Подтверждение пароля *</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showPasswordConfirm ? 'text' : 'password'}
                        id="password_confirm_phone"
                        name="password_confirm"
                        value={formData.password_confirm}
                        onChange={handleChange}
                        className={`form-input ${errors.password_confirm ? 'error' : ''}`}
                        style={{ paddingRight: '40px' }}
                      />
                      <button type="button" onClick={() => setShowPasswordConfirm(!showPasswordConfirm)} style={formatInput()} tabIndex={-1}>
                        {showPasswordConfirm ? '👁️' : '👁️‍🗨️'}
                      </button>
                    </div>
                    {errors.password_confirm && (
                      <span className="form-error">{errors.password_confirm}</span>
                    )}
                  </div>
                  <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                    {loading ? 'Регистрация...' : 'Зарегистрироваться'}
                  </button>
                </>
              )}
            </form>
          </>
        )}

        <div className="page-footer">
          <p>
            Уже есть аккаунт? <Link to="/login">Войти</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default Register
