import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { sheetsClient } from '../sheetsClient';
import { 
  Save, 
  UserCheck, 
  Calendar, 
  Phone, 
  Mail, 
  FileText,
  X,
  Paperclip,
  MapPin,
  Building,
  ChevronRight,
  ChevronLeft,
  Star
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useUser } from '../UserContext';
import './MeetingLog.css';
import { parseKoreanDateTime, getKSTDateTimeString } from '../dateUtils';
// Helper: Convert File/Blob to Base64 string (without the mime header)
const fileToBase64 = (fileOrBlob) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(fileOrBlob);
    reader.onload = () => {
      const base64String = reader.result.split(',')[1];
      resolve(base64String);
    };
    reader.onerror = (error) => reject(error);
  });
};

const MeetingLog = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useUser();
  const [content, setContent] = useState('');
  const [needsRecheck, setNeedsRecheck] = useState(false);
  
  // 성과 관리
  const [achievements, setAchievements] = useState([]);
  
  const addAchievement = () => {
    setAchievements([...achievements, { name: '', phone: '', type: '상조', detail: '' }]);
  };
  const removeAchievement = (index) => {
    const newArr = [...achievements];
    newArr.splice(index, 1);
    setAchievements(newArr);
  };
  const updateAchievement = (index, field, value) => {
    const newArr = [...achievements];
    newArr[index][field] = value;
    setAchievements(newArr);
  };

  // Tab & List states
  const [activeTab, setActiveTab] = useState(location.state?.activeTab || 'write'); // write, list
  const [contactQueue, setContactQueue] = useState([]);
  const [currentQueueIndex, setCurrentQueueIndex] = useState(0);
  const [multiLogs, setMultiLogs] = useState([]);
  const [interactions, setInteractions] = useState(() => {
    try { const cached = localStorage.getItem('sheet_v3_interactions'); return cached ? JSON.parse(cached) : []; } catch(e){ return []; }
  });
  const [loadingInteractions, setLoadingInteractions] = useState(() => !localStorage.getItem('sheet_v3_interactions'));
  const [expandedInteractionId, setExpandedInteractionId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Contacts list
  const [contacts, setContacts] = useState(() => {
    try { const cached = localStorage.getItem('sheet_v3_clients'); return cached ? JSON.parse(cached) : []; } catch(e){ return []; }
  });
  const [selectedContactId, setSelectedContactId] = useState(location.state?.selectedContactId || '');
  const [searchContactTerm, setSearchContactTerm] = useState('');
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const [isNewClientModalOpen, setIsNewClientModalOpen] = useState(false);
  const [newClientData, setNewClientData] = useState({
    company: '', name: '', title: '', phone: '', address: '', recommender: ''
  });

  // Form State: 1) 소통방식
  const [contactType, setContactType] = useState(location.state?.defaultContactType || '전화'); // 전화, 방문, 이메일, 팩스

  // Form State: 2) 이메일/팩스인 경우 자료 전달 결과
  const [materialSent, setMaterialSent] = useState('');

  // Form State: 3) 미팅 일정
  const [hasNextMeeting, setHasNextMeeting] = useState(false);
  
  // 로컬 표준시 기준 YYYY-MM-DD 반환 헬퍼
  const getLocalDateString = (d = new Date()) => {
    const offset = d.getTimezoneOffset();
    const localDate = new Date(d.getTime() - (offset * 60 * 1000));
    return localDate.toISOString().split('T')[0];
  };

  const [nextMeetingDateOnly, setNextMeetingDateOnly] = useState(getLocalDateString());
  const [nextMeetingTimeOnly, setNextMeetingTimeOnly] = useState('10:00');
  const [nextMeetingType, setNextMeetingType] = useState(['브리핑']); // array for multi-select
  const [customMeetingType, setCustomMeetingType] = useState('');
  const [nextMeetingDate, setNextMeetingDate] = useState('');

  // 개별 날짜 및 시간 텍스트 입력값 -> 전체 일정 문자열 조합
  useEffect(() => {
    if (nextMeetingDateOnly && nextMeetingTimeOnly) {
      setNextMeetingDate(`${nextMeetingDateOnly} ${nextMeetingTimeOnly}`);
    }
  }, [nextMeetingDateOnly, nextMeetingTimeOnly]);

  // AI 등에 의해 전체 일정 문자열이 변경될 때 -> 개별 상태값 분해 동기화
  useEffect(() => {
    if (nextMeetingDate) {
      const parts = nextMeetingDate.split(/[T\s]/);
      if (parts.length === 2) {
        if (parts[0] !== nextMeetingDateOnly) setNextMeetingDateOnly(parts[0]);
        if (parts[1] !== nextMeetingTimeOnly) setNextMeetingTimeOnly(parts[1]);
      }
    }
  }, [nextMeetingDate]);

  const fetchContacts = async () => {
    try {
      const cached = localStorage.getItem('sheet_v3_clients');
      if (cached) {
        setContacts(JSON.parse(cached));
      }
      const data = await sheetsClient.read('clients');
      if (data && data.length > 0) {
        setContacts(data);
        localStorage.setItem('sheet_v3_clients', JSON.stringify(data));
      }
    } catch (error) {
      console.log('Contacts load failed.', error.message);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, []);

  useEffect(() => {
    if (location.state?.selectedContactIds && location.state.selectedContactIds.length > 0) {
      sessionStorage.removeItem('meetingLogDraft');
      const ids = location.state.selectedContactIds;
      setContactQueue(ids);
      setCurrentQueueIndex(0);
      setSelectedContactId(ids[0]);
      
      const initialLogs = ids.map(id => ({
        contactId: id, content: '', needsRecheck: false, contactType: location.state?.defaultContactType || '전화', materialSent: '', hasNextMeeting: false,
        nextMeetingDateOnly: getLocalDateString(), nextMeetingTimeOnly: '10:00', nextMeetingType: ['브리핑'], customMeetingType: '', achievements: []
      }));
      setMultiLogs(initialLogs);
    } else if (location.state?.selectedContactId) {
      sessionStorage.removeItem('meetingLogDraft');
      setSelectedContactId(location.state.selectedContactId);
      setContactQueue([]);
    } else {
      const draftStr = sessionStorage.getItem('meetingLogDraft');
      if (draftStr) {
        try {
          const draft = JSON.parse(draftStr);
          setSelectedContactId(draft.selectedContactId);
          setContactQueue(draft.contactQueue);
          setCurrentQueueIndex(draft.currentQueueIndex);
          setMultiLogs(draft.multiLogs);
          setContent(draft.content);
          setNeedsRecheck(draft.needsRecheck || false);
          setContactType(draft.contactType);
          setMaterialSent(draft.materialSent);
          setHasNextMeeting(draft.hasNextMeeting);
          setNextMeetingDateOnly(draft.nextMeetingDateOnly);
          setNextMeetingTimeOnly(draft.nextMeetingTimeOnly);
          setNextMeetingType(draft.nextMeetingType);
          setCustomMeetingType(draft.customMeetingType);
          setAchievements(draft.achievements || []);
          setActiveTab(draft.activeTab || 'write');
        } catch (e) {
          console.error('Failed to load draft:', e);
        }
      }
    }
  }, [location.state]);

  const saveCurrentToLogs = () => {
    const newLogs = [...multiLogs];
    newLogs[currentQueueIndex] = {
      contactId: selectedContactId, content, needsRecheck, contactType, materialSent, hasNextMeeting,
      nextMeetingDateOnly, nextMeetingTimeOnly, nextMeetingType, customMeetingType, achievements
    };
    return newLogs;
  };

  useEffect(() => {
    if (!selectedContactId && contactQueue.length === 0) return;
    const draft = {
      selectedContactId, content, needsRecheck, contactType, materialSent, hasNextMeeting,
      nextMeetingDateOnly, nextMeetingTimeOnly, nextMeetingType, customMeetingType,
      contactQueue, currentQueueIndex, multiLogs: saveCurrentToLogs(), activeTab, achievements
    };
    sessionStorage.setItem('meetingLogDraft', JSON.stringify(draft));
  }, [
    selectedContactId, content, needsRecheck, contactType, materialSent, hasNextMeeting,
    nextMeetingDateOnly, nextMeetingTimeOnly, nextMeetingType, customMeetingType,
    contactQueue, currentQueueIndex, activeTab, multiLogs, achievements
  ]);

  const loadFormFromMultiLogs = (index, logs) => {
    const log = logs[index];
    if (!log) return;
    setSelectedContactId(log.contactId);
    setContent(log.content);
    setNeedsRecheck(log.needsRecheck || false);
    setContactType(log.contactType);
    setMaterialSent(log.materialSent);
    setHasNextMeeting(log.hasNextMeeting);
    setNextMeetingDateOnly(log.nextMeetingDateOnly);
    setNextMeetingTimeOnly(log.nextMeetingTimeOnly);
    setNextMeetingType(log.nextMeetingType);
    setCustomMeetingType(log.customMeetingType);
    setAchievements(log.achievements || []);
  };

  const handlePrevContact = () => {
    if (contactQueue.length === 0) return;
    const newLogs = saveCurrentToLogs();
    setMultiLogs(newLogs);
    const newIndex = currentQueueIndex - 1;
    setCurrentQueueIndex(newIndex);
    loadFormFromMultiLogs(newIndex, newLogs);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNextContact = () => {
    if (contactQueue.length === 0) return;
    const newLogs = saveCurrentToLogs();
    setMultiLogs(newLogs);
    const newIndex = currentQueueIndex + 1;
    setCurrentQueueIndex(newIndex);
    loadFormFromMultiLogs(newIndex, newLogs);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBatchSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      if (!user) {
        toast.error('사용자를 먼저 선택해 주세요.');
        return;
      }
    
    const finalLogs = [...multiLogs];
    finalLogs[currentQueueIndex] = {
      contactId: selectedContactId, content, needsRecheck, contactType, materialSent, hasNextMeeting,
      nextMeetingDateOnly, nextMeetingTimeOnly, nextMeetingType, customMeetingType, achievements
    };
    setMultiLogs(finalLogs);

    const checkDateUnavailability = (dateStr) => {
      if (!dateStr) return false;
      try {
        const cachedMeetings = JSON.parse(localStorage.getItem('sheet_v3_meetings') || '[]');
        const targetDateStr = dateStr.split(' ')[0];
        return cachedMeetings.some(m => m.type === '일정 불가' && m.date.startsWith(targetDateStr));
      } catch (e) {
        return false;
      }
    };

    // 검증 단계
    for (let i = 0; i < finalLogs.length; i++) {
      const log = finalLogs[i];
      if (!log.contactId) continue;
      if (log.hasNextMeeting && log.nextMeetingDateOnly) {
        const parsed = parseKoreanDateTime(`${log.nextMeetingDateOnly} ${log.nextMeetingTimeOnly}`);
        if (checkDateUnavailability(parsed)) {
          return toast.error(`${i + 1}번째 대상자의 미팅 날짜가 일정 불가(휴무) 상태입니다.`);
        }
      }
    }

    toast.loading('다중 기록을 순차적으로 저장하는 중...', { id: 'batch-save' });

    for (let i = 0; i < finalLogs.length; i++) {
      const log = finalLogs[i];
      if (!log.contactId) continue;

      let finalContent = log.content;
      if (log.achievements && log.achievements.length > 0) {
        const achievementLines = log.achievements.map(a => {
          const detailStr = a.type === '상조' ? `${a.detail}구좌` : a.detail;
          return `- 이름: ${a.name} | 연락처: ${a.phone} | 성과: ${a.type} (${detailStr})`;
        }).join('\n');
        finalContent += `\n\n[성과 기록]\n${achievementLines}`;
      }

      const hasInteractionContent = finalContent.trim() || log.materialSent;
      if (!hasInteractionContent && !log.hasNextMeeting) continue;

      const client = contacts.find(c => c.id === log.contactId);
      const clientName = client ? `${client.company} - ${client.name}` : '알 수 없음';
      
      const parsedMeetingDate = log.hasNextMeeting && log.nextMeetingDateOnly ? parseKoreanDateTime(`${log.nextMeetingDateOnly} ${log.nextMeetingTimeOnly}`) : '';
      
      try {
        if (hasInteractionContent) {
          const tempId = 'temp_' + Date.now() + '_' + i;
          const interactionData = {
            id: tempId, client_id: log.contactId, client_name: clientName, date: getKSTDateTimeString(),
            type: log.contactType, summary: finalContent, content: finalContent, attachments: '', next_meeting_date: parsedMeetingDate, creator: user,
            needs_recheck: log.needsRecheck
          };
          await sheetsClient.insert('interactions', interactionData);
        }
        
        if (log.hasNextMeeting) {
          let typeArr = Array.isArray(log.nextMeetingType) ? [...log.nextMeetingType] : [log.nextMeetingType];
          if (typeArr.includes('직접입력')) {
            typeArr = typeArr.filter(t => t !== '직접입력');
            if (log.customMeetingType) typeArr.push(log.customMeetingType);
          }
          const finalMeetingType = typeArr.join(', ') || '미팅';
          
          const meetingData = {
            id: 'temp_meet_' + Date.now() + '_' + i, client_id: log.contactId, client_name: clientName, date: parsedMeetingDate,
            type: finalMeetingType, result: '진행 예정 (준비 단계)', creator: user
          };
          await sheetsClient.insert('meetings', meetingData);
        }
      } catch (err) {
        console.error('Batch insert err:', err);
      }
    }
    
    toast.success('다중 기록 저장이 완료되었습니다!', { id: 'batch-save' });
    sessionStorage.removeItem('meetingLogDraft');
    setContactQueue([]);
    setMultiLogs([]);
    setContent('');
    setNeedsRecheck(false);
    setAchievements([]);
    setActiveTab('list');
    fetchInteractions();
    } finally {
      setIsSaving(false);
    }
  };

  const handleQuickClientSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      toast.error('사용자를 먼저 선택해 주세요.');
      return;
    }

    try {
      toast.loading('신규 대상자를 저장하고 선택하는 중...', { id: 'quick-client' });
      
      let parsedCity = '천안시';
      let parsedDistrict = '서북구';
      const addr = newClientData.address || '';
      if (addr.includes('동남구')) {
        parsedDistrict = '동남구';
      } else if (addr.includes('서북구')) {
        parsedDistrict = '서북구';
      }
      if (addr.includes('아산시') || addr.includes('아산')) {
        parsedCity = '아산시';
        parsedDistrict = '';
      }

      const clientPayload = {
        company: newClientData.company || '미지정 업체',
        name: newClientData.name || '미지정 담당자',
        title: newClientData.title || '',
        phone: newClientData.phone || '',
        address: newClientData.address || '',
        recommender: newClientData.recommender || '',
        city: parsedCity,
        district: parsedDistrict,
        latitude: '',
        longitude: '',
        creator: user
      };

      const saved = await sheetsClient.insert('clients', clientPayload);
      
      setContacts(prev => {
        const next = [saved, ...prev];
        localStorage.setItem('sheet_v3_clients', JSON.stringify(next));
        return next;
      });

      setSelectedContactId(saved.id);
      setIsNewClientModalOpen(false);
      
      setNewClientData({
        company: '', name: '', title: '', phone: '', address: '', recommender: ''
      });

      toast.success('새 대상자가 등록 및 선택되었습니다.', { id: 'quick-client' });
    } catch (error) {
      toast.error('등록 실패: ' + error.message, { id: 'quick-client' });
    }
  };

  const fetchInteractions = async () => {
    try {
      setLoadingInteractions(true);
      const cached = localStorage.getItem('sheet_v3_interactions');
      if (cached) {
        setInteractions(JSON.parse(cached));
      }
      const data = await sheetsClient.read('interactions');
      if (data && data.length > 0) {
        const sorted = data.sort((a, b) => {
          const dateA = a.date ? new Date(a.date.replace(' ', 'T')) : new Date(0);
          const dateB = b.date ? new Date(b.date.replace(' ', 'T')) : new Date(0);
          return dateB - dateA;
        });
        setInteractions(sorted);
        localStorage.setItem('sheet_v3_interactions', JSON.stringify(sorted));
      }
    } catch (error) {
      console.error('Failed to fetch interactions:', error);
    } finally {
      setLoadingInteractions(false);
    }
  };



  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      if (!user) {
      toast.error('사용자를 먼저 선택해 주세요.');
      return;
    }
    if (!selectedContactId) {
      toast.error('미팅 대상자를 선택해 주세요.');
      return;
    }

    if (hasNextMeeting && !nextMeetingDate) {
      toast.error('다음 미팅 일정을 지정해 주세요.');
      return;
    }

    // 자연어 한글 날짜 시간 파싱 적용
    const parsedMeetingDate = hasNextMeeting ? parseKoreanDateTime(nextMeetingDate) : '';
    
    // 포맷 검증
    const isValidFormat = /^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}$/.test(parsedMeetingDate);
    if (hasNextMeeting && !isValidFormat) {
      toast.error(`일정 해석에 실패했습니다: "${nextMeetingDate}"\n(예: "6/25 오후 3시" 또는 "2026-06-25 15:00" 형태로 기입해주세요.)`);
      return;
    }

    if (hasNextMeeting && isValidFormat) {
      try {
        const cachedMeetings = JSON.parse(localStorage.getItem('sheet_v3_meetings') || '[]');
        const targetDateStr = parsedMeetingDate.split(' ')[0];
        const isUnavailable = cachedMeetings.some(m => m.type === '일정 불가' && m.date.startsWith(targetDateStr));
        if (isUnavailable) {
          toast.error('선택하신 날짜는 일정 불가(휴무) 상태이므로 일정을 추가할 수 없습니다.');
          return;
        }
      } catch (e) {
        // ignore
      }
    }

    const hasInteractionContent = content.trim() || materialSent || (window.meetingAttachments && window.meetingAttachments.length > 0) || achievements.length > 0;

    if (!hasInteractionContent && !hasNextMeeting) {
      toast.error('저장할 내용이나 일정이 없습니다.');
      return;
    }

    const client = contacts.find(c => c.id === selectedContactId);
    const clientName = client ? `${client.company} - ${client.name}` : '알 수 없음';

    let finalContent = content;
    if (achievements.length > 0) {
      const achievementLines = achievements.map(a => {
        const detailStr = a.type === '상조' ? `${a.detail}구좌` : a.detail;
        return `- 이름: ${a.name} | 연락처: ${a.phone} | 성과: ${a.type} (${detailStr})`;
      }).join('\n');
      finalContent += `\n\n[성과 기록]\n${achievementLines}`;
    }

    // 1) Prepare data
    const tempId = 'temp_' + Date.now();
    let interactionData = null;
    
    if (hasInteractionContent) {
      interactionData = {
        id: tempId,
        client_id: selectedContactId,
        client_name: clientName,
        date: getKSTDateTimeString(),
        type: contactType,
        summary: finalContent,
        content: finalContent,
        attachments: (window.meetingAttachments || []).join(','),
        next_meeting_date: parsedMeetingDate,
        creator: user,
        needs_recheck: needsRecheck
      };
    }

    let meetingData = null;
    if (hasNextMeeting) {
      let typeArr = Array.isArray(nextMeetingType) ? [...nextMeetingType] : [nextMeetingType];
      if (typeArr.includes('직접입력')) {
        typeArr = typeArr.filter(t => t !== '직접입력');
        if (customMeetingType) typeArr.push(customMeetingType);
      }
      const finalMeetingType = typeArr.join(', ') || '미팅';
      
      meetingData = {
        id: 'temp_meet_' + Date.now(),
        client_id: selectedContactId,
        client_name: clientName,
        date: parsedMeetingDate,
        type: finalMeetingType,
        result: '진행 예정 (준비 단계)',
        creator: user
      };
    }

    // 2) Optimistic UI Update & Cache Update
    if (interactionData) {
      toast.success('기록 저장을 시작했습니다. (화면 이동 가능)', { id: 'interaction-save' });
      
      const cachedStr = localStorage.getItem('sheet_v3_interactions');
      let cachedInteractions = [];
      if (cachedStr) {
        try {
          cachedInteractions = JSON.parse(cachedStr);
        } catch (e) {}
      }
      const updatedCache = [interactionData, ...cachedInteractions];
      localStorage.setItem('sheet_v3_interactions', JSON.stringify(updatedCache));
    } else {
      toast.success('일정 저장을 시작했습니다. (화면 이동 가능)', { id: 'interaction-save' });
    }

    // Reset State Immediately
    sessionStorage.removeItem('meetingLogDraft');
    setContent('');
    setNeedsRecheck(false);
    setAchievements([]);
    setMaterialSent('');
    setHasNextMeeting(false);
    setNextMeetingDate('');
    setSelectedContactId('');
    window.meetingAttachments = [];

    // 3) Background Save
    try {
      let savedInteraction = null;
      if (interactionData) {
        savedInteraction = await sheetsClient.insert('interactions', interactionData);
      }
      
      if (meetingData) {
        await sheetsClient.insert('meetings', meetingData);
      }
      
      // 서버에서 발급받은 ID로 캐시 업데이트
      if (savedInteraction) {
        const latestCacheStr = localStorage.getItem('sheet_v3_interactions');
        if (latestCacheStr) {
          const latestCache = JSON.parse(latestCacheStr);
          const fixedCache = latestCache.map(i => i.id === tempId ? savedInteraction : i);
          localStorage.setItem('sheet_v3_interactions', JSON.stringify(fixedCache));
        }
      }
    } catch (err) {
      console.error("Save failed:", err);
      toast.error('저장 중 오류가 발생했습니다: ' + err.message);
      
      // 에러 시 임시 항목 제거
      if (interactionData) {
        const errCacheStr = localStorage.getItem('sheet_v3_interactions');
        if (errCacheStr) {
          const errCache = JSON.parse(errCacheStr);
          localStorage.setItem('sheet_v3_interactions', JSON.stringify(errCache.filter(i => i.id !== tempId)));
        }
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="card meeting-log-page" style={{ paddingBottom: '3rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1.25rem', gap: '0.5rem' }}>
        <button type="button" onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: 'var(--text-primary)' }}>
          <ChevronLeft size={24} />
        </button>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 700, margin: 0 }}>상담 기록 작성</h2>
      </div>
      {contactQueue.length > 1 && (
        <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '0.8rem 1rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem', borderLeft: '4px solid var(--accent-color)', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>다중 기록 작성 중 ({currentQueueIndex + 1} / {contactQueue.length})</span>
        </div>
      )}
      
      {/* 1. Target Selection */}
      <div className="form-group" style={{ marginBottom: '1.25rem', position: 'relative' }}>
        <label><UserCheck size={16} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '0.25rem' }}/> 대상자 선택 (누구랑) *</label>
        
        {selectedContactId ? (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between', 
            padding: '0.6rem 0.85rem', 
            backgroundColor: 'var(--bg-secondary)', 
            border: '1px solid var(--border-color)', 
            borderRadius: 'var(--radius-md)' 
          }}>
            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>
              {(() => {
                const c = contacts.find(item => item.id === selectedContactId);
                return c ? `${c.company} - ${c.name} (${c.title || '담당자'})` : '선택된 대상자';
              })()}
            </span>
            <button 
              type="button" 
              onClick={() => {
                setSelectedContactId('');
                setSearchContactTerm('');
              }}
              style={{ background: 'none', border: 'none', color: 'var(--danger-color)', cursor: 'pointer', padding: 0 }}
            >
              <X size={18} />
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <input 
                type="text" 
                placeholder="상호명, 성함, 또는 주소로 대상자 검색..." 
                value={searchContactTerm}
                onChange={(e) => {
                  setSearchContactTerm(e.target.value);
                  setIsSearchDropdownOpen(true);
                }}
                onFocus={() => setIsSearchDropdownOpen(true)}
                onBlur={() => setTimeout(() => setIsSearchDropdownOpen(false), 200)}
                style={{ width: '100%', padding: '0.6rem', boxSizing: 'border-box' }}
              />
              
              {isSearchDropdownOpen && searchContactTerm.trim() && (
                <div style={{ 
                  position: 'absolute', 
                  top: '100%', 
                  left: 0, 
                  right: 0, 
                  backgroundColor: 'var(--bg-primary)', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: 'var(--radius-md)', 
                  boxShadow: 'var(--shadow-md)', 
                  maxHeight: '200px', 
                  overflowY: 'auto', 
                  zIndex: 100, 
                  marginTop: '0.25rem' 
                }}>
                  {(() => {
                    const filtered = contacts.filter(c => 
                      c.company?.toLowerCase().includes(searchContactTerm.toLowerCase()) || 
                      c.name?.toLowerCase().includes(searchContactTerm.toLowerCase()) || 
                      c.address?.toLowerCase().includes(searchContactTerm.toLowerCase())
                    );
                    
                    if (filtered.length === 0) {
                      return (
                        <div style={{ padding: '0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                          검색 결과가 없습니다.
                        </div>
                      );
                    }
                    
                    return filtered.map(c => (
                      <div 
                        key={c.id} 
                        onClick={() => {
                          setSelectedContactId(c.id);
                          setIsSearchDropdownOpen(false);
                          setSearchContactTerm('');
                        }}
                        style={{ 
                          padding: '0.6rem 0.85rem', 
                          borderBottom: '1px solid var(--border-color)', 
                          cursor: 'pointer', 
                          fontSize: '0.85rem',
                          textAlign: 'left'
                        }}
                        className="search-item-hover"
                      >
                        <span style={{ fontWeight: 600 }}>{c.company}</span> - {c.name} ({c.title || '담당자'}, {c.city})
                      </div>
                    ));
                  })()}
                </div>
              )}
            </div>
            
            <button 
              type="button" 
              className="btn-primary" 
              onClick={() => setIsNewClientModalOpen(true)}
              style={{ whiteSpace: 'nowrap', padding: '0 0.85rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
            >
              + 신규 등록
            </button>
          </div>
        )}
      </div>

      {/* 2. 소통 방식 (방문 추가) */}
      <div style={{ marginBottom: '1.25rem' }}>
        <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>소통 방식</label>
        <div className="type-tabs">
          {['전화', '방문', '이메일', '팩스'].map(type => (
            <button 
              key={type}
              type="button" 
              className={`type-tab ${contactType === type ? 'active' : ''}`}
              onClick={() => setContactType(type)}
            >
              {type === '전화' && <Phone size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.25rem' }} />}
              {type === '방문' && <MapPin size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.25rem' }} />}
              {type === '이메일' && <Mail size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.25rem' }} />}
              {type === '팩스' && <FileText size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.25rem' }} />}
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* 3. 소통방식별 서브폼 (전화 & 방문인 경우 미팅 스케줄링) */}
      {['전화', '방문'].includes(contactType) ? (
        <div className="sub-form-card" style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <Calendar size={15} /> 미팅 스케줄링
          </h4>
          <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem', marginBottom: '0.8rem' }}>
            <input 
              type="checkbox" 
              id="next-meet-check"
              checked={hasNextMeeting}
              onChange={(e) => setHasNextMeeting(e.target.checked)}
              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
            />
            <label htmlFor="next-meet-check" style={{ cursor: 'pointer', userSelect: 'none' }}>후속 미팅 일정 잡힘 (캘린더 연동)</label>
          </div>

          {hasNextMeeting && (
            <div className="sub-form-row" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div className="form-group">
                <label>미팅 일시 *</label>
                
                {/* 퀵 날짜 선택 버튼 */}
                <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                  <button 
                    type="button" 
                    className="btn-secondary" 
                    style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                    onClick={() => setNextMeetingDateOnly(getLocalDateString())}
                  >
                    오늘
                  </button>
                  <button 
                    type="button" 
                    className="btn-secondary" 
                    style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() + 1);
                      setNextMeetingDateOnly(getLocalDateString(d));
                    }}
                  >
                    내일
                  </button>
                  <button 
                    type="button" 
                    className="btn-secondary" 
                    style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() + 2);
                      setNextMeetingDateOnly(getLocalDateString(d));
                    }}
                  >
                    모레
                  </button>
                  <button 
                    type="button" 
                    className="btn-secondary" 
                    style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                    onClick={() => {
                      const d = new Date();
                      const day = d.getDay();
                      const daysUntilNextMon = day === 0 ? 1 : 8 - day;
                      d.setDate(d.getDate() + daysUntilNextMon);
                      setNextMeetingDateOnly(getLocalDateString(d));
                    }}
                  >
                    다음주 월요일
                  </button>
                </div>

                {/* 달력 날짜 선택 + 시간 직접 입력 */}
                <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                  <input 
                    type="date" 
                    value={nextMeetingDateOnly}
                    onChange={(e) => setNextMeetingDateOnly(e.target.value)}
                    style={{ flex: 1.2, padding: '0.5rem 0.35rem', fontSize: '0.85rem', minWidth: '0', boxSizing: 'border-box' }}
                    title="달력에서 날짜를 선택하세요"
                  />
                  <input 
                    type="text" 
                    placeholder="시간 (예: 15:30, 오후 3시)" 
                    value={nextMeetingTimeOnly}
                    onChange={(e) => setNextMeetingTimeOnly(e.target.value)}
                    style={{ flex: 1, padding: '0.5rem 0.35rem', fontSize: '0.85rem', minWidth: '0', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>미팅 구분</label>
                <div className="meeting-option-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
                  {['브리핑', '인사', '소개', '유투브 촬영', '직접입력'].map(opt => (
                    <button
                      key={opt}
                      type="button"
                      className={`meeting-option-btn ${(Array.isArray(nextMeetingType) ? nextMeetingType : []).includes(opt) ? 'active' : ''}`}
                      onClick={() => {
                        const current = Array.isArray(nextMeetingType) ? nextMeetingType : [];
                        if (current.includes(opt)) {
                          setNextMeetingType(current.filter(t => t !== opt));
                        } else {
                          setNextMeetingType([...current, opt]);
                        }
                      }}
                      style={{ fontSize: '0.75rem', padding: '0.4rem 0.2rem' }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
                {(Array.isArray(nextMeetingType) ? nextMeetingType : []).includes('직접입력') && (
                  <input 
                    type="text" 
                    placeholder="직접 입력하세요..." 
                    value={customMeetingType}
                    onChange={(e) => setCustomMeetingType(e.target.value)}
                    style={{ marginTop: '0.4rem', fontSize: '0.85rem' }}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="sub-form-card" style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            {contactType === '이메일' ? <Mail size={15} /> : <FileText size={15} />}
            자료 전달 결과
          </h4>
          <div className="form-group">
            <label>보낸 자료 내용</label>
            <input 
              type="text" 
              placeholder="예: 영업 제안서 PDF 송부" 
              value={materialSent}
              onChange={(e) => setMaterialSent(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* 4. 소통 내용 전문 */}
      <div className="form-group" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
          <label style={{ margin: 0 }}>미팅 내용</label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: needsRecheck ? '#d32f2f' : 'var(--text-secondary)' }}>
            <input 
              type="checkbox" 
              checked={needsRecheck} 
              onChange={(e) => setNeedsRecheck(e.target.checked)} 
              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
            />
            <Star size={14} fill={needsRecheck ? '#ffb300' : 'none'} color={needsRecheck ? '#ffb300' : 'currentColor'} className={needsRecheck ? 'blink-star' : ''} /> 다시확인 필요 (별표시)
          </label>
        </div>
        <textarea 
          rows="10" 
          placeholder=""
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
      </div>

      {/* 4.1 성과 추가 */}
      <div style={{ marginBottom: '1.5rem', border: '1px solid var(--border-color)', padding: '1rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-secondary)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            🏆 성과 기록
          </label>
          <button type="button" className="btn-secondary" onClick={addAchievement} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>
            + 인원 추가
          </button>
        </div>
        
        {achievements.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {achievements.map((achieve, idx) => (
              <div key={idx} style={{ padding: '0.75rem', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', position: 'relative' }}>
                <button 
                  type="button" 
                  onClick={() => removeAchievement(idx)}
                  style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', background: 'none', border: 'none', color: 'var(--danger-color)', cursor: 'pointer' }}
                >
                  <X size={14} />
                </button>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                  <div style={{ flex: 1, minWidth: '100px' }}>
                    <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.2rem' }}>이름</label>
                    <input type="text" value={achieve.name} onChange={(e) => updateAchievement(idx, 'name', e.target.value)} placeholder="이름" style={{ padding: '0.35rem', fontSize: '0.8rem', width: '100%' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: '120px' }}>
                    <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.2rem' }}>연락처</label>
                    <input type="text" value={achieve.phone} onChange={(e) => updateAchievement(idx, 'phone', e.target.value)} placeholder="연락처" style={{ padding: '0.35rem', fontSize: '0.8rem', width: '100%' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: '100px' }}>
                    <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.2rem' }}>성과 유형</label>
                    <select value={achieve.type} onChange={(e) => updateAchievement(idx, 'type', e.target.value)} style={{ padding: '0.35rem', fontSize: '0.8rem', width: '100%' }}>
                      <option value="상조">상조</option>
                      <option value="보험">보험</option>
                      <option value="직접입력">직접입력</option>
                    </select>
                  </div>
                  <div style={{ flex: 1.5, minWidth: '150px' }}>
                    <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.2rem' }}>
                      {achieve.type === '상조' ? '구좌 수' : '내용 입력'}
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                      <input 
                        type={achieve.type === '상조' ? 'number' : 'text'} 
                        value={achieve.detail} 
                        onChange={(e) => updateAchievement(idx, 'detail', e.target.value)} 
                        placeholder={achieve.type === '상조' ? "예: 2" : "내용 직접입력"} 
                        style={{ padding: '0.35rem', fontSize: '0.8rem', flex: 1, width: '100%' }} 
                      />
                      {achieve.type === '상조' && <span style={{ fontSize: '0.8rem', flexShrink: 0 }}>구좌</span>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {achievements.length === 0 && (
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center', padding: '0.5rem' }}>
            입력된 성과가 없습니다.
          </div>
        )}
      </div>

      {/* 4.5. 파일 및 사진 첨부 */}
      <div style={{ marginBottom: '1.5rem', border: '1px solid var(--border-color)', padding: '1rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-secondary)' }}>
        <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
          <Paperclip size={16} /> 사진 및 파일 첨부
        </label>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {(Array.isArray(window.meetingAttachments) ? window.meetingAttachments : []).map((url, idx) => (
              <div key={idx} style={{ position: 'relative', display: 'inline-block', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '0.2rem', backgroundColor: 'var(--bg-primary)' }}>
                <a href={url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem', color: 'var(--accent-color)', textDecoration: 'underline' }}>첨부파일 {idx + 1} 보기</a>
                <button 
                  type="button" 
                  onClick={() => {
                    const newAtt = [...window.meetingAttachments];
                    newAtt.splice(idx, 1);
                    window.meetingAttachments = newAtt;
                    // Trigger re-render by doing a dummy state update
                    setMaterialSent(prev => prev + ' '); setTimeout(() => setMaterialSent(prev => prev.trim()), 0);
                  }}
                  style={{ position: 'absolute', top: '-8px', right: '-8px', background: 'white', borderRadius: '50%', color: 'var(--danger-color)', padding: '2px', border: '1px solid var(--border-color)' }}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'nowrap' }}>
            <input 
              type="file" 
              id="meeting-file-upload" 
              style={{ display: 'none' }}
              onChange={async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                if (file.size > 50 * 1024 * 1024) {
                  toast.error('파일 크기는 50MB 이하여야 합니다.');
                  return;
                }
                const btn = document.getElementById('meeting-upload-btn');
                if (btn) btn.disabled = true;
                const loadingToast = toast.loading('파일을 업로드하는 중...');
                try {
                  const url = await sheetsClient.uploadFile(file);
                  if (!window.meetingAttachments) window.meetingAttachments = [];
                  window.meetingAttachments.push(url);
                  toast.success('파일 첨부 완료!', { id: loadingToast });
                  setMaterialSent(prev => prev + ' '); setTimeout(() => setMaterialSent(prev => prev.trim()), 0); // Trigger re-render hack
                } catch (err) {
                  toast.error('파일 업로드 실패: ' + err.message, { id: loadingToast });
                } finally {
                  if (btn) btn.disabled = false;
                  e.target.value = '';
                }
              }}
            />
            <button 
              type="button" 
              id="meeting-upload-btn"
              className="btn-secondary btn-sm"
              onClick={() => document.getElementById('meeting-file-upload').click()}
              style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
            >
              파일 선택하기
            </button>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>최대 50MB</span>
          </div>
        </div>
      </div>


      {/* 7. Sticky Save Trigger */}
      <div style={{ 
        position: 'sticky', 
        bottom: 0, 
        marginTop: '2rem', 
        backgroundColor: 'var(--bg-primary)', 
        padding: '1rem 0',
        borderTop: '1px solid var(--border-color)',
        zIndex: 10
      }}>
        {contactQueue.length > 1 ? (
          <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
            <button 
              type="button"
              className="btn-secondary" 
              onClick={handlePrevContact}
              disabled={currentQueueIndex === 0}
              style={{ flex: 1, padding: '1rem' }}
            >
              이전 대상자
            </button>
            {currentQueueIndex < contactQueue.length - 1 ? (
              <button 
                type="button"
                className="btn-primary" 
                onClick={handleNextContact}
                style={{ flex: 1, padding: '1rem', backgroundColor: 'var(--accent-color)', border: 'none', color: 'white' }}
              >
                다음 대상자
              </button>
            ) : (
              <button 
                type="button"
                className="btn-primary" 
                onClick={handleBatchSave}
                style={{ flex: 1, padding: '1rem', backgroundColor: '#4caf50', border: 'none', color: 'white' }}
              >
                <Save size={18} style={{ marginRight: '0.5rem' }} /> 저장하기
              </button>
            )}
          </div>
        ) : (
          <button type="button" className="btn-primary" onClick={handleSave} style={{ width: '100%', padding: '0.85rem', fontSize: '1.05rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
            <Save size={18} /> 저장하기
          </button>
        )}
      </div>

      {/* Quick New Client Modal (상담기록 탭 전용 신규등록 모달) */}
      {isNewClientModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 1001 }}>
          <div className="modal-content" style={{ maxWidth: '450px', padding: '1.25rem 1rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '1rem' }}>신규 대상자 등록</h3>
            <form onSubmit={handleQuickClientSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              
              <div className="form-group">
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>업체명</label>
                <input 
                  type="text" 
                  placeholder="예: 색종이 재활 요양원"
                  value={newClientData.company}
                  onChange={(e) => setNewClientData(prev => ({ ...prev, company: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>성함</label>
                <input 
                  type="text" 
                  placeholder="예: 홍길동"
                  value={newClientData.name}
                  onChange={(e) => setNewClientData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>직책</label>
                <input 
                  type="text" 
                  placeholder="예: 원장, 대표"
                  value={newClientData.title}
                  onChange={(e) => setNewClientData(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>소개자</label>
                <input 
                  type="text" 
                  placeholder="예: 이영희 과장"
                  value={newClientData.recommender}
                  onChange={(e) => setNewClientData(prev => ({ ...prev, recommender: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>연락처</label>
                <input 
                  type="text" 
                  placeholder="예: 010-1234-5678"
                  value={newClientData.phone}
                  onChange={(e) => setNewClientData(prev => ({ ...prev, phone: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>주소</label>
                <input 
                  type="text" 
                  placeholder="예: 충남 천안시 서북구 직산읍 성진로 21"
                  value={newClientData.address}
                  onChange={(e) => setNewClientData(prev => ({ ...prev, address: e.target.value }))}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button 
                  type="button" 
                  className="btn-secondary" 
                  onClick={() => setIsNewClientModalOpen(false)}
                  style={{ flex: 1 }}
                >
                  취소
                </button>
                <button 
                  type="submit" 
                  className="btn-primary" 
                  style={{ flex: 1 }}
                >
                  저장 및 선택
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MeetingLog;
