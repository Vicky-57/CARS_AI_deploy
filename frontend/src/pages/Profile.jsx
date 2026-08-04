import { useState } from 'react';
import { User, Mail, Phone, MessageCircle, Lock, Save, ShieldCheck } from 'lucide-react';

export default function Profile() {
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
      if (name === 'phone' && syncWhatsapp) {
        next.whatsapp = value;
      }
      if (name === 'whatsapp') {
        setSyncWhatsapp(false); // manual edit breaks sync
      }
      return next;
    });
  };

  const handleSyncToggle = (e) => {
    const checked = e.target.checked;
    setSyncWhatsapp(checked);
    if (checked) {
      setFormData(prev => ({ ...prev, whatsapp: prev.phone }));
    }
  };

  const handleSave = (e) => {
    e.preventDefault();
    setLoading(true);
    // Simulate static save
    setTimeout(() => {
      setLoading(false);
      alert('Profile settings saved successfully (Static Preview)');
    }, 800);
  };

  return (
    <div style={{ paddingBottom: 40, maxWidth: 800, margin: '0 auto' }}>
      <div className="page-header" style={{ alignItems: 'flex-end', marginBottom: 32 }}>
        <div className="page-header-left">
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.5px' }}>Profile Settings</h1>
          <p style={{ fontSize: '0.9rem' }}>Manage your account details and login credentials</p>
        </div>
      </div>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        
        {/* Card 1: Personal Info */}
        <div className="card" style={{ border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.03)', overflow: 'hidden' }}>
          <div className="card-header" style={{ padding: '24px 32px', background: 'var(--gray-50)', borderBottom: '1px solid var(--gray-200)' }}>
            <span className="card-title" style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <User size={18} color="var(--brand-500)" /> Personal Information
            </span>
          </div>
          
          <div className="card-body" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Full Name</label>
              <div style={{ position: 'relative' }}>
                <User size={18} color="var(--gray-400)" style={{ position: 'absolute', left: 16, top: 12 }} />
                <input 
                  type="text" 
                  name="name"
                  className="form-input" 
                  style={{ paddingLeft: 44, paddingRight: 16, height: 44, fontSize: '0.95rem' }} 
                  value={formData.name}
                  onChange={handleChange}
                  required 
                />
              </div>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Email Address</label>
              <div style={{ position: 'relative' }}>
                <Mail size={18} color="var(--gray-400)" style={{ position: 'absolute', left: 16, top: 12 }} />
                <input 
                  type="email" 
                  name="email"
                  className="form-input" 
                  style={{ paddingLeft: 44, paddingRight: 16, height: 44, fontSize: '0.95rem' }} 
                  value={formData.email}
                  onChange={handleChange}
                  required 
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Phone Number</label>
                <div style={{ position: 'relative' }}>
                  <Phone size={18} color="var(--gray-400)" style={{ position: 'absolute', left: 16, top: 12 }} />
                  <input 
                    type="tel" 
                    name="phone"
                    className="form-input" 
                    style={{ paddingLeft: 44, paddingRight: 16, height: 44, fontSize: '0.95rem' }} 
                    value={formData.phone}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="form-group" style={{ margin: 0, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label className="form-label" style={{ fontWeight: 600, color: 'var(--text-secondary)', margin: 0 }}>WhatsApp Number</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={syncWhatsapp} 
                      onChange={handleSyncToggle}
                      style={{ accentColor: 'var(--brand-500)', width: 14, height: 14, margin: 0 }}
                    />
                    Same as Phone
                  </label>
                </div>
                <div style={{ position: 'relative' }}>
                  <MessageCircle size={18} color="#25D366" style={{ position: 'absolute', left: 16, top: 12 }} />
                  <input 
                    type="tel" 
                    name="whatsapp"
                    className="form-input" 
                    style={{ paddingLeft: 44, paddingRight: 16, height: 44, fontSize: '0.95rem', background: syncWhatsapp ? 'var(--gray-50)' : 'white' }} 
                    value={formData.whatsapp}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Card 2: Security */}
        <div className="card" style={{ border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.03)', overflow: 'hidden' }}>
          <div className="card-header" style={{ padding: '24px 32px', background: 'var(--gray-50)', borderBottom: '1px solid var(--gray-200)' }}>
            <span className="card-title" style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldCheck size={18} color="var(--danger)" /> Login Credentials
            </span>
          </div>
          
          <div className="card-body" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>New Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} color="var(--gray-400)" style={{ position: 'absolute', left: 16, top: 12 }} />
                <input 
                  type="password" 
                  name="password"
                  className="form-input" 
                  style={{ paddingLeft: 44, paddingRight: 16, height: 44, fontSize: '0.95rem' }} 
                  placeholder="Leave blank to keep current password"
                  value={formData.password}
                  onChange={handleChange}
                />
              </div>
            </div>
            
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Confirm New Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} color="var(--gray-400)" style={{ position: 'absolute', left: 16, top: 12 }} />
                <input 
                  type="password" 
                  name="confirmPassword"
                  className="form-input" 
                  style={{ paddingLeft: 44, paddingRight: 16, height: 44, fontSize: '0.95rem' }} 
                  placeholder="Confirm new password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ padding: '12px 32px', fontSize: '1rem', fontWeight: 600 }}>
            <Save size={18} />
            {loading ? 'Saving Changes...' : 'Save Settings'}
          </button>
        </div>

      </form>
    </div>
  );
}
