import React, { useState, useEffect } from 'react';
import { sheetsClient } from '../sheetsClient';
import { ChevronRight, Phone, MapPin, Mail, FileText } from 'lucide-react';
import toast from 'react-hot-toast';

const MapRoute = () => {
  const [interactions, setInteractions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchInteractions();
  }, []);

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
      setLoading(false);
    }
  };

  const filteredInteractions = interactions.filter(item => {
    const query = searchTerm.toLowerCase().trim();
    if (!query) return true;
    const clientNameMatch = item.client_name?.toLowerCase().includes(query);
    const summaryMatch = item.summary?.toLowerCase().includes(query);
    const contentMatch = item.content?.toLowerCase().includes(query);
    const transcriptionMatch = item.transcription?.toLowerCase().includes(query);
    
    return clientNameMatch || summaryMatch || contentMatch || transcriptionMatch;
  });

  return (
    <div className="card map-route-page" style={{ paddingBottom: '3rem' }}>
      <div style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>기록 내용</h2>
        <button 
          onClick={fetchInteractions} 
          className="btn-secondary" 
          style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
          disabled={loading}
        >
          새로고침
        </button>
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
        ) : filteredInteractions.length > 0 ? (
          filteredInteractions.map(item => {
            const isExpanded = expandedId === item.id;
            return (
              <div 
                key={item.id} 
                className={`contact-card ${isExpanded ? 'expanded' : 'collapsed'}`}
                style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--bg-secondary)', overflow: 'hidden' }}
                onClick={() => setExpandedId(isExpanded ? null : item.id)}
              >
                <div className="contact-card-header" style={{ padding: '0.85rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: isExpanded ? '1px solid var(--border-color)' : 'none', backgroundColor: 'var(--bg-primary)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', textAlign: 'left' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>{item.client_name}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                      {item.type === '전화' && <Phone size={11} />}
                      {item.type === '방문' && <MapPin size={11} />}
                      {item.type === '이메일' && <Mail size={11} />}
                      {item.type === '팩스' && <FileText size={11} />}
                      {item.date} • {item.type}
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
                
                {isExpanded && (
                  <div className="contact-body" onClick={(e) => e.stopPropagation()} style={{ padding: '1rem', backgroundColor: 'var(--bg-secondary)', textAlign: 'left' }}>
                    <div style={{ marginBottom: '0.75rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-color)', display: 'block', marginBottom: '0.2rem' }}>활동 결과 요약</span>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', margin: 0, fontWeight: 500, lineHeight: 1.4 }}>{item.summary}</p>
                    </div>
                    
                    {item.next_meeting_date && (
                      <div style={{ marginBottom: '0.75rem', padding: '0.5rem', backgroundColor: 'var(--bg-primary)', borderRadius: '4px', borderLeft: '3px solid var(--success-color)' }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--success-color)', display: 'block' }}>📅 예정된 후속 미팅 일정</span>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{item.next_meeting_date}</span>
                      </div>
                    )}

                    {/* 소통 내용 전문 */}
                    <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '0.75rem', marginTop: '0.5rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.2rem' }}>소통 내용 전문</span>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>
                        {item.content || item.transcription || item.summary}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div style={{ textAlign: 'center', padding: '1rem 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            {searchTerm.trim() ? '검색 결과와 일치하는 상담 기록이 없습니다.' : '저장된 상담 기록이 없습니다.'}
          </div>
        )}
      </div>
    </div>
  );
};

export default MapRoute;
