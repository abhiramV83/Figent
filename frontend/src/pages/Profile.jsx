import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { API_BASE } from '../config'
import { olive, sand } from '../theme'

export default function Profile({ token, onAuthError }) {
  const [profile, setProfile] = useState(null)
  const [reviewsCount, setReviewsCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    if (!token) return

    // 1. Fetch user profile
    const fetchProfile = axios.get(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    })

    // 2. Fetch reviews history for stats
    const fetchReviews = axios.get(`${API_BASE}/api/reviews`, {
      headers: { Authorization: `Bearer ${token}` }
    })

    Promise.all([fetchProfile, fetchReviews])
      .then(([profileRes, reviewsRes]) => {
        setProfile(profileRes.data)
        setReviewsCount(reviewsRes.data.length || 0)
        setLoading(false)
      })
      .catch(err => {
        if (err.response?.status === 401 && onAuthError) {
          onAuthError()
        } else {
          setError('Failed to load profile details.')
          setLoading(false)
        }
      })
  }, [token, onAuthError])

  if (loading) {
    return (
      <div style={{ minHeight: 'calc(100vh - 10rem)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          border: `2.5px solid ${sand[300]}`, borderTopColor: olive[600],
          animation: 'spin 0.75s linear infinite'
        }} />
      </div>
    )
  }

  const isGuest = profile?.username?.startsWith('guest_')
  const userType = isGuest ? 'Guest Session' : 'GitHub Authenticated User'

  return (
    <div style={{ maxWidth: '640px', margin: '40px auto', padding: '0 24px' }}>
      {/* Back link */}
      <button onClick={() => navigate('/')} style={{
        background: 'none', border: 'none', color: sand[600],
        fontSize: '12px', cursor: 'pointer', marginBottom: '24px', padding: 0,
        display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 700
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
            stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Back to Dashboard
      </button>

      {/* Main card */}
      <div style={{
        background: sand[50],
        border: `1px solid ${sand[200]}`,
        borderRadius: '20px',
        padding: '32px',
        boxShadow: '0 8px 30px rgba(42, 45, 34, 0.04)',
        animation: 'slideIn 0.4s ease-out'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '28px', flexWrap: 'wrap' }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: olive[100], border: `2.5px solid ${olive[300]}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '24px', fontWeight: 800, color: olive[700], textTransform: 'uppercase'
          }}>
            {profile?.username?.[0] || 'U'}
          </div>
          <div>
            <h2 style={{ color: sand[950], fontSize: '20px', fontWeight: 800, margin: '0 0 4px', letterSpacing: '-0.4px' }}>
              {profile?.username}
            </h2>
            <span style={{
              background: isGuest ? sand[200] : olive[100],
              color: isGuest ? sand[700] : olive[700],
              border: `1px solid ${isGuest ? sand[300] : olive[200]}`,
              fontSize: '10px', fontWeight: 800, textTransform: 'uppercase',
              letterSpacing: '0.05em', borderRadius: '6px', padding: '2px 8px'
            }}>
              {userType}
            </span>
          </div>
        </div>

        {/* Info Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderTop: `1px solid ${sand[200]}`, paddingTop: '20px' }}>
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: sand[500], marginBottom: '4px' }}>
              Email Address
            </div>
            <div style={{ fontSize: '13.5px', color: sand[950], fontWeight: 600 }}>
              {profile?.email || 'No email associated'}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: sand[500], marginBottom: '4px' }}>
              Account Limit
            </div>
            <div style={{ fontSize: '13.5px', color: sand[950], fontWeight: 600 }}>
              {isGuest ? '1 free code review audit' : 'Unlimited code review audits (GitHub Level)'}
            </div>
          </div>

          {/* Stats Box */}
          <div style={{
            background: sand[100],
            border: `1px solid ${sand[200]}`,
            borderRadius: '12px',
            padding: '16px 20px',
            marginTop: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: sand[800] }}>
                Total Audits Completed
              </div>
              <div style={{ fontSize: '11px', color: sand[500], marginTop: '2px', fontWeight: 500 }}>
                Repositories audited using AI agents
              </div>
            </div>
            <div style={{ fontSize: '32px', fontWeight: 800, color: olive[600] }}>
              {reviewsCount}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
