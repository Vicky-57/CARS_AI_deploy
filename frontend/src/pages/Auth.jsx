import { useState } from 'react';
import { Car, Lock, User, AlertCircle, Eye, EyeOff } from 'lucide-react';
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
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)',
      padding: '20px'
    }}>
      {/* Background accent */}
      <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)' }} />
        <div style={{ position: 'absolute', bottom: '-20%', right: '-10%', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 70%)' }} />
      </div>

      <div style={{
        maxWidth: 420, width: '100%', position: 'relative',
        background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20,
        padding: '40px 36px', boxShadow: '0 25px 60px rgba(0,0,0,0.4)'
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px', boxShadow: '0 8px 24px rgba(59,130,246,0.4)'
          }}>
            <Car size={28} color="white" />
          </div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'white', margin: '0 0 6px', letterSpacing: '-0.5px' }}>
            CAR-AGENTS
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.88rem', margin: 0 }}>
            Operations Portal — Sign in to continue
          </p>
        </div>

        {/* Error message */}
        {errorMsg && (
          <div style={{
            background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
            padding: '12px 14px', borderRadius: 10, color: '#fca5a5',
            fontSize: '0.82rem', marginBottom: 20, display: 'flex', gap: 8, alignItems: 'center'
          }}>
            <AlertCircle size={15} style={{ flexShrink: 0 }} /> {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* User ID */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              User ID
            </label>
            <div style={{ position: 'relative' }}>
              <User size={16} color="#475569" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input
                type="text"
                value={userId}
                onChange={e => setUserId(e.target.value)}
                placeholder="car01"
                autoComplete="username"
                autoFocus
                style={{
                  width: '100%', paddingLeft: 42, paddingRight: 16,
                  height: 46, borderRadius: 10, fontSize: '0.95rem',
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                  color: 'white', outline: 'none', boxSizing: 'border-box',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => e.target.style.borderColor = 'rgba(99,102,241,0.6)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
                required
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} color="#475569" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                style={{
                  width: '100%', paddingLeft: 42, paddingRight: 48,
                  height: 46, borderRadius: 10, fontSize: '0.95rem',
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                  color: 'white', outline: 'none', boxSizing: 'border-box',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => e.target.style.borderColor = 'rgba(99,102,241,0.6)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
                required
              />
              <button
                type="button"
                onClick={() => setShowPwd(v => !v)}
                style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#64748b' }}
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
              marginTop: 8, height: 48, borderRadius: 10, border: 'none',
              background: loading ? '#374151' : 'linear-gradient(135deg, #3b82f6, #6366f1)',
              color: 'white', fontSize: '0.95rem', fontWeight: 700,
              cursor: loading ? 'default' : 'pointer',
              boxShadow: loading ? 'none' : '0 4px 16px rgba(99,102,241,0.4)',
              transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
            }}
          >
            {loading ? (
              <>
                <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', animation: 'spin 0.7s linear infinite' }} />
                Signing in…
              </>
            ) : 'Sign In to Portal'}
          </button>
        </form>

        {/* Hint */}
        <div style={{ marginTop: 24, textAlign: 'center', fontSize: '0.78rem', color: '#475569', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 20 }}>
          Default: <span style={{ color: '#64748b', fontFamily: 'monospace' }}>car01</span> / <span style={{ color: '#64748b', fontFamily: 'monospace' }}>12345678</span>
        </div>

        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
          input::placeholder { color: #475569; }
        `}</style>
      </div>
    </div>
  );
}
