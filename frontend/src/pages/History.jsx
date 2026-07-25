import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { API_BASE } from '../config'
import { olive, sand } from '../theme'

export default function History({ token, onAuthError }) {
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    if (!token) return
    axios.get(`${API_BASE}/api/reviews`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(res => { setReviews(res.data); setLoading(false) })
    .catch(err => {
      setLoading(false)
      if (err.response?.status === 401 && onAuthError) {
        onAuthError()
      }
    })
  }, [token, onAuthError])

  const statusStyle = {
    complete: { color: olive[700], background: olive[100], border: `1px solid ${olive[200]}` },
    running: { color: '#7a5c00', background: '#fdf7e3', border: '1px solid #e5d48a' },
    failed: { color: '#8b3a2a', background: '#fdf0ee', border: '1px solid #e8c4bc' }
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 4rem)', background: sand.bg }}
      className="py-12 px-6"
    >
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '32px' }}>
          <div>
            <h1 style={{ color: sand[950], fontSize: '24px', fontWeight: 800, letterSpacing: '-0.3px', margin: 0 }}>
              Review History
            </h1>
            <p style={{ color: sand[700], fontSize: '13px', marginTop: '6px', fontWeight: 500 }}>
              All past repository analyses in your workspace
            </p>
          </div>
          <button
            onClick={() => navigate('/')}
            style={{
              background: olive[600],
              color: '#f7f9eb',
              border: 'none',
              borderRadius: '10px',
              padding: '10px 20px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'background-color 0.15s'
            }}
            onMouseEnter={e => e.target.style.backgroundColor = olive[700]}
            onMouseLeave={e => e.target.style.backgroundColor = olive[600]}
          >
            New Analysis
          </button>
        </div>

        {/* Divider */}
        <div style={{ height: '1px', background: sand[200], marginBottom: '24px' }}></div>

        {loading && (
          <div style={{ textAlign: 'center', color: sand[600], padding: '48px 0', fontSize: '13px', fontWeight: 600 }}>
            Loading...
          </div>
        )}

        {!loading && reviews.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '64px 32px',
            background: sand[50], border: `1px dashed ${sand[200]}`, borderRadius: '14px'
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: '12px',
              background: olive[100], border: `1px solid ${olive[200]}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px'
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ margin: 'auto' }}>
                <path d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"
                  stroke={olive[700]} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h3 style={{ color: sand[950], fontWeight: 850, fontSize: '15px', margin: '0 0 8px' }}>
              No analyses yet
            </h3>
            <p style={{ color: sand[600], fontSize: '12px', marginBottom: '20px', fontWeight: 500 }}>
              Run your first repository analysis to see results here.
            </p>
            <button
              onClick={() => navigate('/')}
              style={{
                background: olive[600],
                color: '#f7f9eb',
                border: 'none',
                borderRadius: '8px',
                padding: '9px 20px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'background-color 0.15s'
              }}
              onMouseEnter={e => e.target.style.backgroundColor = olive[700]}
              onMouseLeave={e => e.target.style.backgroundColor = olive[600]}
            >
              Analyze a repository
            </button>
          </div>
        )}

        {/* Review cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {reviews.map(r => (
            <div
              key={r.id}
              onClick={() => navigate(`/review/${r.id}`)}
              style={{
                background: sand[50], border: `1px solid ${sand[200]}`,
                borderRadius: '14px', padding: '20px 22px',
                cursor: 'pointer', transition: 'border-color 0.15s, transform 0.15s'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = olive[300]
                e.currentTarget.style.transform = 'translateY(-1px)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = sand[200]
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '13px', fontWeight: 800, fontFamily: 'monospace',
                    color: sand[950], overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                  }}>
                    {r.repo_url}
                  </div>
                  <div style={{ fontSize: '11px', color: sand[500], marginTop: '5px', fontWeight: 600 }}>
                    {new Date(r.created_at.endsWith('Z') || r.created_at.includes('+') ? r.created_at : r.created_at + 'Z').toLocaleString()}
                  </div>
                </div>
                <span style={{
                  ...(statusStyle[r.status] || { color: sand[600], background: sand[100], border: `1px solid ${sand[200]}` }),
                  fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.05em', borderRadius: '6px', padding: '3px 10px', flexShrink: 0
                }}>
                  {r.status}
                </span>
              </div>

              {r.status === 'complete' && (
                <div style={{
                  display: 'flex', gap: '20px',
                  marginTop: '14px', paddingTop: '12px',
                  borderTop: `1px solid ${sand[200]}`, fontSize: '11px'
                }}>
                  {[
                    { label: 'Findings', value: r.total_findings },
                    { label: 'PRs', value: r.pr_count },
                    { label: 'Issues', value: r.issue_count }
                  ].map(stat => (
                    <div key={stat.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ color: sand[500], fontWeight: 600 }}>{stat.label}</span>
                      <span style={{ color: sand[950], fontWeight: 800 }}>{stat.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}