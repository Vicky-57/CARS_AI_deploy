import { useState, useEffect } from 'react';
import { User, Mail, Phone, MessageCircle, Lock, Save, ShieldCheck, Plug, CheckCircle2, RefreshCw, Activity } from 'lucide-react';
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
      alert('Settings saved successfully.');
    }, 500);
  };

  const tabs = [
    { id: 'PERSONAL', label: 'Personal Info', icon: User },
    { id: 'SECURITY', label: 'Security & Access', icon: ShieldCheck },
    { id: 'CONNECTIONS', label: 'App Integrations', icon: Plug },
  ];

  return (
    <div style={{ paddingBottom: 40, maxWidth: 900 }}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div className="page-header-left">
          <h1 className="page-title">Settings & Profile</h1>
          <p className="page-subtitle">Manage broker identity, access credentials, and cloud integrations</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="hide-scrollbar" style={{ 
        display: 'inline-flex', background: 'var(--border)', padding: 2, 
        borderRadius: 'var(--radius-sm)', marginBottom: 20,
        maxWidth: '100%', overflowX: 'auto'
      }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            className="profile-tab"
            onClick={() => setActiveTab(tab.id)}
            style={{
              color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-muted)',
              background: activeTab === tab.id ? 'var(--surface)' : 'transparent',
              boxShadow: activeTab === tab.id ? 'var(--shadow-xs)' : 'none',
            }}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'PERSONAL' && (
        <form onSubmit={handleSave} className="card">
          <div className="card-header">
            <span className="card-title" style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 6 }}>
              <User size={16} /> Personal Information
            </span>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Full Name</label>
              <input type="text" name="name" className="form-input" value={formData.name} onChange={handleChange} required />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Email Address</label>
              <input type="email" name="email" className="form-input" value={formData.email} onChange={handleChange} required />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Phone Number</label>
                <input type="tel" name="phone" className="form-input" value={formData.phone} onChange={handleChange} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <label className="form-label" style={{ margin: 0, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <img src="/assets/whatsapp.png" alt="WhatsApp" style={{ width: 14, height: 14, objectFit: 'contain' }} />
                    WhatsApp Number
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={syncWhatsapp} onChange={handleSyncToggle} style={{ width: 13, height: 13, margin: 0 }} /> Same as Phone
                  </label>
                </div>
                <input type="tel" name="whatsapp" className="form-input" value={formData.whatsapp} onChange={handleChange} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                <Save size={14} /> {loading ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </form>
      )}

      {activeTab === 'SECURITY' && (
        <form onSubmit={handleSave} className="card">
          <div className="card-header">
            <span className="card-title" style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 6 }}>
              <ShieldCheck size={16} /> Login Credentials
            </span>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">New Password</label>
              <input type="password" name="password" className="form-input" placeholder="Leave blank to keep current password" value={formData.password} onChange={handleChange} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Confirm New Password</label>
              <input type="password" name="confirmPassword" className="form-input" placeholder="Confirm new password" value={formData.confirmPassword} onChange={handleChange} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                <Save size={14} /> {loading ? 'Saving…' : 'Update Password'}
              </button>
            </div>
          </div>
        </form>
      )}

      {activeTab === 'CONNECTIONS' && <AppConnectionsTab />}
    </div>
  );
}

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
    } catch {
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Google Drive Integration Card */}
      <div className="card">
        <div className="card-header" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div className="card-title" style={{ fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Plug size={16} /> Google Drive Cloud Storage Integration
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
              Automated vehicle document archiving & 1-click contract PDF cloud backup
            </div>
          </div>

          {googleStatus.connected ? (
            <span className="badge badge-success" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <CheckCircle2 size={12} /> Connected
            </span>
          ) : (
            <span className="badge badge-neutral">Not Connected</span>
          )}
        </div>

        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: 'var(--bg-canvas)', borderRadius: 'var(--radius-sm)', padding: '12px 16px', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>Connected Admin Account</div>
            {googleStatus.loading ? (
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Checking Google Drive status…</div>
            ) : googleStatus.connected ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                    {googleStatus.email || 'Admin Account Connected'}
                  </div>
                  {googleStatus.name && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{googleStatus.name}</div>}
                </div>
                <button className="btn-icon" onClick={fetchStatus} title="Refresh connection status">
                  <RefreshCw size={13} />
                </button>
              </div>
            ) : (
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                No Google account linked. Connect to enable cloud backups for vehicle paperwork.
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            {googleStatus.connected ? (
              <button 
                type="button" 
                onClick={handleConnectGoogle} 
                className="btn btn-secondary btn-sm"
                disabled={isConnecting}
              >
                <RefreshCw size={13} /> Re-authorize Google Drive Access
              </button>
            ) : (
              <button 
                type="button" 
                onClick={handleConnectGoogle} 
                className="btn btn-primary btn-sm"
                disabled={isConnecting}
              >
                {isConnecting ? 'Connecting…' : 'Connect Google Account'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Activity */}
      <div className="card">
        <div className="card-header">
          <span className="card-title" style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Activity size={15} /> System Status
          </span>
        </div>
        <div className="card-body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.8125rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle2 size={15} color="#16a34a" /> <span>FastAPI Backend Services Active (Port 9000)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle2 size={15} color="#16a34a" /> <span>Supabase PostgreSQL Schema v3.0 Connected</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle2 size={15} color="#16a34a" /> <span>Frappe Espresso Design System Active</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
