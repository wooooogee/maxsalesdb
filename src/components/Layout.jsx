import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { Home, Users, MessageSquare, Calendar, FileText, Navigation } from 'lucide-react';
import './Layout.css';
import { useUser } from '../UserContext';
import { sheetsClient } from '../sheetsClient';

import NotificationManager from './NotificationManager';

const Layout = () => {
  const location = useLocation();
  const { user } = useUser();
  const [hasNewChat, setHasNewChat] = useState(false);

  // Check for new chat messages periodically
  useEffect(() => {
    if (!user) return;
    
    const checkNewChat = async () => {
      try {
        const chats = await sheetsClient.read('chat_messages');
        if (chats && chats.length > 0) {
          const sorted = [...chats].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
          const latestChat = sorted[sorted.length - 1];
          const lastReadId = localStorage.getItem('last_read_chat_id');
          
          if (latestChat.id !== lastReadId && latestChat.user_name !== user) {
            setHasNewChat(true);
          } else {
            setHasNewChat(false);
          }
        }
      } catch (e) {
        console.error('Failed to check new chats:', e);
      }
    };

    // When entering chat page, mark as read
    if (location.pathname === '/chat') {
      setHasNewChat(false);
      // We also need to update last_read_chat_id, but we'll let Chat.jsx do that or do it here
      // But we don't have the latest chat ID here without fetching.
      // So we just hide the badge. The Chat.jsx should update last_read_chat_id
    } else {
      checkNewChat();
    }

    const intervalId = setInterval(() => {
      if (location.pathname !== '/chat') {
        checkNewChat();
      }
    }, 15000); // Check every 15s

    // Listen to custom event for immediate update
    const handleBadgeUpdate = (e) => {
      if (e.detail?.hasNew && location.pathname !== '/chat') {
        setHasNewChat(true);
      } else if (e.detail?.hasNew === false) {
        setHasNewChat(false);
      }
    };
    window.addEventListener('chat_badge_update', handleBadgeUpdate);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('chat_badge_update', handleBadgeUpdate);
    };
  }, [user, location.pathname]);

  const navLinks = [
    { to: '/', icon: <Home size={20} />, label: '홈' },
    { to: '/meetings', icon: <Calendar size={20} />, label: '상담 기록' },
    { to: '/route', icon: <FileText size={20} />, label: '기록 내용' },
    { to: '/chat', icon: <MessageSquare size={20} />, label: '업무 공유방', badge: hasNewChat },
    { to: '/contacts', icon: <Users size={20} />, label: '대상자 관리' },
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
              onClick={() => {
                if (link.to === '/meetings') {
                  sessionStorage.removeItem('meetingLogDraft');
                }
              }}
              style={{ position: 'relative' }}
            >
              {link.icon}
              <span>{link.label}</span>
              {link.badge && (
                <span style={{
                  position: 'absolute',
                  top: '6px',
                  right: '12px',
                  backgroundColor: 'var(--danger-color, #ef4444)',
                  color: 'white',
                  fontSize: '0.6rem',
                  fontWeight: 'bold',
                  padding: '2px 5px',
                  borderRadius: '10px'
                }}>
                  NEW
                </span>
              )}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="main-content">
        <header className="top-header">
          <div className="header-title">미팅 및 상담 기록 시스템</div>
          <div className="header-actions" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <NotificationManager />
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
            onClick={() => {
              if (link.to === '/meetings') {
                sessionStorage.removeItem('meetingLogDraft');
              }
            }}
            style={{ position: 'relative' }}
          >
            {React.cloneElement(link.icon, { size: 24 })}
            <span>{link.label}</span>
            {link.badge && (
                <span style={{
                  position: 'absolute',
                  top: '2px',
                  right: '25%',
                  backgroundColor: 'var(--danger-color, #ef4444)',
                  color: 'white',
                  fontSize: '0.55rem',
                  fontWeight: 'bold',
                  padding: '1px 4px',
                  borderRadius: '8px'
                }}>
                  N
                </span>
              )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
};

export default Layout;
