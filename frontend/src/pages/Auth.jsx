import { useState } from 'react';
import { Car, Lock, Mail, User } from 'lucide-react';

export default function Auth({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    // Simulate network delay
    setTimeout(() => {
      setLoading(false);
      onLogin();
    }, 800);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
      padding: '20px'
    }}>
      <div className="card" style={{ maxWidth: 420, width: '100%', padding: '32px' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12, background: 'var(--brand-500)', 
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px'
          }}>
            <Car size={24} color="white" />
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 8px 0' }}>
            {isLogin ? 'Welcome Back' : 'Create an Account'}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>
            {isLogin 
              ? 'Enter your credentials to access the portal' 
              : 'Sign up to start managing your brokerage'}
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!isLogin && (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Full Name</label>
              <div style={{ position: 'relative' }}>
                <User size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: 10 }} />
                <input className="form-input" type="text" placeholder="John Doe" style={{ paddingLeft: 36 }} required />
              </div>
            </div>
          )}

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Email Address</label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: 10 }} />
              <input className="form-input" type="email" placeholder="you@example.com" style={{ paddingLeft: 36 }} required />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: 10 }} />
              <input className="form-input" type="password" placeholder="••••••••" style={{ paddingLeft: 36 }} required />
            </div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ marginTop: 8, padding: '10px', justifyContent: 'center' }} disabled={loading}>
            {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Sign Up')}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 24, fontSize: '0.85rem' }}>
          <span style={{ color: 'var(--text-secondary)' }}>
            {isLogin ? "Don't have an account? " : "Already have an account? "}
          </span>
          <button 
            style={{ background: 'none', border: 'none', color: 'var(--brand-600)', cursor: 'pointer', padding: '0 4px', fontSize: '0.85rem', fontWeight: 500 }}
            onClick={() => setIsLogin(!isLogin)}
          >
            {isLogin ? 'Sign Up' : 'Sign In'}
          </button>
        </div>
      </div>
    </div>
  );
}
