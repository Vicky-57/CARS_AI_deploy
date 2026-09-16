import { useState } from 'react';
import { Lock, User, AlertCircle, Eye, EyeOff, ArrowRight, Car, CheckCircle2 } from 'lucide-react';
import { api } from '../api/api';

const FEATURES = [
  'Real-time lead & deal tracking',
  'B2B vehicle brokerage operations',
  'Integrated communication tools',
  'Smart project & contract management',
];

export default function Auth({ onLogin }) {
  const [userId, setUserId]     = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showPwd, setShowPwd]   = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!userId || !password) { setErrorMsg('Please enter your User ID and password.'); return; }
    setLoading(true);
    setErrorMsg('');
    try {
      const data = await api.login(userId, password);
      onLogin({ userId: data.user_id, email: data.user_id + '@car-agents.de', name: 'Vikas Broker' });
    } catch (err) {
      setErrorMsg(err.message || 'Login failed. Check credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      background: '#FFFFFF',
    }}>

      {/* ── Left branding panel ── */}
      <div style={{
        width: '46%',
        background: 'linear-gradient(160deg, #0f0f0f 0%, #1a1a1a 60%, #111 100%)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '48px 52px',
        position: 'relative',
        overflow: 'hidden',
        flexShrink: 0,
      }}>
        {/* Background decoration */}
        <div style={{
          position: 'absolute', top: -80, right: -80,
          width: 340, height: 340,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.04) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: -60, left: -60,
          width: 260, height: 260,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.03) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative' }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: '#FFFFFF',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          }}>
            <img src="/assets/car.png" alt="Car-Agents Logo" style={{ width: 22, height: 22, objectFit: 'contain', filter: 'brightness(0)' }} />
          </div>
          <div>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.3px' }}>CAR-AGENTS</div>
            <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Broker Desk</div>
          </div>
        </div>

        {/* Main headline */}
        <div style={{ position: 'relative' }}>
          <div style={{
            display: 'inline-block',
            fontSize: '0.72rem', fontWeight: 700,
            color: '#999999',
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            marginBottom: 16,
            background: 'rgba(255,255,255,0.07)',
            padding: '5px 12px',
            borderRadius: 20,
            border: '1px solid rgba(255,255,255,0.12)',
          }}>
            B2B Vehicle Brokerage CRM
          </div>
          <h1 style={{
            fontSize: '2.4rem',
            fontWeight: 800,
            color: '#ffffff',
            lineHeight: 1.15,
            letterSpacing: '-0.5px',
            margin: '0 0 20px',
          }}>
            Your complete<br />
            <span style={{ color: '#ffffff' }}>brokerage</span><br />
            operations hub.
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.88rem', lineHeight: 1.7, margin: '0 0 32px' }}>
            Manage leads, projects, communications, and vehicle deals — all in one place.
          </p>

          {/* Feature list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {FEATURES.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <CheckCircle2 size={15} color="#999999" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.65)' }}>{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.25)', position: 'relative' }}>
          © 2026 CAR-AGENTS · B2B Vehicle Brokerage Platform
        </div>
      </div>

      {/* ── Right login form ── */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 40px',
        background: '#FAFAFA',
      }}>
        <div style={{ width: '100%', maxWidth: 380 }}>

          {/* Form header */}
          <div style={{ marginBottom: 36 }}>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#171717', margin: '0 0 8px', letterSpacing: '-0.4px' }}>
              Welcome back
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#999999', margin: 0 }}>
              Sign in to your CAR-AGENTS broker account.
            </p>
          </div>

          {/* Error alert */}
          {errorMsg && (
            <div style={{
              background: '#FAECEC',
              border: '1px solid #F0C4C4',
              padding: '11px 14px',
              borderRadius: 8,
              color: '#D64545',
              fontSize: '0.82rem',
              marginBottom: 20,
              display: 'flex',
              gap: 8,
              alignItems: 'center',
            }}>
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

            {/* User ID */}
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#525252', marginBottom: 7 }}>
                User ID
              </label>
              <div style={{ position: 'relative' }}>
                <User size={15} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: '#B5B5B5', pointerEvents: 'none' }} />
                <input
                  type="text"
                  value={userId}
                  onChange={e => setUserId(e.target.value)}
                  placeholder="e.g. admin or broker id"
                  autoComplete="username"
                  autoFocus
                  required
                  style={{
                    width: '100%',
                    padding: '11px 13px 11px 38px',
                    border: '1.5px solid #E9EAEA',
                    borderRadius: 8,
                    fontSize: '0.875rem',
                    color: '#171717',
                    background: '#FFFFFF',
                    outline: 'none',
                    transition: 'border-color 0.15s',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit',
                  }}
                  onFocus={e => e.target.style.borderColor = '#171717'}
                  onBlur={e => e.target.style.borderColor = '#E9EAEA'}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#525252', marginBottom: 7 }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={15} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: '#B5B5B5', pointerEvents: 'none' }} />
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  style={{
                    width: '100%',
                    padding: '11px 40px 11px 38px',
                    border: '1.5px solid #E9EAEA',
                    borderRadius: 8,
                    fontSize: '0.875rem',
                    color: '#171717',
                    background: '#FFFFFF',
                    outline: 'none',
                    transition: 'border-color 0.15s',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit',
                  }}
                  onFocus={e => e.target.style.borderColor = '#171717'}
                  onBlur={e => e.target.style.borderColor = '#E9EAEA'}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(v => !v)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#B5B5B5' }}
                >
                  {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: 4,
                height: 44,
                width: '100%',
                background: loading ? '#525252' : '#171717',
                color: '#ffffff',
                border: 'none',
                borderRadius: 8,
                fontSize: '0.875rem',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transition: 'background 0.15s, transform 0.1s',
                fontFamily: 'inherit',
                letterSpacing: '0.01em',
              }}
              onMouseEnter={e => { if (!loading) e.target.style.background = '#333333'; }}
              onMouseLeave={e => { if (!loading) e.target.style.background = '#171717'; }}
            >
              {loading ? (
                <>
                  <div style={{
                    width: 16, height: 16,
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: '#ffffff',
                    borderRadius: '50%',
                    animation: 'spin 0.7s linear infinite',
                  }} />
                  <span>Authenticating…</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <div style={{ marginTop: 32, textAlign: 'center', fontSize: '0.72rem', color: '#B5B5B5' }}>
            CAR-AGENTS Broker Portal · Fast, compliant B2B vehicle desk
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 768px) {
          .auth-left { display: none !important; }
        }
      `}</style>
    </div>
  );
}
