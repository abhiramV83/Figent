import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import Chat from '../components/chat'
import { API_BASE } from '../config'
import { olive, sand } from '../theme'

const severityLeft = {
  critical: '#b91c1c', // sharp red
  high: '#ea580c',     // sharp orange
  medium: '#ca8a04',   // sharp yellow/gold
  low: olive[600]      // sharp olive
}

const severityBadge = {
  critical: { color: '#991b1b', background: '#fef2f2', border: '1px solid #fca5a5', fontWeight: 800 },
  high: { color: '#9a3412', background: '#fff7ed', border: '1px solid #fdba74', fontWeight: 800 },
  medium: { color: '#854d0e', background: '#fefce8', border: '1px solid #fde047', fontWeight: 800 },
  low: { color: olive[700], background: olive[50], border: `1px solid ${olive[200]}`, fontWeight: 800 }
}

export default function Review({ token, username, onAuthError }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [review, setReview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('findings')
  const [severityFilter, setSeverityFilter] = useState('all')
  const [sessionId, setSessionId] = useState(null)

  useEffect(() => {
    if (!token) return
    axios.get(`${API_BASE}/api/review/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(res => { setReview(res.data); setLoading(false) })
    .catch(err => {
      setLoading(false)
      if (err.response?.status === 401 && onAuthError) {
        onAuthError()
      }
    })

    axios.post(`${API_BASE}/api/chat/session/${id}`, {}, {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(res => setSessionId(res.data.session_id))
    .catch(err => {
      console.error(err)
      if (err.response?.status === 401 && onAuthError) {
        onAuthError()
      }
    })
  }, [id, token, onAuthError])

  if (loading) return (
    <div style={{ minHeight: 'calc(100vh - 4rem)', background: sand.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: sand[600], fontSize: '13px', fontWeight: 650 }}>
      Loading analysis...
    </div>
  )

  if (!review) return (
    <div style={{ minHeight: 'calc(100vh - 4rem)', background: sand.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: '14px' }}>
      <span style={{ color: '#b91c1c', fontWeight: 750 }}>Report not found</span>
      <button onClick={() => navigate('/')}
        style={{ background: olive[600], color: '#f7f9eb', border: 'none',
          borderRadius: '8px', padding: '8px 18px', fontSize: '12px', cursor: 'pointer', fontWeight: 700 }}>
        Go home
      </button>
    </div>
  )

  const findings = review.findings || []
  const critical = findings.filter(f => f.severity === 'critical')
  const high = findings.filter(f => f.severity === 'high')
  const medium = findings.filter(f => f.severity === 'medium')
  const low = findings.filter(f => f.severity === 'low')
  const withAction = findings.filter(f => f.action_taken !== 'report_only')

  const filteredFindings = findings.filter(f => {
    if (severityFilter === 'all') return true
    if (severityFilter === 'github') return f.action_taken !== 'report_only'
    return f.severity === severityFilter
  })

  const filters = [
    { id: 'all', label: 'All', count: findings.length },
    { id: 'critical', label: 'Critical', count: critical.length },
    { id: 'high', label: 'High', count: high.length },
    { id: 'medium', label: 'Medium', count: medium.length },
    { id: 'low', label: 'Low', count: low.length },
    { id: 'github', label: 'GitHub', count: withAction.length }
  ]



  const downloadPdfReport = async () => {
    if (!review) return
    
    const loadHtml2Pdf = () => {
      return new Promise((resolve) => {
        if (window.html2pdf) {
          resolve(window.html2pdf)
          return
        }
        const script = document.createElement('script')
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js'
        script.onload = () => resolve(window.html2pdf)
        document.body.appendChild(script)
      })
    }

    try {
      const html2pdf = await loadHtml2Pdf()
      const element = document.getElementById('report-print-area')
      
      const repoParts = review.repo_url.split('/')
      const repoName = (repoParts[repoParts.length - 1] || 'repo').replace(/\.git$/, '')

      const opt = {
        margin:       [0.4, 0.4, 0.4, 0.4],
        filename:     `figent_${repoName}_audit_report.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, logging: false },
        jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
      }

      html2pdf().set(opt).from(element).save()
    } catch (err) {
      console.error('PDF Generation Error:', err)
    }
  }

  return (
    <div style={{ 
      minHeight: activeTab === 'chat' ? 'calc(100vh - 140px)' : 'calc(100vh - 4rem)', 
      background: 'transparent',
      ...(activeTab === 'chat' ? { display: 'flex', flexDirection: 'column' } : {})
    }}
      className={`pt-10 px-6 ${activeTab === 'chat' ? 'pb-2' : 'pb-16'}`}
    >
      <div className="max-w-5xl mx-auto" style={activeTab === 'chat' ? {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        width: '100%'
      } : undefined}>

        {/* Back link */}
        <button onClick={() => navigate('/history')}
          style={{ background: 'none', border: 'none', color: sand[600],
            fontSize: '12px', cursor: 'pointer', marginBottom: '16px', padding: 0,
            display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 700 }}
          onMouseEnter={e => e.currentTarget.style.color = olive[600]}
          onMouseLeave={e => e.currentTarget.style.color = sand[600]}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
              stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back to History
        </button>

        <div id="report-print-area" style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
          {/* Repo URL header and Download Button */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '20px', marginBottom: '28px', flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ color: sand[950], fontSize: '22px', fontWeight: 800,
                fontFamily: 'monospace', wordBreak: 'break-all', margin: '0 0 6px' }}>
                {review.repo_url}
              </h1>
              <p style={{ color: sand[600], fontSize: '12px', margin: 0, fontWeight: 600 }}>
                Completed {new Date(review.created_at.endsWith('Z') || review.created_at.includes('+') ? review.created_at : review.created_at + 'Z').toLocaleString()}
              </p>
            </div>
            
            <button
              data-html2pdf-ignore="true"
              onClick={downloadPdfReport}
              style={{
                background: olive[600], border: `1px solid ${olive[600]}`,
                color: '#f7f9eb', borderRadius: '10px', padding: '10px 18px',
                fontSize: '12.5px', fontWeight: 800, cursor: 'pointer',
                transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: '8px'
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = olive[700]}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = olive[600]}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4m4-5 5 5 5-5m-5 5V3"/>
              </svg>
              Download PDF
            </button>
          </div>

        {/* Report-only Mode Banner */}
        {review?.report_mode && (
          <div style={{
            background: '#fffbeb', border: '1px solid #fef3c7',
            borderRadius: '12px', padding: '14px 20px', marginBottom: '28px',
            display: 'flex', alignItems: 'flex-start', gap: '12px',
            animation: 'fadeIn 0.22s ease-out'
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ color: '#d97706', flexShrink: 0, marginTop: '2px' }}>
              <path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span style={{ fontSize: '13px', color: '#78350f', fontWeight: 600, lineHeight: 1.5, flex: 1, wordBreak: 'break-word' }}>
              {username && username.startsWith('guest_') ? (
                <>
                  Guest Report Mode — showing full analysis only. To enable auto-fixes (opening Pull Requests and Issues) directly on your own repositories, please <span style={{ textDecoration: 'underline', cursor: 'pointer', fontWeight: 800 }} onClick={() => { localStorage.removeItem('token'); localStorage.removeItem('username'); window.location.href = '/login'; }}>sign in with your GitHub account</span>.
                </>
              ) : (
                <>
                  Report-only mode — you don't own this repository. Showing full analysis only. To enable auto-fixes (PRs/Issues), please fork this repository to your own GitHub account and run the audit there.
                </>
              )}
            </span>
          </div>
        )}

        {/* Stats row */}
        <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '28px' }}>
          {[
            { 
              label: 'Total Findings', 
              value: review.total_findings, 
              accent: sand[950],
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
              )
            },
            { 
              label: 'PRs Opened', 
              value: review.pr_count, 
              accent: olive[600],
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="18" cy="18" r="3"></circle>
                  <circle cx="6" cy="6" r="3"></circle>
                  <path d="M13 6h3a2 2 0 0 1 2 2v7"></path>
                  <line x1="6" y1="9" x2="6" y2="21"></line>
                </svg>
              )
            },
            { 
              label: 'Issues Opened', 
              value: review.issue_count, 
              accent: olive[500],
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
              )
            },
            { 
              label: 'Critical', 
              value: critical.length, 
              accent: '#b91c1c',
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                  <line x1="12" y1="9" x2="12" y2="13"></line>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
              )
            }
          ].map(stat => (
            <div key={stat.label}
              style={{ 
                background: 'rgba(253, 252, 248, 0.55)', 
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(253, 252, 248, 0.65)',
                borderRadius: '14px', 
                padding: '20px',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 4px 12px rgba(42, 45, 34, 0.015)'
              }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ fontSize: '28px', fontWeight: 800, color: stat.accent, lineHeight: 1 }}>
                  {stat.value}
                </div>
                <div style={{ color: stat.accent, opacity: 0.7 }}>
                  {stat.icon}
                </div>
              </div>
              <div style={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.07em', color: sand[500], marginTop: '10px' }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div data-html2pdf-ignore="true" style={{ display: 'flex', gap: '4px', borderBottom: `1px solid ${sand[200]}`, marginBottom: '24px' }}>
          {[
            { id: 'findings', label: 'Findings Report' },
            { id: 'chat', label: 'AI Assistant' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id)
                if (tab.id === 'chat') {
                  setTimeout(() => {
                    window.scrollTo({
                      top: document.documentElement.scrollHeight,
                      behavior: 'smooth'
                    })
                  }, 120)
                }
              }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '10px 18px', fontSize: '13px', fontWeight: 700,
                borderBottom: activeTab === tab.id ? `2px solid ${olive[600]}` : '2px solid transparent',
                color: activeTab === tab.id ? olive[600] : sand[600],
                transition: 'color 0.15s', marginBottom: '-1px'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Findings tab */}
        {activeTab === 'findings' && (
          <div>
            {/* Filter row */}
            <div data-html2pdf-ignore="true" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
              {filters.map(f => {
                const active = severityFilter === f.id
                return (
                  <button
                    key={f.id}
                    onClick={() => setSeverityFilter(f.id)}
                    style={{
                      background: active ? olive[600] : sand[50],
                      color: active ? '#f7f9eb' : sand[700],
                      border: active ? `1px solid ${olive[600]}` : `1px solid ${sand[200]}`,
                      borderRadius: '8px', padding: '6px 14px',
                      fontSize: '12px', fontWeight: 700,
                      cursor: 'pointer', transition: 'all 0.15s',
                      display: 'flex', alignItems: 'center', gap: '7px'
                    }}
                  >
                    <span>{f.label}</span>
                    <span style={{
                      background: active ? 'rgba(255,255,255,0.2)' : sand[100],
                      color: active ? '#f7f9eb' : sand[600],
                      borderRadius: '4px', padding: '1px 6px',
                      fontSize: '10px', fontWeight: 800
                    }}>
                      {f.count}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filteredFindings.map((f, i) => (
                <div key={i}
                  style={{
                    background: 'rgba(253, 252, 248, 0.45)',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(253, 252, 248, 0.55)',
                    borderLeft: `4px solid ${severityLeft[f.severity] || sand[200]}`,
                    borderRadius: '12px', padding: '18px 20px',
                    boxShadow: '0 4px 12px rgba(42, 45, 34, 0.01)',
                    transition: 'all 0.2s ease-in-out'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = olive[300]
                    e.currentTarget.style.transform = 'translateY(-1.5px)'
                    e.currentTarget.style.boxShadow = `0 10px 24px ${olive[100]}22`
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'rgba(253, 252, 248, 0.55)'
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(42, 45, 34, 0.01)'
                  }}
                >
                  {/* Top row */}
                  <div style={{ display: 'flex', alignItems: 'flex-start',
                    justifyContent: 'space-between', gap: '12px',
                    paddingBottom: '12px', marginBottom: '12px',
                    borderBottom: `1px solid ${sand[200]}`
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <span style={{
                        ...(severityBadge[f.severity] || {}),
                        fontSize: '9px', textTransform: 'uppercase',
                        letterSpacing: '0.07em', borderRadius: '5px', padding: '2px 8px'
                      }}>
                        {f.severity}
                      </span>
                      <span style={{ fontFamily: 'monospace', fontSize: '12px', color: sand[950], fontWeight: 700,
                        maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        title={f.file}>
                        {f.file}
                      </span>
                      {f.line && (
                        <span style={{ background: sand[100], border: `1px solid ${sand[200]}`,
                          borderRadius: '5px', padding: '1px 8px', fontSize: '11px', color: sand[700],
                          fontFamily: 'monospace', fontWeight: 600 }}>
                          L{f.line}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                      <span style={{ color: sand[500], fontSize: '11px', fontWeight: 600 }}>
                        {f.confidence}% confidence
                      </span>
                      {f.github_url && (
                        <a href={f.github_url} target="_blank" rel="noreferrer"
                          style={{
                            background: olive[100], border: `1px solid ${olive[200]}`,
                            color: olive[700], borderRadius: '7px',
                            padding: '4px 12px', fontSize: '11px', fontWeight: 700,
                            textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px'
                          }}>
                          {f.action_taken === 'pr' ? 'View PR' : 'View Issue'}
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                            <path d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
                              stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </a>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', margin: '0 0 16px' }}>
                    {f.issue.split(' | ').map((issueText, idx) => {
                      const match = issueText.match(/^\[(quality|security|performance)\]\s*(.*)$/i)
                      if (match) {
                        const [, agentType, text] = match
                        const agentLabel = agentType.charAt(0).toUpperCase() + agentType.slice(1)
                        const badgeColor = agentType === 'security' ? '#b91c1c' : agentType === 'performance' ? '#ca8a04' : olive[600]
                        const badgeBg = agentType === 'security' ? '#fef2f2' : agentType === 'performance' ? '#fefce8' : olive[50]
                        const badgeBorder = agentType === 'security' ? '1px solid #fca5a5' : agentType === 'performance' ? '1px solid #fde047' : `1px solid ${olive[200]}`
                        
                        return (
                          <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', fontSize: '13.5px', lineHeight: 1.6 }}>
                            <span style={{ 
                              fontSize: '9px', fontWeight: 900, color: badgeColor, background: badgeBg, 
                              border: badgeBorder, borderRadius: '4px', padding: '1px 6px', 
                              textTransform: 'uppercase', marginTop: '3px', flexShrink: 0,
                              letterSpacing: '0.04em', width: '82px', textAlign: 'center'
                            }}>
                              {agentLabel}
                            </span>
                            <span style={{ color: sand[950], fontWeight: 600, flex: 1, wordBreak: 'break-word' }}>{text}</span>
                          </div>
                        )
                      }
                      return (
                        <p key={idx} style={{ color: sand[950], fontSize: '13.5px', lineHeight: 1.6, margin: 0, fontWeight: 600 }}>
                          {issueText}
                        </p>
                      )
                    })}
                  </div>

                  {f.fix && (
                    <div style={{ background: sand[100], border: `1px solid ${sand[200]}`,
                      borderRadius: '9px', padding: '14px 16px' }}>
                      <div style={{ fontSize: '9px', fontWeight: 800, textTransform: 'uppercase',
                        letterSpacing: '0.1em', color: sand[500], marginBottom: '8px' }}>
                        Suggested Fix
                      </div>
                      <pre style={{ margin: 0, fontFamily: 'monospace', fontSize: '12px',
                        color: olive[700], fontWeight: 700, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {f.fix}
                      </pre>
                    </div>
                  )}

                  {f.agents && f.agents.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center',
                      gap: '6px', marginTop: '12px', paddingTop: '10px', borderTop: `1px solid ${sand[200]}` }}>
                      <span style={{ fontSize: '9px', color: sand[500], fontWeight: 800,
                        textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        Detected by
                      </span>
                      {f.agents.map((a, j) => (
                        <span key={j} style={{ background: sand[100], border: `1px solid ${sand[200]}`,
                          color: sand[700], borderRadius: '5px', padding: '2px 8px',
                          fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
                          letterSpacing: '0.05em' }}>
                          {a}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {filteredFindings.length === 0 && (
                <div style={{ textAlign: 'center', padding: '48px',
                  background: sand[50], border: `1px dashed ${sand[200]}`, borderRadius: '12px' }}>
                  <p style={{ color: sand[600], fontSize: '13px', fontWeight: 600 }}>
                    No findings in this category.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
        </div>

        {/* Chat tab */}
        {activeTab === 'chat' && sessionId && (
          <div style={{ 
            background: sand[50], 
            border: `1px solid ${sand[200]}`, 
            borderRadius: '14px', 
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            height: '580px',
            marginBottom: '10px'
          }}>
            <Chat token={token} reviewId={id} sessionId={sessionId} onNewSession={setSessionId} height="100%" />
          </div>
        )}

      </div>

      <style>{`
        @media (max-width: 768px) {
          .stats-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 8px !important;
          }
        }
        @media (max-width: 480px) {
          .stats-grid {
            grid-template-columns: 1fr !important;
            gap: 8px !important;
          }
        }
      `}</style>
    </div>
  )
}