import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { API_BASE } from '../config'
import { olive, sand } from '../theme'

const suggestions = [
  'Summarize the review findings',
  'What are the most critical issues?',
  'Explain the security vulnerabilities found',
  'What should I fix first?'
]

function renderMarkdown(text) {
  if (!text) return null
  
  // Split by code blocks
  const parts = text.split(/(```[a-z]*\n[\s\S]*?\n```)/g)
  
  return parts.map((part, index) => {
    if (part.startsWith('```')) {
      const match = part.match(/```([a-z]*)\n([\s\S]*?)\n```/)
      const code = match ? match[2] : part.slice(3, -3)
      return (
        <div key={index} style={{ 
          background: sand[100], 
          border: `1px solid ${sand[200]}`, 
          borderRadius: '8px', 
          padding: '12px', 
          margin: '10px 0',
          fontFamily: 'monospace',
          fontSize: '12px',
          overflowX: 'auto',
          color: olive[700],
          fontWeight: 700,
          whiteSpace: 'pre'
        }}>
          {code}
        </div>
      )
    }
    
    const lines = part.split('\n')
    return lines.map((line, lineIndex) => {
      // Inline bold matches
      const boldParts = line.split(/(\*\*.*?\*\*)/g)
      const content = boldParts.map((bp, bIdx) => {
        if (bp.startsWith('**') && bp.endsWith('**')) {
          return <strong key={bIdx} style={{ color: sand[950], fontWeight: 800 }}>{bp.slice(2, -2)}</strong>
        }
        return bp
      })

      if (line.startsWith('### ')) {
        return <h4 key={lineIndex} style={{ color: olive[700], fontSize: '14px', fontWeight: 800, margin: '12px 0 6px' }}>{line.slice(4)}</h4>
      }
      if (line.startsWith('## ')) {
        return <h3 key={lineIndex} style={{ color: olive[700], fontSize: '16px', fontWeight: 800, margin: '16px 0 8px' }}>{line.slice(3)}</h3>
      }
      if (line.startsWith('- ') || line.startsWith('* ')) {
        return (
          <div key={lineIndex} style={{ display: 'flex', gap: '8px', margin: '4px 0 4px 12px', color: sand[800], fontWeight: 600 }}>
            <span>•</span>
            <div>{line.slice(2)}</div>
          </div>
        )
      }
      if (line.trim() === '') {
        return <div key={lineIndex} style={{ height: '6px' }} />
      }
      return (
        <p key={lineIndex} style={{ margin: '4px 0', color: sand[800], fontWeight: 600, lineHeight: 1.6, fontFamily: 'inherit' }}>
          {content}
        </p>
      )
    })
  })
}

