import { useNavigate } from 'react-router-dom'
import { olive, sand } from '../theme'
import logoImg from '../assets/logo.png'

export default function Landing() {
  const navigate = useNavigate()

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f5f3ec',
      backgroundImage: 'radial-gradient(rgba(122, 133, 90, 0.16) 1.5px, transparent 0)',
      backgroundSize: '24px 24px',
      fontFamily: 'Outfit, Plus Jakarta Sans, sans-serif',
      position: 'relative'
    }}>
      {/* Background Blobs Layer */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 0
      }}>
        <div style={{
          position: 'absolute', top: '-10%', left: '-10%',
          width: '50vw', height: '50vw', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(122, 133, 90, 0.1) 0%, rgba(245, 243, 236, 0) 70%)',
          filter: 'blur(60px)',
          animation: 'drift-bg 22s infinite alternate ease-in-out'
        }} />
        <div style={{
          position: 'absolute', bottom: '-15%', right: '-10%',
          width: '60vw', height: '60vw', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(185, 195, 160, 0.12) 0%, rgba(245, 243, 236, 0) 70%)',
          filter: 'blur(80px)',
          animation: 'drift-bg-rev 28s infinite alternate ease-in-out'
        }} />
      </div>
      
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
            onClick={() => navigate('/login')}
            style={{
              background: olive[600], color: '#f7f9eb', border: 'none', borderRadius: '8px',
              padding: '8px 18px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s'
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = olive[700]}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = olive[600]}
          >
            Sign In
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '80px 24px', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: olive[100], border: `1px solid ${olive[200]}`, borderRadius: '99px', padding: '4px 14px', marginBottom: '24px' }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: olive[600] }}></div>
          <span style={{ color: olive[700], fontSize: '11px', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Autonomous Agent Orchestrator powered by LangGraph
          </span>
        </div>
        
        <h1 style={{ color: sand[950], fontSize: '48px', fontWeight: 800, lineHeight: 1.15, letterSpacing: '-1.5px', marginBottom: '20px' }}>
          Code Review, Remediated by <span style={{ color: olive[600] }}>Specialized AI Agents</span>
        </h1>
        
        <p style={{ color: sand[700], fontSize: '18px', lineHeight: 1.6, maxWidth: '680px', margin: '0 auto 20px', fontWeight: 500 }}>
          Figent automates static analysis, security audits, and code quality checks using a LangGraph pipeline of co-operating AI workers that draft fixes and pull requests directly into your repository.
        </p>

        {/* Supported Languages List */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px 12px',
          background: 'rgba(253, 252, 248, 0.5)', border: `1px solid ${sand[200]}`,
          borderRadius: '16px', padding: '14px 20px', margin: '0 auto 36px',
          maxWidth: '750px', alignItems: 'center', boxShadow: '0 4px 12px rgba(42, 45, 34, 0.01)'
        }}>
          <span style={{ fontSize: '11px', color: sand[600], fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginRight: '4px' }}>
            Supported:
          </span>
          {[
            { name: 'Python', spec: true },
            { name: 'JavaScript', spec: false },
            { name: 'TypeScript', spec: false },
            { name: 'Java', spec: false },
            { name: 'Go', spec: false },
            { name: 'Shell', spec: false },
            { name: 'Rust', spec: false }
          ].map(lang => (
            <span key={lang.name} style={{
              fontSize: '12px', color: sand[900], fontWeight: 700,
              background: lang.spec ? olive[100] : sand[100],
              border: lang.spec ? `1px solid ${olive[200]}` : `1px solid ${sand[200]}`,
              padding: '3px 10px', borderRadius: '8px',
              display: 'inline-flex', alignItems: 'center', gap: '6px'
            }}>
              {lang.name}
              {lang.spec && (
                <span style={{ fontSize: '9px', fontWeight: 900, color: olive[700], background: olive[200], borderRadius: '4px', padding: '1px 5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Specialized Agents
                </span>
              )}
            </span>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button
            onClick={() => navigate('/login')}
            style={{
              background: olive[600], color: '#f7f9eb', border: 'none', borderRadius: '10px',
              padding: '14px 28px', fontSize: '15px', fontWeight: 800, cursor: 'pointer', transition: 'all 0.15s'
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = olive[700]}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = olive[600]}
          >
            Get Started
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
          
          {/* Card 1: LangGraph */}
          <div style={{ background: sand[50], border: `1px solid ${sand[200]}`, borderRadius: '16px', padding: '28px' }}>
            <div style={{ width: 40, height: 40, borderRadius: '10px', background: olive[100], display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '18px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ color: olive[700] }}>
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
            </div>
            <h3 style={{ color: sand[950], fontSize: '16px', fontWeight: 800, marginBottom: '8px' }}>
              LangGraph Orchestration
            </h3>
            <p style={{ color: sand[700], fontSize: '13px', lineHeight: 1.6, fontWeight: 500, margin: 0 }}>
              Clones your codebase and runs parallel Quality, Security, and Performance agents coordinated via a stateful execution graph.
            </p>
          </div>

          {/* Card 2: Resilient Background Tasks */}
          <div style={{ background: sand[50], border: `1px solid ${sand[200]}`, borderRadius: '16px', padding: '28px' }}>
            <div style={{ width: 40, height: 40, borderRadius: '10px', background: olive[100], display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '18px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ color: olive[700] }}>
                <polyline points="23 4 23 10 17 10"/>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
              </svg>
            </div>
            <h3 style={{ color: sand[950], fontSize: '16px', fontWeight: 800, marginBottom: '8px' }}>
              Persistent Background Audits
            </h3>
            <p style={{ color: sand[700], fontSize: '13px', lineHeight: 1.6, fontWeight: 500, margin: 0 }}>
              Audits execute asynchronously in a server-side queue. You can safely close your browser tab or refresh, reconnecting instantly when you return.
            </p>
          </div>

          {/* Card 3: Security Boundary */}
          <div style={{ background: sand[50], border: `1px solid ${sand[200]}`, borderRadius: '16px', padding: '28px' }}>
            <div style={{ width: 40, height: 40, borderRadius: '10px', background: olive[100], display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '18px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ color: olive[700] }}>
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <h3 style={{ color: sand[950], fontSize: '16px', fontWeight: 800, marginBottom: '8px' }}>
              Responsible Security Sandbox
            </h3>
            <p style={{ color: sand[700], fontSize: '13px', lineHeight: 1.6, fontWeight: 500, margin: 0 }}>
              Validates repository ownership automatically. Third-party repositories run in Report-Only mode, preserving code safety and access boundaries.
            </p>
          </div>

          {/* Card 4: Pull Requests */}
          <div style={{ background: sand[50], border: `1px solid ${sand[200]}`, borderRadius: '16px', padding: '28px' }}>
            <div style={{ width: 40, height: 40, borderRadius: '10px', background: olive[100], display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '18px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ color: olive[700] }}>
                <circle cx="18" cy="18" r="3"/>
                <circle cx="6" cy="6" r="3"/>
                <circle cx="6" cy="18" r="3"/>
                <path d="M18 15V9a4 4 0 0 0-4-4H9"/>
                <line x1="6" y1="9" x2="6" y2="15"/>
              </svg>
            </div>
            <h3 style={{ color: sand[950], fontSize: '16px', fontWeight: 800, marginBottom: '8px' }}>
              GitHub Remediation
            </h3>
            <p style={{ color: sand[700], fontSize: '13px', lineHeight: 1.6, fontWeight: 500, margin: 0 }}>
              Synthesizes clean code patches and automatically opens Pull Requests or registers GitHub issues for repositories with write permissions.
            </p>
          </div>

          {/* Card 5: Chat Assistant */}
          <div style={{ background: sand[50], border: `1px solid ${sand[200]}`, borderRadius: '16px', padding: '28px' }}>
            <div style={{ width: 40, height: 40, borderRadius: '10px', background: olive[100], display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '18px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ color: olive[700] }}>
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <h3 style={{ color: sand[950], fontSize: '16px', fontWeight: 800, marginBottom: '8px' }}>
              Context-Aware Assistant
            </h3>
            <p style={{ color: sand[700], fontSize: '13px', lineHeight: 1.6, fontWeight: 500, margin: 0 }}>
              Chat directly with a virtual security engineer that possesses complete context over the review findings to refine and explain recommended fixes.
            </p>
          </div>

          {/* Card 6: PDF downloads */}
          <div style={{ background: sand[50], border: `1px solid ${sand[200]}`, borderRadius: '16px', padding: '28px' }}>
            <div style={{ width: 40, height: 40, borderRadius: '10px', background: olive[100], display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '18px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ color: olive[700] }}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10 9 9 9 8 9"/>
              </svg>
            </div>
            <h3 style={{ color: sand[950], fontSize: '16px', fontWeight: 800, marginBottom: '8px' }}>
              One-Click PDF Reports
            </h3>
            <p style={{ color: sand[700], fontSize: '13px', lineHeight: 1.6, fontWeight: 500, margin: 0 }}>
              Generate clean, full-color PDF audit report sheets client-side instantly. Perfect for compliance, sharing with teammates, or offline logs.
            </p>
          </div>

        </div>
      </div>

      <style>{`
        @keyframes drift-bg {
          from { transform: translate(0, 0) scale(1); }
          to { transform: translate(6%, 6%) scale(1.08); }
        }
        @keyframes drift-bg-rev {
          from { transform: translate(0, 0) scale(1); }
          to { transform: translate(-6%, -6%) scale(1.05); }
        }
      `}</style>
    </div>
  )
}
