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
      position: 'relative',
      overflowX: 'hidden'
    }}>
      {/* Floating Ambient Glowing Blobs */}
      <div style={{
        position: 'absolute', top: '-10%', left: '-10%',
        width: '50vw', height: '50vw', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(122, 133, 90, 0.1) 0%, rgba(245, 243, 236, 0) 70%)',
        zIndex: 0, pointerEvents: 'none', filter: 'blur(60px)',
        animation: 'drift-bg 22s infinite alternate ease-in-out'
      }} />
      <div style={{
        position: 'absolute', bottom: '-15%', right: '-10%',
        width: '60vw', height: '60vw', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(185, 195, 160, 0.12) 0%, rgba(245, 243, 236, 0) 70%)',
        zIndex: 0, pointerEvents: 'none', filter: 'blur(80px)',
        animation: 'drift-bg-rev 28s infinite alternate ease-in-out'
      }} />
      
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

      {/* Product Demo Video Section */}
      <div style={{ maxWidth: '960px', margin: '0 auto 80px', padding: '0 24px' }}>
        <div style={{
          background: sand[50],
          border: `1px solid ${sand[200]}`,
          borderRadius: '20px',
          padding: '12px',
          boxShadow: '0 20px 40px rgba(42, 45, 34, 0.06)',
          animation: 'slideIn 0.6s ease-out'
        }}>
          <div style={{ borderRadius: '12px', overflow: 'hidden', border: `1px solid ${sand[100]}` }}>
            <img 
              src="/demo.webp" 
              alt="Figent Product Walkthrough" 
              style={{ width: '100%', height: 'auto', display: 'block' }} 
            />
          </div>
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