export default function Chat({ token, reviewId, sessionId, onNewSession, height = '520px' }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingStatus, setLoadingStatus] = useState('Thinking...')
  const messagesContainerRef = useRef(null)

  // Auto-scroll internally inside the chat container (does not scroll the page viewport)
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight
    }
  }, [messages, loading])

  useEffect(() => {
    if (!sessionId || !token) return
    axios.get(`${API_BASE}/api/chat/history/${sessionId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(res => setMessages(res.data))
    .catch(err => console.error(err))
  }, [sessionId, token])



  useEffect(() => {
    if (!loading) return
    const statuses = [
      'Thinking...',
      'Reading findings database...',
      'Cross-referencing files...',
      'Analyzing security rules...',
      'Formulating code recommendations...'
    ]
    let idx = 0
    setLoadingStatus(statuses[0])
    const interval = setInterval(() => {
      idx = (idx + 1) % statuses.length
      setLoadingStatus(statuses[idx])
    }, 1500)
    return () => clearInterval(interval)
  }, [loading])

  const send = async (textToSend) => {
    const text = (textToSend || input).trim()
    if (!text || loading) return
    if (!textToSend) setInput('')
    setMessages(prev => [...prev, { role: 'user', content: text }])
    setLoading(true)
    try {
      const res = await axios.post(`${API_BASE}/api/chat/${reviewId}`, {
        message: text,
        session_id: sessionId
      }, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setMessages(prev => [...prev, { role: 'assistant', content: res.data.response }])
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Failed to reach the Figent agent. Please try again.'
      }])
    } finally {
      setLoading(false)
    }
  }

  const handleNewChat = async () => {
    if (loading) return
    setLoading(true)
    try {
      const res = await axios.post(`${API_BASE}/api/chat/session/${reviewId}/new`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setMessages([])
      if (onNewSession) {
        onNewSession(res.data.session_id)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height }}>
      
      {/* Session Control Header */}
      <div style={{ 
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        paddingBottom: '14px', borderBottom: `1px solid ${sand[200]}`, marginBottom: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: olive[600] }}></div>
          <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: sand[800], letterSpacing: '0.05em' }}>
            Active Session
          </span>
        </div>
        <button
          onClick={handleNewChat}
          disabled={loading}
          style={{
            background: 'none', border: `1px solid ${sand[200]}`,
            color: sand[700], borderRadius: '8px',
            padding: '6px 14px', fontSize: '11px', fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.15s'
          }}
          onMouseEnter={e => { if(!loading) { e.currentTarget.style.borderColor = olive[300]; e.currentTarget.style.color = olive[600] } }}
          onMouseLeave={e => { if(!loading) { e.currentTarget.style.borderColor = sand[200]; e.currentTarget.style.color = sand[700] } }}
        >
          {loading ? 'Starting...' : 'New Chat'}
        </button>
      </div>

      {/* Messages */}
      <div 
        ref={messagesContainerRef}
        style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px',
          paddingRight: '4px', marginBottom: '16px' }}
      >

        {messages.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', height: '100%', textAlign: 'center', padding: '24px' }}>
            <div style={{ width: 44, height: 44, borderRadius: '12px',
              background: olive[100], border: `1px solid ${olive[200]}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: '14px' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ margin: 'auto' }}>
                <path d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"
                  stroke={olive[700]} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h4 style={{ color: sand[950], fontWeight: 800, fontSize: '14px', margin: '0 0 6px' }}>
              AI Review Assistant
            </h4>
            <p style={{ color: sand[700], fontSize: '12px', lineHeight: 1.6, marginBottom: '20px', maxWidth: '300px', fontWeight: 600 }}>
              Ask about specific findings, security issues, or get recommendations on what to fix first.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', maxWidth: '380px' }}>
              {suggestions.map((s, i) => (
                <button key={i} onClick={() => send(s)} style={{
                  background: sand[100], border: `1px solid ${sand[200]}`,
                  borderRadius: '8px', padding: '7px 14px',
                  fontSize: '12px', color: sand[800], cursor: 'pointer',
                  fontWeight: 700, transition: 'border-color 0.15s'
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = olive[400]}
                onMouseLeave={e => e.currentTarget.style.borderColor = sand[200]}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} style={{
            display: 'flex',
            justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start'
          }}>
            <div style={{
              maxWidth: '82%',
              padding: '12px 18px',
              borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
              fontSize: '13px', lineHeight: 1.65,
              ...(m.role === 'user'
                ? { background: olive[600], color: '#f7f9eb', fontWeight: 600 }
                : { background: sand[50], color: sand[950],
                    border: `1px solid ${sand[200]}`, borderLeft: `4px solid ${olive[500]}`,
                    wordBreak: 'break-word', fontWeight: 600, fontFamily: 'inherit' }
              )
            }}>
              {m.role === 'user' ? m.content : renderMarkdown(m.content)}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{
              background: sand[50], border: `1px solid ${sand[200]}`,
              borderLeft: `4px solid ${olive[300]}`,
              borderRadius: '14px 14px 14px 4px',
              padding: '12px 18px', display: 'flex', alignItems: 'center', gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {[0,1,2].map(k => (
                  <div key={k} style={{
                    width: 6, height: 6, borderRadius: '50%', background: olive[400],
                    animation: `bounce 1.2s ${k * 0.2}s infinite`
                  }}></div>
                ))}
              </div>
              <span style={{ fontSize: '12px', color: sand[600], fontWeight: 700, animation: 'pulse 1.5s infinite' }}>
                {loadingStatus}
              </span>
            </div>
          </div>
        )}
        {/* Internally scrolled bottom container */}
      </div>

      {/* Input */}
      <div style={{ display: 'flex', gap: '10px', borderTop: `1px solid ${sand[200]}`, paddingTop: '16px' }}>
        <input
          style={{
            flex: 1, background: sand[100], border: `1px solid ${sand[200]}`,
            borderRadius: '10px', padding: '11px 16px',
            fontSize: '13px', color: sand[950], outline: 'none', fontFamily: 'inherit',
            fontWeight: 600
          }}
          placeholder="Ask about this review..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          onFocus={e => e.target.style.borderColor = olive[500]}
          onBlur={e => e.target.style.borderColor = sand[200]}
        />
        <button
          onClick={() => send()}
          disabled={loading}
          style={{
            background: loading ? sand[300] : olive[600],
            color: '#f7f9eb', border: 'none',
            borderRadius: '10px', padding: '11px 20px',
            fontSize: '13px', fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          Send
        </button>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  )
}