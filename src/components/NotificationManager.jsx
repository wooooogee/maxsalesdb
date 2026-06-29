import React, { useState, useEffect, useRef } from 'react';
import { useUser } from '../UserContext';
import { sheetsClient } from '../sheetsClient';
import toast from 'react-hot-toast';
import { Bell, BellOff } from 'lucide-react';

const NotificationManager = () => {
  const { user } = useUser();
  const [enabled, setEnabled] = useState(() => {
    return localStorage.getItem('push_notifications_enabled') === 'true';
  });
  
  const lastChatIdRef = useRef(localStorage.getItem('last_notified_chat_id'));
  const notifiedMeetingsRef = useRef(JSON.parse(localStorage.getItem('notified_meetings') || '[]'));

  // Initialize and check permission
  useEffect(() => {
    if (enabled && Notification.permission !== 'granted') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          toast.success('알림이 성공적으로 활성화되었습니다.');
          localStorage.setItem('push_notifications_enabled', 'true');
        } else {
          toast.error('브라우저 알림 권한이 차단되어 알림을 켤 수 없습니다.');
          setEnabled(false);
          localStorage.setItem('push_notifications_enabled', 'false');
        }
      });
    }
  }, [enabled]);

  const toggleNotification = () => {
    if (!enabled) {
      setEnabled(true);
      localStorage.setItem('push_notifications_enabled', 'true');
    } else {
      setEnabled(false);
      localStorage.setItem('push_notifications_enabled', 'false');
      toast('알림이 비활성화되었습니다.', { icon: '🔕' });
    }
  };

  const showNotification = (title, body) => {
    if (enabled && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/favicon.ico' });
    }
  };

  // Background Polling Logic
  useEffect(() => {
    if (!enabled || !user) return;

    let isPolling = false;

    const pollData = async () => {
      if (isPolling) return;
      isPolling = true;

      try {
        // 1. Check for new Chat Messages
        const chats = await sheetsClient.read('chat_messages');
        if (chats && chats.length > 0) {
          const sorted = [...chats].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
          const latestChat = sorted[sorted.length - 1];
          
          if (lastChatIdRef.current !== latestChat.id) {
            // New chat detected
            if (lastChatIdRef.current && latestChat.sender !== user) {
              // Only notify if we already had a known last chat (not first load) and it's not our own message
              showNotification(`업무 공유방 - ${latestChat.sender}`, latestChat.text);
            }
            lastChatIdRef.current = latestChat.id;
            localStorage.setItem('last_notified_chat_id', latestChat.id);
          }
        }

        // 2. Check for upcoming meetings (within 30 mins)
        const meetings = await sheetsClient.read('meetings');
        if (meetings && meetings.length > 0) {
          const now = new Date();
          const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
          
          const upcoming = meetings.filter(m => {
            if (!m.date || !m.date.startsWith(todayStr)) return false;
            
            const meetingTime = new Date(m.date);
            const diffMinutes = (meetingTime - now) / (1000 * 60);
            
            return diffMinutes > 0 && diffMinutes <= 30 && !notifiedMeetingsRef.current.includes(m.id);
          });

          upcoming.forEach(m => {
            showNotification('⏰ 다가오는 일정 알림', `30분 내에 예정된 일정이 있습니다.\n대상자: ${m.client_name}`);
            notifiedMeetingsRef.current.push(m.id);
          });

          if (upcoming.length > 0) {
            localStorage.setItem('notified_meetings', JSON.stringify(notifiedMeetingsRef.current));
          }
        }

      } catch (e) {
        console.error('Notification poll error:', e);
      } finally {
        isPolling = false;
      }
    };

    // Run immediately, then every 30 seconds
    pollData();
    const intervalId = setInterval(pollData, 30000);

    return () => clearInterval(intervalId);
  }, [enabled, user]);

  return (
    <button 
      onClick={toggleNotification}
      className="btn-secondary btn-sm"
      style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '0.4rem', 
        padding: '0.4rem 0.6rem', 
        borderRadius: '20px', 
        fontSize: '0.8rem',
        border: 'none',
        backgroundColor: enabled ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
        color: enabled ? 'var(--primary-color)' : 'var(--text-secondary)'
      }}
      title={enabled ? "알림 끄기" : "알림 켜기"}
    >
      {enabled ? <Bell size={16} /> : <BellOff size={16} />}
      <span className="hide-on-mobile">{enabled ? '알림 켜짐' : '알림 꺼짐'}</span>
    </button>
  );
};

export default NotificationManager;
