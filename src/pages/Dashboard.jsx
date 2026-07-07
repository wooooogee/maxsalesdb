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
  Award,
  MapPin,
  Building,
  Copy
} from 'lucide-react';
import toast from 'react-hot-toast';
import './Dashboard.css';
import { parseKoreanDateTime } from '../dateUtils';
import { useUser } from '../UserContext';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const { user, changeUser } = useUser();
  const navigate = useNavigate();
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
  const [newMeetType, setNewMeetType] = useState(['브리핑']);
  const [newMeetCustomType, setNewMeetCustomType] = useState('');
  const [isAddingMeeting, setIsAddingMeeting] = useState(false);
  const [routeSelectedIds, setRouteSelectedIds] = useState([]);
  const [optimizedOrder, setOptimizedOrder] = useState([]);
  const [draggedRouteId, setDraggedRouteId] = useState(null);
  const [cancelUnavailConfirm, setCancelUnavailConfirm] = useState(null);
  
  const [editMeetingId, setEditMeetingId] = useState(null);
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [showStatsModal, setShowStatsModal] = useState(false);

  // 일정 불가 상태
  const [emptyDayActionDate, setEmptyDayActionDate] = useState(null);
  const [unavailabilityLoading, setUnavailabilityLoading] = useState(false);

  const handleSetUnavailable = async (dateObj) => {
    try {
      setUnavailabilityLoading(true);
      toast.loading('일정 불가 상태로 설정하는 중...', { id: 'unavail' });
      const meetingData = {
        client_id: 'unavailable_client',
        client_name: '일정 불가(휴무)',
        date: format(dateObj, 'yyyy-MM-dd') + ' 00:00',
        type: '일정 불가',
        result: '일정 불가'
      };
      const saved = await sheetsClient.insert('meetings', meetingData);
      setMeetings(prev => {
        const next = [...prev, saved];
        localStorage.setItem('sheet_v3_meetings', JSON.stringify(next));
        return next;
      });
      toast.success('일정 불가 상태로 설정되었습니다.', { id: 'unavail' });
      setEmptyDayActionDate(null);
    } catch (err) {
      toast.error('설정 실패: ' + err.message, { id: 'unavail' });
    } finally {
      setUnavailabilityLoading(false);
    }
  };

  const handleRemoveUnavailable = async (meetingId) => {
    try {
      toast.loading('일정 불가 상태 해제 중...', { id: 'unavail-remove' });
      await sheetsClient.delete('meetings', meetingId);
      setMeetings(prev => {
        const next = prev.filter(m => m.id !== meetingId);
        localStorage.setItem('sheet_v3_meetings', JSON.stringify(next));
        return next;
      });
      toast.success('일정 불가 상태가 해제되었습니다.', { id: 'unavail-remove' });
    } catch (err) {
      toast.error('해제 실패: ' + err.message, { id: 'unavail-remove' });
    }
  };

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

    let selectedClientId = newMeetClient;
    let selectedClientName = '알 수 없음';
    
    // Check if newMeetClient matches an existing ID or a "Company - Name" format
    const existingClient = clients.find(c => 
      c.id === newMeetClient || 
      (c.company ? `${c.company} - ${c.name}` : c.name) === newMeetClient ||
      c.company === newMeetClient
    );

    try {
      setIsAddingMeeting(true);
      toast.loading(editMeetingId ? '일정을 수정하는 중...' : '일정을 등록하는 중...', { id: 'direct-add' });

      if (existingClient) {
        selectedClientId = existingClient.id;
        selectedClientName = existingClient.company ? `${existingClient.company} - ${existingClient.name}` : existingClient.name;
      } else {
        // Create new client since it doesn't match
        const newContact = {
          company: newMeetClient,
          name: '담당자 (직접등록)',
          creator: user,
          interest_level: 'none',
          created_at: new Date().toISOString()
        };
        const savedContact = await sheetsClient.insert('clients', newContact);
        setClients(prev => {
          const next = [savedContact, ...prev];
          localStorage.setItem('sheet_v3_clients', JSON.stringify(next));
          return next;
        });
        selectedClientId = savedContact.id;
        selectedClientName = `${savedContact.company} - ${savedContact.name}`;
      }

      let typeArr = Array.isArray(newMeetType) ? [...newMeetType] : [newMeetType];
      if (typeArr.includes('직접입력')) {
        typeArr = typeArr.filter(t => t !== '직접입력');
        if (newMeetCustomType) typeArr.push(newMeetCustomType);
      }
      const finalType = typeArr.join(', ') || '미팅';

      const meetingData = {
        client_id: selectedClientId,
        client_name: selectedClientName,
        date: parsedDateStr,
        type: finalType || '미팅',
      };

      if (editMeetingId) {
        meetingData.id = editMeetingId;
        await sheetsClient.update('meetings', meetingData);
        setMeetings(prev => {
          const next = prev.map(m => m.id === editMeetingId ? { ...m, ...meetingData } : m);
          localStorage.setItem('sheet_v3_meetings', JSON.stringify(next));
          return next;
        });
        toast.success('일정이 수정되었습니다.', { id: 'direct-add' });
      } else {
        meetingData.result = '진행 예정 (직접 등록)';
        const saved = await sheetsClient.insert('meetings', meetingData);
        setMeetings(prev => {
          const next = [...prev, saved];
          localStorage.setItem('sheet_v3_meetings', JSON.stringify(next));
          return next;
        });
        toast.success('일정이 직접 등록되었습니다.', { id: 'direct-add' });
      }
      
      // Reset form
      setNewMeetClient('');
      setNewMeetTime('10:00');
      setNewMeetType(['브리핑']);
      setNewMeetCustomType('');
      setEditMeetingId(null);
      setShowAddForm(false);
    } catch (err) {
      toast.error('일정 처리 실패: ' + err.message, { id: 'direct-add' });
    } finally {
      setIsAddingMeeting(false);
    }
  };

  const handleEditScheduleClick = (meet) => {
    if (editMeetingId === meet.id) {
      setEditMeetingId(null);
      setShowAddForm(false);
      return;
    }
    
    try {
      setEditMeetingId(meet.id);
      
      // Look up client to format as "Company - Name", fallback to meet.client_name
      const client = clients.find(c => c.id === meet.client_id);
      const displayStr = client 
        ? (client.company ? `${client.company} - ${client.name}` : client.name)
        : (meet.client_name || meet.client_id);
      
      setNewMeetClient(displayStr);
      const dateObj = parseISO(meet.date);
      setSelectedDate(dateObj);
      setNewMeetTime(format(dateObj, 'HH:mm'));
      
      const standardTypes = ['브리핑', '인사', '소개', '유투브 촬영'];
      const types = meet.type ? meet.type.split(',').map(t => t.trim()) : [];
      const extractedStandards = types.filter(t => standardTypes.includes(t));
      const extractedCustoms = types.filter(t => !standardTypes.includes(t));
      
      if (extractedCustoms.length > 0) {
        setNewMeetType([...extractedStandards, '직접입력']);
        setNewMeetCustomType(extractedCustoms.join(', '));
      } else {
        setNewMeetType(extractedStandards.length > 0 ? extractedStandards : ['브리핑']);
        setNewMeetCustomType('');
      }
      setShowAddForm(true);
    } catch (e) {
      toast.error('일정 데이터를 불러오는데 실패했습니다.');
    }
  };

  const handleMeetingClick = async (meet) => {
    if (editMeetingId === meet.id) {
      setEditMeetingId(null);
      setShowAddForm(false);
    }
    
    let newResult;
    if (meet.result === '완료') {
      newResult = '미팅 못함';
    } else if (meet.result === '미팅 못함') {
      newResult = '진행 예정';
    } else {
      newResult = '완료';
    }
    
    // Optimistic UI update
    const updatedMeet = { ...meet, result: newResult };
    setMeetings(prev => {
      const next = prev.map(m => m.id === meet.id ? updatedMeet : m);
      localStorage.setItem('sheet_v3_meetings', JSON.stringify(next));
      return next;
    });

    try {
      await sheetsClient.update('meetings', updatedMeet);
    } catch (err) {
      toast.error('상태 업데이트 실패', { id: 'meet-complete' });
      // Revert optimistic update
      setMeetings(prev => {
        const next = prev.map(m => m.id === meet.id ? meet : m);
        localStorage.setItem('sheet_v3_meetings', JSON.stringify(next));
        return next;
      });
    }
  };

  const handleDeleteMeeting = async () => {
    if (deletePassword !== '0805') {
      toast.error('비밀번호가 일치하지 않습니다.');
      return;
    }
    try {
      toast.loading('일정을 삭제하는 중...', { id: 'delete-meeting' });
      await sheetsClient.delete('meetings', { id: deleteTargetId, sheet: 'meetings' });
      
      setMeetings(prev => {
        const next = prev.filter(m => m.id !== deleteTargetId);
        localStorage.setItem('sheet_v3_meetings', JSON.stringify(next));
        return next;
      });
      
      toast.success('일정이 삭제되었습니다.', { id: 'delete-meeting' });
      setDeleteTargetId(null);
      setDeletePassword('');
    } catch (err) {
      toast.error('일정 삭제 실패: ' + err.message, { id: 'delete-meeting' });
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
  const paddingStart = Array.from({ length: startDayOfWeek }, (_, i) => {
    const d = new Date(monthStart);
    d.setDate(d.getDate() - (startDayOfWeek - i));
    return d;
  });
  
  // Padding for end of month
  const endDayOfWeek = monthEnd.getDay();
  const paddingEnd = Array.from({ length: 6 - endDayOfWeek }, (_, i) => {
    const d = new Date(monthEnd);
    d.setDate(d.getDate() + (i + 1));
    return d;
  });
  
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
    }).sort((a, b) => new Date(a.date) - new Date(b.date));
  };

  const selectedDateMeetings = getDayMeetings(selectedDate);
  const isSelectedDateUnavailable = selectedDateMeetings.some(m => m.type === '일정 불가');
  
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

  const handleDragStart = (e, id) => {
    if (!routeSelectedIds.includes(id)) {
      e.preventDefault();
      return;
    }
    setDraggedRouteId(id);
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, targetId) => {
    e.preventDefault(); // necessary to allow dropping
    if (!draggedRouteId || draggedRouteId === targetId) return;
    if (!routeSelectedIds.includes(targetId)) return;
    
    const draggedIdx = routeSelectedIds.indexOf(draggedRouteId);
    const targetIdx = routeSelectedIds.indexOf(targetId);
    
    const newRoute = [...routeSelectedIds];
    newRoute.splice(draggedIdx, 1);
    newRoute.splice(targetIdx, 0, draggedRouteId);
    
    setRouteSelectedIds(newRoute);
  };

  const handleDragEnd = () => {
    setDraggedRouteId(null);
  };

  const handleOpenNaverDirections = () => {
    const orderedMeetings = routeSelectedIds
      .map(id => visitMeetings.find(m => m.id === id))
      .filter(Boolean);

    if (orderedMeetings.length === 0) {
      toast.error('길찾기를 실행할 장소를 체크해 주세요.');
      return;
    }

    if (orderedMeetings.length === 1) {
      const client = getClientContact(orderedMeetings[0].client_id);
      const url = `https://map.naver.com/p/search/${encodeURIComponent(client.address || client.company)}`;
      window.open(url, '_blank');
    } else {
      const path = orderedMeetings.map(m => {
        const client = getClientContact(m.client_id);
        const name = encodeURIComponent(client.company || client.name || '경유지');
        const lat = client.latitude;
        const lng = client.longitude;
        
        if (lat && lng) {
          return `${lng},${lat},${name}`;
        } else {
          // 좌표가 없는 경우 대체 텍스트 (완벽히 동작하지 않을 수 있음)
          return name;
        }
      }).join('/');
      
      const url = `https://map.naver.com/p/directions/${path}/-/car`;
      window.open(url, '_blank');
    }
  };

  const renderMeetingForm = () => (
    <form onSubmit={handleDirectAddMeeting} style={{ padding: '0.75rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', backgroundColor: 'var(--bg-primary)' }}>
      <h4 style={{ fontSize: '0.85rem', fontWeight: 700, margin: 0 }}>
        {editMeetingId ? '일정 수정' : '새 미팅 일정 등록'}
      </h4>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>대상자 (검색 또는 직접 입력) *</label>
        <input 
          list="client-list"
          value={newMeetClient} 
          onChange={(e) => setNewMeetClient(e.target.value)}
          placeholder="대상자 검색 또는 직접 입력..."
          style={{ width: '100%', padding: '0.35rem', fontSize: '0.85rem' }}
          required
        />
        <datalist id="client-list">
          {clients.map(c => (
            <option key={c.id} value={c.company ? `${c.company} - ${c.name}` : c.name}></option>
          ))}
        </datalist>
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
          <div style={{ display: 'flex', gap: '0.2rem', flexWrap: 'wrap' }}>
            {['브리핑', '인사', '소개', '유투브 촬영', '직접입력'].map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  const current = Array.isArray(newMeetType) ? newMeetType : [];
                  if (current.includes(opt)) {
                    setNewMeetType(current.filter(t => t !== opt));
                  } else {
                    setNewMeetType([...current, opt]);
                  }
                }}
                style={{ fontSize: '0.7rem', padding: '0.25rem 0.4rem', border: '1px solid var(--border-color)', borderRadius: '4px', background: (Array.isArray(newMeetType) ? newMeetType : []).includes(opt) ? 'var(--primary-color)' : 'white', color: (Array.isArray(newMeetType) ? newMeetType : []).includes(opt) ? 'white' : 'var(--text-primary)', cursor: 'pointer' }}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      </div>

      {(Array.isArray(newMeetType) ? newMeetType : []).includes('직접입력') && (
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

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
        <button 
          type="submit" 
          className="btn-primary" 
          style={{ flex: 1, padding: '0.4rem', fontSize: '0.85rem' }}
          disabled={isAddingMeeting}
        >
          {editMeetingId ? '수정 완료' : '일정 등록 완료'}
        </button>
        {editMeetingId && (
          <button
            type="button"
            className="btn-secondary"
            style={{ flex: 1, padding: '0.4rem', fontSize: '0.85rem' }}
            onClick={() => {
              setEditMeetingId(null);
              setShowAddForm(false);
              setNewMeetClient('');
              setNewMeetTime('10:00');
              setNewMeetType('브리핑');
              setNewMeetCustomType('');
            }}
          >
            취소
          </button>
        )}
      </div>
    </form>
  );

  // Calculate Monthly Stats
  const calculateStats = () => {
    const thisMonthInteractions = interactions.filter(i => i.date && isSameMonth(parseISO(i.date.replace(' ', 'T')), currentDate));
    const thisMonthMeetings = meetings.filter(m => m.date && isSameMonth(parseISO(m.date), currentDate));
    
    let sangjoCount = 0;
    let bohumCount = 0;
    
    thisMonthInteractions.forEach(interaction => {
      const content = interaction.content || '';
      
      const sangjoMatches = [...content.matchAll(/성과:\s*상조\s*\((\d+)구좌\)/g)];
      sangjoMatches.forEach(match => {
        sangjoCount += parseInt(match[1], 10);
      });
      
      const bohumMatches = [...content.matchAll(/성과:\s*보험/g)];
      bohumCount += bohumMatches.length;
    });

    let briefingCount = 0;
    let insaCount = 0;
    let youtubeCount = 0;
    let meetingCount = thisMonthMeetings.length;

    thisMonthMeetings.forEach(meeting => {
      if (meeting.type && meeting.type.includes('브리핑')) briefingCount++;
      if (meeting.type && meeting.type.includes('인사')) insaCount++;
      if (meeting.type && meeting.type.includes('유투브 촬영')) youtubeCount++;
    });

    return { sangjoCount, bohumCount, briefingCount, insaCount, youtubeCount, meetingCount };
  };

  return (
    <div className="dashboard-container">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>홈</h2>
        
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
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

          <button 
            className="btn-secondary" 
            style={{ padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => setShowStatsModal(true)}
            title="월간 성과 대시보드"
          >
            <CalendarIcon size={20} />
          </button>
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
            const isUnavailable = dayMeetings.some(m => m.type === '일정 불가');
            
            return (
              <div 
                key={day.toString()} 
                className={`calendar-cell ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''} ${!isSameMonth(day, currentDate) ? 'other-month' : ''} ${isUnavailable ? 'unavailable' : ''}`}
                onClick={() => {
                  setSelectedDate(day);
                  if (isUnavailable) {
                    const unavailMeeting = dayMeetings.find(m => m.type === '일정 불가');
                    setCancelUnavailConfirm(unavailMeeting);
                  } else if (dayMeetings.length === 0) {
                    setEmptyDayActionDate(day);
                  } else {
                    setEmptyDayActionDate(null);
                  }
                }}
              >
                <span>{format(day, 'd')}</span>
                {dayMeetings.length > 0 && !isUnavailable && (
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
            {format(selectedDate, 'MM월 dd일')} 미팅 일정 ({isSelectedDateUnavailable ? '불가' : selectedDateMeetings.length + '건'})
          </h3>
          <button 
            type="button" 
            className="btn-secondary" 
            style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
            onClick={() => setShowAddForm(!showAddForm)}
            disabled={isSelectedDateUnavailable}
          >
            {showAddForm ? '닫기' : '일정 직접 추가'}
          </button>
        </div>

        {/* 직접 등록/수정 Form (새 등록일 때만 상단에 표시) */}
        {showAddForm && !editMeetingId && !isSelectedDateUnavailable && renderMeetingForm()}
        
        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>데이터 로드 중...</div>
        ) : selectedDateMeetings.length > 0 && !isSelectedDateUnavailable ? (
          <div className="schedule-list">
            {selectedDateMeetings.map(meet => {
              const client = getClientContact(meet.client_id);
              const isCompleted = meet.result === '완료';
              const isMissed = meet.result === '미팅 못함';
              const cardStyle = isCompleted 
                ? { backgroundColor: '#e8f5e9', border: '2px solid #4caf50', opacity: 0.8 }
                : isMissed
                  ? { backgroundColor: '#fee2e2', border: '2px solid #ef4444' }
                  : (editMeetingId === meet.id ? { backgroundColor: '#fee2e2', border: '2px solid #ef4444' } : {});

              return (
                <div 
                  key={meet.id} 
                  className="schedule-card" 
                  style={cardStyle}
                  onClick={(e) => {
                    // Prevent bubbling if clicking a button inside
                    if(e.target.closest('button') || e.target.closest('a') || e.target.closest('input')) return;
                    handleMeetingClick(meet);
                  }}
                >
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
                  
                  {client && client.address && (
                    <div className="schedule-address" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.4rem', marginBottom: '0.6rem', display: 'flex', alignItems: 'flex-start', gap: '0.3rem', lineHeight: '1.4' }}>
                      <MapPin size={12} style={{ flexShrink: 0, marginTop: '0.2rem' }} />
                      <span style={{ wordBreak: 'keep-all', overflowWrap: 'break-word' }}>
                        {client.address}
                      </span>
                    </div>
                  )}

                  {client && (
                    <div className="schedule-actions">
                      {client.phone && (
                        <a href={`tel:${client.phone}`} className="btn-secondary btn-schedule-action">
                          <Phone size={12} /> 전화
                        </a>
                      )}
                      {client.phone && (
                        <a href={`sms:${client.phone}`} className="btn-secondary btn-schedule-action">
                          <MessageSquare size={12} /> 문자
                        </a>
                      )}
                      {client.address && (
                        <button 
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(client.address).then(() => toast.success('주소가 복사되었습니다.'));
                          }}
                          className="btn-secondary btn-schedule-action" 
                          style={{ backgroundColor: '#03c75a', color: 'white', border: 'none' }}
                        >
                          <Copy size={12} /> 주소복사
                        </button>
                      )}
                      {(client.company || meet.client_name) && (
                        <a href={`https://map.naver.com/v5/search/${encodeURIComponent(client.company || meet.client_name)}`} target="_blank" rel="noopener noreferrer" className="btn-secondary btn-schedule-action" style={{ backgroundColor: '#2d60ff', color: 'white', border: 'none' }}>
                          <Building size={12} /> 상호
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
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <button 
                          className="btn-primary" 
                          style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
                          onClick={() => {
                            navigate('/meetings', { state: { selectedContactId: meet.client_id, defaultContactType: '방문' } });
                          }}
                        >
                          미팅 내용 입력
                        </button>
                        <button 
                          className="btn-secondary" 
                          style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', color: 'var(--text-primary)' }}
                          onClick={() => handleEditScheduleClick(meet)}
                        >
                          일정 수정
                        </button>
                        <button 
                          className="btn-secondary" 
                          style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', color: '#dc2626' }}
                          onClick={() => setDeleteTargetId(meet.id)}
                        >
                          삭제
                        </button>
                      </div>
                    )}
                  </div>
                  {editMeetingId === meet.id && (
                    <div style={{ marginTop: '0.75rem', paddingTop: '0.5rem', borderTop: '1px dashed var(--border-color)' }}>
                      {renderMeetingForm()}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : isSelectedDateUnavailable ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
            <p style={{ fontWeight: 'bold', color: 'var(--danger-color)', fontSize: '1rem', margin: 0 }}>
              이 날짜는 일정 불가(휴무) 상태입니다. 달력에서 다시 눌러 해제하세요.
            </p>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
            선택한 날짜에 예정된 미팅이 없습니다.
          </div>
        )}
      </div>



      {/* AI 동선 최적화 및 길찾기 섹션 */}
      {visitMeetings.length > 0 && (
        <div className="schedule-section" style={{ border: '1px solid var(--border-color)', padding: '1.25rem', borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--bg-secondary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              🚗 AI 동선 최적화
            </h3>
            {visitMeetings.length > 1 && (
              <button 
                type="button" 
                className="btn-secondary" 
                onClick={optimizeRoute}
                style={{ fontSize: '0.75rem', padding: '0.35rem 0.7rem', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--accent-color)', color: 'var(--accent-color)', borderRadius: 'var(--radius-md)', fontWeight: 600 }}
              >
                🤖 AI 추천 동선
              </button>
            )}
          </div>

          <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
              {(() => {
                // 선택된 항목들이 위로, 순서대로 오도록 정렬
                const sortedMeetings = [...visitMeetings].sort((a, b) => {
                  const idxA = routeSelectedIds.indexOf(a.id);
                  const idxB = routeSelectedIds.indexOf(b.id);
                  if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                  if (idxA !== -1) return -1;
                  if (idxB !== -1) return 1;
                  return 0;
                });
                return sortedMeetings.map((meet, idx) => {
                  const client = getClientContact(meet.client_id);
                  const isChecked = routeSelectedIds.includes(meet.id);
                  const orderIndex = routeSelectedIds.indexOf(meet.id);

                return (
                  <div 
                    key={meet.id} 
                    draggable={isChecked}
                    onDragStart={(e) => handleDragStart(e, meet.id)}
                    onDragOver={(e) => handleDragOver(e, meet.id)}
                    onDragEnd={handleDragEnd}
                    onClick={() => handleRouteCheckboxChange(meet.id)}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.75rem', 
                      padding: '0.6rem 0.85rem', 
                      backgroundColor: isChecked ? 'var(--bg-primary)' : 'var(--bg-secondary)', 
                      border: `1px solid ${isChecked ? 'var(--accent-color)' : 'var(--border-color)'}`, 
                      borderRadius: 'var(--radius-md)',
                      cursor: isChecked ? 'grab' : 'pointer',
                      opacity: draggedRouteId === meet.id ? 0.5 : 1,
                      transition: 'background-color 0.2s, border-color 0.2s'
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
                });
              })()}
            </div>

            <button 
              type="button" 
              className="btn-primary" 
              onClick={handleOpenNaverDirections}
              disabled={routeSelectedIds.length === 0}
              style={{ width: '100%', padding: '0.7rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
            >
              🚗 네이버 길찾기 시작
            </button>
          </div>
        </div>
      )}

      {/* Monthly Stats Modal */}
      {showStatsModal && (
        <div className="modal-overlay" onClick={() => setShowStatsModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', width: '90%' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, fontSize: '1.2rem' }}>
                <CalendarIcon size={20} style={{ color: 'var(--primary-color)' }} />
                {format(currentDate, 'yyyy년 MM월')} 성과
              </h3>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn-secondary" style={{ padding: '0.25rem' }} onClick={handlePrevMonth}>
                  <ChevronLeft size={18} />
                </button>
                <button className="btn-secondary" style={{ padding: '0.25rem' }} onClick={handleNextMonth}>
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
            
            {(() => {
              const stats = calculateStats();
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                    <h4 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>🎯 실적 성과</h4>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontWeight: 600 }}>상조</span>
                      <span style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--primary-color)' }}>{stats.sangjoCount} <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>구좌</span></span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600 }}>보험</span>
                      <span style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent-color)' }}>{stats.bohumCount} <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>개</span></span>
                    </div>
                  </div>
                  
                  <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                    <h4 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>🤝 미팅 활동</h4>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span>총 미팅</span>
                      <span style={{ fontWeight: 700 }}>{stats.meetingCount} <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>번</span></span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span>브리핑</span>
                      <span style={{ fontWeight: 700 }}>{stats.briefingCount} <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>번</span></span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span>인사</span>
                      <span style={{ fontWeight: 700 }}>{stats.insaCount} <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>번</span></span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>유투브 촬영</span>
                      <span style={{ fontWeight: 700 }}>{stats.youtubeCount} <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>번</span></span>
                    </div>
                  </div>
                </div>
              );
            })()}
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button className="btn-secondary" onClick={() => setShowStatsModal(false)}>
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Modal for Deletion */}
      {deleteTargetId && (
        <div className="modal-overlay" style={{ zIndex: 9999, alignItems: 'center', paddingBottom: 0 }}>
          <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', padding: '2rem 1.5rem', width: '90%', maxWidth: '320px', textAlign: 'center', boxShadow: 'var(--shadow-lg)' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem' }}>삭제 비밀번호 확인</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
              일정을 삭제하시려면 비밀번호를 입력하세요.
            </p>
            <input 
              type="password" 
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              placeholder="비밀번호 입력"
              style={{ width: '100%', padding: '0.75rem', marginBottom: '1.5rem', textAlign: 'center', letterSpacing: '0.2em' }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => { setDeleteTargetId(null); setDeletePassword(''); }}>취소</button>
              <button className="btn-primary" style={{ flex: 1, backgroundColor: '#ef4444' }} onClick={handleDeleteMeeting}>확인</button>
            </div>
          </div>
        </div>
      )}

      {emptyDayActionDate && (
        <div className="modal-overlay" style={{ zIndex: 9999, alignItems: 'center' }}>
          <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', width: '90%', maxWidth: '320px', padding: '2rem 1.5rem', boxSizing: 'border-box' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', fontWeight: 700, color: 'var(--text-primary)', textAlign: 'center' }}>
              {format(emptyDayActionDate, 'MM월 dd일')}
            </h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', textAlign: 'center', lineHeight: '1.5' }}>
              선택하신 날짜에 등록된 일정이 없습니다.<br/>작업을 선택해 주세요.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <button 
                className="btn-primary" 
                style={{ width: '100%', padding: '0.8rem' }}
                onClick={() => {
                  setEmptyDayActionDate(null);
                  setShowAddForm(true);
                }}
              >
                새 일정 추가
              </button>
              <button 
                className="btn-secondary" 
                style={{ width: '100%', padding: '0.8rem', backgroundColor: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5' }}
                onClick={() => handleSetUnavailable(emptyDayActionDate)}
                disabled={unavailabilityLoading}
              >
                일정 불가(휴무)로 설정
              </button>
              <button 
                className="btn-secondary" 
                style={{ width: '100%', padding: '0.8rem', marginTop: '0.5rem' }}
                onClick={() => setEmptyDayActionDate(null)}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 휴무 해제 확인 모달 */}
      {cancelUnavailConfirm && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '320px', textAlign: 'center', padding: '1.5rem' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.1rem' }}>일정 불가 해제</h3>
            <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: '1.4' }}>
              선택하신 날짜의 일정 불가(휴무) 상태를<br/>해제하시겠습니까?
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
              <button 
                className="btn-secondary" 
                onClick={() => setCancelUnavailConfirm(null)}
                style={{ flex: 1 }}
              >
                취소
              </button>
              <button 
                className="btn-primary" 
                style={{ flex: 1, backgroundColor: 'var(--danger-color)' }}
                onClick={() => {
                  handleRemoveUnavailable(cancelUnavailConfirm.id);
                  setCancelUnavailConfirm(null);
                }}
              >
                해제하기
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Dashboard;
