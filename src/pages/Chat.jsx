import React, { useState, useEffect, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { sheetsClient } from '../sheetsClient';
import { Send, CheckCircle, Clock, Type, X, Calendar as CalendarIcon, CheckSquare, Paperclip } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { useUser } from '../UserContext';
import './Chat.css';

const MOCK_MESSAGES = [];

const Chat = () => {
  const { user } = useUser();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const [selectedMsgId, setSelectedMsgId] = useState(null);

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      toast.error('파일 크기는 50MB 이하여야 합니다.');
      return;
    }

    setIsUploading(true);
    const loadingToast = toast.loading('파일을 업로드하는 중...');
    try {
      const url = await sheetsClient.uploadFile(file);
      const isImage = file.type.startsWith('image/');
      const fileText = isImage ? `[IMAGE] ${url}` : `[FILE] ${file.name} | ${url}`;
      
      const newMsg = {
        user_name: user,
        text: fileText,
        status: 'normal',
        created_at: new Date().toISOString()
      };

      if (isSupabaseConfigured()) {
        const { error } = await supabase.from('chat_messages').insert([newMsg]);
        if (error) throw error;
      } else {
        await sheetsClient.insert('chat_messages', newMsg);
        fetchMessages(true);
      }
      toast.success('파일 업로드 완료!', { id: loadingToast });
    } catch (error) {
      console.error('File upload error:', error);
      toast.error('파일 업로드에 실패했습니다.', { id: loadingToast });
    } finally {
      setIsUploading(false);
      e.target.value = ''; // Reset input
    }
  };

  const renderMessageContent = (text) => {
    if (text.startsWith('[IMAGE] ')) {
      const url = text.replace('[IMAGE] ', '').trim();
      return (
        <div>
          <img src={url} alt="attached" style={{ maxWidth: '100%', borderRadius: '8px', marginTop: '0.2rem' }} />
        </div>
      );
    } else if (text.startsWith('[FILE] ')) {
      const parts = text.replace('[FILE] ', '').split(' | ');
      const name = parts[0];
      const url = parts[1];
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.2rem' }}>
          <Paperclip size={16} />
          <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>
            {name} 다운로드
          </a>
        </div>
      );
    }
    return text;
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
    if (messages && messages.length > 0) {
      const latest = messages[messages.length - 1];
      if (latest && !String(latest.id).startsWith('temp_')) {
        localStorage.setItem('last_read_chat_id', latest.id);
        window.dispatchEvent(new CustomEvent('chat_badge_update', { detail: { hasNew: false } }));
      }
    }
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
        setMessages(prev => {
          const tempMessages = prev.filter(m => String(m.id).startsWith('temp_'));
          const remoteData = data || [];
          const filteredTemp = tempMessages.filter(temp => 
            !remoteData.some(s => s.text === temp.text && s.user_name === temp.user_name && s.created_at === temp.created_at)
          );
          return [...remoteData, ...filteredTemp];
        });
      } else {
        const data = await sheetsClient.read('chat_messages');
        if (data && data.length > 0) {
          const sorted = data.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
          setMessages(prev => {
            const tempMessages = prev.filter(m => String(m.id).startsWith('temp_'));
            const filteredTemp = tempMessages.filter(temp => 
              !sorted.some(s => s.text === temp.text && s.user_name === temp.user_name && s.created_at === temp.created_at)
            );
            const next = [...sorted, ...filteredTemp];
            const isSame = prev.length === next.length && JSON.stringify(prev) === JSON.stringify(next);
            return isSame ? prev : next;
          });
          localStorage.setItem('sheet_v3_chat_messages', JSON.stringify(sorted));
        } else {
          setMessages(prev => {
            const tempMessages = prev.filter(m => String(m.id).startsWith('temp_'));
            const filteredTemp = tempMessages.filter(temp => 
              !MOCK_MESSAGES.some(s => s.text === temp.text && s.user_name === temp.user_name && s.created_at === temp.created_at)
            );
            const next = [...MOCK_MESSAGES, ...filteredTemp];
            const isSame = prev.length === next.length && JSON.stringify(prev) === JSON.stringify(next);
            return isSame ? prev : next;
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
    if (!user) {
      toast.error('홈 화면에서 사용자를 먼저 선택해주세요.');
      return;
    }
    if (!newMessage.trim()) return;

    // 낙관적 UI 업데이트 (Optimistic UI)
    const tempId = 'temp_' + Date.now();
    const msgData = {
      id: tempId,
      text: newMessage,
      user_name: user,
      status: 'normal',
      created_at: new Date().toISOString()
    };

    // 즉시 화면에 표시하고 입력창 비우기
    setMessages(prev => {
      const next = [...prev, msgData];
      localStorage.setItem('sheet_v3_chat_messages', JSON.stringify(next));
      return next;
    });
    setNewMessage('');

    if (isSupabaseConfigured()) {
      try {
        const { error, data } = await supabase.from('chat_messages').insert([{
          text: msgData.text,
          user_name: msgData.user_name,
          status: msgData.status,
          created_at: msgData.created_at
        }]).select();
        if (error) throw error;
        // 실제 ID로 업데이트
        if (data && data[0]) {
          setMessages(prev => prev.map(m => m.id === tempId ? data[0] : m));
        }
      } catch (error) {
        console.warn("Supabase insert failed:", error);
        toast.error('메시지 전송 실패 (네트워크 오류)');
        // 전송 실패 시 임시 메시지 제거
        setMessages(prev => prev.filter(m => m.id !== tempId));
      }
    } else {
      try {
        // 백그라운드에서 구글 시트에 저장
        const saved = await sheetsClient.insert('chat_messages', {
          text: msgData.text,
          user_name: msgData.user_name,
          status: msgData.status,
          created_at: msgData.created_at
        });
        // 실제 ID로 업데이트 (임시 ID -> 시트에서 발급한 ID)
        setMessages(prev => {
          const next = prev.map(m => m.id === tempId ? saved : m);
          localStorage.setItem('sheet_v3_chat_messages', JSON.stringify(next));
          return next;
        });
      } catch (err) {
        toast.error('메시지 저장 실패: ' + err.message);
        // 전송 실패 시 임시 메시지 제거
        setMessages(prev => {
          const next = prev.filter(m => m.id !== tempId);
          localStorage.setItem('sheet_v3_chat_messages', JSON.stringify(next));
          return next;
        });
      }
    }
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
            filteredMessages.map((msg, idx) => {
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
                  key={msg.id || idx} 
                  className={`message-wrapper ${msg.user_name === user ? 'mine' : ''}`}
                >
                  <div className="message-header">
                    {msg.user_name !== user && (
                      <span className="sender-name">{msg.user_name}</span>
                    )}
                    <span className="message-time">{displayDate}</span>
                  </div>
                  
                  <div className="message-content-wrapper">
                    <div 
                      className={`message-bubble status-${msg.status}`}
                      onClick={() => setSelectedMsgId(selectedMsgId === msg.id ? null : msg.id)}
                    >
                      {msg.status === 'checked' && <CheckSquare size={16} className="inline-icon" />}
                      {renderMessageContent(msg.text)}
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
            type="file" 
            ref={fileInputRef} 
            style={{ display: 'none' }} 
            onChange={handleFileSelect} 
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
          />
          <button 
            type="button" 
            className="attach-btn" 
            disabled={!user || isUploading}
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip size={20} />
          </button>
          <input 
            type="text" 
            placeholder={
              !user ? "홈 화면에서 사용자를 먼저 선택해주세요" : 
              isUploading ? "파일 업로드 중..." : "공유할 업무 내용 입력..."
            }
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            disabled={!user || isUploading}
          />
          <button type="submit" className="btn-send" disabled={!newMessage.trim() || !user || isUploading}>
            전송
          </button>
        </form>
      </div>
    </div>
  );
};

export default Chat;
