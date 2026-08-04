import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { API_BASE } from '../config'
import { olive, sand } from '../theme'
import logoImg from '../assets/logo.png'

export default function Callback({ onLogin }) {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [errorMsg, setErrorMsg] = useState('')
  const [statusStep, setStatusStep] = useState(0)

  // Rotate status messages for a more premium experience
  useEffect(() => {
    if (errorMsg) return
    const interval = setInterval(() => {
      setStatusStep(prev => (prev < 2 ? prev + 1 : prev))
    }, 1000)
    return () => clearInterval(interval)
  }, [errorMsg])

  useEffect(() => {
    const code = searchParams.get('code')
    const existingToken = localStorage.getItem('token')
    
    // If we have an existing token but no new code, we can redirect directly
    if (existingToken && !code) {
      navigate('/', { replace: true })
      return
    }

    if (!code) {
      setErrorMsg('No authorization code provided by GitHub')
      setTimeout(() => navigate('/login', { replace: true }), 3500)
      return
    }

    axios.post(`${API_BASE}/api/auth/github`, { code })
      .then(res => {
        // Delay slightly for smooth animation progression
        setTimeout(() => {
          onLogin(res.data.token, res.data.username)
          navigate('/', { replace: true })
        }, 1200)
      })
      .catch(err => {
        const msg = err.response?.data?.detail || 'Authentication failed. Please try again.'
        setErrorMsg(msg)
        setTimeout(() => navigate('/login', { replace: true }), 3500)
      })
  }, [searchParams, onLogin, navigate])

  const statusMessages = [
    'Exchanging authorization credentials...',
    'Establishing secure workspace session...',
    'Syncing developer workspace. Redirecting...'
  ]

  return (
    <div style={{
      minHeight: '100vh',
      background: sand.bg,
      backgroundImage: 'radial-gradient(rgba(122, 133, 90, 0.12) 1.5px, transparent 0)',
      backgroundSize: '24px 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Decorative Blur Blobs */}
      <div style={{
        position: 'absolute', top: '25%', left: '20%',
        width: '40vw', height: '40vw', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(122, 133, 90, 0.08) 0%, rgba(245, 243, 236, 0) 70%)',
        filter: 'blur(50px)', pointerEvents: 'none'
      }} />

      <div style={{
        width: '100%',
        maxWidth: '420px',
        background: 'rgba(253, 252, 248, 0.65)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(253, 252, 248, 0.8)',
        borderRadius: '24px',
        padding: '40px 32px',
        textAlign: 'center',
        boxShadow: '0 12px 40px rgba(42, 45, 34, 0.025)',
        zIndex: 1,
        animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) both'
      }}>
        {!errorMsg ? (
          <div>
            {/* Pulsing secure link animation */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '24px',
              marginBottom: '32px',
              position: 'relative'
            }}>
              {/* GitHub Logo */}
              <div style={{
                width: '56px', height: '56px', borderRadius: '16px',
                background: '#1f2328', display: 'flex', alignItems: 'center',
                justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                animation: 'pulseGlow 2s infinite alternate ease-in-out'
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="#ffffff">
                  <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.579.688.481C19.137 20.162 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
                </svg>
              </div>

              {/* Pulsing connection line */}
              <div style={{
                width: '60px', height: '3px', background: `linear-gradient(90deg, #1f2328, ${olive[500]})`,
                borderRadius: '2px', position: 'relative', overflow: 'hidden'
              }}>
                <div style={{
                  position: 'absolute', top: 0, left: 0, height: '100%',
                  width: '20px', background: '#ffffff', filter: 'blur(2px)',
                  animation: 'pulseLine 1.4s infinite ease-in-out'
                }} />
              </div>

              {/* Figent Logo */}
              <div style={{
                width: '56px', height: '56px', borderRadius: '16px',
                background: olive[50], border: `1px solid ${olive[200]}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(42, 45, 34, 0.04)',
                animation: 'pulseGlowOlive 2s infinite alternate ease-in-out'
              }}>
                <img src={logoImg} alt="Figent" style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
              </div>
            </div>

            {/* Spinner */}
            <div style={{
              width: '24px', height: '24px', margin: '0 auto 20px',
              border: `2px solid ${sand[200]}`, borderTopColor: olive[600],
              borderRadius: '50%', animation: 'spin 0.6s linear infinite'
            }} />

            {/* Status steps */}
            <div style={{
              fontSize: '14.5px', color: sand[950], fontWeight: 750,
              letterSpacing: '-0.2px', marginBottom: '6px',
              minHeight: '22px', transition: 'all 0.3s'
            }}>
              {statusMessages[statusStep]}
            </div>
            <div style={{ fontSize: '12px', color: sand[500], fontWeight: 600 }}>
              Do not close this window
            </div>
          </div>
        ) : (
          <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            {/* Error state */}
            <div style={{
              width: '48px', height: '48px', borderRadius: '50%',
              background: '#fef2f2', border: '1px solid #fca5a5',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#b91c1c', margin: '0 auto 20px'
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                  stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            
            <h3 style={{ color: sand[950], fontSize: '17px', fontWeight: 800, margin: '0 0 8px', letterSpacing: '-0.3px' }}>
              Authentication Error
            </h3>
            
            <p style={{ color: '#7f1d1d', fontSize: '13px', margin: '0 0 20px', fontWeight: 600, lineHeight: 1.5 }}>
              {errorMsg}
            </p>
            
            <div style={{ fontSize: '11px', color: sand[500], fontWeight: 600 }}>
              Redirecting back to login...
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pulseLine {
          0% { left: -30%; }
          100% { left: 110%; }
        }
        @keyframes pulseGlow {
          0% { box-shadow: 0 4px 12px rgba(31, 35, 40, 0.08); }
          100% { box-shadow: 0 4px 20px rgba(31, 35, 40, 0.25); }
        }
        @keyframes pulseGlowOlive {
          0% { box-shadow: 0 4px 12px rgba(122, 133, 90, 0.04); }
          100% { box-shadow: 0 4px 20px rgba(122, 133, 90, 0.2); }
        }
        @keyframes slideUp {
          from { transform: translateY(16px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
