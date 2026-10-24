import { useState } from 'react'
import { fieldErrorsOf, friendlyError } from '../../api/client'
import { sendContactInquiry } from '../../api/publicApi'
import Icon from '../../components/Icon'
import { NAME_ERROR, NAME_PATTERN } from '../../utils/validators'
import Reveal from './Reveal'

const EMPTY = { name: '', email: '', phone: '', message: '', website: '' }
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_PATTERN = /^\+?[0-9\s()-]+$/

// Browser me jaldi check (server wahi rules phir se check karta hai).
function validate(values) {
  const found = {}
  const digits = values.phone.replace(/\D/g, '').length
  if (values.name.trim().length < 2) found.name = 'Please enter your full name.'
  else if (!NAME_PATTERN.test(values.name.trim())) found.name = NAME_ERROR
  if (!EMAIL_PATTERN.test(values.email.trim())) found.email = 'Please enter a valid email address.'
  if (!PHONE_PATTERN.test(values.phone.trim())) found.phone = 'Phone me sirf numbers (aur + - ( )) hon, letters nahi.'
  else if (digits < 7 || digits > 15) found.phone = 'Please enter a valid phone number (7 to 15 digits).'
  if (values.message.trim().length < 10) found.message = 'Please write a short message (at least 10 characters).'
  return found
}

// Contact Us form: koi bhi (login ke bina) bhej sakta hai. Sawaal database me save hota hai aur Super Admin ko dikhta hai.
export default function ContactSection() {
  const [values, setValues] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [sending, setSending] = useState(false)
  const [sentName, setSentName] = useState('')

  function setField(name, value) {
    setValues({ ...values, [name]: value })
    if (errors[name]) setErrors({ ...errors, [name]: undefined })
  }

  // Field chhodte hi (blur) sirf usi field ko check karo
  function checkField(name) {
    const message = validate(values)[name]
    setErrors((current) => ({ ...current, [name]: message }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (sending) return
    const found = validate(values)
    setErrors(found)
    setFormError('')
    if (Object.keys(found).length > 0) return

    setSending(true)
    try {
      await sendContactInquiry({
        name: values.name.trim(),
        email: values.email.trim(),
        phone: values.phone.trim(),
        message: values.message.trim(),
        website: values.website,
      })
      setSentName(values.name.trim())
      setValues(EMPTY)
    } catch (error) {
      const serverErrors = fieldErrorsOf(error)
      if (Object.keys(serverErrors).length > 0) setErrors(serverErrors)
      setFormError(friendlyError(error))
      setSentName('')
    } finally {
      setSending(false)
    }
  }

  const fieldClass = (name) => (errors[name] ? 'lp-field lp-field--error' : 'lp-field')

  return (
    <section id="contact" className="lp-section lp-section--beige" aria-labelledby="lp-contact-title">
      <div className="lp-container lp-contact">
        <Reveal>
          <div className="lp-contact__copy">
            <p className="lp-eyebrow lp-eyebrow--dark">Contact</p>
            <h2 id="lp-contact-title">Questions? We would love to hear from you</h2>
            <p>Tell us about your salon and what you would like to manage better. We will help you find the right way to start.</p>
            <ul className="lp-contact__list">
              <li>
                <Icon name="user" size={18} /> Friendly, human help
              </li>
              <li>
                <Icon name="clock" size={18} /> Quick to set up
              </li>
              <li>
                <Icon name="shield" size={18} /> Your details stay private
              </li>
            </ul>
          </div>
        </Reveal>

        <Reveal delay={120}>
          <form className="lp-form" onSubmit={handleSubmit} noValidate>
            {sentName && (
              <p className="lp-form__notice" role="status">
                Thank you, {sentName}! Your message has been sent. Our team will get back to you soon.
              </p>
            )}
            {formError && (
              <p className="lp-form__notice lp-form__notice--error" role="alert">
                {formError}
              </p>
            )}

            <div className={fieldClass('name')}>
              <label htmlFor="lp-name">Full name</label>
              <input id="lp-name" onBlur={() => checkField('name')} value={values.name} onChange={(e) => setField('name', e.target.value)} autoComplete="off" maxLength={100} aria-invalid={Boolean(errors.name)} />
              {errors.name && <p className="lp-field__error">{errors.name}</p>}
            </div>

            <div className="lp-form__row">
              <div className={fieldClass('email')}>
                <label htmlFor="lp-email">Email</label>
                <input id="lp-email" onBlur={() => checkField('email')} type="email" value={values.email} onChange={(e) => setField('email', e.target.value)} autoComplete="email" maxLength={254} aria-invalid={Boolean(errors.email)} />
                {errors.email && <p className="lp-field__error">{errors.email}</p>}
              </div>

              <div className={fieldClass('phone')}>
                <label htmlFor="lp-phone">Phone number</label>
                <input id="lp-phone" onBlur={() => checkField('phone')} type="tel" value={values.phone} onChange={(e) => setField('phone', e.target.value)} autoComplete="tel" maxLength={20} aria-invalid={Boolean(errors.phone)} />
                {errors.phone && <p className="lp-field__error">{errors.phone}</p>}
              </div>
            </div>

            <div className={fieldClass('message')}>
              <label htmlFor="lp-message">How can we help?</label>
              <textarea id="lp-message" onBlur={() => checkField('message')} rows={4} value={values.message} onChange={(e) => setField('message', e.target.value)} maxLength={2000} aria-invalid={Boolean(errors.message)} />
              {errors.message && <p className="lp-field__error">{errors.message}</p>}
            </div>

            {/* Spam jaal: insaan ko dikhta nahi, bot bhar deta hai. Server aisa sawaal save nahi karta. */}
            <div className="lp-hp" aria-hidden="true">
              <label htmlFor="lp-website">Leave this empty</label>
              <input id="lp-website" tabIndex={-1} autoComplete="off" value={values.website} onChange={(e) => setField('website', e.target.value)} />
            </div>

            <button type="submit" className="lp-btn lp-btn--dark" disabled={sending}>
              {sending ? 'Sending…' : 'Send message'}
            </button>
          </form>
        </Reveal>
      </div>
    </section>
  )
}
