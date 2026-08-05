import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import {
  LayoutDashboard, Users, FolderKanban, MessageSquare,
  FileText, Calendar, Car, User, Briefcase,
  ChevronsUpDown, LogOut, Settings
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
import SellForm from './pages/SellForm';
import BuyForm from './pages/BuyForm';
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

function Sidebar({ online, onLogout, userProfile }) {
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-logo">
          <div className="sidebar-brand-icon">
            <Car size={18} />
          </div>
          <div>
            <div className="sidebar-brand-name">CAR-AGENTS</div>
            <div className="sidebar-brand-sub">Operations Portal</div>
          </div>
        </div>
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
              >
                <Icon size={16} className="nav-icon" />
                {label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer" style={{ position: 'relative' }}>
        <button
          className="nav-item"
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', height: 'auto', background: showProfileMenu ? 'var(--sidebar-hover)' : 'transparent', borderRadius: 'var(--radius)' }}
          onClick={() => setShowProfileMenu(!showProfileMenu)}
        >
          <div style={{ width: 32, height: 32, borderRadius: 6, background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {userProfile?.picture ? (
              <img src={userProfile.picture} alt="User" style={{ width: 28, height: 28, borderRadius: '50%' }} />
            ) : (
              <User size={18} color="#f1f5f9" />
            )}
          </div>
          <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.2 }}>
              {userProfile?.name || (userProfile?.email ? userProfile.email.split('@')[0] : 'Vikas Broker')}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.2 }}>
              {userProfile?.email || 'vikaspurohit105@gmail.com'}
            </div>
          </div>
          <ChevronsUpDown size={16} color="#94a3b8" />
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

  return (
    <BrowserRouter>
      <AppRoutes
        isAuthenticated={isAuthenticated}
        online={online}
        userProfile={userProfile}
        onLogin={handleLogin}
        onLogout={handleLogout}
      />
    </BrowserRouter>
  );
}

function AppRoutes({ isAuthenticated, online, userProfile, onLogin, onLogout }) {
  const { pathname } = useLocation();

  // Public customer forms — accessible without portal login
  if (pathname.startsWith('/form/')) {
    return pathname === '/form/buy' ? <BuyForm /> : <SellForm />;
  }

  if (!isAuthenticated) {
    return <Auth onLogin={onLogin} />;
  }

  return (
    <div className="portal-layout">
      <Sidebar online={online} onLogout={onLogout} userProfile={userProfile} />
      <div className="main-content">
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
  );
}
