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
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-canvas, #f8f9fa)',
      padding: '24px 16px',
      fontFamily: 'inherit'
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 8,
            background: 'var(--primary, #18181b)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 12,
            boxShadow: 'var(--shadow-sm)'
          }}>
            <img
              src="/assets/car.png"
              alt="Car-Agents Logo"
              style={{ width: 24, height: 24, objectFit: 'contain', filter: 'brightness(0) invert(1)' }}
            />
          </div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary, #18181b)', margin: 0, letterSpacing: '-0.3px' }}>
            CAR-AGENTS
          </h1>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted, #71717a)', marginTop: 4 }}>
            B2B Vehicle Brokerage Operations & CRM
          </p>
        </div>

        {/* Frappe Card */}
        <div className="card" style={{ padding: '32px 28px' }}>
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary, #18181b)', margin: 0 }}>
              Sign in to Frappe Desk
            </h2>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted, #71717a)', marginTop: 4 }}>
              Enter your broker credentials to access projects and documents
            </p>
          </div>

          {/* Error Alert */}
          {errorMsg && (
            <div style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              padding: '10px 12px',
              borderRadius: 'var(--radius-sm, 6px)',
              color: '#991b1b',
              fontSize: '0.8125rem',
              marginBottom: 16,
              display: 'flex',
              gap: 8,
              alignItems: 'center'
            }}>
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* User ID */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '0.78rem' }}>
                User ID
              </label>
              <div style={{ position: 'relative' }}>
                <User size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted, #71717a)', pointerEvents: 'none' }} />
                <input
                  type="text"
                  value={userId}
                  onChange={e => setUserId(e.target.value)}
                  placeholder="e.g. admin or broker id"
                  autoComplete="username"
                  autoFocus
                  className="form-input"
                  style={{ paddingLeft: 36 }}
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '0.78rem' }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted, #71717a)', pointerEvents: 'none' }} />
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="form-input"
                  style={{ paddingLeft: 36, paddingRight: 36 }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(v => !v)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-muted, #71717a)' }}
                >
                  {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{
                marginTop: 6,
                height: 38,
                width: '100%',
                justifyContent: 'center',
                fontSize: '0.85rem',
                fontWeight: 600
              }}
            >
              {loading ? (
                <>
                  <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                  <span>Authenticating…</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer info */}
        <div style={{ textAlign: 'center', marginTop: 20, fontSize: '0.72rem', color: 'var(--text-muted, #71717a)' }}>
          CAR-AGENTS Broker Portal · Fast, compliant B2B vehicle desk
        </div>
      </div>
    </div>
  );
}
