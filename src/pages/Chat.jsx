import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { sheetsClient } from '../sheetsClient';
import { Send, CheckCircle, Clock, Type, X, Calendar as CalendarIcon, CheckSquare } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import './Chat.css';

const MOCK_MESSAGES = [];

const Chat = () => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const messagesEndRef = useRef(null);
  
  // For interaction context menu
  const [selectedMsgId, setSelectedMsgId] = useState(null);

  // Supabase 설정 유무 체크
  const isSupabaseConfigured = () => {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    return (
      url && 
      url !== 'https://YOUR_SUPABASE_PROJECT_ID.supabase.co' && 
      url.startsWith('http') &&
      key &&
      key !== 'YOUR_SUPABASE_ANON_KEY'
    );
  };

  useEffect(() => {
    // 오래된 캐시 데이터 삭제 처리
    const cached = localStorage.getItem('sheet_v3_chat_messages');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        const hasMock = parsed.some(m => m.user_name === '김철수' || m.user_name === '이영희');
        if (hasMock) {
          localStorage.removeItem('sheet_v3_chat_messages');
        }
      } catch (e) {}
    }
    localStorage.removeItem('local_chat_messages');

    fetchMessages();
    let unsubscribe = () => {};
    let pollInterval = null;
    
    if (isSupabaseConfigured()) {
      unsubscribe = setupRealtime();
    } else {
      // Supabase가 없을 경우 구글 시트 변경사항을 5초마다 폴링 (실시간 동기화 효과)
      pollInterval = setInterval(() => {
        fetchMessages(true);
      }, 5000);
    }
    
    return () => {
      unsubscribe();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const getLocalMessages = () => {
    const data = localStorage.getItem('local_chat_messages');
    if (!data) {
      localStorage.setItem('local_chat_messages', JSON.stringify(MOCK_MESSAGES));
      return MOCK_MESSAGES;
    }
    return JSON.parse(data);
  };

  const saveLocalMessages = (newMsgs) => {
    localStorage.setItem('local_chat_messages', JSON.stringify(newMsgs));
  };

  const fetchMessages = async (silent = false) => {
    try {
      if (!silent) {
        const cached = localStorage.getItem('sheet_v3_chat_messages');
        if (cached) {
          setMessages(JSON.parse(cached));
          setLoading(false);
        } else {
          setLoading(true);
        }
      }

      if (isSupabaseConfigured()) {
        const { data, error } = await supabase.from('chat_messages').select('*').order('created_at', { ascending: true });
        if (error) throw error;
        setMessages(data || []);
      } else {
        const data = await sheetsClient.read('chat_messages');
        if (data && data.length > 0) {
          const sorted = data.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
          setMessages(prev => {
            // 변경사항이 있을 때만 업데이트하여 불필요한 스크롤 이동 방지
            const isSame = prev.length === sorted.length && JSON.stringify(prev) === JSON.stringify(sorted);
            return isSame ? prev : sorted;
          });
          localStorage.setItem('sheet_v3_chat_messages', JSON.stringify(sorted));
        } else {
          setMessages(prev => {
            const isSame = prev.length === MOCK_MESSAGES.length && JSON.stringify(prev) === JSON.stringify(MOCK_MESSAGES);
            return isSame ? prev : MOCK_MESSAGES;
          });
          localStorage.setItem('sheet_v3_chat_messages', JSON.stringify(MOCK_MESSAGES));
        }
      }
    } catch (error) {
      console.warn('Fetch failed, falling back to cached messages.', error.message);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const setupRealtime = () => {
    try {
      const channel = supabase
        .channel('public:chat_messages')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, payload => {
          setMessages(prev => [...prev, payload.new]);
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_messages' }, payload => {
          setMessages(prev => prev.map(msg => msg.id === payload.new.id ? payload.new : msg));
        })
        .subscribe();
        
      return () => {
        supabase.removeChannel(channel);
      };
    } catch (e) {
      console.warn("Supabase realtime failed to subscribe:", e);
      return () => {};
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const msgData = {
      text: newMessage,
      user_name: '나(현재 사용자)',
      status: 'normal',
      created_at: new Date().toISOString()
    };

    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase.from('chat_messages').insert([msgData]);
        if (error) throw error;
      } catch (error) {
        console.warn("Supabase insert failed:", error);
      }
    } else {
      try {
        toast.loading('메시지 전송 중...', { id: 'chat-send' });
        const saved = await sheetsClient.insert('chat_messages', msgData);
        setMessages(prev => {
          const next = [...prev, saved];
          localStorage.setItem('sheet_v3_chat_messages', JSON.stringify(next));
          return next;
        });
        toast.success('메시지가 전송되었습니다.', { id: 'chat-send' });
      } catch (err) {
        toast.error('메시지 전송 실패: ' + err.message, { id: 'chat-send' });
      }
    }
    setNewMessage('');
  };

  const handleUpdateStatus = async (id, newStatus) => {
    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase.from('chat_messages').update({ status: newStatus }).eq('id', id);
        if (error) throw error;
      } catch (error) {
        console.warn("Supabase status update failed:", error);
      }
    } else {
      try {
        toast.loading('메시지 상태 변경 중...', { id: 'chat-status' });
        const existing = messages.find(m => m.id === id);
        if (existing) {
          const updatedMsg = { ...existing, status: newStatus };
          await sheetsClient.update('chat_messages', updatedMsg);
          setMessages(prev => {
            const next = prev.map(msg => msg.id === id ? updatedMsg : msg);
            localStorage.setItem('sheet_v3_chat_messages', JSON.stringify(next));
            return next;
          });
          toast.success('메시지 상태가 변경되었습니다.', { id: 'chat-status' });
        }
      } catch (err) {
        toast.error('상태 변경 실패: ' + err.message, { id: 'chat-status' });
      }
    }
    setSelectedMsgId(null);
  };

  const handleAddToSchedule = (msg) => {
    toast.success(`'${msg.text}' 내용이 일정에 추가되었습니다.`);
    setSelectedMsgId(null);
  };

  const filteredMessages = messages.filter(msg => {
    const query = searchTerm.toLowerCase().trim();
    if (!query) return true;
    return msg.text?.toLowerCase().includes(query) || msg.user_name?.toLowerCase().includes(query);
  });

  return (
    <div className="chat-page">
      <div className="chat-header" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>공동 업무 공유방</h2>
        </div>
        {/* 검색 바 */}
        <input 
          type="text" 
          placeholder="검색" 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ width: '100%', padding: '0.6rem 0.85rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', boxSizing: 'border-box' }}
        />
      </div>

      <div className="chat-container">
        <div className="messages-area">
          {loading && messages.length === 0 ? (
             <div className="loading" style={{ textAlign: 'center', padding: '2rem' }}>로딩 중...</div>
          ) : filteredMessages.length > 0 ? (
            filteredMessages.map((msg) => {
              let displayDate = '방금 전';
              try {
                if (msg.created_at) {
                  displayDate = format(new Date(msg.created_at), 'a h:mm');
                }
              } catch (e) {
                console.warn("Date formatting error for chat message:", e);
              }

              return (
                <div 
                  key={msg.id} 
                  className={`message-wrapper ${msg.user_name.includes('나') ? 'mine' : ''}`}
                >
                  <div className="message-header">
                    <span className="sender-name">{msg.user_name}</span>
                    <span className="message-time">{displayDate}</span>
                  </div>
                  
                  <div className="message-content-wrapper">
                    <div 
                      className={`message-bubble status-${msg.status}`}
                      onClick={() => setSelectedMsgId(selectedMsgId === msg.id ? null : msg.id)}
                    >
                      {msg.status === 'checked' && <CheckSquare size={16} className="inline-icon" />}
                      {msg.text}
                    </div>
                    
                    {selectedMsgId === msg.id && (
                      <div className="message-actions">
                        <button onClick={() => handleUpdateStatus(msg.id, 'strikethrough')} title="가운데 줄긋기">
                          <Type size={16} style={{textDecoration: 'line-through'}} />
                        </button>
                        <button onClick={() => handleUpdateStatus(msg.id, 'red')} title="빨간색 강조">
                          <Type size={16} color="red" />
                        </button>
                        <button onClick={() => handleUpdateStatus(msg.id, 'checked')} title="체크 표시">
                          <CheckCircle size={16} />
                        </button>
                        <button onClick={() => handleUpdateStatus(msg.id, 'normal')} title="초기화">
                          <Clock size={16} />
                        </button>
                        <button onClick={() => handleAddToSchedule(msg)} title="일정에 추가">
                          <CalendarIcon size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-secondary)' }}>
              {searchTerm.trim() ? (
                '검색 결과와 일치하는 메시지가 없습니다.'
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>공유방에 메시지가 없습니다.</span>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>첫 메시지를 남겨보세요!</span>
                </div>
              )}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        
        <form className="chat-input-area" onSubmit={handleSendMessage}>
          <input 
            type="text" 
            placeholder="공유할 업무 내용 입력..." 
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
          />
          <button type="submit" className="btn-send">
            <Send size={20} />
          </button>
        </form>
      </div>
    </div>
  );
};

export default Chat;
