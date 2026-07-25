import { useNavigate, useLocation } from 'react-router-dom'
import { olive, sand } from '../theme'
import logoImg from '../assets/logo.png'

export default function Navbar({ user, onLogout }) {
  const navigate = useNavigate()
  const location = useLocation()
  const isActive = (path) => location.pathname === path

  return (
    <nav style={{
      background: sand[50],
      borderBottom: `1px solid ${sand[200]}`,
      position: 'sticky', top: 0, zIndex: 50
    }}>
      <div style={{
        maxWidth: '1100px', margin: '0 auto', padding: '0 28px',
        height: '62px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        {/* Brand */}
        <button onClick={() => navigate('/')} style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          display: 'flex', alignItems: 'center', gap: '10px'
        }}>
          <img 
            src={logoImg} 
            alt="Figent Logo" 
            style={{ width: '32px', height: '32px', objectFit: 'contain' }} 
          />
          <span style={{ color: sand[950], fontSize: '16px', fontWeight: 800, letterSpacing: '-0.3px' }}>
            Figent
          </span>
        </button>

        {/* Nav links */}
        {user && (
          <div style={{ display: 'flex', gap: '2px' }}>
            {[
              { label: 'New Analysis', path: '/' },
              { label: 'History', path: '/history' }
            ].map(item => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                style={{
                  background: isActive(item.path) ? olive[100] : 'transparent',
                  color: isActive(item.path) ? olive[600] : sand[600],
                  border: isActive(item.path) ? `1px solid ${olive[200]}` : '1px solid transparent',
                  borderRadius: '8px', padding: '7px 16px',
                  fontSize: '13px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s'
                }}
                onMouseEnter={e => { if (!isActive(item.path)) { e.currentTarget.style.background = sand[100]; e.currentTarget.style.color = sand[800] }}}
                onMouseLeave={e => { if (!isActive(item.path)) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = sand[600] }}}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}

        {/* User + Logout */}
        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '9px',
              paddingLeft: '14px', borderLeft: `1px solid ${sand[200]}`
            }}>
              <div style={{
                width: 30, height: 30, borderRadius: '50%',
                background: olive[100], border: `1px solid ${olive[200]}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '12px', fontWeight: 800, color: olive[600], textTransform: 'uppercase'
              }}>
                {user.username?.[0] || 'U'}
              </div>
              <span style={{ fontSize: '13px', fontWeight: 700, color: sand[800] }}>
                {user.username}
              </span>
            </div>
            <button
              onClick={onLogout}
              style={{
                background: 'none', border: `1px solid ${sand[200]}`,
                color: sand[600], borderRadius: '8px',
                padding: '6px 14px', fontSize: '12px', fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.15s'
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = sand[300]; e.currentTarget.style.color = sand[950] }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = sand[200]; e.currentTarget.style.color = sand[600] }}
            >
              Log out
            </button>
          </div>
        )}
      </div>
    </nav>
  )
}
