import { useState, useEffect } from 'react';
import { User, Mail, Phone, MessageCircle, Lock, Save, ShieldCheck, Plug, Calendar, HardDrive, CheckCircle2, Settings, Trash2, X, RefreshCw, AlertTriangle, Activity } from 'lucide-react';
import { api } from '../api/api';

export default function Profile() {
  const [activeTab, setActiveTab] = useState('PERSONAL');
  const [loading, setLoading] = useState(false);
  const [syncWhatsapp, setSyncWhatsapp] = useState(true);
  
  const [formData, setFormData] = useState({
    name: 'Loading...',
    email: 'Loading...',
    phone: '+49 170 1234567',
    whatsapp: '+49 170 1234567',
    password: '',
    confirmPassword: ''
  });

  useEffect(() => {
    if (api.googleAuthStatus) {
      api.googleAuthStatus().then(res => {
        if (res && res.connected) {
          setFormData(prev => ({
            ...prev,
            name: res.name || (res.email ? res.email.split('@')[0] : 'Vikas Broker'),
            email: res.email || 'vikaspurohit105@gmail.com',
          }));
        } else {
          setFormData(prev => ({
            ...prev,
            name: 'Vikas Broker',
            email: 'info@car-agents.de',
          }));
        }
      }).catch(() => {
        setFormData(prev => ({ ...prev, name: 'Vikas Broker', email: 'info@car-agents.de' }));
      });
    }
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const next = { ...prev, [name]: value };
      if (name === 'phone' && syncWhatsapp) next.whatsapp = value;
      if (name === 'whatsapp') setSyncWhatsapp(false);
      return next;
    });
  };

  const handleSyncToggle = (e) => {
    const checked = e.target.checked;
    setSyncWhatsapp(checked);
    if (checked) setFormData(prev => ({ ...prev, whatsapp: prev.phone }));
  };

  const handleSave = (e) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      alert('Profile settings saved successfully');
    }, 600);
  };

  const tabs = [
    { id: 'PERSONAL', label: 'Personal Info', icon: User },
    { id: 'SECURITY', label: 'Login Credentials', icon: ShieldCheck },
    { id: 'CONNECTIONS', label: 'App Connections', icon: Plug },
  ];

  return (
    <div style={{ paddingBottom: 40, maxWidth: 1100, margin: '0 auto' }}>
      <div className="page-header" style={{ alignItems: 'flex-end', marginBottom: 24 }}>
        <div className="page-header-left">
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.5px' }}>Settings</h1>
          <p style={{ fontSize: '0.9rem' }}>Manage your account, security, and unified Google integration</p>
        </div>
      </div>

      <div className="profile-tabs-mobile" style={{ 
        display: 'inline-flex', gap: 8, background: 'var(--gray-50)', padding: 8, 
        borderRadius: 'var(--radius-lg)', marginBottom: 32, border: '1px solid var(--gray-200)',
        alignItems: 'center'
      }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '12px 24px',
              borderRadius: 'var(--radius)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: '0.95rem',
              fontWeight: 600,
              color: activeTab === tab.id ? '#fafafa' : 'var(--text-secondary)',
              background: activeTab === tab.id ? '#09090b' : 'transparent',
              boxShadow: activeTab === tab.id ? '0 1px 2px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)' : 'none',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              flexShrink: 0
            }}
          >
            <tab.icon size={18} color={activeTab === tab.id ? 'white' : 'var(--text-muted)'} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'PERSONAL' && (
        <form onSubmit={handleSave} className="card" style={{ border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.03)', overflow: 'hidden' }}>
          <div className="card-header profile-card-header" style={{ padding: '28px 32px', background: 'var(--gray-50)', borderBottom: '1px solid var(--gray-200)' }}>
            <span className="card-title" style={{ fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
              <User size={20} color="var(--brand-500)" /> Personal Information
            </span>
          </div>
          <div className="card-body profile-card-body" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Full Name</label>
              <div style={{ position: 'relative' }}>
                <User size={18} color="var(--gray-400)" style={{ position: 'absolute', left: 16, top: 12 }} />
                <input type="text" name="name" className="form-input" style={{ paddingLeft: 44, paddingRight: 16, height: 44 }} value={formData.name} onChange={handleChange} required />
              </div>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Email Address</label>
              <div style={{ position: 'relative' }}>
                <Mail size={18} color="var(--gray-400)" style={{ position: 'absolute', left: 16, top: 12 }} />
                <input type="email" name="email" className="form-input" style={{ paddingLeft: 44, paddingRight: 16, height: 44 }} value={formData.email} onChange={handleChange} required />
              </div>
            </div>
            <div className="grid-2" style={{ gap: 24, alignItems: 'start' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Phone Number</label>
                <div style={{ position: 'relative' }}>
                  <Phone size={18} color="var(--gray-400)" style={{ position: 'absolute', left: 16, top: 12 }} />
                  <input type="tel" name="phone" className="form-input" style={{ paddingLeft: 44, paddingRight: 16, height: 44 }} value={formData.phone} onChange={handleChange} />
                </div>
              </div>
              <div className="form-group" style={{ margin: 0, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label className="form-label" style={{ fontWeight: 600, color: 'var(--text-secondary)', margin: 0 }}>WhatsApp Number</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={syncWhatsapp} onChange={handleSyncToggle} style={{ accentColor: 'var(--brand-500)', width: 14, height: 14, margin: 0 }} /> Same as Phone
                  </label>
                </div>
                <div style={{ position: 'relative' }}>
                  <MessageCircle size={18} color="#25D366" style={{ position: 'absolute', left: 16, top: 12 }} />
                  <input type="tel" name="whatsapp" className="form-input" style={{ paddingLeft: 44, paddingRight: 16, height: 44, background: syncWhatsapp ? 'var(--gray-50)' : 'white' }} value={formData.whatsapp} onChange={handleChange} />
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <button type="submit" className="btn btn-primary" disabled={loading} style={{ padding: '12px 32px' }}><Save size={18} /> {loading ? 'Saving...' : 'Save Settings'}</button>
            </div>
          </div>
        </form>
      )}

      {activeTab === 'SECURITY' && (
        <form onSubmit={handleSave} className="card" style={{ border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.03)', overflow: 'hidden' }}>
          <div className="card-header profile-card-header" style={{ padding: '28px 32px', background: 'var(--gray-50)', borderBottom: '1px solid var(--gray-200)' }}>
            <span className="card-title" style={{ fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
              <ShieldCheck size={20} color="var(--danger)" /> Login Credentials
            </span>
          </div>
          <div className="card-body profile-card-body" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>New Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} color="var(--gray-400)" style={{ position: 'absolute', left: 16, top: 12 }} />
                <input type="password" name="password" className="form-input" style={{ paddingLeft: 44, paddingRight: 16, height: 44 }} placeholder="Leave blank to keep current password" value={formData.password} onChange={handleChange} />
              </div>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Confirm New Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} color="var(--gray-400)" style={{ position: 'absolute', left: 16, top: 12 }} />
                <input type="password" name="confirmPassword" className="form-input" style={{ paddingLeft: 44, paddingRight: 16, height: 44 }} placeholder="Confirm new password" value={formData.confirmPassword} onChange={handleChange} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <button type="submit" className="btn btn-primary" disabled={loading} style={{ padding: '12px 32px' }}><Save size={18} /> {loading ? 'Saving...' : 'Save Settings'}</button>
            </div>
          </div>
        </form>
      )}

      {activeTab === 'CONNECTIONS' && <AppConnectionsTab />}
    </div>
  );
}

// -----------------------------------------------------------------------------
// App Connections Component (Single Unified Google Workspace Connector)
// -----------------------------------------------------------------------------

function AppConnectionsTab() {
  const [googleStatus, setGoogleStatus] = useState({
    connected: false,
    email: null,
    name: null,
    loading: true
  });

  const [isConnecting, setIsConnecting] = useState(false);

  const fetchStatus = async () => {
    setGoogleStatus(prev => ({ ...prev, loading: true }));
    try {
      if (api.googleAuthStatus) {
        const res = await api.googleAuthStatus();
        setGoogleStatus({
          connected: !!res.connected,
          email: res.email || null,
          name: res.name || null,
          loading: false
        });
      }
    } catch (err) {
      setGoogleStatus({ connected: false, email: null, name: null, loading: false });
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleConnectGoogle = async () => {
    setIsConnecting(true);
    try {
      if (api.googleAuthUrl) {
        const res = await api.googleAuthUrl();
        const authUrl = res?.url || res?.auth_url;
        if (authUrl) {
          window.location.href = authUrl;
          return;
        } else if (res && res.message) {
          alert(res.message);
        }
      }
    } catch (e) {
      alert('Error initiating Google OAuth: ' + e.message);
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32, animation: 'fadeIn 0.3s ease-in-out' }}>
      
      {/* Single Unified Google Workspace Suite Card */}
      <div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Plug size={20} color="var(--brand-500)" /> Google Workspace Integration
        </h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: '0.9rem' }}>
          Connect your Google Account once to enable Gmail, Google Drive, and Google Calendar.
        </p>
        
        {/* Re-auth required banner */}
        {googleStatus.connected && !googleStatus.email && (
          <div style={{ background: '#fffbeb', border: '1px solid #fbbf24', borderRadius: 10, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{ fontSize: '1.1rem' }}>⚠️</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#92400e' }}>Re-authorization Required</div>
              <div style={{ fontSize: '0.8rem', color: '#78350f', marginTop: 2 }}>Gmail scopes were updated. Click "Re-authorize Google Account" below to enable Email + Calendar access.</div>
            </div>
          </div>
        )}
        
        <div style={{ maxWidth: 640 }}>
          <div className="profile-app-card"
            style={{ 
              display: 'flex', flexDirection: 'column', padding: '28px',
              border: '1px solid #e5e7eb', borderRadius: '16px', 
              background: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            }}
          >
            {/* Header / Brand icons */}
            <div className="profile-app-header-mobile" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f8fafc', padding: '8px 12px', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                  <img src="/assets/Gmail_icon_(2020).svg.png" alt="Gmail" style={{ width: 24, height: 24, objectFit: 'contain' }} />
                  <img src="/assets/google-drive (1).png" alt="Drive" style={{ width: 24, height: 24, objectFit: 'contain' }} />
                  <img src="/assets/google-calendar.png" alt="Calendar" style={{ width: 24, height: 24, objectFit: 'contain' }} />
                </div>
                <div>
                  <h3 style={{ fontWeight: 800, fontSize: '1.2rem', margin: 0, color: '#111827' }}>Google Workspace Suite</h3>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Gmail · Google Drive · Google Calendar</div>
                </div>
              </div>

              {googleStatus.connected ? (
                <span style={{ 
                  background: '#dcfce7', color: '#15803d', 
                  padding: '4px 12px', borderRadius: 20, 
                  fontSize: '0.78rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6
                }}>
                  <CheckCircle2 size={14} /> Connected
                </span>
              ) : (
                <span style={{ 
                  background: '#f1f5f9', color: '#64748b', 
                  padding: '4px 12px', borderRadius: 20, 
                  fontSize: '0.78rem', fontWeight: 600
                }}>
                  Not Connected
                </span>
              )}
            </div>

            {/* Account Status Info */}
            <div style={{ background: '#f8fafc', borderRadius: 12, padding: '16px 20px', marginBottom: 24, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Connected Account</div>
              {googleStatus.loading ? (
                <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Checking Google auth status...</div>
              ) : googleStatus.connected ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #4285F4, #34a853)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '0.9rem', flexShrink: 0 }}>
                      {googleStatus.email ? googleStatus.email[0].toUpperCase() : 'G'}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#111827' }}>
                        {googleStatus.email || '— Re-authorization needed —'}
                      </div>
                      {googleStatus.name && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{googleStatus.name}</div>}
                    </div>
                  </div>
                  <button className="btn-icon" onClick={fetchStatus} title="Refresh connection status">
                    <RefreshCw size={14} />
                  </button>
                </div>
              ) : (
                <div style={{ fontSize: '0.88rem', color: '#64748b' }}>
                  No Google account linked. Click below to grant 1-click permission.
                </div>
              )}
            </div>
            
            {/* Features list */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 12 }}>Enabled Features</div>
              <div className="grid-2" style={{ gap: 12, fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CheckCircle2 size={15} color="#10b981" /> Primary Inbox Email Sync
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CheckCircle2 size={15} color="#10b981" /> 1-Click AI Lead Conversion
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CheckCircle2 size={15} color="#10b981" /> Auto Contract Storage to Drive
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CheckCircle2 size={15} color="#10b981" /> 30-Min Travel Conflict Guard
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            {googleStatus.connected ? (
              <div style={{ display: 'flex', gap: 12 }}>
                <button 
                  type="button" 
                  onClick={handleConnectGoogle} 
                  className="btn btn-secondary"
                  style={{ flex: 1, justifyContent: 'center' }}
                  disabled={isConnecting}
                >
                  <RefreshCw size={16} /> Re-authorize Google Account
                </button>
              </div>
            ) : (
              <button 
                type="button" 
                onClick={handleConnectGoogle} 
                className="btn btn-primary"
                style={{ width: '100%', padding: '12px', justifyContent: 'center', fontSize: '0.95rem' }}
                disabled={isConnecting}
              >
                {isConnecting ? 'Connecting...' : 'Connect Google Workspace Account'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <Activity size={18} color="var(--brand-500)" /> Recent Activity
        </h3>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '24px 32px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.9rem' }}>
              <CheckCircle2 size={16} color="#10b981" /> <span>Google OAuth2 Unified Connector active</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.9rem' }}>
              <CheckCircle2 size={16} color="#10b981" /> <span>Primary Inbox emails query initialized via Gmail REST API</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
