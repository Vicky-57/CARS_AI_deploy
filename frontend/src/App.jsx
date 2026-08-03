import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import {
  LayoutDashboard, Users, FolderKanban, MessageSquare,
  FileText, Calendar, Mic, Car, Activity, ChevronRight, Wifi, WifiOff
} from 'lucide-react';

import Dashboard from './pages/Dashboard';
import Leads from './pages/Leads';
import Projects from './pages/Projects';
import Communications from './pages/Communications';
import Contracts from './pages/Contracts';
import CalendarPage from './pages/Calendar';
import VoiceNotes from './pages/VoiceNotes';
import { api } from './api/api';

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
      { path: '/communications', icon: MessageSquare, label: 'Communications' },
      { path: '/projects', icon: FolderKanban, label: 'Projects' },
    ],
  },
  {
    section: 'Tools',
    items: [
      { path: '/contracts', icon: FileText, label: 'Contracts' },
      { path: '/calendar', icon: Calendar, label: 'Calendar' },
      { path: '/voice', icon: Mic, label: 'Voice Notes' },
    ],
  },
];

const PAGE_TITLES = {
  '/': 'Dashboard',
  '/leads': 'Leads',
  '/communications': 'Communications',
  '/projects': 'Projects',
  '/contracts': 'Contracts',
  '/calendar': 'Calendar',
  '/voice': 'Voice Notes',
};

function Sidebar({ online }) {
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

      <div className="sidebar-status">
        {online
          ? <><span className="status-dot online" /><span>Frappe CRM connected</span></>
          : <><span className="status-dot" /><span>Frappe CRM offline</span></>
        }
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

      <div className="sidebar-footer">
        <div className="nav-item" style={{ color: '#475569', fontSize: '0.72rem', cursor: 'default' }}>
          <Activity size={14} />
          v5.0.0 — Frappe CRM
        </div>
      </div>
    </aside>
  );
}

function Topbar() {
  const loc = useLocation();
  const title = PAGE_TITLES[loc.pathname] || 'Portal';
  return (
    <div className="topbar">
      <div className="topbar-title">{title}</div>
      <div className="topbar-actions">
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          CAR-AGENTS Broker Portal
        </span>
      </div>
    </div>
  );
}

export default function App() {
  const [online, setOnline] = useState(false);

  useEffect(() => {
    // Check Frappe CRM connection
    api.health()
      .then(() => setOnline(true))
      .catch(() => setOnline(false));
  }, []);

  return (
    <BrowserRouter>
      <div className="portal-layout">
        <Sidebar online={online} />
        <div className="main-content">
          <Topbar />
          <div className="page-content">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/leads" element={<Leads />} />
              <Route path="/communications" element={<Communications />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/contracts" element={<Contracts />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/voice" element={<VoiceNotes />} />
            </Routes>
          </div>
        </div>
      </div>
    </BrowserRouter>
  );
}
