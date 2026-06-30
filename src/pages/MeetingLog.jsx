import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { sheetsClient } from '../sheetsClient';
import { analyzeMeetingWithAI, analyzeAudioWithAI } from '../geminiClient';
import { 
  Mic, 
  Save, 
  Square, 
  Wand2, 
  UserCheck, 
  Calendar, 
  Phone, 
  Mail, 
  FileText,
  Upload,
  X,
  Paperclip,
  Play,
  Volume2,
  MapPin,
  Building,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useUser } from '../UserContext';
import './MeetingLog.css';
import { parseKoreanDateTime } from '../dateUtils';

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
  const [summary, setSummary] = useState('');
  const [isSummarizing, setIsSummarizing] = useState(false);
  
  // Tab & List states
  const [activeTab, setActiveTab] = useState(location.state?.activeTab || 'write'); // write, list
  const [contactQueue, setContactQueue] = useState([]);
  const [currentQueueIndex, setCurrentQueueIndex] = useState(0);
  const [multiLogs, setMultiLogs] = useState([]);
  const [interactions, setInteractions] = useState([]);
  const [loadingInteractions, setLoadingInteractions] = useState(false);
  const [expandedInteractionId, setExpandedInteractionId] = useState(null);
  
  // Contacts list
  const [contacts, setContacts] = useState([]);
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
  const [nextMeetingType, setNextMeetingType] = useState('브리핑'); // 브리핑, 인사, 소개, 직접입력
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

  // --- 오디오 관련 상태 ---
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState('');
  const [uploadedFile, setUploadedFile] = useState(null);

  // References for Recording
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerIntervalRef = useRef(null);

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
    return () => {
      clearInterval(timerIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (location.state?.selectedContactIds && location.state.selectedContactIds.length > 0) {
      sessionStorage.removeItem('meetingLogDraft');
      const ids = location.state.selectedContactIds;
      setContactQueue(ids);
      setCurrentQueueIndex(0);
      setSelectedContactId(ids[0]);
      
      const initialLogs = ids.map(id => ({
        contactId: id, content: '', summary: '', contactType: location.state?.defaultContactType || '전화', materialSent: '', hasNextMeeting: false,
        nextMeetingDateOnly: getLocalDateString(), nextMeetingTimeOnly: '10:00', nextMeetingType: '브리핑', customMeetingType: '',
        audioBlob: null, audioUrl: '', uploadedFile: null,
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
          setSummary(draft.summary);
          setContactType(draft.contactType);
          setMaterialSent(draft.materialSent);
          setHasNextMeeting(draft.hasNextMeeting);
          setNextMeetingDateOnly(draft.nextMeetingDateOnly);
          setNextMeetingTimeOnly(draft.nextMeetingTimeOnly);
          setNextMeetingType(draft.nextMeetingType);
          setCustomMeetingType(draft.customMeetingType);
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
      contactId: selectedContactId, content, summary, contactType, materialSent, hasNextMeeting,
      nextMeetingDateOnly, nextMeetingTimeOnly, nextMeetingType, customMeetingType, audioBlob, audioUrl, uploadedFile,
    };
    return newLogs;
  };

  useEffect(() => {
    if (!selectedContactId && contactQueue.length === 0) return;
    const draft = {
      selectedContactId, content, summary, contactType, materialSent, hasNextMeeting,
      nextMeetingDateOnly, nextMeetingTimeOnly, nextMeetingType, customMeetingType,
      contactQueue, currentQueueIndex, multiLogs: saveCurrentToLogs(), activeTab
    };
    sessionStorage.setItem('meetingLogDraft', JSON.stringify(draft));
  }, [
    selectedContactId, content, summary, contactType, materialSent, hasNextMeeting,
    nextMeetingDateOnly, nextMeetingTimeOnly, nextMeetingType, customMeetingType,
    contactQueue, currentQueueIndex, activeTab, multiLogs
  ]);

  const loadFormFromMultiLogs = (index, logs) => {
    const log = logs[index];
    if (!log) return;
    setSelectedContactId(log.contactId);
    setContent(log.content);
    setSummary(log.summary);
    setContactType(log.contactType);
    setMaterialSent(log.materialSent);
    setHasNextMeeting(log.hasNextMeeting);
    setNextMeetingDateOnly(log.nextMeetingDateOnly);
    setNextMeetingTimeOnly(log.nextMeetingTimeOnly);
    setNextMeetingType(log.nextMeetingType);
    setCustomMeetingType(log.customMeetingType);
    setAudioBlob(log.audioBlob);
    setAudioUrl(log.audioUrl);
    setUploadedFile(log.uploadedFile);
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
    if (!user) return toast.error('사용자를 먼저 선택해 주세요.');
    
    const finalLogs = [...multiLogs];
    finalLogs[currentQueueIndex] = {
      contactId: selectedContactId, content, summary, contactType, materialSent, hasNextMeeting,
      nextMeetingDateOnly, nextMeetingTimeOnly, nextMeetingType, customMeetingType, audioBlob, audioUrl, uploadedFile,
    };
    setMultiLogs(finalLogs);

    toast.loading('다중 기록을 순차적으로 저장하는 중...', { id: 'batch-save' });

    for (let i = 0; i < finalLogs.length; i++) {
      const log = finalLogs[i];
      if (!log.contactId) continue;

      const hasInteractionContent = log.content.trim() || log.summary.trim() || log.materialSent || log.uploadedFile || log.audioBlob;
      if (!hasInteractionContent && !log.hasNextMeeting) continue;

      const client = contacts.find(c => c.id === log.contactId);
      const clientName = client ? `${client.company} - ${client.name}` : '알 수 없음';
      
      const parsedMeetingDate = log.hasNextMeeting && log.nextMeetingDateOnly ? parseKoreanDateTime(`${log.nextMeetingDateOnly} ${log.nextMeetingTimeOnly}`) : '';
      
      try {
        if (hasInteractionContent) {
          const tempId = 'temp_' + Date.now() + '_' + i;
          const interactionData = {
            id: tempId, client_id: log.contactId, client_name: clientName, date: new Date().toISOString().substring(0, 16).replace('T', ' '),
            type: log.contactType, summary: log.summary || log.content, content: log.content, attachments: '', next_meeting_date: parsedMeetingDate, creator: user
          };
          await sheetsClient.insert('interactions', interactionData);
        }
        
        if (log.hasNextMeeting) {
          const finalMeetingType = log.nextMeetingType === '직접입력' ? log.customMeetingType : log.nextMeetingType;
          const meetingData = {
            id: 'temp_meet_' + Date.now() + '_' + i, client_id: log.contactId, client_name: clientName, date: parsedMeetingDate,
            type: finalMeetingType || '미팅', result: '진행 예정 (준비 단계)', creator: user
          };
          await sheetsClient.insert('schedules', meetingData);
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
    setSummary('');
    setActiveTab('list');
    fetchInteractions();
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

  // --- 1. 앱 내 직접 음성 녹음 제어 ---
  const startRecording = async () => {
    audioChunksRef.current = [];
    setAudioBlob(null);
    setAudioUrl('');
    setUploadedFile(null); // 녹음 시 업로드 파일은 해제

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast.error('이 브라우저 혹은 기기는 마이크 녹음 기능을 지원하지 않습니다.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Determine supported mime types for recording
      let options = { mimeType: 'audio/webm' };
      if (!MediaRecorder.isTypeSupported('audio/webm')) {
        options = { mimeType: 'audio/mp4' }; // Fallback for Safari/iOS
        if (!MediaRecorder.isTypeSupported('audio/mp4')) {
          options = {}; // Browser default
        }
      }

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const mimeType = mediaRecorder.mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        
        // Stop all mic tracks to release hardware
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(250); // Get chunks every 250ms
      setIsRecording(true);
      setRecordingSeconds(0);
      
      // Timer setup
      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);

      toast.success('통화 녹음/메모를 기록하기 위해 마이크가 켜졌습니다.');
    } catch (err) {
      console.error('마이크 권한 획득 실패:', err);
      toast.error('마이크 권한이 거부되었거나 마이크 기기를 사용할 수 없습니다.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerIntervalRef.current);
      toast.success('녹음이 중지되었습니다. 파일이 준비되었습니다.');
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
    clearInterval(timerIntervalRef.current);
    setAudioBlob(null);
    setAudioUrl('');
    audioChunksRef.current = [];
    toast('녹음이 취소되었습니다.');
  };

  // --- 2. 파일 업로드 핸들링 ---
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('audio/')) {
      toast.error('오디오 파일(*.mp3, *.wav, *.m4a 등)만 업로드할 수 있습니다.');
      return;
    }

    if (file.size > 20 * 1024 * 1024) { // 20MB 제한
      toast.error('20MB 이하의 녹음 파일만 지원합니다.');
      return;
    }

    setUploadedFile(file);
    setAudioBlob(null); // 업로드 시 녹음 데이터는 해제
    setAudioUrl(URL.createObjectURL(file));
    toast.success(`'${file.name}' 녹음 파일이 로드되었습니다.`);
  };

  const removeAudioSource = () => {
    setAudioBlob(null);
    setUploadedFile(null);
    setAudioUrl('');
    toast('로딩된 음성 리소스가 지워졌습니다.');
  };

  const formatTime = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // --- 3. Gemini AI 스마트 분석 실행 ---
  const handleAISummarize = async () => {
    const hasAudio = audioBlob || uploadedFile;

    try {
      setIsSummarizing(true);
      
      if (hasAudio) {
        toast.loading('Gemini AI가 녹음본 전체를 받아쓰기(STT)하고 요약을 만들고 있습니다...', { id: 'ai-analyze' });
        
        const audioSource = audioBlob || uploadedFile;
        const base64Data = await fileToBase64(audioSource);
        const mimeType = audioSource.type || 'audio/webm';
        
        // Call Multimodal Gemini audio analysis
        const analysis = await analyzeAudioWithAI(base64Data, mimeType);
        
        // Auto fill form fields
        if (analysis.transcription) {
          setContent(analysis.transcription);
        }
        setSummary(analysis.summary);
        
        if (analysis.recommended_channel) {
          setContactType(analysis.recommended_channel);
        }
        
        if (analysis.material_sent) {
          setMaterialSent(analysis.material_sent);
        }

        if (analysis.has_next_meeting) {
          setHasNextMeeting(true);
          if (analysis.next_meeting_date) {
            setNextMeetingDate(analysis.next_meeting_date.replace(' ', 'T'));
          }
          if (analysis.meeting_type) {
            if (['브리핑', '인사', '소개'].includes(analysis.meeting_type)) {
              setNextMeetingType(analysis.meeting_type);
            } else {
              setNextMeetingType('직접입력');
              setCustomMeetingType(analysis.meeting_type);
            }
          }
        } else {
          setHasNextMeeting(false);
        }
        
        toast.success('녹음 음성 분석 완료! 입력 폼을 검토 후 저장해주세요.', { id: 'ai-analyze', duration: 4000 });
      } else {
        // Fallback: Text only analysis
        if (!content.trim()) {
          toast.error('녹음 파일이 없거나 텍스트 내용이 비어있습니다.');
          setIsSummarizing(false);
          return;
        }

        toast.loading('대화 내용 텍스트를 AI로 요약하는 중...', { id: 'ai-analyze' });
        const analysis = await analyzeMeetingWithAI(content);
        
        setSummary(analysis.summary);
        if (analysis.recommended_channel) setContactType(analysis.recommended_channel);
        if (analysis.material_sent) setMaterialSent(analysis.material_sent);

        if (analysis.has_next_meeting) {
          setHasNextMeeting(true);
          if (analysis.next_meeting_date) {
            setNextMeetingDate(analysis.next_meeting_date.replace(' ', 'T'));
          }
          if (analysis.meeting_type) {
            if (['브리핑', '인사', '소개'].includes(analysis.meeting_type)) {
              setNextMeetingType(analysis.meeting_type);
            } else {
              setNextMeetingType('직접입력');
              setCustomMeetingType(analysis.meeting_type);
            }
          }
        } else {
          setHasNextMeeting(false);
        }
        
        toast.success('텍스트 분석 요약이 완료되었습니다.', { id: 'ai-analyze' });
      }

    } catch (error) {
      console.error(error);
      toast.error(error.message || 'AI 요약에 실패했습니다. API 키 및 파일 형식을 확인해주세요.', { id: 'ai-analyze' });
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleSave = async () => {
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

    const hasInteractionContent = content.trim() || summary.trim() || materialSent || (window.meetingAttachments && window.meetingAttachments.length > 0);

    if (!hasInteractionContent && !hasNextMeeting) {
      toast.error('저장할 내용이나 일정이 없습니다.');
      return;
    }

    const client = contacts.find(c => c.id === selectedContactId);
    const clientName = client ? `${client.company} - ${client.name}` : '알 수 없음';

    // 1) Prepare data
    const tempId = 'temp_' + Date.now();
    let interactionData = null;
    
    if (hasInteractionContent) {
      interactionData = {
        id: tempId,
        client_id: selectedContactId,
        client_name: clientName,
        date: new Date().toISOString().substring(0, 16).replace('T', ' '),
        type: contactType,
        summary: summary || content,
        content: content,
        attachments: (window.meetingAttachments || []).join(','),
        next_meeting_date: parsedMeetingDate,
        creator: user
      };
    }

    let meetingData = null;
    if (hasNextMeeting) {
      const finalMeetingType = nextMeetingType === '직접입력' ? customMeetingType : nextMeetingType;
      meetingData = {
        id: 'temp_meet_' + Date.now(),
        client_id: selectedContactId,
        client_name: clientName,
        date: parsedMeetingDate,
        type: finalMeetingType || '미팅',
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
    setSummary('');
    setMaterialSent('');
    setHasNextMeeting(false);
    setNextMeetingDate('');
    setSelectedContactId('');
    window.meetingAttachments = [];
    removeAudioSource();

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
                <div className="meeting-option-grid">
                  {['브리핑', '인사', '소개', '직접입력'].map(opt => (
                    <button
                      key={opt}
                      type="button"
                      className={`meeting-option-btn ${nextMeetingType === opt ? 'active' : ''}`}
                      onClick={() => setNextMeetingType(opt)}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
                {nextMeetingType === '직접입력' && (
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
        <label>미팅 내용</label>
        <textarea 
          rows="10" 
          placeholder=""
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
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

      {/* 5. 통화 녹음 파일 및 음성 메모 (그 아래에 위치!) */}
      <div style={{ marginBottom: '1.5rem', border: '1px solid var(--border-color)', padding: '1rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-secondary)' }}>
        <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: '0.5rem' }}>
          통화 녹음 파일 및 음성 메모
        </label>
        
        <div className="audio-action-row">
          {/* A. In-App Direct Recorder */}
          {!isRecording ? (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button 
                type="button" 
                className="btn-secondary" 
                onClick={startRecording}
                disabled={isSummarizing}
                style={{ flex: 1 }}
              >
                <Mic size={16} style={{ color: 'var(--danger-color)' }} /> 즉시 음성 녹음 시작
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', width: '100%' }}>
              <div className="recording-status-box" style={{ flex: 1 }}>
                <div className="recording-pulse-dot" />
                <span>녹음 중... ({formatTime(recordingSeconds)})</span>
              </div>
              <button type="button" className="btn-primary" style={{ backgroundColor: 'var(--danger-color)' }} onClick={stopRecording}>
                녹음 완료
              </button>
              <button type="button" className="btn-secondary" onClick={cancelRecording}>
                취소
              </button>
            </div>
          )}

          {/* B. File Uploader */}
          {!isRecording && !audioUrl && (
            <div className="upload-box" style={{ marginTop: '0.5rem' }}>
              <Upload size={20} style={{ display: 'block', margin: '0 auto 0.25rem', color: 'var(--text-secondary)' }} />
              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>영업/통화 녹음 파일 업로드</span>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>mp3, wav, webm, m4a 등 (20MB 이하)</p>
              <input type="file" accept="audio/*" onChange={handleFileChange} />
            </div>
          )}
          
          {/* C. Audio Player Preview */}
          {audioUrl && (
            <div className="audio-preview-container" style={{ marginTop: '0.5rem' }}>
              <div className="audio-preview-header">
                <span>
                  {uploadedFile ? `📁 업로드: ${uploadedFile.name}` : '🎙️ 직접 녹음된 오디오'}
                </span>
                <button type="button" style={{ color: 'var(--danger-color)', background: 'none', border: 'none', cursor: 'pointer' }} onClick={removeAudioSource}>
                  <X size={16} />
                </button>
              </div>
              <audio src={audioUrl} controls className="audio-preview-player" style={{ width: '100%', marginTop: '0.3rem' }} />
            </div>
          )}
        </div>

        {/* Smart AI completion trigger */}
        <div style={{ marginTop: '1rem' }}>
          <button 
            type="button" 
            className="btn-primary ai-btn" 
            onClick={handleAISummarize} 
            disabled={isSummarizing || (!content.trim() && !audioBlob && !uploadedFile)}
            style={{ padding: '0.75rem', width: '100%' }}
          >
            <Wand2 size={18} /> {isSummarizing ? 'AI 분석 중...' : '음성 텍스트 변환 및 AI요약'}
          </button>
        </div>
      </div>

      {/* 6. Summary Block */}
      <div className="form-group" style={{ marginTop: '1rem' }}>
        <label>활동 결과 요약 (AI 자동 요약 내용)</label>
        <textarea 
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="활동 결과 한줄 요약..."
          style={{ width: '100%', minHeight: '60px', padding: '0.6rem 0.75rem', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '0.85rem', boxSizing: 'border-box', resize: 'vertical' }}
        />
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
