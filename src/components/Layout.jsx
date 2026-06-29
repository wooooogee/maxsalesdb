import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { Home, Users, MessageSquare, Calendar, FileText, Navigation } from 'lucide-react';
import './Layout.css';

const Layout = () => {
  const navLinks = [
    { to: '/', icon: <Home size={20} />, label: '홈' },
    { to: '/contacts', icon: <Users size={20} />, label: '대상자 관리' },
    { to: '/meetings', icon: <Calendar size={20} />, label: '상담 기록' },
    { to: '/route', icon: <FileText size={20} />, label: '기록 내용' },
    { to: '/chat', icon: <MessageSquare size={20} />, label: '업무 공유방' },
  ];

  return (
    <div className="layout-container">
      {/* Desktop Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2>맥스세일즈</h2>
        </div>
        <nav className="sidebar-nav">
          {navLinks.map(link => (
            <NavLink 
              key={link.to} 
              to={link.to} 
              className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
            >
              {link.icon}
              <span>{link.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="main-content">
        <header className="top-header">
          <div className="header-title">미팅 및 상담 기록 시스템</div>
          <div className="header-actions">
            <button className="btn-icon">
              <Calendar size={20} />
            </button>
          </div>
        </header>
        <div className="page-content">
          <Outlet />
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="mobile-nav">
        {navLinks.map(link => (
          <NavLink 
            key={link.to} 
            to={link.to} 
            className={({ isActive }) => (isActive ? 'mobile-nav-item active' : 'mobile-nav-item')}
          >
            {React.cloneElement(link.icon, { size: 24 })}
            <span>{link.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
};

export default Layout;
