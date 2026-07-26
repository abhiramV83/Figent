import { useNavigate } from 'react-router-dom'
import { olive, sand } from '../theme'
import logoImg from '../assets/logo.png'

export default function Footer() {
  const navigate = useNavigate()

  return (
    <footer style={{
      background: sand[50],
      borderTop: `1px solid ${sand[200]}`,
      padding: '40px 24px',
      marginTop: 'auto',
      zIndex: 10,
      position: 'relative'
    }}>
      <div style={{
        maxWidth: '1100px',
        margin: '0 auto',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '24px'
      }} className="footer-container">
        
        {/* Brand/Slogan */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '320px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img src={logoImg} alt="Figent Logo" style={{ width: '24px', height: '24px', objectFit: 'contain' }} />
            <span style={{ color: sand[950], fontSize: '14px', fontWeight: 800, letterSpacing: '-0.3px' }}>
              Figent
            </span>
          </div>
          <p style={{ color: sand[500], fontSize: '11.5px', lineHeight: 1.5, margin: 0, fontWeight: 500 }}>
            Autonomous multi-agent code audit platform. Secure your repositories instantly with LLM security analysis.
          </p>
        </div>

        {/* Links & Copyright */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'flex-end' }} className="footer-links-col">
          <div style={{ display: 'flex', gap: '16px' }}>
            <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: sand[600], fontSize: '11.5px', fontWeight: 600 }}>Dashboard</button>
            <button onClick={() => navigate('/history')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: sand[600], fontSize: '11.5px', fontWeight: 600 }}>History</button>
            <button onClick={() => navigate('/profile')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: sand[600], fontSize: '11.5px', fontWeight: 600 }}>Profile</button>
          </div>
          <span style={{ color: sand[400], fontSize: '10.5px', fontWeight: 500 }}>
            &copy; 2026 Figent. Powered by Antigravity AI.
          </span>
        </div>

      </div>

      <style>{`
        @media (max-width: 600px) {
          .footer-container {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 20px !important;
          }
          .footer-links-col {
            align-items: flex-start !important;
            width: 100% !important;
          }
        }
      `}</style>
    </footer>
  )
}
