import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { sheetsClient } from '../sheetsClient';
import { 
  ChevronRight, 
  Phone, 
  MapPin, 
  Mail, 
  FileText, 
  Save, 
  Trash2, 
  X, 
  Star,
  Search,
  Calendar,
  User,
  RefreshCw,
  PlusCircle,
  CheckCircle2,
  Clock,
  Users,
  FileCheck
} from 'lucide-react';
import toast from 'react-hot-toast';
import './MapRoute.css';
import './MeetingLog.css';

const MapRoute = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [interactions, setInteractions] = useState(() => {
    try { const cached = localStorage.getItem('sheet_v3_interactions'); return cached ? JSON.parse(cached) : []; } catch(e){ return []; }
  });
  const [meetings, setMeetings] = useState(() => {
    try { const cached = localStorage.getItem('sheet_v3_meetings'); return cached ? JSON.parse(cached) : []; } catch(e){ return []; }
  });
  const [contacts, setContacts] = useState(() => {
    try { const cached = localStorage.getItem('sheet_v3_clients'); return cached ? JSON.parse(cached) : []; } catch(e){ return []; }
  });

  const [loading, setLoading] = useState(() => !localStorage.getItem('sheet_v3_interactions'));
  const [expandedId, setExpandedId] = useState(null);
  const [searchTerm, setSearchTerm] = useState(location.state?.searchTerm || '');
  const [selectedContact, setSelectedContact] = useState(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [filterRecheck, setFilterRecheck] = useState(false);

  // Edit states
  const [editData, setEditData] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Modal states
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [recheckTargetItem, setRecheckTargetItem] = useState(null);

  const parseDateToLocal = (dateStr) => {
    if (!dateStr) return null;
    const match = String(dateStr).trim().match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})(?:\s+(\d{1,2}):(\d{1,2}))?/);
    if (match) {
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1;
      const day = parseInt(match[3], 10);
      const hour = match[4] ? parseInt(match[4], 10) : 0;
      const minute = match[5] ? parseInt(match[5], 10) : 0;
      return new Date(year, month, day, hour, minute);
    }
    const fallback = new Date(dateStr);
    return isNaN(fallback.getTime()) ? null : fallback;
  };

  const formatLocalDate = (dateStr) => {
    if (!dateStr) return '';
    const d = parseDateToLocal(dateStr);
    if (!d) return dateStr;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = d.getHours();
    const min = d.getMinutes();
    
    // 00:00 미드나잇 시간은 생략하여 2026.08.20 형태로만 표시
    if (h === 0 && min === 0) {
      return `${y}.${m}.${day}`;
    }
    
    const hStr = String(h).padStart(2, '0');
    const minStr = String(min).padStart(2, '0');
    return `${y}.${m}.${day} ${hStr}:${minStr}`;
  };

  const extractDateOnly = (dateStr) => {
    if (!dateStr) return '날짜 없음';
    const d = parseDateToLocal(dateStr);
    if (!d) return dateStr;
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const day = d.getDate();
    const weekday = weekdays[d.getDay()];
    return `${y}년 ${m}월 ${day}일 (${weekday})`;
  };

  const extractShortDate = (dateStr) => {
    if (!dateStr) return '';
    const d = parseDateToLocal(dateStr);
    if (!d) return dateStr;
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const weekday = weekdays[d.getDay()];
    return `${y}.${m}.${day} (${weekday})`;
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [interactionsData, meetingsData, clientsData] = await Promise.all([
        sheetsClient.read('interactions'),
        sheetsClient.read('meetings'),
        sheetsClient.read('clients')
      ]);

      if (interactionsData) {
        const sorted = [...interactionsData].sort((a, b) => {
          const timeA = parseDateToLocal(a.date)?.getTime() || 0;
          const timeB = parseDateToLocal(b.date)?.getTime() || 0;
          return timeB - timeA;
        });
        setInteractions(sorted);
        localStorage.setItem('sheet_v3_interactions', JSON.stringify(sorted));
      }
      if (meetingsData) {
        setMeetings(meetingsData);
        localStorage.setItem('sheet_v3_meetings', JSON.stringify(meetingsData));
      }
      if (clientsData) {
        setContacts(clientsData);
        localStorage.setItem('sheet_v3_clients', JSON.stringify(clientsData));
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleResetData = () => {
    if (window.confirm('샘플 데이터를 복원하시겠습니까? (로컬 환경 초기화)')) {
      sheetsClient.resetToSampleData();
      fetchData();
      toast.success('샘플 데이터가 복원되었습니다.');
    }
  };

  const handleUpdateInteraction = async (e) => {
    e.stopPropagation();
    if (!editData) return;

    try {
      setIsUpdating(true);
      const toastId = toast.loading('수정 사항 저장 중...');

      await sheetsClient.update('interactions', editData);

      const updatedList = interactions.map(item => item.id === editData.id ? editData : item);
      setInteractions(updatedList);
      localStorage.setItem('sheet_v3_interactions', JSON.stringify(updatedList));

      toast.success('수정되었습니다.', { id: toastId });
      setExpandedId(null);
    } catch (err) {
      console.error(err);
      toast.error('수정 실패: ' + err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRecheckConfirm = (remove) => {
    let finalItem = { ...recheckTargetItem };
    if (remove) {
      finalItem.needs_recheck = false;
      setInteractions(prev => prev.map(i => i.id === finalItem.id ? finalItem : i));
      sheetsClient.update('interactions', finalItem).catch(err => console.error('상태 해제 실패', err));
    }
    setExpandedId(finalItem.id);
    setEditData(finalItem);
    setRecheckTargetItem(null);
  };

  const requestDeleteInteraction = (e, id) => {
    e.stopPropagation();
    setDeleteTargetId(id);
    setDeletePassword('');
  };

  const confirmDeleteInteraction = async () => {
    if (deletePassword !== '0805') {
      toast.error('비밀번호가 일치하지 않습니다.');
      return;
    }

    const id = deleteTargetId;
    setDeleteTargetId(null);
    setDeletePassword('');

    const updatedList = interactions.filter(item => item.id !== id);
    setInteractions(updatedList);
    localStorage.setItem('sheet_v3_interactions', JSON.stringify(updatedList));
    toast.success('기록이 삭제되었습니다.');

    setExpandedId(null);

    try {
      await sheetsClient.delete('interactions', id);
    } catch (err) {
      toast.error('삭제 실패: ' + err.message);
      setInteractions(interactions);
      localStorage.setItem('sheet_v3_interactions', JSON.stringify(interactions));
    }
  };

  // interactions와 meetings 데이터를 통합 관리
  const allCombinedRecords = React.useMemo(() => {
    const map = new Map();

    interactions.forEach(item => {
      if (!item) return;
      const key = item.id || `int_${item.client_id}_${item.date}`;
      map.set(key, {
        ...item,
        sheet_source: 'interactions',
        meeting_type: item.meeting_type || item.type || '상담'
      });
    });

    meetings.forEach(item => {
      if (!item) return;
      const key = item.id || `meet_${item.client_id}_${item.date}`;
      if (!map.has(key)) {
        map.set(key, {
          ...item,
          sheet_source: 'meetings',
          meeting_type: item.type || '미팅',
          summary: item.summary || item.content || item.type || '',
          content: item.content || item.summary || ''
        });
      }
    });

    return Array.from(map.values());
  }, [interactions, meetings]);

  const cleanType = (rawType) => {
    if (!rawType) return '인사';
    let str = String(rawType).trim();
    str = str.replace(/\(진행\s*예정.*?\)/gi, '').trim();
    str = str.replace(/\(완료\)/gi, '').trim();
    
    if (str.includes('브리핑')) return '브리핑';
    if (str.includes('인사')) return '인사';
    if (str.includes('계약')) return '계약';
    if (str.includes('소개')) return '소개';
    if (str.includes('자료') || str.includes('제안서')) return '자료송부';

    if (str.includes(',')) {
      str = str.split(',')[0].trim();
    }
    if (!str || str === '미팅') return '인사';
    return str;
  };

  // 선택된 대상자 관련 통계 및 미팅 현황 분석 (과거 날짜는 모두 "미팅을 한 거"로 인식)
  const getTargetStats = (contact) => {
    if (!contact) return null;

    const nowTime = new Date().getTime();

    const targetRecords = allCombinedRecords.filter(r => 
      r.client_id === contact.id || 
      (r.client_name && r.client_name.includes(contact.company))
    );

    // 과거 미팅 (date <= now 또는 interactions 또는 완료)
    const pastMeetings = targetRecords.filter(r => {
      const dateTime = parseDateToLocal(r.date)?.getTime() || 0;
      return r.sheet_source === 'interactions' || r.result === '완료' || dateTime <= nowTime;
    }).sort((a, b) => (parseDateToLocal(b.date)?.getTime() || 0) - (parseDateToLocal(a.date)?.getTime() || 0));

    // 미래 미팅 (date > now 이고 result !== 완료)
    const futureMeetings = targetRecords.filter(r => {
      const dateTime = parseDateToLocal(r.date)?.getTime() || 0;
      return r.result !== '완료' && dateTime > nowTime;
    }).sort((a, b) => (parseDateToLocal(a.date)?.getTime() || 0) - (parseDateToLocal(b.date)?.getTime() || 0));

    const lastInteraction = pastMeetings[0] || null;
    const nextMeeting = futureMeetings[0] || null;

    return {
      lastInteraction,
      nextMeeting,
      totalCount: pastMeetings.length
    };
  };

  const activeTargetStats = selectedContact ? getTargetStats(selectedContact) : null;

  // 필터링된 기록 리스트 (통합 데이터 사용)
  const filteredInteractions = allCombinedRecords.filter(item => {
    if (filterRecheck && !item.needs_recheck) return false;

    if (selectedContact) {
      return item.client_id === selectedContact.id || (item.client_name && item.client_name.includes(selectedContact.company));
    }

    const query = searchTerm.toLowerCase().trim();
    if (!query) return true;

    const clientNameMatch = item.client_name?.toLowerCase().includes(query);
    const summaryMatch = item.summary?.toLowerCase().includes(query);
    const contentMatch = item.content?.toLowerCase().includes(query);
    const typeMatch = item.type?.toLowerCase().includes(query) || item.meeting_type?.toLowerCase().includes(query);

    return clientNameMatch || summaryMatch || contentMatch || typeMatch;
  });

  const sortedFilteredInteractions = [...filteredInteractions].sort((a, b) => {
    const timeA = parseDateToLocal(a.date)?.getTime() || 0;
    const timeB = parseDateToLocal(b.date)?.getTime() || 0;
    return timeB - timeA;
  });

  const groupedInteractions = sortedFilteredInteractions.reduce((acc, item) => {
    const dateGroup = extractDateOnly(item.date);
    if (!acc.map[dateGroup]) {
      acc.map[dateGroup] = [];
      acc.keys.push(dateGroup);
    }
    acc.map[dateGroup].push(item);
    return acc;
  }, { map: {}, keys: [] });

  const getDisplayMeetingType = (item) => {
    if (!item) return '인사';
    const typeCandidate = cleanType(item.meeting_type || item.type);
    if (typeCandidate && !['전화', '방문', '팩스', '이메일'].includes(typeCandidate)) {
      return typeCandidate;
    }
    const text = `${item.summary || ''} ${item.content || ''}`.toLowerCase();
    if (text.includes('브리핑')) return '브리핑';
    if (text.includes('인사')) return '인사';
    if (text.includes('계약')) return '계약';
    if (text.includes('소개')) return '소개';
    if (text.includes('자료') || text.includes('제안서')) return '자료송부';

    return cleanType(item.meeting_type || item.type || '인사');
  };

  const getBadgeStyle = (meetingType) => {
    switch (meetingType) {
      case '브리핑':
        return { backgroundColor: '#1976d2', color: 'white' };
      case '인사':
        return { backgroundColor: '#2e7d32', color: 'white' };
      case '계약':
        return { backgroundColor: '#e65100', color: 'white' };
      case '소개':
        return { backgroundColor: '#7b1fa2', color: 'white' };
      case '자료송부':
        return { backgroundColor: '#00838f', color: 'white' };
      default:
        return { backgroundColor: '#1976d2', color: 'white' };
    }
  };

  return (
    <div className="card" style={{ paddingBottom: '3rem' }}>
      {/* 헤더 바 */}
      <div style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, whiteSpace: 'nowrap', wordBreak: 'keep-all' }}>
          📋 기록 내용
        </h2>
        <button 
          onClick={() => setFilterRecheck(!filterRecheck)}
          className={filterRecheck ? 'btn-primary' : 'btn-secondary'}
          style={{ fontSize: '0.78rem', padding: '0.4rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem', whiteSpace: 'nowrap', borderRadius: '6px' }}
        >
          <Star size={13} fill={filterRecheck ? '#ffb300' : 'none'} color={filterRecheck ? '#ffb300' : 'currentColor'} /> 
          <span>별표시</span>
        </button>
      </div>

      {/* 대상자 검색 바 */}
      <div style={{ marginBottom: '1.25rem', position: 'relative' }}>
        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
          🔍 대상자 검색
        </label>
        
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <input 
              type="text" 
              placeholder="" 
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setIsDropdownOpen(true);
                if (!e.target.value.trim()) {
                  setSelectedContact(null);
                }
              }}
              onFocus={() => setIsDropdownOpen(true)}
              onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
              style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', fontSize: '0.85rem', boxSizing: 'border-box' }}
            />

            {/* 자동완성 드롭다운 */}
            {isDropdownOpen && searchTerm.trim() && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                maxHeight: '220px',
                overflowY: 'auto',
                zIndex: 200,
                marginTop: '0.25rem'
              }}>
                {(() => {
                  const filtered = contacts.filter(c => 
                    c.company?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                    c.address?.toLowerCase().includes(searchTerm.toLowerCase())
                  );

                  if (filtered.length === 0) {
                    return (
                      <div style={{ padding: '0.75rem', fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                        검색된 대상자가 없습니다.
                      </div>
                    );
                  }

                  return filtered.map(c => (
                    <div 
                      key={c.id} 
                      onClick={() => {
                        setSelectedContact(c);
                        setSearchTerm(c.name ? `${c.company} - ${c.name}` : c.company);
                        setIsDropdownOpen(false);
                      }}
                      style={{
                        padding: '0.65rem 0.85rem',
                        borderBottom: '1px solid var(--border-color)',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        textAlign: 'left'
                      }}
                      className="search-item-hover"
                    >
                      <span style={{ fontWeight: 600, color: 'var(--accent-color)' }}>{c.company}</span>
                      {c.name && <span style={{ color: 'var(--text-primary)', marginLeft: '0.4rem' }}>- {c.name}</span>}
                    </div>
                  ));
                })()}
              </div>
            )}
          </div>

          {(selectedContact || searchTerm) && (
            <button 
              className="btn-secondary"
              onClick={() => {
                setSelectedContact(null);
                setSearchTerm('');
              }}
              style={{ fontSize: '0.8rem', padding: '0 0.85rem', whiteSpace: 'nowrap' }}
            >
              전체 보기
            </button>
          )}
        </div>
      </div>

      {/* 🎯 대상자 미팅 현황 퀵 카드 */}
      {selectedContact && (
        <div style={{
          marginBottom: '1.5rem',
          padding: '1.1rem',
          borderRadius: 'var(--radius-lg)',
          backgroundColor: 'var(--bg-secondary)',
          border: '2px solid var(--accent-color)',
          boxShadow: 'var(--shadow-md)',
          boxSizing: 'border-box',
          width: '100%'
        }}>
          {/* 상호명 및 담당자 성함 */}
          <div style={{ marginBottom: '0.6rem', width: '100%' }}>
            <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--accent-color)', wordBreak: 'keep-all', lineHeight: 1.3 }}>
              🏢 {selectedContact.company} {selectedContact.name ? `- ${selectedContact.name}` : ''}
            </div>
          </div>

          {/* 연락처 */}
          {selectedContact.phone && (
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <Phone size={13} color="var(--accent-color)" />
              <a href={`tel:${selectedContact.phone}`} style={{ color: 'var(--accent-color)', textDecoration: 'none', fontWeight: 600 }}>{selectedContact.phone}</a>
            </div>
          )}

          {/* 다음 미팅 일정 잡기 버튼 (전체 너비 가로 버튼) */}
          <button 
            className="btn-primary"
            onClick={() => navigate('/meetings', { state: { selectedContactId: selectedContact.id, activeTab: 'write' } })}
            style={{
              width: '100%',
              fontSize: '0.88rem',
              padding: '0.65rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              whiteSpace: 'nowrap',
              backgroundColor: 'var(--accent-color)',
              borderRadius: 'var(--radius-md)',
              marginBottom: '0.85rem'
            }}
          >
            <PlusCircle size={16} />
            <span>➕ 다음 미팅 일정 잡기</span>
          </button>

          {/* 최근 미팅 및 다음 미팅 상태 그리드 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', marginTop: '0.8rem' }}>
            {/* 최근 미팅 카드 */}
            <div style={{
              padding: '0.8rem',
              backgroundColor: 'var(--bg-primary)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)'
            }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.3rem' }}>
                <CheckCircle2 size={14} color="var(--success-color)" /> 최근 미팅 (언제)
              </div>
              {activeTargetStats?.lastInteraction ? (
                <div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {formatLocalDate(activeTargetStats.lastInteraction.date)}
                  </div>
                  <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.25rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: '0.72rem',
                      padding: '0.15rem 0.45rem',
                      borderRadius: '4px',
                      backgroundColor: '#e3f2fd',
                      color: '#1976d2',
                      fontWeight: 700
                    }}>
                      {getDisplayMeetingType(activeTargetStats.lastInteraction)}
                    </span>
                    {(activeTargetStats.lastInteraction.attendees_count > 0 || activeTargetStats.lastInteraction.contracts_count > 0) && (
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-color)' }}>
                        👥 진행 {activeTargetStats.lastInteraction.attendees_count || 0}명 | 📝 계약 {activeTargetStats.lastInteraction.contracts_count || 0}명
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '0.85rem', color: '#e53935', fontWeight: 600 }}>
                  ⚠️ 최근 미팅 이력 없음 (미진행)
                </div>
              )}
            </div>

            {/* 다음 미팅 예정 카드 */}
            <div style={{
              padding: '0.8rem',
              backgroundColor: 'var(--bg-primary)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)'
            }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.3rem' }}>
                <Clock size={14} color="var(--accent-color)" /> 다음 미팅 예정 (스케줄)
              </div>
              {activeTargetStats?.nextMeeting ? (
                <div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--accent-color)' }}>
                    {formatLocalDate(activeTargetStats.nextMeeting.date)}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem', fontWeight: 600 }}>
                    {cleanType(activeTargetStats.nextMeeting.type || activeTargetStats.nextMeeting.meeting_type)}
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  📅 다음 일정 미정 (스케줄 필요)
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 타임라인 히스토리 리스트 (검색 시에만 노출: 미리 보여주지 않음) */}
      <div className="interactions-list" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {loading && interactions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>기록을 로딩하는 중...</div>
        ) : (!selectedContact && !searchTerm.trim() && !filterRecheck) ? (
          <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', border: '1px border var(--border-color)' }}>
            <Search size={38} style={{ marginBottom: '0.8rem', opacity: 0.5, color: 'var(--accent-color)' }} />
            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
              대상자를 검색해보세요
            </div>
            <div style={{ fontSize: '0.85rem', lineHeight: 1.5 }}>
              상단 검색창에 대상자를 입력하시면<br />방문 날짜와 상담 기록을 확인하실 수 있습니다.
            </div>
          </div>
        ) : sortedFilteredInteractions.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            {sortedFilteredInteractions.map(item => {
              const isExpanded = expandedId === item.id;
              const displayType = getDisplayMeetingType(item);
              const badgeStyle = getBadgeStyle(displayType);
              const hasStats = (item.attendees_count > 0 || item.contracts_count > 0);

              const rawSummary = (item.summary || item.content || '').trim();
              const isDuplicateSummary = !rawSummary || rawSummary === displayType || ['브리핑', '인사', '방문', '전화', '상담', '소개'].includes(rawSummary);

              return (
                <div 
                  key={item.id} 
                  className={`contact-card ${isExpanded ? 'expanded' : 'collapsed'}`}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    border: isExpanded ? '2px solid var(--accent-color)' : '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--bg-secondary)',
                    overflow: 'hidden',
                    transition: 'border-color 0.2s, box-shadow 0.2s'
                  }}
                >
                  {/* 두 줄 컴팩트 요약 행 (1행: 미팅일시 + 미팅내용 배지, 2행: 장소 및 대상자) */}
                  <div 
                    onClick={() => {
                      if (isExpanded) {
                        setExpandedId(null);
                        setEditData(null);
                      } else {
                        if (item.needs_recheck) {
                          setRecheckTargetItem(item);
                        } else {
                          setExpandedId(item.id);
                          setEditData({ ...item });
                        }
                      }
                    }}
                    style={{
                      padding: '0.75rem 0.9rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.35rem',
                      backgroundColor: 'var(--bg-primary)',
                      cursor: 'pointer'
                    }}
                  >
                    {/* 1행: 미팅일시 + 미팅내용 배지 (절대 잘리지 않게 일시 바로 옆 배치) */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                          📅 {extractShortDate(item.date)}
                        </span>

                        {/* 미팅 내용 배지 (브리핑, 인사 등) */}
                        <span style={{
                          fontSize: '0.73rem',
                          fontWeight: 700,
                          padding: '0.15rem 0.55rem',
                          borderRadius: '10px',
                          whiteSpace: 'nowrap',
                          ...badgeStyle
                        }}>
                          {displayType}
                        </span>

                        {hasStats && (
                          <span style={{ fontSize: '0.73rem', fontWeight: 700, color: '#e65100', whiteSpace: 'nowrap' }}>
                            👥{item.attendees_count || 0} 📝{item.contracts_count || 0}
                          </span>
                        )}

                        {item.needs_recheck && <Star size={15} fill="#ffb300" color="#ffb300" className="blink-star" />}
                      </div>

                      <ChevronRight 
                        size={16} 
                        style={{ 
                          transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', 
                          transition: 'transform 0.2s',
                          color: 'var(--text-secondary)',
                          flexShrink: 0
                        }} 
                      />
                    </div>

                    {/* 2행: 장소 및 대상자 (상호명 - 성함) + 메모 내용 */}
                    <div style={{ fontSize: '0.83rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, color: 'var(--accent-color)' }}>
                        🏢 {item.client_name}
                      </span>
                      {!isDuplicateSummary && (
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '300px' }}>
                          - {rawSummary}
                        </span>
                      )}
                    </div>
                  </div>

                      {/* 펼쳐진 상세 내용 및 편집 영역 */}
                      {isExpanded && editData && (
                        <div className="contact-body" onClick={(e) => e.stopPropagation()} style={{ padding: '1.1rem', backgroundColor: 'var(--bg-secondary)', textAlign: 'left', borderTop: '1px solid var(--border-color)' }}>
                          
                          {/* 상세 브리핑 성과 수량 수정 */}
                          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', backgroundColor: 'var(--bg-primary)', padding: '0.6rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                            <div style={{ flex: 1 }}>
                              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.2rem' }}>👥 진행 인원 (명)</label>
                              <input 
                                type="number" 
                                value={editData.attendees_count || 0}
                                onChange={(e) => setEditData({ ...editData, attendees_count: parseInt(e.target.value, 10) || 0 })}
                                style={{ width: '100%', padding: '0.35rem', fontSize: '0.85rem', boxSizing: 'border-box' }}
                              />
                            </div>
                            <div style={{ flex: 1 }}>
                              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.2rem' }}>📝 계약 인원 (명)</label>
                              <input 
                                type="number" 
                                value={editData.contracts_count || 0}
                                onChange={(e) => setEditData({ ...editData, contracts_count: parseInt(e.target.value, 10) || 0 })}
                                style={{ width: '100%', padding: '0.35rem', fontSize: '0.85rem', boxSizing: 'border-box' }}
                              />
                            </div>
                          </div>

                          <div className="form-group" style={{ marginBottom: '1rem' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-color)', display: 'block', marginBottom: '0.4rem' }}>상세 메모 및 내용</label>
                            <textarea
                              value={editData.content || editData.summary || ''}
                              onChange={(e) => setEditData({ ...editData, content: e.target.value, summary: e.target.value })}
                              style={{ width: '100%', minHeight: '160px', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '0.85rem', boxSizing: 'border-box', resize: 'vertical' }}
                              placeholder="상담 및 방문 내용을 입력하세요..."
                            />
                          </div>

                          <div className="form-group" style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: editData.needs_recheck ? '#d32f2f' : 'var(--text-secondary)' }}>
                              <input 
                                type="checkbox" 
                                checked={editData.needs_recheck || false} 
                                onChange={(e) => setEditData({ ...editData, needs_recheck: e.target.checked })} 
                                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                              />
                              <Star size={14} fill={editData.needs_recheck ? '#ffb300' : 'none'} color={editData.needs_recheck ? '#ffb300' : 'currentColor'} className={editData.needs_recheck ? 'blink-star' : ''} /> 다시확인 필요 (별표시)
                            </label>
                          </div>

                          {editData.next_meeting_date && (
                            <div style={{ marginBottom: '1rem', padding: '0.6rem', backgroundColor: 'var(--bg-primary)', borderRadius: '6px', borderLeft: '4px solid var(--success-color)' }}>
                              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--success-color)', display: 'block' }}>📅 예정된 다음 미팅 일정</span>
                              <span style={{ fontSize: '0.88rem', fontWeight: 700 }}>{editData.next_meeting_date}</span>
                            </div>
                          )}

                          {/* 첨부파일 영역 */}
                          <div className="form-group" style={{ marginBottom: '1rem' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-color)', display: 'block', marginBottom: '0.4rem' }}>첨부파일 및 사진</label>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                              {editData.attachments && editData.attachments.split(',').filter(Boolean).length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                  {editData.attachments.split(',').filter(Boolean).map((url, idx) => (
                                    <div key={idx} style={{ position: 'relative', display: 'inline-block', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '0.25rem 0.5rem', backgroundColor: 'var(--bg-primary)' }}>
                                      <a href={url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem', color: 'var(--accent-color)', textDecoration: 'underline' }}>첨부파일 {idx + 1} 보기</a>
                                      <button 
                                        type="button" 
                                        onClick={() => {
                                          const arr = editData.attachments.split(',').filter(Boolean);
                                          arr.splice(idx, 1);
                                          setEditData({ ...editData, attachments: arr.join(',') });
                                        }}
                                        style={{ position: 'absolute', top: '-8px', right: '-8px', background: 'white', borderRadius: '50%', color: 'var(--danger-color)', padding: '2px', border: '1px solid var(--border-color)' }}
                                      >
                                        <X size={12} />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <input 
                                  type="file" 
                                  id={`map-file-upload-${editData.id}`}
                                  style={{ display: 'none' }}
                                  onChange={async (e) => {
                                    const file = e.target.files[0];
                                    if (!file) return;
                                    if (file.size > 50 * 1024 * 1024) {
                                      toast.error('파일 크기는 50MB 이하여야 합니다.');
                                      return;
                                    }
                                    const btn = document.getElementById(`map-upload-btn-${editData.id}`);
                                    if (btn) btn.disabled = true;
                                    const loadingToast = toast.loading('파일 업로드 중...');
                                    try {
                                      const url = await sheetsClient.uploadFile(file);
                                      const arr = editData.attachments ? editData.attachments.split(',').filter(Boolean) : [];
                                      arr.push(url);
                                      setEditData({ ...editData, attachments: arr.join(',') });
                                      toast.success('파일 첨부 완료!', { id: loadingToast });
                                    } catch (err) {
                                      toast.error('업로드 실패: ' + err.message, { id: loadingToast });
                                    } finally {
                                      if (btn) btn.disabled = false;
                                      e.target.value = '';
                                    }
                                  }}
                                />
                                <button 
                                  type="button" 
                                  id={`map-upload-btn-${editData.id}`}
                                  className="btn-secondary btn-sm"
                                  onClick={() => document.getElementById(`map-file-upload-${editData.id}`).click()}
                                  style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
                                >
                                  파일 추가...
                                </button>
                              </div>
                            </div>
                          </div>

                          <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                            <button 
                              type="button" 
                              onClick={(e) => requestDeleteInteraction(e, editData.id)}
                              style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 0.8rem', borderRadius: '4px', backgroundColor: '#ffebee', color: '#d32f2f', border: '1px solid #ffcdd2', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                            >
                              <Trash2 size={14} /> 기록 삭제
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            {searchTerm.trim() ? '검색 결과와 일치하는 미팅 기록이 없습니다.' : '저장된 미팅 기록이 없습니다.'}
          </div>
        )}
      </div>

      {/* 화면 하단 고정 저장 버튼 (수정 모드) */}
      {editData && (
        <div style={{ position: 'fixed', bottom: 'calc(65px + env(safe-area-inset-bottom))', left: 0, right: 0, padding: '0.8rem 1rem', backgroundColor: 'var(--bg-secondary)', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'center', zIndex: 1000, boxShadow: '0 -4px 10px rgba(0,0,0,0.05)' }}>
          <button 
            className="btn-primary" 
            disabled={isUpdating}
            onClick={handleUpdateInteraction}
            style={{ width: '100%', maxWidth: '500px', padding: '0.8rem', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', borderRadius: '8px' }}
          >
            <Save size={18} /> {isUpdating ? '저장 중...' : '수정 사항 저장'}
          </button>
        </div>
      )}

      {/* Password Modal */}
      {deleteTargetId && (
        <div className="modal-overlay" style={{ zIndex: 9999, alignItems: 'center', paddingBottom: 0 }}>
          <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', width: '90%', maxWidth: '320px', textAlign: 'center', padding: '2rem 1.5rem', boxSizing: 'border-box' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', fontWeight: 600 }}>비밀번호 확인</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>기록을 삭제하시려면 비밀번호를 입력하세요.</p>
            <input 
              type="password" 
              value={deletePassword} 
              onChange={(e) => setDeletePassword(e.target.value)} 
              placeholder="****" 
              style={{ width: '100%', padding: '0.8rem', marginBottom: '1.5rem', borderRadius: '8px', border: '1px solid var(--border-color)', textAlign: 'center', letterSpacing: '0.3em', fontSize: '1.2rem', boxSizing: 'border-box' }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn-secondary" style={{ flex: 1, padding: '0.8rem' }} onClick={() => { setDeleteTargetId(null); setDeletePassword(''); }}>취소</button>
              <button className="btn-primary" style={{ flex: 1, padding: '0.8rem', backgroundColor: '#d32f2f', border: 'none' }} onClick={confirmDeleteInteraction}>확인</button>
            </div>
          </div>
        </div>
      )}

      {/* Recheck Modal */}
      {recheckTargetItem && (
        <div className="modal-overlay" style={{ zIndex: 9999, alignItems: 'center', paddingBottom: 0 }}>
          <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', width: '90%', maxWidth: '320px', textAlign: 'center', padding: '2.5rem 1.5rem 2rem', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
              <Star size={42} fill="#ffb300" color="#ffb300" className="blink-star" />
            </div>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>다시확인 상태 해제</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.8rem', lineHeight: '1.5' }}>
              내용을 확인하셨습니까?<br/>별표시 상태를 해제할까요?
            </p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn-secondary" style={{ flex: 1, padding: '0.8rem' }} onClick={() => handleRecheckConfirm(false)}>유지</button>
              <button className="btn-primary" style={{ flex: 1, padding: '0.8rem', border: 'none', backgroundColor: 'var(--accent-color)' }} onClick={() => handleRecheckConfirm(true)}>해제</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapRoute;
