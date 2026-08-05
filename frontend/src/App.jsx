import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { useState, useEffect } from 'react';
import {
  LayoutDashboard, Users, FolderKanban, MessageSquare,
  FileText, Calendar, Car, User, Briefcase,
  ChevronsUpDown, LogOut, Settings, Menu, PanelLeftClose, PanelLeft
} from 'lucide-react';

import Dashboard from './pages/Dashboard';
import Leads from './pages/Leads';
import Customers from './pages/Customers';
import Projects from './pages/Projects';
import Deals from './pages/Deals';
import Communications from './pages/Communications';
import Contracts from './pages/Contracts';
import CalendarPage from './pages/Calendar';
import Auth from './pages/Auth';
import Profile from './pages/Profile';
import { api, supabase } from './api/api';

const NAV = [
  {
    section: 'Overview',
    items: [
      { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    ],
  },
  {
    section: 'CRM',
    items: [
      { path: '/leads', icon: Users, label: 'Leads' },
      { path: '/customers', icon: Users, label: 'Customers' },
      { path: '/communications', icon: MessageSquare, label: 'Communications' },
      { path: '/projects', icon: FolderKanban, label: 'Projects' },
      { path: '/deals', icon: Briefcase, label: 'Deals' },
    ],
  },
  {
    section: 'Tools',
    items: [
      { path: '/contracts', icon: FileText, label: 'Documentation' },
      { path: '/calendar', icon: Calendar, label: 'Calendar' },
    ],
  },
];

function Sidebar({ online, onLogout, userProfile, isOpen, onClose, isCollapsed, onToggleCollapse, onExpand }) {
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''} ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-brand">
        <div className="sidebar-brand-logo" onClick={onToggleCollapse} style={{ cursor: 'pointer' }} title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}>
          <div className="sidebar-brand-icon" style={{ background: 'transparent', width: 36, height: 36 }}>
            <img src="/assets/car.png" alt="CAR-AGENTS Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
          </div>
          <div className="brand-text">
            <div className="sidebar-brand-name">CAR-AGENTS</div>
            <div className="sidebar-brand-sub">Operations Portal</div>
          </div>
        </div>
        {!isCollapsed && (
          <button className="collapse-toggle" onClick={onToggleCollapse} title="Collapse Sidebar">
            <PanelLeftClose size={18} />
          </button>
        )}
      </div>

      <nav className="sidebar-nav">
        {NAV.map(({ section, items }) => (
          <div key={section}>
            <div className="sidebar-section-label">{section}</div>
            {items.map(({ path, icon: Icon, label }) => (
              <NavLink
                key={path}
                to={path}
                end={path === '/'}
                className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                onClick={() => {
                  onClose();
                  if (isCollapsed && onExpand) onExpand();
                }}
                title={isCollapsed ? label : undefined}
              >
                <Icon size={16} className="nav-icon" />
                <span className="nav-item-text">{label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer" style={{ position: 'relative' }}>
        <button
          className="nav-item user-profile-btn"
          style={{ background: showProfileMenu ? 'var(--sidebar-hover)' : 'transparent' }}
          onClick={() => setShowProfileMenu(!showProfileMenu)}
        >
          <div style={{ width: 32, height: 32, borderRadius: 6, background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {userProfile?.picture ? (
              <img src={userProfile.picture} alt="User" style={{ width: 28, height: 28, borderRadius: '50%' }} />
            ) : (
              <User size={18} color="#f1f5f9" />
            )}
          </div>
          <div className="user-info-text" style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.2 }}>
              {userProfile?.name || (userProfile?.email ? userProfile.email.split('@')[0] : 'Vikas Broker')}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.2 }}>
              {userProfile?.email || 'vikaspurohit105@gmail.com'}
            </div>
          </div>
          <ChevronsUpDown size={16} color="#94a3b8" className="user-dropdown-icon" />
        </button>

        {showProfileMenu && (
          <div style={{
            position: 'absolute',
            bottom: 'calc(100% + 8px)',
            left: 16,
            right: 16,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            boxShadow: 'var(--shadow-md)',
            padding: 4,
            zIndex: 50,
            animation: 'fadeIn 0.15s ease'
          }}>
            <NavLink
              to="/profile"
              className="popover-item"
              onClick={() => setShowProfileMenu(false)}
            >
              <Settings size={14} /> Profile Settings
            </NavLink>
            <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
            <button
              className="popover-item text-danger"
              onClick={() => {
                setShowProfileMenu(false);
                onLogout();
              }}
            >
              <LogOut size={14} /> Log out
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

export default function App() {
  const [online, setOnline] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true';
  });
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return !!localStorage.getItem('car_agents_user');
  });
  const [userProfile, setUserProfile] = useState(() => {
    try {
      const stored = localStorage.getItem('car_agents_user');
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  });

  useEffect(() => {
    // Check connection
    api.health()
      .then(() => setOnline(true))
      .catch(() => setOnline(false));

    // Fetch dynamic user profile from Google OAuth Status if connected
    if (api.googleAuthStatus) {
      api.googleAuthStatus()
        .then(res => {
          if (res && res.connected) {
            const profile = {
              name: res.name || (res.email ? res.email.split('@')[0] : 'Vikas Broker'),
              email: res.email || 'vikaspurohit105@gmail.com',
              picture: res.picture || null
            };
            setUserProfile(profile);
            localStorage.setItem('car_agents_user', JSON.stringify(profile));
          }
        })
        .catch(() => {});
    }
  }, []);

  const handleLogin = (user) => {
    const profile = user || { email: 'vikaspurohit105@gmail.com', name: 'Vikas Broker' };
    setUserProfile(profile);
    localStorage.setItem('car_agents_user', JSON.stringify(profile));
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('car_agents_user');
    localStorage.removeItem('car_agents_token');
    supabase.auth.signOut().catch(() => {});
    setUserProfile(null);
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return <Auth onLogin={handleLogin} />;
  }

  return (
    <BrowserRouter>
      <div className="portal-layout">
        <Sidebar 
          online={online} 
          onLogout={handleLogout} 
          userProfile={userProfile} 
          isOpen={sidebarOpen} 
          onClose={() => setSidebarOpen(false)}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={() => {
            const newVal = !sidebarCollapsed;
            setSidebarCollapsed(newVal);
            localStorage.setItem('sidebar_collapsed', newVal);
          }}
          onExpand={() => {
            setSidebarCollapsed(false);
            localStorage.setItem('sidebar_collapsed', 'false');
          }}
        />
        {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)}></div>}
        <div className="main-content">
          <div className="mobile-header">
            <button className="btn-icon" onClick={() => setSidebarOpen(true)}>
              <Menu size={24} color="var(--text-primary)" />
            </button>
            <div className="mobile-brand-name">CAR-AGENTS</div>
            <div style={{ width: 36 }}></div>
          </div>
          <div className="page-content">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/leads" element={<Leads />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/communications" element={<Communications />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/deals" element={<Deals />} />
              <Route path="/contracts" element={<Contracts />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/profile" element={<Profile />} />
            </Routes>
          </div>
        </div>
      </div>
    </BrowserRouter>
  );
}
