import { useState } from 'react';
import { Lock, User, AlertCircle, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { api } from '../api/api';

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
      background: '#0a0b0e',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Same radial glow as sidebar */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        <div style={{ position: 'absolute', top: '-15%', left: '-10%', width: 700, height: 700, borderRadius: '50%', background: 'radial-gradient(circle, rgba(244,124,60,0.35) 0%, transparent 65%)' }} />
        <div style={{ position: 'absolute', bottom: '-15%', right: '-10%', width: 700, height: 700, borderRadius: '50%', background: 'radial-gradient(circle, rgba(244,124,60,0.28) 0%, transparent 65%)' }} />
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(244,124,60,0.08) 0%, transparent 70%)' }} />
      </div>

      {/* Left branding panel — hidden on mobile */}
      <div className="auth-left-panel" style={{
        flex: 1.2,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '60px 80px',
        position: 'relative', zIndex: 1,
        background: 'linear-gradient(to right, rgba(10, 11, 14, 0.6), rgba(10, 11, 14, 0.8)), url("/assets/login img.png") center top / cover no-repeat',
        borderRight: '1px solid rgba(255,255,255,0.05)',
      }}>
        <div style={{ maxWidth: 480 }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 60 }}>
            <img
              src="/assets/car.png"
              alt="Car-Agents Logo"
              style={{ width: 44, height: 44, objectFit: 'contain', filter: 'brightness(0) invert(1)' }}
            />
            <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'white', letterSpacing: '-0.3px' }}>CAR-AGENTS</span>
          </div>

          <h1 style={{ fontSize: '3rem', fontWeight: 800, color: 'white', lineHeight: 1.1, letterSpacing: '-1.5px', marginBottom: 20 }}>
            Your operations,<br />
            <span style={{ background: 'linear-gradient(90deg, #e26a2c, #f47c3c)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              streamlined.
            </span>
          </h1>
          <p style={{ color: '#64748b', fontSize: '1.05rem', lineHeight: 1.7, margin: 0 }}>
            The all-in-one portal for managing your car brokerage — leads, projects, calendar, and finances in one place.
          </p>

          {/* Feature pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 40 }}>
            {['Leads & Pipeline', 'Project Tracker', 'Google Calendar', 'Finance Calculator'].map(f => (
              <span key={f} style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 20,
                padding: '6px 14px',
                fontSize: '0.8rem',
                color: '#94a3b8',
                fontWeight: 500,
              }}>{f}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Right login panel */}
      <div style={{
        width: '100%',
        maxWidth: 480,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 24px',
        position: 'relative', zIndex: 1,
      }}>
        <div style={{ width: '100%', maxWidth: 400 }}>
          {/* Mobile-only logo */}
          <div className="auth-mobile-logo" style={{ textAlign: 'center', marginBottom: 36, display: 'none' }}>
            <img src="/assets/car.png" alt="Car-Agents" style={{ width: 40, height: 40, filter: 'brightness(0) invert(1)', marginBottom: 12 }} />
            <div style={{ fontWeight: 800, fontSize: '1.2rem', color: 'white', letterSpacing: '-0.3px' }}>CAR-AGENTS</div>
          </div>

          {/* Card */}
          <div style={{
            background: 'rgba(255,255,255,0.04)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 24,
            padding: '40px 36px',
            boxShadow: '0 32px 64px rgba(0,0,0,0.5)',
          }}>
            <div style={{ marginBottom: 32 }}>
              <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'white', margin: '0 0 8px', letterSpacing: '-0.5px' }}>
                Sign in
              </h2>
              <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>
                Enter your credentials to access the portal
              </p>
            </div>

            {/* Error */}
            {errorMsg && (
              <div style={{
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
                padding: '12px 14px', borderRadius: 12, color: '#fca5a5',
                fontSize: '0.85rem', marginBottom: 20, display: 'flex', gap: 8, alignItems: 'center'
              }}>
                <AlertCircle size={15} style={{ flexShrink: 0 }} /> {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* User ID */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                  User ID
                </label>
                <div style={{ position: 'relative' }}>
                  <User size={15} color="#475569" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                  <input
                    type="text"
                    value={userId}
                    onChange={e => setUserId(e.target.value)}
                    placeholder="car01"
                    autoComplete="username"
                    autoFocus
                    style={{
                      width: '100%', paddingLeft: 42, paddingRight: 16,
                      height: 48, borderRadius: 12, fontSize: '0.95rem',
                      background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                      color: 'white', outline: 'none', boxSizing: 'border-box',
                      transition: 'border-color 0.2s, background 0.2s',
                    }}
                    onFocus={e => { e.target.style.borderColor = 'rgba(244,124,60,0.7)'; e.target.style.background = 'rgba(244,124,60,0.08)'; }}
                    onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.background = 'rgba(255,255,255,0.06)'; }}
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={15} color="#475569" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                  <input
                    type={showPwd ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    style={{
                      width: '100%', paddingLeft: 42, paddingRight: 48,
                      height: 48, borderRadius: 12, fontSize: '0.95rem',
                      background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                      color: 'white', outline: 'none', boxSizing: 'border-box',
                      transition: 'border-color 0.2s, background 0.2s',
                    }}
                    onFocus={e => { e.target.style.borderColor = 'rgba(244,124,60,0.7)'; e.target.style.background = 'rgba(244,124,60,0.08)'; }}
                    onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.background = 'rgba(255,255,255,0.06)'; }}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(v => !v)}
                    style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#475569' }}
                  >
                    {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                style={{
                  marginTop: 8, height: 50, borderRadius: 12, border: 'none',
                  background: loading
                    ? 'rgba(255,255,255,0.06)'
                    : 'linear-gradient(135deg, #e26a2c 0%, #f47c3c 100%)',
                  color: 'white', fontSize: '0.95rem', fontWeight: 700,
                  cursor: loading ? 'default' : 'pointer',
                  boxShadow: loading ? 'none' : '0 8px 24px rgba(244,124,60,0.4)',
                  transition: 'all 0.2s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                }}
                onMouseEnter={e => { if (!loading) e.currentTarget.style.boxShadow = '0 12px 28px rgba(244,124,60,0.55)'; }}
                onMouseLeave={e => { if (!loading) e.currentTarget.style.boxShadow = '0 8px 24px rgba(244,124,60,0.4)'; }}
              >
                {loading ? (
                  <>
                    <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', animation: 'spin 0.7s linear infinite' }} />
                    Signing in…
                  </>
                ) : (
                  <>Sign In to Portal <ArrowRight size={16} /></>
                )}
              </button>
            </form>

            {/* Hint */}
            <div style={{ marginTop: 24, textAlign: 'center', fontSize: '0.78rem', color: '#64748b', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 20 }}>
              Default: <span style={{ color: '#94a3b8', fontFamily: 'monospace' }}>car01</span> / <span style={{ color: '#94a3b8', fontFamily: 'monospace' }}>12345678</span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder { color: #64748b; }
        
        /* Override Chrome Autofill styling for dark mode */
        input:-webkit-autofill,
        input:-webkit-autofill:hover, 
        input:-webkit-autofill:focus, 
        input:-webkit-autofill:active{
            -webkit-box-shadow: 0 0 0 30px #1a1a1a inset !important;
            -webkit-text-fill-color: white !important;
            border: 1px solid rgba(244,124,60,0.3) !important;
            transition: background-color 5000s ease-in-out 0s;
        }

        @media (max-width: 768px) {
          .auth-left-panel { display: none !important; }
          .auth-mobile-logo { display: block !important; }
        }
      `}</style>
    </div>
  );
}
