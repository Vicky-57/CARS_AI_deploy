import { useState } from 'react';
import { User, Mail, Phone, MessageCircle, Lock, Save, ShieldCheck, Plug, Calendar, HardDrive, CheckCircle2, Settings, Trash2, X, RefreshCw, AlertTriangle, Activity } from 'lucide-react';

export default function Profile() {
  const [activeTab, setActiveTab] = useState('PERSONAL');
  const [loading, setLoading] = useState(false);
  const [syncWhatsapp, setSyncWhatsapp] = useState(true);
  
  const [formData, setFormData] = useState({
    name: 'John Broker',
    email: 'broker@car-agents.com',
    phone: '+49 170 1234567',
    whatsapp: '+49 170 1234567',
    password: '',
    confirmPassword: ''
  });

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
      alert('Profile settings saved successfully (Static Preview)');
    }, 800);
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
          <p style={{ fontSize: '0.9rem' }}>Manage your account, security, and integrations</p>
        </div>
      </div>

      <div style={{ 
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
              color: activeTab === tab.id ? 'white' : 'var(--text-secondary)',
              background: activeTab === tab.id ? 'var(--brand-500)' : 'transparent',
              boxShadow: activeTab === tab.id ? '0 2px 8px rgba(var(--brand-rgb, 59,130,246),0.3)' : 'none',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s',
              flexShrink: 0
            }}
          >
            <tab.icon size={18} color={activeTab === tab.id ? 'white' : 'var(--text-muted)'} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'PERSONAL' && (
        <form onSubmit={handleSave} className="card" style={{ border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.03)', overflow: 'hidden', animation: 'fadeIn 0.3s ease-in-out' }}>
          <div className="card-header" style={{ padding: '28px 32px', background: 'var(--gray-50)', borderBottom: '1px solid var(--gray-200)' }}>
            <span className="card-title" style={{ fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
              <User size={20} color="var(--brand-500)" /> Personal Information
            </span>
          </div>
          <div className="card-body" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: 24 }}>
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
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
        <form onSubmit={handleSave} className="card" style={{ border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.03)', overflow: 'hidden', animation: 'fadeIn 0.3s ease-in-out' }}>
          <div className="card-header" style={{ padding: '28px 32px', background: 'var(--gray-50)', borderBottom: '1px solid var(--gray-200)' }}>
            <span className="card-title" style={{ fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
              <ShieldCheck size={20} color="var(--danger)" /> Login Credentials
            </span>
          </div>
          <div className="card-body" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: 24 }}>
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
// App Connections Component (Handles complex connection states & modals statically)
// -----------------------------------------------------------------------------

function AppConnectionsTab() {
  const [apps, setApps] = useState([
    {
      id: 'gmail',
      name: 'Gmail',
      imgSrc: '/assets/Gmail_icon_(2020).svg.png',
      color: '#ea4335',
      bgColor: '#fef2f2',
      description: 'Read emails, send emails, search inbox',
      permissions: ['Read emails', 'Send emails', 'Labels'],
      connected: true,
      account: 'john@gmail.com',
      lastSync: '2 mins ago',
      autoSync: true,
    },
    {
      id: 'gdrive',
      name: 'Google Drive',
      imgSrc: '/assets/google-drive (1).png',
      color: '#34a853',
      bgColor: '#f0fdf4',
      description: 'Search files, upload, download',
      permissions: ['Search Drive', 'Upload files', 'Download files'],
      connected: false,
      account: '',
      lastSync: '',
      autoSync: false,
    },
    {
      id: 'gcal',
      name: 'Google Calendar',
      imgSrc: '/assets/google-calendar.png',
      color: '#4285f4',
      bgColor: '#f0f9ff',
      description: 'Automatically sync meetings and viewing appointments.',
      permissions: ['Read calendar events', 'Create events'],
      connected: true,
      account: 'john@gmail.com',
      lastSync: '1 min ago',
      autoSync: true,
    }
  ]);

  const [connectModal, setConnectModal] = useState(null);
  const [manageModal, setManageModal] = useState(null);
  const [disconnectModal, setDisconnectModal] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [permissionToggles, setPermissionToggles] = useState({});

  const handleOpenConnect = (app) => {
    const initialPerms = {};
    app.permissions.forEach(p => initialPerms[p] = true);
    setPermissionToggles(initialPerms);
    setConnectModal(app);
  };

  const handleTogglePerm = (perm) => {
    setPermissionToggles(prev => ({ ...prev, [perm]: !prev[perm] }));
  };

  const simulateConnect = () => {
    setIsConnecting(true);
    setTimeout(() => {
      setApps(prev => prev.map(a => a.id === connectModal.id ? { ...a, connected: true, account: 'john.new@gmail.com', lastSync: 'Just now', autoSync: true } : a));
      setIsConnecting(false);
      setConnectModal(null);
    }, 1500);
  };

  const simulateDisconnect = () => {
    setApps(prev => prev.map(a => a.id === disconnectModal.id ? { ...a, connected: false, account: '', lastSync: '' } : a));
    setDisconnectModal(null);
    setManageModal(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32, animation: 'fadeIn 0.3s ease-in-out' }}>
      
      {/* Integrations List */}
      <div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Plug size={20} color="var(--brand-500)" /> Google Apps
        </h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: '0.9rem' }}>Manage your connected Google services and permissions.</p>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
          {apps.map(app => (
            <div 
              key={app.id} 
              style={{ 
                display: 'flex', flexDirection: 'column', padding: '24px',
                border: '1px solid #e5e7eb', borderRadius: '12px', 
                background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                transition: 'box-shadow 0.2s',
              }}
              onMouseOver={(e) => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'; }}
              onMouseOut={(e) => { e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)'; }}
            >
              {/* Icon — real Google brand image */}
              <div style={{ marginBottom: 16 }}>
                <img src={app.imgSrc} alt={app.name} style={{ width: 36, height: 36, objectFit: 'contain', display: 'block' }} />
              </div>
              
              {/* Name + Connected badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <h3 style={{ fontWeight: 700, fontSize: '1.1rem', margin: 0, color: '#111827', letterSpacing: '-0.2px' }}>{app.name}</h3>
                {app.connected && (
                  <span style={{ 
                    background: '#dcfce7', color: '#15803d', 
                    padding: '2px 8px', borderRadius: 20, 
                    fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.2px'
                  }}>Connected</span>
                )}
              </div>
              
              {/* Description */}
              <p style={{ color: '#6b7280', fontSize: '0.875rem', lineHeight: 1.6, margin: 0, flex: 1 }}>
                {app.description}
              </p>

              {/* Spacer */}
              <div style={{ height: 24 }} />
              
              {/* Button */}
              {app.connected ? (
                <button 
                  type="button" 
                  onClick={() => setManageModal(app)} 
                  style={{ 
                    width: '100%', padding: '10px 16px', 
                    background: 'white', border: '1.5px solid #d1d5db', 
                    borderRadius: '8px', fontWeight: 600, fontSize: '0.9rem',
                    color: '#374151', cursor: 'pointer', transition: 'all 0.15s'
                  }}
                  onMouseOver={(e) => { e.target.style.background = '#f9fafb'; e.target.style.borderColor = '#9ca3af'; }}
                  onMouseOut={(e) => { e.target.style.background = 'white'; e.target.style.borderColor = '#d1d5db'; }}
                >
                  Manage Integration
                </button>
              ) : (
                <button 
                  type="button" 
                  onClick={() => handleOpenConnect(app)} 
                  style={{ 
                    width: '100%', padding: '10px 16px', 
                    background: '#111827', border: 'none', 
                    borderRadius: '8px', fontWeight: 600, fontSize: '0.9rem',
                    color: 'white', cursor: 'pointer', transition: 'background 0.15s'
                  }}
                  onMouseOver={(e) => e.target.style.background = '#1f2937'}
                  onMouseOut={(e) => e.target.style.background = '#111827'}
                >
                  Connect
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <Activity size={18} color="var(--brand-500)" /> Recent Activity
        </h3>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '24px 32px' }}>
          
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>Today</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.9rem' }}>
                <CheckCircle2 size={16} color="#10b981" /> <span>Calendar synced successfully</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.9rem' }}>
                <CheckCircle2 size={16} color="#10b981" /> <span>Email search completed (2 new leads found)</span>
              </div>
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>Yesterday</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.9rem' }}>
                <CheckCircle2 size={16} color="#10b981" /> <span>Uploaded <strong style={{color: 'var(--brand-600)'}}>purchase_contract_m3.pdf</strong> to Google Drive</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.9rem' }}>
                <CheckCircle2 size={16} color="#10b981" /> <span>Created calendar event: <strong>Vehicle Handover - Audi RS6</strong></span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* --- MODALS --- */}
      
      {/* Connect Modal */}
      {connectModal && (
        <div className="modal-overlay" onClick={() => !isConnecting && setConnectModal(null)}>
          <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <img src={connectModal.imgSrc} alt={connectModal.name} style={{ width: 28, height: 28, objectFit: 'contain' }} />
                Connect {connectModal.name}
              </div>
              {!isConnecting && <button className="btn-icon" onClick={() => setConnectModal(null)}><X size={18} /></button>}
            </div>
            <div className="modal-body" style={{ padding: 24, textAlign: 'center' }}>
              {isConnecting ? (
                <div style={{ padding: '40px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                  <RefreshCw size={32} color="var(--brand-500)" className="spin" />
                  <div style={{ fontWeight: 600 }}>Authorizing with Google...</div>
                </div>
              ) : (
                <>
                  <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: '0.95rem', lineHeight: 1.5 }}>
                    Car Agents is requesting access to your Google Account. Please select the permissions you wish to grant:
                  </p>
                  <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 16, textAlign: 'left', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 16 }}>Requested Permissions</div>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {connectModal.permissions.map((perm, idx) => (
                        <li key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.95rem', color: 'var(--gray-800)', fontWeight: 500 }}>
                          <span>{perm}</span>
                          <div 
                            onClick={() => handleTogglePerm(perm)}
                            style={{ 
                              width: 44, height: 24, background: permissionToggles[perm] ? '#10b981' : '#cbd5e1', 
                              borderRadius: 24, position: 'relative', cursor: 'pointer', transition: 'background 0.2s ease-in-out' 
                            }}
                          >
                            <div style={{ 
                              width: 20, height: 20, background: 'white', borderRadius: '50%', 
                              position: 'absolute', top: 2, left: permissionToggles[perm] ? 22 : 2, 
                              transition: 'left 0.2s ease-in-out', boxShadow: '0 1px 3px rgba(0,0,0,0.15)' 
                            }} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}
            </div>
            {!isConnecting && (
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setConnectModal(null)}>Cancel</button>
                <button className="btn btn-primary" onClick={simulateConnect}>Continue with Google</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Manage Modal */}
      {manageModal && (
        <div className="modal-overlay" onClick={() => setManageModal(null)}>
          <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Settings size={18} color="var(--text-secondary)" /> Manage {manageModal.name}
              </div>
              <button className="btn-icon" onClick={() => setManageModal(null)}><X size={18} /></button>
            </div>
            
            <div className="modal-body" style={{ padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingBottom: 24, borderBottom: '1px solid var(--border)', marginBottom: 24 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: manageModal.bgColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img src={manageModal.imgSrc} alt={manageModal.name} style={{ width: 30, height: 30, objectFit: 'contain' }} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{manageModal.account}</div>
                  <div style={{ fontSize: '0.85rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={14} /> Connected</div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 12 }}>Permissions Granted</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {manageModal.permissions.map((perm, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
                        <CheckCircle2 size={14} color="#10b981" /> {perm}
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: 'var(--gray-50)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Auto Sync</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Automatically fetch updates in the background.</div>
                  </div>
                  <label style={{ display: 'flex', cursor: 'pointer' }}>
                    <input type="checkbox" defaultChecked={manageModal.autoSync} style={{ accentColor: 'var(--brand-500)', width: 18, height: 18 }} />
                  </label>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>Sync Frequency</label>
                  <select className="form-select" defaultValue="5m">
                    <option value="1m">Every 1 minute</option>
                    <option value="5m">Every 5 minutes</option>
                    <option value="1h">Every hour</option>
                    <option value="manual">Manual only</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
              <button className="btn btn-danger" style={{ background: 'transparent', color: 'var(--danger)', border: '1px solid var(--danger)' }} onClick={() => { setDisconnectModal(manageModal); }}>
                <Trash2 size={16} /> Disconnect
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary" onClick={() => setManageModal(null)}>Close</button>
                <button className="btn btn-primary"><RefreshCw size={16} /> Reconnect</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Disconnect Warning Modal */}
      {disconnectModal && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-body" style={{ padding: 32, textAlign: 'center' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#fee2e2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <AlertTriangle size={32} />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: 12 }}>Disconnect {disconnectModal.name}?</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: '0.95rem' }}>
                The assistant will no longer have access to your {disconnectModal.name}. You will need to re-authorize to use this feature again.
              </p>
              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setDisconnectModal(null)}>Cancel</button>
                <button className="btn btn-danger" style={{ flex: 1, justifyContent: 'center' }} onClick={simulateDisconnect}>Disconnect</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
