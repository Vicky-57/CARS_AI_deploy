import { BrowserRouter, Routes, Route, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import {
  LayoutDashboard, Users, FolderKanban, MessageSquare,
  FileText, Calendar, Car, User, Briefcase, Search,
  ChevronsUpDown, LogOut, Settings, Menu, PanelLeftClose, PanelLeft,
  ChevronRight, ChevronLeft, Command, Bell, HelpCircle
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
import GoogleTranslate from './components/GoogleTranslate';

const NAV = [
  {
    section: 'Workspace',
    items: [
      { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    ],
  },
  {
    section: 'CRM & Brokerage',
    items: [
      { path: '/leads', icon: Users, label: 'Leads' },
      { path: '/customers', icon: Users, label: 'Customers' },
      { path: '/projects', icon: FolderKanban, label: 'Deals & Projects' },
      { path: '/communications', icon: MessageSquare, label: 'Communications' },
    ],
  },
  {
    section: 'Tools & Documentation',
    items: [
      { path: '/contracts', icon: FileText, label: 'Documentation' },
      { path: '/calendar', icon: Calendar, label: 'Calendar' },
    ],
  },
];

const BREADCRUMB_MAP = {
  '/': ['Workspace', 'Dashboard'],
  '/leads': ['CRM', 'Leads'],
  '/customers': ['CRM', 'Customers'],
  '/projects': ['Brokerage', 'Deals & Projects'],
  '/deals': ['Brokerage', 'Deals & Projects'],
  '/communications': ['Brokerage', 'Communications'],
  '/contracts': ['Documentation', 'Contract Engine'],
  '/calendar': ['Tools', 'Calendar & Schedule'],
  '/profile': ['System', 'Profile & Settings'],
};

function DeskTopbar({ online, userProfile }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  
  const crumbs = BREADCRUMB_MAP[location.pathname] || ['Portal', 'Overview'];

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;
    const term = searchTerm.toLowerCase();
    if (term.includes('lead')) navigate('/leads');
    else if (term.includes('deal') || term.includes('project') || term.includes('car')) navigate('/projects');
    else if (term.includes('customer') || term.includes('client')) navigate('/customers');
    else if (term.includes('contract') || term.includes('doc') || term.includes('pdf')) navigate('/contracts');
    else if (term.includes('cal') || term.includes('sched')) navigate('/calendar');
    else if (term.includes('set') || term.includes('prof')) navigate('/profile');
    else navigate('/leads');
    setSearchTerm('');
  };

  return (
    <header className="desk-topbar">
      {/* Breadcrumb Trail */}
      <div className="desk-breadcrumbs">
        <span className="desk-breadcrumbs-item" style={{ fontWeight: 600 }}>CAR-AGENTS</span>
        <ChevronRight size={13} className="desk-breadcrumbs-sep" />
        <span className="desk-breadcrumbs-item">{crumbs[0]}</span>
        <ChevronRight size={13} className="desk-breadcrumbs-sep" />
        <span className="desk-breadcrumbs-item active">{crumbs[1]}</span>
      </div>



      {/* Right Topbar Actions & Status */}
      <div className="desk-topbar-actions">
        <GoogleTranslate />

        {/* Frappe Awesome Bar (Global Search) */}
        <form onSubmit={handleSearchSubmit} className="desk-search-bar">
          <Search size={14} color="var(--text-muted)" />
          <input
            type="text"
            className="desk-search-input"
            placeholder="Search or jump to... (e.g. Leads, Deals, Docs)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <div className="desk-search-kbd">⌘K</div>
        </form>
      </div>
    </header>
  );
}

function Sidebar({ online, onLogout, userProfile, isOpen, onClose, isCollapsed, onToggleCollapse, onExpand }) {
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''} ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-brand">
        <div
          className="sidebar-brand-logo"
          onClick={() => {
            if (typeof window !== 'undefined' && window.innerWidth <= 768) {
              onClose();
            } else {
              onToggleCollapse();
            }
          }}
          style={{ cursor: 'pointer' }}
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          <div className="sidebar-brand-icon" style={{ background: '#1e293b', width: 30, height: 30 }}>
            <Car size={18} color="#ffffff" />
          </div>
          <div className="brand-text">
            <div className="sidebar-brand-name">CAR-AGENTS</div>
            <div className="sidebar-brand-sub">Desk</div>
          </div>
        </div>
        {!isCollapsed && (
          <button
            className="collapse-toggle"
            onClick={() => {
              if (typeof window !== 'undefined' && window.innerWidth <= 768) {
                onClose();
              } else {
                onToggleCollapse();
              }
            }}
            title="Collapse Sidebar"
          >
            <PanelLeftClose size={16} />
          </button>
        )}
      </div>

      {/* Floating edge collapse/expand toggle */}
      <button
        className="sidebar-edge-toggle"
        onClick={() => {
          if (typeof window !== 'undefined' && window.innerWidth <= 768) {
            onClose();
          } else {
            onToggleCollapse();
          }
        }}
        title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
      >
        {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

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
                data-tooltip={label}
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
          style={{ background: showProfileMenu ? 'var(--sidebar-hover)' : 'transparent', gap: 10 }}
          onClick={() => setShowProfileMenu(!showProfileMenu)}
        >
          {/* Avatar: photo if available, else initials circle */}
          {userProfile?.picture ? (
            <img
              src={userProfile.picture}
              alt="User"
              style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, objectFit: 'cover' }}
            />
          ) : (
            <div style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              background: '#D4EDDA',
              color: '#2E7D52',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '0.78rem',
              flexShrink: 0,
              letterSpacing: '0.02em',
            }}>
              {(() => {
                const name = userProfile?.name || (userProfile?.email ? userProfile.email.split('@')[0] : 'VB');
                return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
              })()}
            </div>
          )}

          <div className="user-info-text" style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.3 }}>
              {userProfile?.name || (userProfile?.email ? userProfile.email.split('@')[0] : 'Vikas Broker')}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.3 }}>
              {userProfile?.email || 'vikaspurohit105@gmail.com'}
            </div>
          </div>
          <ChevronsUpDown size={14} color="var(--text-muted)" className="user-dropdown-icon" />
        </button>

        {showProfileMenu && (
          <div style={{
            position: 'absolute',
            bottom: 'calc(100% + 8px)',
            left: 10,
            width: 210,
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            boxShadow: 'var(--shadow-md)',
            padding: 4,
            zIndex: 50,
            animation: 'modalFadeIn 0.15s ease'
          }}>
            <NavLink
              to="/profile"
              className="btn btn-ghost"
              style={{ width: '100%', justifyContent: 'flex-start', padding: '8px 10px' }}
              onClick={() => setShowProfileMenu(false)}
            >
              <Settings size={14} /> Profile Settings
            </NavLink>
            <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
            <button
              className="btn btn-ghost"
              style={{ width: '100%', justifyContent: 'flex-start', padding: '8px 10px', color: 'var(--status-red-text)' }}
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true';
  });
  const { pathname } = useLocation();

  // Public customer forms — accessible without portal login
  if (pathname.startsWith('/form/')) {
    return pathname === '/form/buy' ? <BuyForm /> : <SellForm />;
  }

  if (!isAuthenticated) {
    return (
      <>
        <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 9999 }}>
          <GoogleTranslate />
        </div>
        <Auth onLogin={onLogin} />
      </>
    );
  }

  return (
    <>

      <div className="portal-layout">
        <Sidebar 
          online={online} 
          onLogout={onLogout} 
          userProfile={userProfile} 
          isOpen={sidebarOpen} 
          onClose={() => setSidebarOpen(false)}
          isCollapsed={sidebarCollapsed && typeof window !== 'undefined' && window.innerWidth > 768}
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
          {/* Frappe Desk Topbar */}
          <DeskTopbar online={online} userProfile={userProfile} />

          {/* Mobile Header for small screens */}
          <div className="mobile-header">
            <button className="btn-icon" onClick={() => setSidebarOpen(true)}>
              <Menu size={20} color="var(--text-primary)" />
            </button>
            <div className="mobile-brand-name">CAR-AGENTS</div>
            <div style={{ width: 28 }}></div>
          </div>

          {/* Dynamic Page Views */}
          <div className="page-content">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/leads" element={<Leads />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/communications" element={<Communications />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/deals" element={<Projects />} />
              <Route path="/contracts" element={<Contracts />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/profile" element={<Profile />} />
            </Routes>
          </div>
        </div>
      </div>
    </>
  );
}
