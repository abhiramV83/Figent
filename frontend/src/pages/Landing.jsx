import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { API_BASE } from '../config'
import { olive, sand } from '../theme'
import logoImg from '../assets/logo.png'

export default function Landing({ onLogin }) {
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleGetStarted = () => {
    setLoading(true)
    axios.post(`${API_BASE}/api/auth/guest`)
      .then(res => {
        onLogin(res.data.token, res.data.username)
      })
      .catch(err => {
        console.error('Failed to initialize guest session', err)
        setLoading(false)
      })
  }

  return (
    <div style={{ minHeight: '100vh', background: sand.bg, fontFamily: 'Outfit, Plus Jakarta Sans, sans-serif' }}>
      
      {/* Navbar overlay for Landing */}
      <nav style={{ background: sand[50], borderBottom: `1px solid ${sand[200]}` }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 24px', height: '62px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img 
              src={logoImg} 
              alt="Figent Logo" 
              style={{ width: '32px', height: '32px', objectFit: 'contain' }} 
            />
            <span style={{ color: sand[950], fontSize: '16px', fontWeight: 800, letterSpacing: '-0.3px' }}>Figent</span>
          </div>
          <button
            disabled={loading}
            onClick={handleGetStarted}
            style={{
              background: olive[600], color: '#f7f9eb', border: 'none', borderRadius: '8px',
              padding: '8px 18px', fontSize: '13px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.15s',
              opacity: loading ? 0.7 : 1
            }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.backgroundColor = olive[700] }}
            onMouseLeave={e => { if (!loading) e.currentTarget.style.backgroundColor = olive[600] }}
          >
            {loading ? 'Entering...' : 'Get Started'}
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '80px 24px', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: olive[100], border: `1px solid ${olive[200]}`, borderRadius: '99px', padding: '4px 14px', marginBottom: '24px' }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: olive[600] }}></div>
          <span style={{ color: olive[700], fontSize: '11px', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Autonomous Agent Orchestrator
          </span>
        </div>
        
        <h1 style={{ color: sand[950], fontSize: '48px', fontWeight: 800, lineHeight: 1.15, letterSpacing: '-1.5px', marginBottom: '20px' }}>
          Code Review, Remediated by <span style={{ color: olive[600] }}>Specialized AI Agents</span>
        </h1>
        
        <p style={{ color: sand[700], fontSize: '18px', lineHeight: 1.6, maxWidth: '680px', margin: '0 auto 36px', fontWeight: 500 }}>
          Figent automates static analysis, security audits, and code quality checks using a pipeline of co-operating AI workers that draft fixes and pull requests directly into your repository.
        </p>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button
            disabled={loading}
            onClick={handleGetStarted}
            style={{
              background: olive[600], color: '#f7f9eb', border: 'none', borderRadius: '10px',
              padding: '14px 28px', fontSize: '15px', fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.15s',
              opacity: loading ? 0.7 : 1
            }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.backgroundColor = olive[700] }}
            onMouseLeave={e => { if (!loading) e.currentTarget.style.backgroundColor = olive[600] }}
          >
            {loading ? 'Entering...' : 'Get Started'}
          </button>
          <button
            onClick={() => {
              document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })
            }}
            style={{
              background: sand[50], border: `1px solid ${sand[200]}`, color: sand[800], borderRadius: '10px',
              padding: '14px 28px', fontSize: '15px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s'
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = sand[100]}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = sand[50]}
          >
            Learn More
          </button>
        </div>
      </div>

      {/* Grid Features */}
      <div id="features" style={{ maxWidth: '1000px', margin: '0 auto', padding: '0 24px 80px' }}>
        <h2 style={{ color: sand[950], fontSize: '24px', fontWeight: 800, textAlign: 'center', marginBottom: '40px', letterSpacing: '-0.5px' }}>
          How Figent Works
        </h2>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          
          {/* Card 1 */}
          <div style={{ background: sand[50], border: `1px solid ${sand[200]}`, borderRadius: '16px', padding: '28px' }}>
            <div style={{ width: 40, height: 40, borderRadius: '10px', background: olive[100], display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '18px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ color: olive[700] }}>
                <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <h3 style={{ color: sand[950], fontSize: '16px', fontWeight: 800, marginBottom: '8px' }}>
              Multi-Agent Pipeline
            </h3>
            <p style={{ color: sand[700], fontSize: '13px', lineHeight: 1.6, fontWeight: 500, margin: 0 }}>
              An orchestrator clones and scans your code, invoking dedicated Quality, Security, and Performance agents in parallel.
            </p>
          </div>

          {/* Card 2 */}
          <div style={{ background: sand[50], border: `1px solid ${sand[200]}`, borderRadius: '16px', padding: '28px' }}>
            <div style={{ width: 40, height: 40, borderRadius: '10px', background: olive[100], display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '18px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ color: olive[700] }}>
                <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
              </svg>
            </div>
            <h3 style={{ color: sand[950], fontSize: '16px', fontWeight: 800, marginBottom: '8px' }}>
              Automated Remediations
            </h3>
            <p style={{ color: sand[700], fontSize: '13px', lineHeight: 1.6, fontWeight: 500, margin: 0 }}>
              The system doesn't just report issues—it synthesizes code patches and opens GitHub PRs or Issues automatically.
            </p>
          </div>

          {/* Card 3 */}
          <div style={{ background: sand[50], border: `1px solid ${sand[200]}`, borderRadius: '16px', padding: '28px' }}>
            <div style={{ width: 40, height: 40, borderRadius: '10px', background: olive[100], display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '18px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ color: olive[700] }}>
                <path d="M12 20.25c4.556 0 8.25-3.694 8.25-8.25S16.556 3.75 12 3.75 3.75 7.444 3.75 12c0 2.104.787 4.025 2.08 5.485L4.5 20.25l2.765-1.332A8.22 8.22 0 0012 20.25z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h3 style={{ color: sand[950], fontSize: '16px', fontWeight: 800, marginBottom: '8px' }}>
              Context-Aware Assistant
            </h3>
            <p style={{ color: sand[700], fontSize: '13px', lineHeight: 1.6, fontWeight: 500, margin: 0 }}>
              Chat directly with an AI assistant that has complete context over the review findings to refine fix proposals.
            </p>
          </div>

        </div>
      </div>

    </div>
  )
}
