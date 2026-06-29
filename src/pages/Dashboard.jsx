import React, { useState, useEffect } from 'react';
import { sheetsClient } from '../sheetsClient';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameDay, 
  isSameMonth, 
  addMonths, 
  subMonths, 
  parseISO 
} from 'date-fns';
import { 
  Calendar as CalendarIcon, 
  Users, 
  CheckSquare, 
  Phone, 
  Mail, 
  FileText, 
  ChevronLeft, 
  ChevronRight, 
  MessageSquare,
  Award
} from 'lucide-react';
import toast from 'react-hot-toast';
import './Dashboard.css';
import { parseKoreanDateTime } from '../dateUtils';
import { useUser } from '../UserContext';

const Dashboard = () => {
  const { user, changeUser } = useUser();
  const [clients, setClients] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [interactions, setInteractions] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loading, setLoading] = useState(true);

  // Meeting Result Form
  const [editingMeetingId, setEditingMeetingId] = useState(null);
  const [meetingResult, setMeetingResult] = useState('');

  // 새 일정 직접 추가 Form 상태
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMeetClient, setNewMeetClient] = useState('');
  const [newMeetTime, setNewMeetTime] = useState('10:00');
  const [newMeetType, setNewMeetType] = useState('브리핑');
  const [newMeetCustomType, setNewMeetCustomType] = useState('');
  const [isAddingMeeting, setIsAddingMeeting] = useState(false);
  const [routeSelectedIds, setRouteSelectedIds] = useState([]);
  const [optimizedOrder, setOptimizedOrder] = useState([]);

  const handleDirectAddMeeting = async (e) => {
    e.preventDefault();
    if (!user) {
      toast.error('사용자를 먼저 선택해 주세요.');
      return;
    }
    if (!newMeetClient) {
      toast.error('고객사를 선택해 주세요.');
      return;
    }
    if (!newMeetTime.trim()) {
      toast.error('시간을 입력해 주세요.');
      return;
    }

    // YYYY-MM-DD + 입력된 시간 포맷 결합
    const rawDateStr = `${format(selectedDate, 'yyyy-MM-dd')} ${newMeetTime}`;
    // 자연어 한글 날짜 시간 파싱 적용
    const parsedDateStr = parseKoreanDateTime(rawDateStr);

    // 포맷 검증
    const isValidFormat = /^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}$/.test(parsedDateStr);
    if (!isValidFormat) {
      toast.error(`시간 해석에 실패했습니다: "${newMeetTime}"\n(예: "오후 3시", "15:00" 또는 "오전 11시 30" 형태로 기입해주세요.)`);
      return;
    }

    const client = clients.find(c => c.id === newMeetClient);
    const clientName = client ? `${client.company} - ${client.name}` : '알 수 없음';

    try {
      setIsAddingMeeting(true);
      toast.loading('일정을 등록하는 중...', { id: 'direct-add' });

      const finalType = newMeetType === '직접입력' ? newMeetCustomType : newMeetType;

      const meetingData = {
        client_id: newMeetClient,
        client_name: clientName,
        date: parsedDateStr,
        type: finalType || '미팅',
        result: '진행 예정 (직접 등록)'
      };

      const saved = await sheetsClient.insert('meetings', meetingData);
      setMeetings(prev => [...prev, saved]);
      
      toast.success('일정이 직접 등록되었습니다.', { id: 'direct-add' });
      
      // Reset form
      setNewMeetClient('');
      setNewMeetTime('10:00');
      setNewMeetType('브리핑');
      setNewMeetCustomType('');
      setShowAddForm(false);
    } catch (err) {
      toast.error('일정 등록 실패: ' + err.message, { id: 'direct-add' });
    } finally {
      setIsAddingMeeting(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const cachedClients = localStorage.getItem('sheet_v3_clients');
      const cachedMeetings = localStorage.getItem('sheet_v3_meetings');
      const cachedInteractions = localStorage.getItem('sheet_v3_interactions');
      
      let hasCache = false;
      if (cachedClients && cachedMeetings) {
        setClients(JSON.parse(cachedClients));
        setMeetings(JSON.parse(cachedMeetings));
        if (cachedInteractions) setInteractions(JSON.parse(cachedInteractions));
        setLoading(false); // 캐시 히트: 로딩 즉시 해제
        hasCache = true;
      } else {
        setLoading(true);
      }

      const [clientsData, meetingsData, interactionsData] = await Promise.all([
        sheetsClient.read('clients'),
        sheetsClient.read('meetings'),
        sheetsClient.read('interactions')
      ]);

      if (clientsData) {
        setClients(clientsData);
        localStorage.setItem('sheet_v3_clients', JSON.stringify(clientsData));
      }
      if (meetingsData) {
        setMeetings(meetingsData);
        localStorage.setItem('sheet_v3_meetings', JSON.stringify(meetingsData));
      }
      if (interactionsData) {
        setInteractions(interactionsData);
        localStorage.setItem('sheet_v3_interactions', JSON.stringify(interactionsData));
      }
    } catch (error) {
      console.error("Dashboard fetch failed:", error);
      toast.error("데이터 갱신에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));

  const handleSaveResult = async (meetingId) => {
    if (!meetingResult.trim()) {
      toast.error('미팅 결과를 입력해 주세요.');
      return;
    }

    try {
      toast.loading('미팅 결과를 저장하는 중...', { id: 'save-result' });
      await sheetsClient.update('meetings', {
        id: meetingId,
        result: meetingResult
      });
      
      // Update local state
      setMeetings(prev => prev.map(m => m.id === meetingId ? { ...m, result: meetingResult } : m));
      setEditingMeetingId(null);
      setMeetingResult('');
      toast.success('미팅 결과가 성공적으로 저장되었습니다.', { id: 'save-result' });
      fetchDashboardData(); // Refresh to ensure sync
    } catch (err) {
      toast.error('결과 저장 실패: ' + err.message, { id: 'save-result' });
    }
  };

  // Calendar setup
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  
  // Get all days for grid (expanding to full weeks)
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  
  // Padding for start of month
  const startDayOfWeek = monthStart.getDay(); // 0 is Sunday
  const paddingStart = Array(startDayOfWeek).fill(null);
  
  // Padding for end of month
  const endDayOfWeek = monthEnd.getDay();
  const paddingEnd = Array(6 - endDayOfWeek).fill(null);
  
  const calendarDays = [...paddingStart, ...daysInMonth, ...paddingEnd];

  // Helper: check if day has meeting
  const getDayMeetings = (day) => {
    if (!day) return [];
    return meetings.filter(m => {
      try {
        const mDate = parseISO(m.date);
        return isSameDay(mDate, day);
      } catch (e) {
        return false;
      }
    });
  };

  const selectedDateMeetings = getDayMeetings(selectedDate);
  
  // Statistics
  const totalClients = clients.length;
  const todayMeetingsCount = meetings.filter(m => {
    try {
      return isSameDay(parseISO(m.date), new Date());
    } catch (e) {
      return false;
    }
  }).length;
  
  const thisMonthMeetingsCount = meetings.filter(m => {
    try {
      return isSameMonth(parseISO(m.date), currentDate);
    } catch (e) {
      return false;
    }
  }).length;

  const getClientContact = (clientId) => {
    return clients.find(c => c.id === clientId);
  };

  const visitMeetings = selectedDateMeetings.filter(meet => {
    const client = getClientContact(meet.client_id);
    return client && client.address;
  });

  useEffect(() => {
    setRouteSelectedIds(visitMeetings.map(m => m.id));
    setOptimizedOrder([]);
  }, [selectedDate, meetings, clients]);

  const handleRouteCheckboxChange = (meetId) => {
    setRouteSelectedIds(prev => 
      prev.includes(meetId) 
        ? prev.filter(id => id !== meetId) 
        : [...prev, meetId]
    );
  };

  const optimizeRoute = () => {
    const selectedItems = visitMeetings.filter(m => routeSelectedIds.includes(m.id));
    if (selectedItems.length <= 1) {
      toast.error('동선 최적화를 위해 최소 2개 이상의 장소를 체크해 주세요.');
      return;
    }
    
    const itemsWithCoords = selectedItems.map(m => {
      const client = getClientContact(m.client_id);
      return {
        meeting: m,
        client: client,
        lat: parseFloat(client.latitude || 36.8),
        lng: parseFloat(client.longitude || 127.1)
      };
    });

    const optimized = [];
    const unvisited = [...itemsWithCoords];
    
    let current = unvisited.shift();
    optimized.push(current);

    while (unvisited.length > 0) {
      let nearestIdx = 0;
      let minDistance = Infinity;

      for (let i = 0; i < unvisited.length; i++) {
        const target = unvisited[i];
        const d = Math.sqrt(
          Math.pow(current.lat - target.lat, 2) + 
          Math.pow(current.lng - target.lng, 2)
        );
        if (d < minDistance) {
          minDistance = d;
          nearestIdx = i;
        }
      }

      current = unvisited.splice(nearestIdx, 1)[0];
      optimized.push(current);
    }

    const optimizedIds = optimized.map(item => item.meeting.id);
    setRouteSelectedIds(optimizedIds);
    setOptimizedOrder(optimizedIds);
    toast.success('AI가 가장 효율적인 방문 동선을 계산했습니다!');
  };

  const handleOpenNaverDirections = () => {
    const orderedMeetings = routeSelectedIds
      .map(id => visitMeetings.find(m => m.id === id))
      .filter(Boolean);

    const addresses = orderedMeetings.map(m => {
      const client = getClientContact(m.client_id);
      return client ? client.address : '';
    }).filter(Boolean);

    if (addresses.length === 0) {
      toast.error('길찾기를 실행할 장소를 체크해 주세요.');
      return;
    }

    if (addresses.length === 1) {
      const url = `https://map.naver.com/v5/search/${encodeURIComponent(addresses[0])}`;
      window.open(url, '_blank');
    } else {
      const path = addresses.map(addr => encodeURIComponent(addr)).join('/');
      const url = `https://map.naver.com/v5/dir/${path}/car`;
      window.open(url, '_blank');
    }
  };

  return (
    <div className="dashboard-container">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>홈</h2>
        
        {/* User Selection UI */}
        <div style={{ backgroundColor: user ? 'var(--bg-secondary)' : '#fee2e2', padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)', border: user ? '1px solid var(--border-color)' : '1px solid #f87171', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {user ? (
            <>
              <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>현재 접속자: <span style={{ color: 'var(--primary-color)' }}>{user}</span></span>
              <button 
                className="btn-secondary" 
                style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}
                onClick={() => changeUser('')}
              >
                변경
              </button>
            </>
          ) : (
            <>
              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#b91c1c' }}>사용자를 선택해주세요 *</span>
              <select 
                value={user || ''} 
                onChange={(e) => {
                  if (e.target.value === '직접입력') {
                    const customUser = window.prompt("사용자 이름을 입력하세요:");
                    if (customUser) changeUser(customUser);
                  } else if (e.target.value) {
                    changeUser(e.target.value);
                  }
                }}
                style={{ padding: '0.3rem', borderRadius: '4px', border: '1px solid #ccc' }}
              >
                <option value="" disabled>-- 사용자 선택 --</option>
                <option value="김학민">김학민</option>
                <option value="김진욱">김진욱</option>
                <option value="직접입력">직접입력</option>
              </select>
            </>
          )}
        </div>
      </div>

      {/* Calendar Area */}
      <div className="calendar-section">
        <div className="calendar-header">
          <h3>{format(currentDate, 'yyyy년 MM월')}</h3>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn-secondary" style={{ padding: '0.25rem' }} onClick={handlePrevMonth}>
              <ChevronLeft size={18} />
            </button>
            <button className="btn-secondary" style={{ padding: '0.25rem' }} onClick={handleNextMonth}>
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        <div className="calendar-grid">
          {['일', '월', '화', '수', '목', '금', '토'].map((day, idx) => (
            <div key={idx} className="calendar-day-label" style={{ color: idx === 0 ? 'red' : idx === 6 ? 'blue' : 'inherit' }}>
              {day}
            </div>
          ))}
          
          {calendarDays.map((day, idx) => {
            if (!day) return <div key={`empty-${idx}`} className="calendar-cell empty" />;
            
            const dayMeetings = getDayMeetings(day);
            const isToday = isSameDay(day, new Date());
            const isSelected = isSameDay(day, selectedDate);
            const isCurrentMonth = isSameMonth(day, currentDate);
            
            return (
              <div 
                key={day.toString()} 
                className={`calendar-cell ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''} ${!isCurrentMonth ? 'other-month' : ''}`}
                onClick={() => setSelectedDate(day)}
              >
                <span>{format(day, 'd')}</span>
                {dayMeetings.length > 0 && (
                  <div style={{ display: 'flex', gap: '2px', justifyContent: 'center' }}>
                    {dayMeetings.slice(0, 3).map((_, mIdx) => (
                      <div key={mIdx} className="calendar-event-dot" />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Day Schedule */}
      <div className="schedule-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0 }}>
            {format(selectedDate, 'MM월 dd일')} 미팅 일정 ({selectedDateMeetings.length}건)
          </h3>
          <button 
            type="button" 
            className="btn-secondary" 
            style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
            onClick={() => setShowAddForm(!showAddForm)}
          >
            {showAddForm ? '닫기' : '일정 직접 추가'}
          </button>
        </div>

        {/* 직접 등록 Form */}
        {showAddForm && (
          <form onSubmit={handleDirectAddMeeting} style={{ padding: '0.75rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', backgroundColor: 'var(--bg-primary)' }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, margin: 0 }}>새 미팅 일정 등록</h4>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>대상자 선택 *</label>
              <select 
                value={newMeetClient} 
                onChange={(e) => setNewMeetClient(e.target.value)}
                style={{ width: '100%', padding: '0.35rem', fontSize: '0.85rem' }}
                required
              >
                <option value="">-- 대상자 선택 --</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.company} - {c.name}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>시간 (직접입력) *</label>
                <input 
                  type="text" 
                  placeholder="예: 14:00" 
                  value={newMeetTime}
                  onChange={(e) => setNewMeetTime(e.target.value)}
                  style={{ width: '100%', padding: '0.35rem', fontSize: '0.85rem' }}
                  required
                />
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>미팅 구분</label>
                <select 
                  value={newMeetType} 
                  onChange={(e) => setNewMeetType(e.target.value)}
                  style={{ width: '100%', padding: '0.35rem', fontSize: '0.85rem' }}
                >
                  <option value="브리핑">브리핑</option>
                  <option value="인사">인사</option>
                  <option value="소개">소개</option>
                  <option value="직접입력">직접입력</option>
                </select>
              </div>
            </div>

            {newMeetType === '직접입력' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <input 
                  type="text" 
                  placeholder="미팅 유형 직접 입력..." 
                  value={newMeetCustomType}
                  onChange={(e) => setNewMeetCustomType(e.target.value)}
                  style={{ width: '100%', padding: '0.35rem', fontSize: '0.85rem' }}
                />
              </div>
            )}

            <button 
              type="submit" 
              className="btn-primary" 
              style={{ width: '100%', padding: '0.4rem', fontSize: '0.85rem', marginTop: '0.25rem' }}
              disabled={isAddingMeeting}
            >
              일정 등록 완료
            </button>
          </form>
        )}
        
        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>데이터 로드 중...</div>
        ) : selectedDateMeetings.length > 0 ? (
          <div className="schedule-list">
            {selectedDateMeetings.map(meet => {
              const client = getClientContact(meet.client_id);
              return (
                <div key={meet.id} className="schedule-card">
                  <div className="schedule-card-header">
                    <span className="schedule-time">
                      {format(parseISO(meet.date), 'HH:mm')}
                    </span>
                    <span className="schedule-type-badge">
                      {meet.type}
                    </span>
                  </div>
                  
                  <div className="schedule-company">
                    {meet.client_name || '알 수 없는 대상'}
                  </div>
                  
                  <div className="schedule-result">
                    <strong>결과:</strong> {meet.result || '결과 입력 대기 중'}
                  </div>

                  {client && (
                    <div className="schedule-actions">
                      {client.phone && (
                        <a href={`tel:${client.phone}`} className="btn-secondary btn-schedule-action" style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}>
                          <Phone size={12} /> 전화
                        </a>
                      )}
                      {client.phone && (
                        <a href={`sms:${client.phone}`} className="btn-secondary btn-schedule-action" style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}>
                          <MessageSquare size={12} /> 문자
                        </a>
                      )}
                    </div>
                  )}

                  <div style={{ marginTop: '0.25rem' }}>
                    {editingMeetingId === meet.id ? (
                      <div className="schedule-result-form">
                        <input 
                          type="text" 
                          placeholder="미팅 결과를 입력하세요..." 
                          value={meetingResult}
                          onChange={(e) => setMeetingResult(e.target.value)}
                        />
                        <button className="btn-primary" onClick={() => handleSaveResult(meet.id)}>저장</button>
                        <button className="btn-secondary" onClick={() => setEditingMeetingId(null)}>취소</button>
                      </div>
                    ) : (
                      <button 
                        className="btn-secondary" 
                        style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                        onClick={() => {
                          setEditingMeetingId(meet.id);
                          setMeetingResult(meet.result || '');
                        }}
                      >
                        결과 수정/입력
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '1rem 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            이 날짜에는 등록된 미팅 일정이 없습니다.
          </div>
        )}
      </div>

      {/* AI 동선 최적화 및 길찾기 섹션 */}
      {visitMeetings.length > 0 && (
        <div className="schedule-section" style={{ border: '1px solid var(--border-color)', padding: '1.25rem', borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--bg-secondary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              🚗 AI 동선 최적화 및 길찾기
            </h3>
            {visitMeetings.length > 1 && (
              <button 
                type="button" 
                className="btn-secondary" 
                onClick={optimizeRoute}
                style={{ fontSize: '0.75rem', padding: '0.35rem 0.7rem', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--accent-color)', color: 'var(--accent-color)', borderRadius: 'var(--radius-md)', fontWeight: 600 }}
              >
                🤖 AI 최적 동선 추천
              </button>
            )}
          </div>

          <div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', lineHeight: '1.4' }}>
              방문할 장소들을 체크한 뒤 네이버 지도로 연동하여 길찾기를 실행합니다. AI 추천 버튼 클릭 시 가장 가까운 순서로 동선이 최적화됩니다.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
              {visitMeetings.map((meet, idx) => {
                const client = getClientContact(meet.client_id);
                const isChecked = routeSelectedIds.includes(meet.id);
                const orderIndex = routeSelectedIds.indexOf(meet.id);

                return (
                  <div 
                    key={meet.id} 
                    onClick={() => handleRouteCheckboxChange(meet.id)}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.75rem', 
                      padding: '0.6rem 0.85rem', 
                      backgroundColor: isChecked ? 'var(--bg-primary)' : 'var(--bg-secondary)', 
                      border: `1px solid ${isChecked ? 'var(--accent-color)' : 'var(--border-color)'}`, 
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    <input 
                      type="checkbox" 
                      checked={isChecked}
                      onChange={() => {}} // Controlled via parent div click
                      style={{ cursor: 'pointer', pointerEvents: 'none' }}
                    />
                    
                    <div style={{ flex: 1, textAlign: 'left' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{meet.client_name}</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                          ({format(parseISO(meet.date), 'HH:mm')})
                        </span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                        📍 {client?.address}
                      </div>
                    </div>

                    {isChecked && (
                      <span style={{ 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        width: '20px', 
                        height: '20px', 
                        borderRadius: '50%', 
                        backgroundColor: 'var(--success-color)', 
                        color: 'white', 
                        fontSize: '0.75rem', 
                        fontWeight: 700 
                      }}>
                        {orderIndex + 1}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            <button 
              type="button" 
              className="btn-primary" 
              onClick={handleOpenNaverDirections}
              disabled={routeSelectedIds.length === 0}
              style={{ width: '100%', padding: '0.7rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
            >
              🚗 선택된 동선으로 네이버 길찾기 시작 ({routeSelectedIds.length}곳)
            </button>
          </div>
        </div>
      )}

      {/* Stats Grid - 한줄로 제일 하단에 위치 */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginTop: '1rem' }}>
        <div className="stat-card" style={{ padding: '0.75rem 0.5rem' }}>
          <div className="stat-icon" style={{ padding: '0.4rem', marginBottom: 0 }}><Users size={16} /></div>
          <div className="stat-value" style={{ fontSize: '1.25rem' }}>{totalClients}</div>
          <div className="stat-label" style={{ fontSize: '0.7rem' }}>등록 고객 수</div>
        </div>
        <div className="stat-card" style={{ padding: '0.75rem 0.5rem' }}>
          <div className="stat-icon" style={{ color: 'var(--success-color)', padding: '0.4rem', marginBottom: 0 }}><CalendarIcon size={16} /></div>
          <div className="stat-value" style={{ fontSize: '1.25rem' }}>{todayMeetingsCount}</div>
          <div className="stat-label" style={{ fontSize: '0.7rem' }}>오늘 미팅</div>
        </div>
        <div className="stat-card" style={{ padding: '0.75rem 0.5rem' }}>
          <div className="stat-icon" style={{ color: 'var(--accent-color)', padding: '0.4rem', marginBottom: 0 }}><CheckSquare size={16} /></div>
          <div className="stat-value" style={{ fontSize: '1.25rem' }}>{thisMonthMeetingsCount}</div>
          <div className="stat-label" style={{ fontSize: '0.7rem' }}>이번 달 미팅</div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
