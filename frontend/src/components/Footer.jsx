import { useNavigate } from 'react-router-dom'
import { olive, sand } from '../theme'
import logoImg from '../assets/logo.png'

export default function Footer() {
  const navigate = useNavigate()

  return (
    <footer style={{
      background: 'rgba(253, 252, 248, 0.75)',
      backdropFilter: 'blur(16px)',
      borderTop: `1px solid ${sand[200]}`,
      padding: '12px 24px',
      marginTop: 'auto',
      zIndex: 100,
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0
    }}>
      <div style={{
        maxWidth: '1100px',
        margin: '0 auto',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '16px'
      }} className="footer-container">
        
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img src={logoImg} alt="Figent Logo" style={{ width: '20px', height: '20px', objectFit: 'contain' }} />
          <span style={{ color: sand[950], fontSize: '13px', fontWeight: 800, letterSpacing: '-0.3px' }}>
            Figent
          </span>
        </div>

        {/* Links & Copyright */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }} className="footer-right">
          <div style={{ display: 'flex', gap: '16px' }}>
            <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: sand[600], fontSize: '11.5px', fontWeight: 600 }}>Dashboard</button>
            <button onClick={() => navigate('/history')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: sand[600], fontSize: '11.5px', fontWeight: 600 }}>History</button>
            <button onClick={() => navigate('/profile')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: sand[600], fontSize: '11.5px', fontWeight: 600 }}>Profile</button>
            <button onClick={() => navigate('/support')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: sand[600], fontSize: '11.5px', fontWeight: 600 }}>Support</button>
          </div>
          <span style={{ color: sand[400], fontSize: '11px', fontWeight: 500 }} className="footer-copyright">
            &copy; {new Date().getFullYear()} Figent. All rights reserved.
          </span>
        </div>

      </div>

      <style>{`
        @media (max-width: 600px) {
          .footer-container {
            flex-direction: column !important;
            align-items: center !important;
            text-align: center !important;
            gap: 12px !important;
          }
          .footer-right {
            flex-direction: column !important;
            gap: 10px !important;
            align-items: center !important;
          }
        }
      `}</style>
    </footer>
  )
}
