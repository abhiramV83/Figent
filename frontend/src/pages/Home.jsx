import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { API_BASE, WS_BASE } from '../config'
import { olive, sand } from '../theme'

const agentNames = {
  orchestrator:      'Cloning Repository',
  quality_agent:     'Code Quality Analysis',
  security_agent:    'Vulnerability Detection',
  performance_agent: 'Performance Analysis',
  synthesizer:       'Synthesizing Findings',
  pr_agent:          'Creating GitHub Actions'
}

const PIPELINE_STEPS = [
  { key: 'orchestrator',     icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z' },
  { key: 'quality_agent',    icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
  { key: 'security_agent',   icon: 'M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z' },
  { key: 'performance_agent',icon: 'M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z' },
  { key: 'synthesizer',      icon: 'M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z' },
  { key: 'pr_agent',         icon: 'M7.5 7.5h-.75A2.25 2.25 0 004.5 9.75v7.5a2.25 2.25 0 002.25 2.25h7.5a2.25 2.25 0 002.25-2.25v-7.5a2.25 2.25 0 00-2.25-2.25h-.75m-6 3.75l3 3m0 0l3-3m-3 3V1.5m6 9h.75a2.25 2.25 0 012.25 2.25v7.5a2.25 2.25 0 01-2.25 2.25h-7.5a2.25 2.25 0 01-2.25-2.25v-.75' },
]

export default function Home({ token, username, onAuthError }) {
  const [repoUrl, setRepoUrl]           = useState('')
  const [status, setStatus]             = useState('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [events, setEvents]             = useState([])
   const [activeAgentKey, setActiveAgentKey] = useState(null)
  const [runningReview, setRunningReview] = useState(null)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [stopping, setStopping] = useState(false)
  const [branches, setBranches] = useState([])
  const [selectedBranch, setSelectedBranch] = useState('main')
  const [loadingBranches, setLoadingBranches] = useState(false)
  const [filesList, setFilesList] = useState([])
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [checkedFiles, setCheckedFiles] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [defaultBranch, setDefaultBranch] = useState('main')
  const [loadingDiff, setLoadingDiff] = useState(false)
  const navigate  = useNavigate()
  const statusRef = useRef(status)
  statusRef.current = status
  const wsRef = useRef(null)

  const parseRepoOwner = (url) => {
    if (!url) return null
    const match = url.match(/github\.com\/([^/]+)\/([^/]+)/i)
    return match ? match[1] : null
  }
  const repoOwner = parseRepoOwner(repoUrl)
  const isNotUserRepo = repoOwner && username && repoOwner.toLowerCase() !== username.toLowerCase() && !username.startsWith('guest_')
  const isGuest = username && username.startsWith('guest_')

  // Fetch running reviews on mount to restore dashboard state
  useEffect(() => {
    if (!token) return
    axios.get(`${API_BASE}/api/reviews`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(res => {
      const active = res.data.find(r => r.status === 'running')
      if (active) {
        setRunningReview(active)
        setRepoUrl(active.repo_url)
        setStatus('background_running')
        
        // Fetch initial list of progress events
        axios.get(`${API_BASE}/api/review/${active.id}/progress`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        .then(progressRes => {
          const activeEvents = progressRes.data.events || []
          setEvents(activeEvents)
          
          const lastEvent = activeEvents.filter(e => e.type === 'agent_complete').pop()
          if (lastEvent) {
            const lastIdx = PIPELINE_STEPS.findIndex(s => s.key === lastEvent.agent)
            if (lastIdx !== -1 && lastIdx < PIPELINE_STEPS.length - 1) {
              setActiveAgentKey(PIPELINE_STEPS[lastIdx + 1].key)
            } else {
              setActiveAgentKey(lastEvent.agent)
            }
          } else {
            setActiveAgentKey('orchestrator')
          }
        })
        .catch(err => {
          if (err.response?.status === 401 && onAuthError) onAuthError()
        })
      }
    })
    .catch(err => {
      if (err.response?.status === 401 && onAuthError) onAuthError()
    })
  }, [token, onAuthError])

  // Poll status of background running review
  useEffect(() => {
    if (status !== 'background_running' || !runningReview || !token) return

    const pollInterval = setInterval(() => {
      axios.get(`${API_BASE}/api/review/${runningReview.id}/progress`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => {
        const currentEvents = res.data.events || []
        setEvents(currentEvents)

        const lastEvent = currentEvents.filter(e => e.type === 'agent_complete').pop()
        if (lastEvent) {
          const lastIdx = PIPELINE_STEPS.findIndex(s => s.key === lastEvent.agent)
          if (lastIdx !== -1 && lastIdx < PIPELINE_STEPS.length - 1) {
            setActiveAgentKey(PIPELINE_STEPS[lastIdx + 1].key)
          } else {
            setActiveAgentKey(lastEvent.agent)
          }
        }

        if (res.data.status === 'complete') {
          clearInterval(pollInterval)
          setStatus('done')
          setTimeout(() => navigate(`/review/${runningReview.id}`), 1400)
        } else if (res.data.status === 'failed') {
          clearInterval(pollInterval)
          setStatus('error')
          setErrorMessage(res.data.error || 'The analysis failed on the server.')
          setRunningReview(null)
        }
      })
      .catch(err => {
        if (err.response?.status === 401 && onAuthError) {
          clearInterval(pollInterval)
          onAuthError()
        }
      })
    }, 3500)

    return () => clearInterval(pollInterval)
  }, [status, runningReview, token, navigate, onAuthError])

  const validateGithubUrl = (url) => {
    const reg = /github\.com\/([^/]+)\/([^/]+)/
    return reg.test(url)
  }

  // Fetch branches when valid repo URL is entered
  useEffect(() => {
    let active = true
    if (!token) return
    const url = repoUrl.trim()
    if (!validateGithubUrl(url)) {
      setBranches([])
      setFilesList([])
      setCheckedFiles([])
      return
    }

    setLoadingBranches(true)
    setErrorMessage('')
    
    axios.get(`${API_BASE}/api/repo/branches?repo_url=${encodeURIComponent(url)}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(res => {
      if (!active) return
      setErrorMessage('')
      const branchNames = res.data.branches || []
      setBranches(branchNames)
      setLoadingBranches(false)
      
      let defaultBranchName = 'main'
      if (branchNames.length > 0) {
        if (branchNames.includes('main')) defaultBranchName = 'main'
        else if (branchNames.includes('master')) defaultBranchName = 'master'
        else defaultBranchName = branchNames[0]
      }
      setSelectedBranch(defaultBranchName)
      setDefaultBranch(defaultBranchName)
    })
    .catch(err => {
      if (!active) return
      setLoadingBranches(false)
      setBranches([])
      const msg = err.response?.data?.detail || 'Failed to fetch repository branches. Please verify it is a valid, public GitHub repository.'
      setErrorMessage(msg)
    })

    return () => {
      active = false
    }
  }, [repoUrl, token])

  // Fetch files when repo URL or branch changes
  useEffect(() => {
    let active = true
    if (!token) return
    const url = repoUrl.trim()
    if (!validateGithubUrl(url) || !selectedBranch) {
      setFilesList([])
      setCheckedFiles([])
      return
    }

    setLoadingFiles(true)
    setErrorMessage('')
    axios.get(`${API_BASE}/api/repo/files?repo_url=${encodeURIComponent(url)}&branch=${encodeURIComponent(selectedBranch)}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(async (res) => {
      if (!active) return
      setErrorMessage('')
      const files = res.data.files || []
      setFilesList(files)
      setLoadingFiles(false)
      
      // Check if we need to do branch comparison (if not the default branch)
      if (selectedBranch !== defaultBranch) {
        setLoadingDiff(true)
        try {
          const compareRes = await axios.get(`${API_BASE}/api/repo/compare?repo_url=${encodeURIComponent(url)}&branch=${encodeURIComponent(selectedBranch)}`, {
            headers: { Authorization: `Bearer ${token}` }
          })
          if (!active) return
          const modified = compareRes.data.modified_files || []
          // Normalize paths for matching
          const normalizedModified = modified.map(p => p.replace(/\\/g, '/').toLowerCase())
          
          const matchingPaths = files
            .filter(f => {
              const sizeKb = (f.size_bytes || 0) / 1024
              if (sizeKb > 100) return false // Skip large files
              const normalizedPath = f.path.replace(/\\/g, '/').toLowerCase()
              return normalizedModified.includes(normalizedPath)
            })
            .map(f => f.path)

          if (matchingPaths.length > 0) {
            setCheckedFiles(matchingPaths)
          } else {
            // Fallback to checking first 5 small files
            const paths = files
              .filter(f => (f.size_bytes || 0) / 1024 <= 100)
              .slice(0, 5)
              .map(f => f.path)
            setCheckedFiles(paths)
          }
        } catch (err) {
          if (!active) return
          console.error("Failed to fetch branch comparison, falling back to default pre-selection", err)
          const paths = files
            .filter(f => (f.size_bytes || 0) / 1024 <= 100)
            .slice(0, 5)
            .map(f => f.path)
          setCheckedFiles(paths)
        } finally {
          if (active) setLoadingDiff(false)
        }
      } else {
        // For default branch, pre-select first 5 small files
        const paths = files
          .filter(f => (f.size_bytes || 0) / 1024 <= 100)
          .slice(0, 5)
          .map(f => f.path)
        setCheckedFiles(paths)
      }
    })
    .catch(err => {
      if (!active) return
      setLoadingFiles(false)
      setFilesList([])
      setCheckedFiles([])
      const msg = err.response?.data?.detail || 'Failed to read repository files. Please verify the branch exists.'
      setErrorMessage(msg)
    })

    return () => {
      active = false
    }
  }, [repoUrl, selectedBranch, defaultBranch, token])

  const handleGithubRedirect = () => {
    const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID
    if (!clientId) {
      alert('GitHub Client ID is not configured in Vercel settings.')
      return
    }
    const redirectUri = encodeURIComponent(window.location.origin + '/auth/callback')
    const githubUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=read:user,user:email`
    window.location.href = githubUrl
  }

  const completedEvents  = events.filter(e => e.type === 'agent_complete' || e.type === 'started')

  const handleStop = async () => {
    if (!runningReview?.id) return
    setStopping(true)
    
    // 1. Send stop signal to backend
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({ type: 'stop' }))
      } catch (err) {
        console.error('Failed to send stop via WebSocket', err)
      }
    } else {
      try {
        await axios.post(`${API_BASE}/api/review/${runningReview.id}/stop`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        })
      } catch (err) {
        console.error('Failed to stop review via REST', err)
      }
    }

    // 2. Instantly update UI state and close WebSocket on client
    setTimeout(() => {
      setStopping(false)
      setStatus('error')
      setErrorMessage('Analysis cancelled by user.')
      setActiveAgentKey(null)
      if (wsRef.current) {
        try {
          wsRef.current.close()
        } catch (e) {}
        wsRef.current = null
      }
    }, 100)
  }

  const startReview = () => {
    if (!repoUrl.trim()) return
    setStatus('connecting')
    setErrorMessage('')
    setEvents([])
    setActiveAgentKey('orchestrator')
    setStopping(false)

    const ws = new WebSocket(`${WS_BASE}/api/ws/review`)
    wsRef.current = ws

    ws.onopen = () => {
      ws.send(JSON.stringify({ 
        repo_url: repoUrl, 
        token,
        branch: selectedBranch,
        selected_files: checkedFiles
      }))
      setStatus('streaming')
    }

    ws.onmessage = (e) => {
      const data = JSON.parse(e.data)
      setEvents(prev => [...prev, data])
      if (data.agent) setActiveAgentKey(data.agent)

      if (data.type === 'started') {
        setRunningReview({ id: data.review_id, repo_url: repoUrl })
      }
      if (data.type === 'stopped') {
        setStopping(false)
      }
      if (data.type === 'complete') {
        setStatus('done')
        setActiveAgentKey(null)
        setStopping(false)
        ws.close()
        setTimeout(() => navigate(`/review/${data.review_id}`), 1400)
      }
      if (data.type === 'error') {
        setStatus('error')
        setErrorMessage(data.message)
        setActiveAgentKey(null)
        setStopping(false)
        if (data.message?.includes('token') || data.message?.includes('Authentication')) {
          setTimeout(() => { if (onAuthError) onAuthError() }, 2000)
        }
        ws.close()
      }
    }

    ws.onclose = () => {
      wsRef.current = null
      if (statusRef.current !== 'done' && statusRef.current !== 'error') {
        setStatus('error')
        setErrorMessage('Connection closed unexpectedly. The server may have restarted.')
        setActiveAgentKey(null)
        setStopping(false)
      }
    }

    ws.onerror = () => {
      wsRef.current = null
      setStatus('error')
      setErrorMessage('Could not establish WebSocket connection to the server.')
      setActiveAgentKey(null)
      setStopping(false)
    }
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 4rem)', background: 'transparent', position: 'relative' }}>

      {/* Content */}
      <div style={{
        position: 'relative', zIndex: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: 'calc(100vh - 4rem)', padding: '40px 24px'
      }}>
        <div style={{ width: '100%', maxWidth: '500px' }}>

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '7px',
              background: `${olive[50]}ee`, border: `1px solid ${olive[200]}`,
              borderRadius: '99px', padding: '5px 16px', marginBottom: '16px',
            }}>
              <div style={{
                width: 6, height: 6, borderRadius: '50%', background: olive[600],
                animation: 'blink 1.4s ease-in-out infinite'
              }} />
              <span style={{ color: olive[700], fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                AI Code Review Platform
              </span>
            </div>

            <h1 style={{ color: sand[950], fontSize: '30px', fontWeight: 800, letterSpacing: '-0.6px', margin: '0 0 10px' }}>
              Repository Analysis
            </h1>
            <p style={{ color: sand[700], fontSize: '14px', lineHeight: 1.65, fontWeight: 500, margin: 0 }}>
              Launch the autonomous multi-agent pipeline to detect bugs,
              security vulnerabilities and performance issues.
            </p>
          </div>

          {/* Glass card */}
          <div style={{
            background: `${sand[50]}f4`,
            border: `1px solid ${sand[200]}`,
            borderRadius: '20px',
            padding: '28px',
            boxShadow: `0 4px 32px ${olive[100]}33, 0 1px 6px ${sand[300]}44`
          }}>

            {/* ── Background Running ── */}
            {status === 'background_running' && runningReview && (
              <div>
                {/* Repo chip */}
                <div style={{
                  background: sand[100], border: `1px solid ${sand[200]}`,
                  borderRadius: '10px', padding: '9px 14px', marginBottom: '16px',
                  display: 'flex', alignItems: 'center', gap: '10px'
                }}>
                  <div style={{
                    width: 7, height: 7, borderRadius: '50%', background: '#7a5c00',
                    flexShrink: 0, animation: 'blink 1.4s ease-in-out infinite'
                  }} />
                  <span style={{
                    fontSize: '12px', fontFamily: 'monospace', color: sand[950],
                    fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, textAlign: 'left'
                  }}>
                    {runningReview.repo_url}
                  </span>
                  <span style={{
                    fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
                    color: '#7a5c00', background: '#fdf7e3', border: '1px solid #e5d48a',
                    borderRadius: '99px', padding: '2px 9px', flexShrink: 0
                  }}>
                    Running
                  </span>
                </div>

                {/* Progress flow list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '24px' }}>
                  {completedEvents.map((e, i) => {
                    const step = PIPELINE_STEPS.find(s => s.key === e.agent)
                    return (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        background: sand[100], border: `1px solid ${sand[200]}`,
                        borderRadius: '10px', padding: '10px 13px',
                        animation: 'slideIn 0.22s ease-out both'
                      }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: '7px',
                          background: olive[100], border: `1px solid ${olive[200]}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0, color: olive[700]
                        }}>
                          {step ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                              <path d={step.icon} stroke="currentColor" strokeWidth="1.6"
                                strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                              <path d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                                stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: sand[950] }}>
                            {agentNames[e.agent] || e.agent || 'Started'}
                          </div>
                          <div style={{
                            fontSize: '11px', color: sand[600], marginTop: '1px',
                            fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                          }}>
                            {e.message}
                          </div>
                        </div>
                        
                        <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" style={{ color: olive[600], flexShrink: 0 }}>
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )
                  })}

                  {/* Active working spinner */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    border: `1px dashed ${olive[300]}`, borderRadius: '10px',
                    padding: '10px 13px', animation: 'slideIn 0.22s ease-out both'
                  }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: '7px', flexShrink: 0,
                      border: `2px solid ${sand[200]}`, borderTopColor: olive[600],
                      animation: 'spin 0.75s linear infinite'
                    }} />
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: sand[800] }}>
                        {agentNames[activeAgentKey] || 'Processing...'}
                      </div>
                      <div style={{ fontSize: '11px', color: sand[500], fontWeight: 500 }}>
                        Agent is working in the background...
                      </div>
                    </div>
                  </div>
                </div>

                {/* Confirm abort view */}
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', paddingTop: '16px', borderTop: `1px solid ${sand[200]}` }}>
                  <button
                    disabled={stopping}
                    onClick={handleStop}
                    style={{
                      background: 'none',
                      border: '1px solid #e8c4bc',
                      color: '#8b3a2a',
                      borderRadius: '10px',
                      padding: '10px 20px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: stopping ? 'not-allowed' : 'pointer',
                      transition: 'all 0.15s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                    onMouseEnter={e => { if(!stopping) { e.currentTarget.style.backgroundColor = '#fdf0ee'; e.currentTarget.style.color = '#7a2d1e' } }}
                    onMouseLeave={e => { if(!stopping) { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#8b3a2a' } }}
                  >
                    {stopping ? 'Stopping...' : 'Stop Analysis'}
                  </button>
                  
                  <button
                    onClick={() => setShowConfirmModal(true)}
                    style={{
                      background: 'none',
                      border: `1px solid ${sand[300]}`,
                      color: sand[700],
                      borderRadius: '10px',
                      padding: '10px 20px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.15s'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = sand[400]; e.currentTarget.style.color = sand[950] }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = sand[300]; e.currentTarget.style.color = sand[700] }}
                  >
                    Start New Analysis
                  </button>
                </div>
              </div>
            )}

            {/* ── Idle ── */}
            {status === 'idle' && (
              <div>
                <label style={{
                  display: 'block', color: sand[800], fontSize: '11px',
                  fontWeight: 700, letterSpacing: '0.08em',
                  textTransform: 'uppercase', marginBottom: '10px'
                }}>
                  Repository URL
                </label>
                <div className="input-group" style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                  <input
                    style={{
                      flex: 1, background: sand[100],
                      border: `1px solid ${sand[200]}`, borderRadius: '10px',
                      padding: '12px 16px', fontSize: '13px',
                      color: sand[950], outline: 'none',
                      fontFamily: 'inherit', fontWeight: 600,
                      transition: 'border-color 0.15s, box-shadow 0.15s'
                    }}
                    placeholder="https://github.com/username/repo"
                    value={repoUrl}
                    onChange={e => {
                      setRepoUrl(e.target.value)
                      setErrorMessage('')
                    }}
                    onFocus={e => {
                      e.target.style.borderColor = olive[500]
                      e.target.style.boxShadow = `0 0 0 3px ${olive[100]}`
                    }}
                    onBlur={e => {
                      e.target.style.borderColor = sand[200]
                      e.target.style.boxShadow = 'none'
                    }}
                  />
                </div>

                {errorMessage && (
                  <div style={{
                    background: '#fdf0ee', border: '1px solid #e8c4bc',
                    borderRadius: '12px', padding: '12px 16px', marginBottom: '20px',
                    fontSize: '12.5px', color: '#8b3a2a', fontWeight: 600,
                    animation: 'fadeIn 0.2s ease-out', display: 'flex', alignItems: 'flex-start', gap: '8px',
                    lineHeight: 1.45
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ color: '#8b3a2a', flexShrink: 0, marginTop: '2px' }}>
                      <path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                        stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span style={{ flex: 1, wordBreak: 'break-word' }}>{errorMessage}</span>
                  </div>
                )}

                {isNotUserRepo && !errorMessage && (
                  <div style={{
                    background: '#fffbeb', border: '1px solid #fef3c7',
                    borderRadius: '12px', padding: '14px 18px', marginBottom: '20px',
                    fontSize: '12.5px', color: '#78350f', fontWeight: 600,
                    animation: 'fadeIn 0.2s ease-out', display: 'flex', alignItems: 'flex-start', gap: '10px',
                    lineHeight: 1.55
                  }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ color: '#d97706', flexShrink: 0, marginTop: '2px' }}>
                      <path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                        stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <div>
                      This repository is owned by <span style={{ fontFamily: 'monospace', fontWeight: 800 }}>{repoOwner}</span> (not you). 
                      Auditing will run in <span style={{ fontWeight: 800 }}>Report-only Mode</span> (Pull Requests/Issues cannot be opened).
                      If you want to apply auto-fixes, please fork this repository to your account first.
                    </div>
                  </div>
                )}

                {isGuest && !errorMessage && (
                  <div style={{
                    background: '#fffbeb', border: '1px solid #fef3c7',
                    borderRadius: '12px', padding: '14px 18px', marginBottom: '20px',
                    fontSize: '12.5px', color: '#78350f', fontWeight: 600,
                    animation: 'fadeIn 0.2s ease-out', display: 'flex', alignItems: 'flex-start', gap: '10px',
                    lineHeight: 1.55
                  }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ color: '#d97706', flexShrink: 0, marginTop: '2px' }}>
                      <path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                        stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <div>
                      You are in <span style={{ fontWeight: 800 }}>Guest Mode</span>. Auditing will run in <span style={{ fontWeight: 800 }}>Report-only Mode</span>.
                      To open automated Pull Requests, create issues, and use the platform efficiently, please <span style={{ textDecoration: 'underline', cursor: 'pointer', fontWeight: 800 }} onClick={() => { localStorage.removeItem('token'); localStorage.removeItem('username'); window.location.href = '/login'; }}>Sign In with GitHub</span> and audit your own repositories.
                    </div>
                  </div>
                )}

                {loadingBranches && (
                  <div style={{ color: sand[500], fontSize: '12px', fontWeight: 600, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: 14, height: 14, border: `2px solid ${sand[200]}`, borderTopColor: olive[600], borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                    Loading branches from GitHub...
                  </div>
                )}

                {!loadingBranches && branches.length > 0 && (
                  <div style={{
                    animation: 'fadeIn 0.3s ease-out',
                    background: 'rgba(253, 252, 248, 0.4)',
                    border: `1px solid ${sand[200]}`,
                    borderRadius: '14px',
                    padding: '20px',
                    marginBottom: '20px'
                  }}>
                    {/* Branch Selection */}
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{
                        display: 'block', color: sand[800], fontSize: '11px',
                        fontWeight: 800, letterSpacing: '0.05em',
                        textTransform: 'uppercase', marginBottom: '8px'
                      }}>
                        Select Target Branch
                      </label>
                      <select
                        value={selectedBranch}
                        onChange={e => setSelectedBranch(e.target.value)}
                        style={{
                          width: '100%', padding: '10px 14px', background: sand[100],
                          border: `1px solid ${sand[200]}`, borderRadius: '10px',
                          fontSize: '13px', color: sand[950], fontWeight: 600, outline: 'none',
                          appearance: 'none', backgroundImage: `url("data:image/svg+xml;utf8,<svg fill='none' stroke='${encodeURIComponent(sand[600])}' stroke-width='2' viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'><path stroke-linecap='round' stroke-linejoin='round' d='M19.5 8.25l-7.5 7.5-7.5-7.5'></path></svg>")`,
                          backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center', backgroundSize: '14px'
                        }}
                        onFocus={e => e.target.style.borderColor = olive[500]}
                        onBlur={e => e.target.style.borderColor = sand[200]}
                      >
                        {branches.map(b => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                    </div>

                    {/* File Selection */}
                    <div>
                      {/* Search and Bulk Selection Controls */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <div style={{ flex: 1, minWidth: '180px' }}>
                          <input
                            type="text"
                            placeholder="Search files..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            style={{
                              width: '100%', padding: '8px 12px', background: sand[100],
                              border: `1px solid ${sand[200]}`, borderRadius: '8px',
                              fontSize: '12px', color: sand[950], fontWeight: 600, outline: 'none'
                            }}
                            onFocus={e => e.target.style.borderColor = olive[500]}
                            onBlur={e => e.target.style.borderColor = sand[200]}
                          />
                        </div>
                        
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => {
                              const visibleFiles = filesList.filter(f => {
                                const matchesSearch = f.path.toLowerCase().includes(searchTerm.toLowerCase())
                                const isTooLarge = (f.size_bytes || 0) / 1024 > 100
                                return matchesSearch && !isTooLarge
                              }).map(f => f.path)
                              
                              setCheckedFiles(prev => {
                                const newChecked = [...prev]
                                visibleFiles.forEach(p => {
                                  if (!newChecked.includes(p)) newChecked.push(p)
                                })
                                return newChecked
                              })
                            }}
                            style={{
                              background: 'none', border: `1px solid ${sand[300]}`,
                              color: sand[700], borderRadius: '6px', padding: '6px 12px',
                              fontSize: '11px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = olive[400]; e.currentTarget.style.color = olive[700] }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = sand[300]; e.currentTarget.style.color = sand[700] }}
                          >
                            Select All
                          </button>
                          
                          <button
                            type="button"
                            onClick={() => {
                              const visibleFiles = filesList.filter(f => f.path.toLowerCase().includes(searchTerm.toLowerCase())).map(f => f.path)
                              setCheckedFiles(prev => prev.filter(p => !visibleFiles.includes(p)))
                            }}
                            style={{
                              background: 'none', border: `1px solid ${sand[300]}`,
                              color: sand[700], borderRadius: '6px', padding: '6px 12px',
                              fontSize: '11px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = '#fca5a5'; e.currentTarget.style.color = '#b91c1c' }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = sand[300]; e.currentTarget.style.color = sand[700] }}
                          >
                            Clear Visible
                          </button>
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <label style={{
                          display: 'block', color: sand[800], fontSize: '11px',
                          fontWeight: 800, letterSpacing: '0.05em',
                          textTransform: 'uppercase'
                        }}>
                          Select Files to Audit
                        </label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {loadingDiff && (
                            <span style={{ fontSize: '11px', color: sand[500], fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <div style={{ width: 10, height: 10, border: `1.5px solid ${sand[200]}`, borderTopColor: olive[600], borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                              Checking changed files...
                            </span>
                          )}
                          <span style={{
                            fontSize: '11px', fontWeight: 800,
                            color: checkedFiles.length > 5 ? '#b91c1c' : olive[700],
                            background: checkedFiles.length > 5 ? '#fef2f2' : olive[100],
                            border: checkedFiles.length > 5 ? '1px solid #fca5a5' : `1px solid ${olive[200]}`,
                            borderRadius: '6px', padding: '2px 8px'
                          }}>
                            Selected: {checkedFiles.length} / 5 limit
                          </span>
                        </div>
                      </div>

                      {loadingFiles ? (
                        <div style={{ color: sand[500], fontSize: '12px', padding: '16px 0', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: 14, height: 14, border: `2px solid ${sand[200]}`, borderTopColor: olive[600], borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                          Loading repository file structure...
                        </div>
                      ) : filesList.length === 0 ? (
                        <div style={{ color: sand[500], fontSize: '12px', padding: '12px', border: `1px dashed ${sand[200]}`, borderRadius: '8px', textAlign: 'center', fontWeight: 600 }}>
                          No supported code files found (.py, .js, .ts, .java, .go, .sh, .rs)
                        </div>
                      ) : (
                        <div style={{
                          maxHeight: '200px', overflowY: 'auto',
                          border: `1px solid ${sand[200]}`, borderRadius: '10px',
                          background: sand[100], padding: '6px 0'
                        }}>
                          {filesList
                            .filter(f => f.path.toLowerCase().includes(searchTerm.toLowerCase()))
                            .map(f => {
                              const isChecked = checkedFiles.includes(f.path)
                              const sizeKb = (f.size_bytes || 0) / 1024
                              const isTooLarge = sizeKb > 100
                              
                              return (
                                <label key={f.path} style={{
                                  display: 'flex', alignItems: 'center', gap: '10px',
                                  padding: '8px 14px', 
                                  cursor: isTooLarge ? 'not-allowed' : 'pointer',
                                  transition: 'background-color 0.15s',
                                  userSelect: 'none',
                                  opacity: isTooLarge ? 0.6 : 1
                                }}
                                className="file-item-row"
                                onMouseEnter={e => { if(!isTooLarge) e.currentTarget.style.backgroundColor = 'rgba(107, 124, 36, 0.04)' }}
                                onMouseLeave={e => { if(!isTooLarge) e.currentTarget.style.backgroundColor = 'transparent' }}
                                title={isTooLarge ? 'File size exceeds 100KB limit' : f.path}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked && !isTooLarge}
                                    disabled={isTooLarge}
                                    onChange={() => {
                                      if (isChecked) {
                                        setCheckedFiles(prev => prev.filter(p => p !== f.path))
                                      } else {
                                        setCheckedFiles(prev => [...prev, f.path])
                                      }
                                    }}
                                    style={{
                                      accentColor: olive[600],
                                      width: '16px', height: '16px', cursor: isTooLarge ? 'not-allowed' : 'pointer'
                                    }}
                                  />
                                  <div style={{ flex: 1, minWidth: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                                    <span style={{
                                      fontSize: '12.5px', fontFamily: 'monospace',
                                      color: sand[950], fontWeight: 600,
                                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                                    }}>
                                      {f.path}
                                    </span>
                                    
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                                      {isTooLarge && (
                                        <span style={{
                                          fontSize: '9.5px', fontWeight: 800,
                                          color: '#991b1b', background: '#fef2f2', border: '1px solid #fca5a5',
                                          borderRadius: '4px', padding: '1px 5px'
                                        }}>
                                          Too Large ({Math.round(sizeKb)}KB)
                                        </span>
                                      )}
                                      
                                      <span style={{
                                        fontSize: '10px', fontWeight: 800, textTransform: 'uppercase',
                                        color: sand[500], background: sand[200], borderRadius: '4px',
                                        padding: '1px 5px'
                                      }}>
                                        {f.language}
                                      </span>
                                    </div>
                                  </div>
                                </label>
                              )
                            })}
                          
                          {filesList.filter(f => f.path.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 && (
                            <div style={{ color: sand[500], fontSize: '12px', padding: '12px', textAlign: 'center', fontWeight: 600 }}>
                              No files match your search criteria.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Constraint warnings */}
                {checkedFiles.length > 5 && (
                  <div style={{
                    background: '#fef2f2', border: '1px solid #fca5a5',
                    borderRadius: '12px', padding: '14px 16px', marginBottom: '20px',
                    display: 'flex', alignItems: 'flex-start', gap: '10px',
                    animation: 'fadeIn 0.2s ease-out'
                  }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ color: '#b91c1c', flexShrink: 0, marginTop: '2px' }}>
                      <path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                        stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <div>
                      <div style={{ color: '#991b1b', fontSize: '13px', fontWeight: 800, marginBottom: '2px' }}>
                        Free Tier Limit Exceeded
                      </div>
                      <div style={{ color: '#7f1d1d', fontSize: '12px', fontWeight: 600, lineHeight: 1.5 }}>
                        You have selected {checkedFiles.length} files. The free tier is limited to 5 files per audit.
                        Please <button onClick={() => navigate('/support')} style={{ background: 'none', border: 'none', padding: 0, textDecoration: 'underline', color: olive[700], fontWeight: 800, cursor: 'pointer' }}>contact support</button> or select fewer files to run the audit.
                      </div>
                    </div>
                  </div>
                )}

                {checkedFiles.length === 0 && branches.length > 0 && (
                  <div style={{
                    background: '#fffbeb', border: '1px solid #fef3c7',
                    borderRadius: '12px', padding: '14px 16px', marginBottom: '20px',
                    display: 'flex', alignItems: 'flex-start', gap: '10px'
                  }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ color: '#d97706', flexShrink: 0, marginTop: '2px' }}>
                      <path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                        stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <div>
                      <div style={{ color: '#92400e', fontSize: '13px', fontWeight: 800, marginBottom: '2px' }}>
                        No Files Selected
                      </div>
                      <div style={{ color: '#78350f', fontSize: '12px', fontWeight: 600, lineHeight: 1.5 }}>
                        Please select at least 1 file to initiate the audit workflow.
                      </div>
                    </div>
                  </div>
                )}

                {/* Audit Action Button */}
                <button
                  disabled={!repoUrl.trim() || checkedFiles.length === 0 || checkedFiles.length > 5 || loadingBranches || loadingFiles}
                  onClick={startReview}
                  style={{
                    width: '100%',
                    background: (!repoUrl.trim() || checkedFiles.length === 0 || checkedFiles.length > 5 || loadingBranches || loadingFiles) ? sand[200] : olive[600],
                    color: (!repoUrl.trim() || checkedFiles.length === 0 || checkedFiles.length > 5 || loadingBranches || loadingFiles) ? sand[500] : '#f7f9eb',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '14px 24px',
                    fontSize: '13.5px',
                    fontWeight: 750,
                    cursor: (!repoUrl.trim() || checkedFiles.length === 0 || checkedFiles.length > 5 || loadingBranches || loadingFiles) ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s',
                    boxShadow: (!repoUrl.trim() || checkedFiles.length === 0 || checkedFiles.length > 5 || loadingBranches || loadingFiles) ? 'none' : `0 4px 12px ${olive[400]}33`
                  }}
                  onMouseEnter={e => {
                    if (repoUrl.trim() && checkedFiles.length > 0 && checkedFiles.length <= 5 && !loadingBranches && !loadingFiles) {
                      e.currentTarget.style.backgroundColor = olive[700]
                      e.currentTarget.style.transform = 'translateY(-1px)'
                    }
                  }}
                  onMouseLeave={e => {
                    if (repoUrl.trim() && checkedFiles.length > 0 && checkedFiles.length <= 5 && !loadingBranches && !loadingFiles) {
                      e.currentTarget.style.backgroundColor = olive[600]
                      e.currentTarget.style.transform = 'translateY(0)'
                    }
                  }}
                >
                  Audit Selected Files
                </button>

                <p style={{ color: sand[500], fontSize: '11px', marginTop: '12px', textAlign: 'center', fontWeight: 600 }}>
                  Public repositories only — no credentials required.
                </p>
              </div>
            )}

            {/* ── Streaming / Connecting ── */}
            {(status === 'connecting' || status === 'streaming') && (
              <div>
                {/* Repo chip */}
                <div style={{
                  background: sand[100], border: `1px solid ${sand[200]}`,
                  borderRadius: '10px', padding: '9px 14px', marginBottom: '16px',
                  display: 'flex', alignItems: 'center', gap: '10px'
                }}>
                  <div style={{
                    width: 7, height: 7, borderRadius: '50%', background: olive[500],
                    flexShrink: 0, animation: 'blink 1.4s ease-in-out infinite'
                  }} />
                  <span style={{
                    fontSize: '12px', fontFamily: 'monospace', color: sand[950],
                    fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                  }}>
                    {repoUrl}
                  </span>
                  <span style={{
                    fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
                    color: olive[700], background: olive[100], border: `1px solid ${olive[200]}`,
                    borderRadius: '99px', padding: '2px 9px', flexShrink: 0,
                    animation: 'blink 2s ease-in-out infinite'
                  }}>
                    Running
                  </span>
                </div>

                {/* Completed entries */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {completedEvents.map((e, i) => {
                    const step = PIPELINE_STEPS.find(s => s.key === e.agent)
                    return (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        background: sand[100], border: `1px solid ${sand[200]}`,
                        borderRadius: '10px', padding: '10px 13px',
                        animation: 'slideIn 0.22s ease-out both'
                      }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: '7px',
                          background: olive[100], border: `1px solid ${olive[200]}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0, color: olive[700]
                        }}>
                          {step ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                              <path d={step.icon} stroke="currentColor" strokeWidth="1.6"
                                strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                              <path d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                                stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: sand[950] }}>
                            {agentNames[e.agent] || e.agent || 'Started'}
                          </div>
                          <div style={{
                            fontSize: '11px', color: sand[600], marginTop: '1px',
                            fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                          }}>
                            {e.message}
                          </div>
                        </div>
                        
                        <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" style={{ color: olive[600], flexShrink: 0 }}>
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )
                  })}

                  {/* Active spinner */}
                  {status === 'streaming' && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      border: `1px dashed ${olive[300]}`, borderRadius: '10px',
                      padding: '10px 13px', animation: 'slideIn 0.22s ease-out both'
                    }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: '7px', flexShrink: 0,
                        border: `2px solid ${sand[200]}`, borderTopColor: olive[600],
                        animation: 'spin 0.75s linear infinite'
                      }} />
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: sand[800] }}>
                          {agentNames[activeAgentKey] || 'Processing...'}
                        </div>
                        <div style={{ fontSize: '11px', color: sand[500], fontWeight: 500 }}>
                          Agent is working...
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Stop button for real-time streaming */}
                <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '16px', borderTop: `1px solid ${sand[200]}`, marginTop: '20px' }}>
                  <button
                    disabled={stopping}
                    onClick={handleStop}
                    style={{
                      background: 'none',
                      border: '1px solid #e8c4bc',
                      color: '#8b3a2a',
                      borderRadius: '10px',
                      padding: '10px 20px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: stopping ? 'not-allowed' : 'pointer',
                      transition: 'all 0.15s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                    onMouseEnter={e => { if(!stopping) { e.currentTarget.style.backgroundColor = '#fdf0ee'; e.currentTarget.style.color = '#7a2d1e' } }}
                    onMouseLeave={e => { if(!stopping) { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#8b3a2a' } }}
                  >
                    {stopping ? 'Stopping...' : 'Stop Analysis'}
                  </button>
                </div>
              </div>
            )}

            {/* ── Done ── */}
            {status === 'done' && (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{
                  width: 52, height: 52, borderRadius: '50%',
                  background: olive[100], border: `2.5px solid ${olive[600]}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 14px',
                  animation: 'popIn 0.4s cubic-bezier(0.34,1.56,0.64,1) both'
                }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <path d="M4.5 12.75l6 6 9-13.5" stroke={olive[700]}
                      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <h3 style={{ color: sand[950], fontWeight: 800, fontSize: '16px', margin: '0 0 6px' }}>
                  Analysis Complete
                </h3>
                <p style={{ color: sand[600], fontSize: '12px', fontWeight: 500 }}>
                  Redirecting to your results...
                </p>
              </div>
            )}

            {/* ── Error ── */}
            {status === 'error' && (
              <div style={{
                padding: '20px', background: '#fdf0ee',
                border: '1px solid #e8c4bc', borderRadius: '12px', textAlign: 'center'
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: '50%', background: '#fbdbd4',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 12px'
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                      stroke="#8b3a2a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <h3 style={{ color: '#8b3a2a', fontWeight: 800, fontSize: '14px', margin: '0 0 6px' }}>
                  Analysis Failed
                </h3>
                <p style={{ color: '#b05a48', fontSize: '12px', marginBottom: '14px', fontWeight: 600, lineHeight: 1.5 }}>
                  {errorMessage || 'Something went wrong during the pipeline execution.'}
                </p>
                {errorMessage && (
                  errorMessage.toLowerCase().includes('guest') || 
                  errorMessage.toLowerCase().includes('limit') || 
                  errorMessage.toLowerCase().includes('github')
                ) ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center', marginTop: '12px' }}>
                    <button
                      onClick={handleGithubRedirect}
                      style={{
                        background: '#1f2328',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '10px 20px',
                        fontSize: '13px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = '#2f353c'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = '#1f2328'}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0012 2z"/>
                      </svg>
                      Continue with GitHub
                    </button>
                    <button
                      onClick={() => setStatus('idle')}
                      style={{
                        background: 'none', border: 'none', color: olive[700],
                        fontSize: '11px', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline'
                      }}
                    >
                      Back to Dashboard
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setStatus('idle')}
                    style={{
                      background: olive[600], color: '#f7f9eb', border: 'none',
                      borderRadius: '8px', padding: '8px 20px',
                      fontSize: '12px', fontWeight: 700, cursor: 'pointer'
                    }}
                  >
                    Try again
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Custom Confirmation Modal */}
      {showConfirmModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(26, 27, 21, 0.4)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 100, animation: 'fadeIn 0.2s ease-out both'
        }}>
          <div style={{
            background: sand[50],
            border: `1px solid ${sand[200]}`,
            borderRadius: '20px',
            padding: '32px',
            width: '100%',
            maxWidth: '400px',
            textAlign: 'center',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.12)',
            animation: 'popIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both'
          }}>
            {/* Warning Icon */}
            <div style={{
              width: 52, height: 52, borderRadius: '50%',
              background: '#fdf7e3', border: '1px solid #e5d48a',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px', color: '#7a5c00'
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>

            <h3 style={{ color: sand[950], fontSize: '17px', fontWeight: 800, margin: '0 0 10px', letterSpacing: '-0.3px' }}>
              Confirm New Analysis
            </h3>
            
            <p style={{ color: sand[600], fontSize: '13px', lineHeight: 1.5, marginBottom: '24px', fontWeight: 500 }}>
              An analysis is currently running in the background. Starting a new analysis will stop tracking the current task on this dashboard (the execution will still complete safely on the server).
            </p>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowConfirmModal(false)}
                style={{
                  flex: 1, background: 'none', border: `1px solid ${sand[300]}`,
                  color: sand[700], borderRadius: '10px', padding: '11px',
                  fontSize: '13px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s'
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = sand[400]; e.currentTarget.style.color = sand[950] }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = sand[300]; e.currentTarget.style.color = sand[700] }}
              >
                Cancel
              </button>
              
              <button
                onClick={() => {
                  setShowConfirmModal(false)
                  setStatus('idle')
                  setRunningReview(null)
                  setRepoUrl('')
                  setEvents([])
                  setActiveAgentKey(null)
                }}
                style={{
                  flex: 1, background: olive[600], color: '#f7f9eb',
                  border: 'none', borderRadius: '10px', padding: '11px',
                  fontSize: '13px', fontWeight: 700, cursor: 'pointer', transition: 'background-color 0.15s'
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = olive[700]}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = olive[600]}
              >
                Proceed
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes blink   { 0%,100%{opacity:1;} 50%{opacity:0.35;} }
        @keyframes slideIn { from{opacity:0;transform:translateY(5px);} to{opacity:1;transform:translateY(0);} }
        @keyframes popIn   { from{transform:scale(0.5);opacity:0;} to{transform:scale(1);opacity:1;} }
        @keyframes fadeIn  { from{opacity:0;} to{opacity:1;} }
        @media (max-width: 500px) {
          .input-group {
            flex-direction: column !important;
            gap: 12px !important;
          }
          .input-group button {
            width: 100% !important;
            padding: 14px !important;
            font-size: 14px !important;
          }
        }
      `}</style>
    </div>
  )
}