import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { API_BASE } from '../config'
import { sand } from '../theme'

export default function Callback({ onLogin }) {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    // If user is already logged in, immediately redirect to dashboard
    const existingToken = localStorage.getItem('token')
    if (existingToken) {
      navigate('/', { replace: true })
      return
    }

    const code = searchParams.get('code')
    if (!code) {
      setErrorMsg('No authorization code provided by GitHub')
      setTimeout(() => navigate('/login', { replace: true }), 3000)
      return
    }

    axios.post(`${API_BASE}/api/auth/github`, { code })
      .then(res => {
        onLogin(res.data.token, res.data.username)
        navigate('/', { replace: true })
      })
      .catch(err => {
        const msg = err.response?.data?.detail || 'Authentication failed. Please try again.'
        setErrorMsg(msg)
        setTimeout(() => navigate('/login', { replace: true }), 3000)
      })
  }, [searchParams, onLogin, navigate])

  return (
    <div style={{ minHeight: '100vh', background: sand.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', textAlign: 'center' }}>
        {!errorMsg ? (
          <>
            <div style={{
              width: '28px',
              height: '28px',
              border: '2.5px solid #e5e3d9',
              borderTopColor: '#4a5c2d',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite'
            }}></div>
            <style>{`
              @keyframes spin {
                to { transform: rotate(360deg); }
              }
            `}</style>
            <div style={{ fontSize: '14px', color: sand[800], fontWeight: 700 }}>
              Authenticating with GitHub...
            </div>
          </>
        ) : (
          <div style={{ background: '#fdf0ee', border: '1px solid #e8c4bc', borderRadius: '12px', color: '#7a2d1e', fontSize: '13px', fontWeight: 700, padding: '16px 24px', maxWidth: '340px' }}>
            {errorMsg}
            <div style={{ fontSize: '11px', color: '#9b4b3b', marginTop: '6px', fontWeight: 500 }}>
              Redirecting back to login...
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
