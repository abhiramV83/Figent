import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { API_BASE } from '../config'
import { olive, sand } from '../theme'

export default function Support({ token, onAuthError }) {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: 'Request Higher File Limit',
    message: 'Hello Figent Team,\n\nI would like to request an upgrade to my account to allow scanning more files in my projects.'
  })
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Fetch user details on mount to pre-fill form
  useEffect(() => {
    if (!token) return
    axios.get(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(res => {
      const { username, email } = res.data
      setFormData(prev => ({
        ...prev,
        name: username || '',
        email: (email && !email.endsWith('@figent.com')) ? email : ''
      }))
    })
    .catch(err => {
      if (err.response?.status === 401 && onAuthError) {
        onAuthError()
      }
    })
  }, [token, onAuthError])

  const handleSubmit = (e) => {
    e.preventDefault()
    setSubmitting(true)
    axios.post(`${API_BASE}/api/support/ticket`, formData, {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(() => {
      setSubmitting(false)
      setSubmitted(true)
    })
    .catch(err => {
      setSubmitting(false)
      alert(err.response?.data?.detail || 'Failed to submit support ticket. Please try again.')
    })
  }

  return (
    <div style={{
      minHeight: 'calc(100vh - 4rem)',
      padding: '40px 24px 80px',
      background: 'transparent',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center'
    }}>
      <div style={{ maxWidth: '650px', width: '100%' }}>
        
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <button onClick={() => navigate('/')}
            style={{
              background: 'none', border: 'none', color: sand[600],
              fontSize: '13px', cursor: 'pointer', marginBottom: '24px',
              display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700
            }}
            onMouseEnter={e => e.currentTarget.style.color = olive[600]}
            onMouseLeave={e => e.currentTarget.style.color = sand[600]}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
                stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Back to Dashboard
          </button>
          
          <h1 style={{ color: sand[950], fontSize: '32px', fontWeight: 800, letterSpacing: '-0.8px', margin: '0 0 12px' }}>
            Support Desk
          </h1>
          <p style={{ color: sand[600], fontSize: '15px', fontWeight: 600, margin: '0 auto' }}>
            Need help or want to request custom file limit overrides for your audits? Message our development team below.
          </p>
        </div>

        {/* Contact Form Section */}
        <div style={{
          background: 'rgba(253, 252, 248, 0.55)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(253, 252, 248, 0.65)',
          borderRadius: '24px',
          padding: '40px',
          boxShadow: '0 8px 32px rgba(42, 45, 34, 0.01)'
        }}>
          <h2 style={{ color: sand[950], fontSize: '20px', fontWeight: 800, margin: '0 0 8px', letterSpacing: '-0.3px' }}>
            Developer Support Mailbox
          </h2>
          <p style={{ color: sand[600], fontSize: '13.5px', fontWeight: 600, margin: '0 0 28px' }}>
            Fill out the form below and we will review your account status and respond within 24 hours.
          </p>

          {submitted ? (
            <div style={{
              textAlign: 'center', padding: '24px', background: olive[50],
              border: `1px solid ${olive[200]}`, borderRadius: '14px',
              animation: 'fadeIn 0.4s ease-out'
            }}>
              <div style={{
                width: '44px', height: '44px', borderRadius: '50%', background: olive[100],
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: olive[700],
                margin: '0 auto 16px'
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path d="M4.5 12.75l6 6 9-13.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h4 style={{ color: sand[950], fontWeight: 800, fontSize: '16px', margin: '0 0 6px' }}>Message Sent Successfully</h4>
              <p style={{ color: sand[700], fontSize: '13px', margin: 0, fontWeight: 600, lineHeight: 1.5 }}>
                Thank you! Your ticket has been logged. Our developers will get back to you at the provided email within 24 hours.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label htmlFor="name" style={{ display: 'block', color: sand[800], fontSize: '11px', fontWeight: 800, marginBottom: '6px', letterSpacing: '0.05em' }}>NAME</label>
                  <input
                    id="name"
                    required
                    type="text"
                    placeholder="Jane Doe"
                    value={formData.name}
                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    style={{
                      width: '100%', padding: '11px 14px', background: sand[100],
                      border: `1px solid ${sand[200]}`, borderRadius: '10px',
                      fontSize: '13.5px', color: sand[950], fontWeight: 600, outline: 'none'
                    }}
                    onFocus={e => e.target.style.borderColor = olive[500]}
                    onBlur={e => e.target.style.borderColor = sand[200]}
                  />
                </div>
                <div>
                  <label htmlFor="email" style={{ display: 'block', color: sand[800], fontSize: '11px', fontWeight: 800, marginBottom: '6px', letterSpacing: '0.05em' }}>EMAIL ADDRESS</label>
                  <input
                    id="email"
                    required
                    type="email"
                    placeholder="jane@example.com"
                    value={formData.email}
                    readOnly
                    style={{
                      width: '100%', padding: '11px 14px', background: sand[200],
                      border: `1px solid ${sand[300]}`, borderRadius: '10px',
                      fontSize: '13.5px', color: sand[700], fontWeight: 600, outline: 'none',
                      cursor: 'not-allowed'
                    }}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="subject" style={{ display: 'block', color: sand[800], fontSize: '11px', fontWeight: 800, marginBottom: '6px', letterSpacing: '0.05em' }}>SUBJECT</label>
                <input
                  id="subject"
                  required
                  type="text"
                  placeholder="Subject of inquiry"
                  value={formData.subject}
                  onChange={e => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                  style={{
                    width: '100%', padding: '11px 14px', background: sand[100],
                    border: `1px solid ${sand[200]}`, borderRadius: '10px',
                    fontSize: '13.5px', color: sand[950], fontWeight: 600, outline: 'none'
                  }}
                  onFocus={e => e.target.style.borderColor = olive[500]}
                  onBlur={e => e.target.style.borderColor = sand[200]}
                />
              </div>

              <div>
                <label htmlFor="message" style={{ display: 'block', color: sand[800], fontSize: '11px', fontWeight: 800, marginBottom: '6px', letterSpacing: '0.05em' }}>MESSAGE</label>
                <textarea
                  id="message"
                  required
                  rows="4"
                  placeholder="How can we help you?"
                  value={formData.message}
                  onChange={e => setFormData(prev => ({ ...prev, message: e.target.value }))}
                  style={{
                    width: '100%', padding: '11px 14px', background: sand[100],
                    border: `1px solid ${sand[200]}`, borderRadius: '10px',
                    fontSize: '13.5px', color: sand[950], fontWeight: 600, outline: 'none',
                    resize: 'vertical', fontFamily: 'inherit'
                  }}
                  onFocus={e => e.target.style.borderColor = olive[500]}
                  onBlur={e => e.target.style.borderColor = sand[200]}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                style={{
                  width: '100%',
                  background: submitting ? sand[200] : olive[600],
                  color: submitting ? sand[500] : '#f7f9eb',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '13px 24px',
                  fontSize: '13.5px',
                  fontWeight: 750,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s',
                  boxShadow: submitting ? 'none' : `0 4px 12px ${olive[400]}33`
                }}
                onMouseEnter={e => { if (!submitting) e.currentTarget.style.backgroundColor = olive[700] }}
                onMouseLeave={e => { if (!submitting) e.currentTarget.style.backgroundColor = olive[600] }}
              >
                {submitting ? 'Sending Request...' : 'Send Message'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
