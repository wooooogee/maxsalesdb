import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { sheetsClient } from '../sheetsClient';
import { ChevronRight, Phone, MapPin, Mail, FileText, Save, Trash2, X, Star } from 'lucide-react';
import toast from 'react-hot-toast';
import './MapRoute.css';
import './MeetingLog.css'; // For shared .type-tabs styling

const MapRoute = () => {
  const [interactions, setInteractions] = useState(() => {
    try { const cached = localStorage.getItem('sheet_v3_interactions'); return cached ? JSON.parse(cached) : []; } catch(e){ return []; }
  });
  const [loading, setLoading] = useState(() => !localStorage.getItem('sheet_v3_interactions'));
  const [expandedId, setExpandedId] = useState(null);
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState(location.state?.searchTerm || '');
  const [filterRecheck, setFilterRecheck] = useState(false);
  
  // Edit states
  const [editData, setEditData] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const formatLocalDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleString('ko-KR', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
      });
    } catch (e) {
      return dateStr;
    }
  };

  const fetchInteractions = async () => {
    try {
      const cached = localStorage.getItem('sheet_v3_interactions');
      if (cached) {
        setInteractions(JSON.parse(cached));
        setLoading(false);
      } else {
        setLoading(true);
      }
      
      const data = await sheetsClient.read('interactions');
      if (data && data.length > 0) {
        const sorted = data.sort((a, b) => {
          const timeA = a.date ? new Date(a.date.replace(' ', 'T')).getTime() : 0;
          const timeB = b.date ? new Date(b.date.replace(' ', 'T')).getTime() : 0;
          const validA = isNaN(timeA) ? 0 : timeA;
          const validB = isNaN(timeB) ? 0 : timeB;
          return validB - validA;
        });
        setInteractions(sorted);
        localStorage.setItem('sheet_v3_interactions', JSON.stringify(sorted));
      }
    } catch (error) {
      console.error('Failed to fetch interactions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInteractions();
  }, []);

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

  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [deletePassword, setDeletePassword] = useState('');
  
  // Recheck modal states
  const [recheckTargetItem, setRecheckTargetItem] = useState(null);

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

    try {
      const toastId = toast.loading('기록을 삭제하는 중...');
      await sheetsClient.delete('interactions', id);
      
      const updatedList = interactions.filter(item => item.id !== id);
      setInteractions(updatedList);
      localStorage.setItem('sheet_v3_interactions', JSON.stringify(updatedList));
      
      toast.success('기록이 삭제되었습니다.', { id: toastId });
      setExpandedId(null);
    } catch (err) {
      console.error(err);
      toast.error('삭제 실패: ' + err.message);
    }
  };

  const filteredInteractions = interactions.filter(item => {
    if (filterRecheck && !item.needs_recheck) return false;
    const query = searchTerm.toLowerCase().trim();
    if (!query) return true;
    const clientNameMatch = item.client_name?.toLowerCase().includes(query);
    const summaryMatch = item.summary?.toLowerCase().includes(query);
    const contentMatch = item.content?.toLowerCase().includes(query);
    const transcriptionMatch = item.transcription?.toLowerCase().includes(query);
    
    return clientNameMatch || summaryMatch || contentMatch || transcriptionMatch;
  });

  const extractDateOnly = (dateStr) => {
    if (!dateStr) return '날짜 없음';
    try {
      const d = new Date(dateStr.replace(' ', 'T'));
      if (isNaN(d.getTime())) return '날짜 없음';
      return d.toLocaleDateString('ko-KR', {
        year: 'numeric', month: 'long', day: 'numeric', weekday: 'short'
      });
    } catch (e) {
      return '날짜 없음';
    }
  };

  const sortedFilteredInteractions = [...filteredInteractions].sort((a, b) => {
    const timeA = a.date ? new Date(a.date.replace(' ', 'T')).getTime() : 0;
    const timeB = b.date ? new Date(b.date.replace(' ', 'T')).getTime() : 0;
    const validA = isNaN(timeA) ? 0 : timeA;
    const validB = isNaN(timeB) ? 0 : timeB;
    return validB - validA;
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

  return (
    <div className="card" style={{ paddingBottom: '3rem' }}>
      <div style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>기록 내용</h2>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button 
            onClick={() => setFilterRecheck(!filterRecheck)}
            className={filterRecheck ? 'btn-primary' : 'btn-secondary'}
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
          >
            <Star size={13} fill={filterRecheck ? '#ffb300' : 'none'} color={filterRecheck ? '#ffb300' : 'currentColor'} /> 
            <span>별표시</span>
          </button>
          <button 
            onClick={fetchInteractions} 
            className="btn-secondary" 
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
            disabled={loading}
          >
            새로고침
          </button>
        </div>
      </div>

      {/* 검색 바 */}
      <div style={{ marginBottom: '1.25rem' }}>
        <input 
          type="text" 
          placeholder="검색" 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ width: '100%', padding: '0.6rem 0.85rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', boxSizing: 'border-box' }}
        />
      </div>

      <div className="interactions-list" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {loading && interactions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>기록을 로딩하는 중...</div>
        ) : sortedFilteredInteractions.length > 0 ? (
          groupedInteractions.keys.map(dateGroup => (
            <div key={dateGroup} style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <div style={{ display: 'inline-block', alignSelf: 'flex-start', padding: '0.3rem 0.8rem', backgroundColor: 'var(--bg-primary)', borderRadius: '20px', border: '1px solid var(--border-color)', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                {dateGroup}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {groupedInteractions.map[dateGroup].map(item => {
                  const isExpanded = expandedId === item.id;
                  return (
                    <div 
                      key={item.id} 
                      className={`contact-card ${isExpanded ? 'expanded' : 'collapsed'}`}
                      style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--bg-secondary)', overflow: 'hidden' }}
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
                    >
                      <div className="contact-card-header" style={{ padding: '0.85rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: isExpanded ? '1px solid var(--border-color)' : 'none', backgroundColor: 'var(--bg-primary)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', textAlign: 'left' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>{item.client_name}</span>
                            {item.needs_recheck && <Star size={16} fill="#ffb300" color="#ffb300" className="blink-star" />}
                          </div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                            {item.type === '전화' && <Phone size={11} />}
                            {item.type === '방문' && <MapPin size={11} />}
                            {item.type === '이메일' && <Mail size={11} />}
                            {item.type === '팩스' && <FileText size={11} />}
                            {formatLocalDate(item.date)} • {item.type}
                          </span>
                        </div>
                        <ChevronRight 
                          size={16} 
                          style={{ 
                            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', 
                            transition: 'transform 0.2s',
                            color: 'var(--text-secondary)'
                          }} 
                        />
                      </div>
                      
                      {isExpanded && editData && (
                        <div className="contact-body" onClick={(e) => e.stopPropagation()} style={{ padding: '1rem', backgroundColor: 'var(--bg-secondary)', textAlign: 'left' }}>
                          
                          <div className="form-group" style={{ marginBottom: '1rem' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-color)', display: 'block', marginBottom: '0.4rem' }}>미팅 내용</label>
                            <textarea
                              value={editData.content || editData.transcription || ''}
                              onChange={(e) => setEditData({ ...editData, content: e.target.value })}
                              style={{ width: '100%', minHeight: '180px', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '0.85rem', boxSizing: 'border-box', resize: 'vertical' }}
                              placeholder="상담/미팅 내용을 입력하세요..."
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
                            <div style={{ marginBottom: '1rem', padding: '0.5rem', backgroundColor: 'var(--bg-primary)', borderRadius: '4px', borderLeft: '3px solid var(--success-color)' }}>
                              <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--success-color)', display: 'block' }}>📅 예정된 후속 미팅 일정</span>
                              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{editData.next_meeting_date}</span>
                            </div>
                          )}

                          <div className="form-group" style={{ marginBottom: '1rem' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-color)', display: 'block', marginBottom: '0.4rem' }}>첨부파일</label>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                              {editData.attachments && editData.attachments.split(',').filter(Boolean).length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                  {editData.attachments.split(',').filter(Boolean).map((url, idx) => (
                                    <div key={idx} style={{ position: 'relative', display: 'inline-block', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '0.2rem', backgroundColor: 'var(--bg-primary)' }}>
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
            </div>
          ))
        ) : (
          <div style={{ textAlign: 'center', padding: '1rem 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            {searchTerm.trim() ? '검색 결과와 일치하는 상담 기록이 없습니다.' : '저장된 상담 기록이 없습니다.'}
          </div>
        )}
      </div>
      
      {/* 화면 하단 고정 저장 버튼 (글로벌) */}
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
