import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { sheetsClient } from '../sheetsClient';
import { loadNaverMapScript, geocodeAddress } from '../mapUtils';
import { 
  Search, 
  Plus, 
  User, 
  Phone, 
  Mail, 
  Building, 
  FileText, 
  ChevronRight, 
  MapPin, 
  MessageSquare,
  Calendar,
  CheckSquare,
  Square,
  Edit2,
  Trash2,
  Copy
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useUser } from '../UserContext';
import './Contacts.css';

async function fetchContacts(setContacts, setLoading) {
  try {
    setLoading(true);
    const cached = localStorage.getItem('sheet_v3_clients');
    if (cached) {
      setContacts(JSON.parse(cached));
      setLoading(false); // 로컬 캐시 렌더링 즉시 로딩 해제 (속도 개선)
    }
    
    const data = await sheetsClient.read('clients');
    if (data && data.length > 0) {
      const sorted = data.sort((a,b) => {
        const idA = a.id ? parseInt(a.id.replace('c_', '')) : 0;
        const idB = b.id ? parseInt(b.id.replace('c_', '')) : 0;
        return idB - idA;
      });
      setContacts(sorted);
      localStorage.setItem('sheet_v3_clients', JSON.stringify(sorted));
    }
  } catch (error) {
    console.log('Failed to load contacts.', error.message);
  } finally {
    setLoading(false);
  }
}

const Contacts = () => {
  const { user } = useUser();
  const navigate = useNavigate();
  const [contacts, setContacts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expandedContactId, setExpandedContactId] = useState(null);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(() => {
    return sessionStorage.getItem('contacts_multi_select') === 'true';
  });
  const [selectedContactIds, setSelectedContactIds] = useState(() => {
    const saved = sessionStorage.getItem('contacts_selected_ids');
    return saved ? JSON.parse(saved) : [];
  });
  
  useEffect(() => {
    sessionStorage.setItem('contacts_multi_select', isMultiSelectMode);
    sessionStorage.setItem('contacts_selected_ids', JSON.stringify(selectedContactIds));
  }, [isMultiSelectMode, selectedContactIds]);
  
  // Custom delete modal states
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [deletePassword, setDeletePassword] = useState('');

  // Filters State
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [cities, setCities] = useState([]);
  const [districts, setDistricts] = useState([]);

  // Form State
  const [formData, setFormData] = useState({
    company: '', title: '', name: '', recommender: '', phone: '', email: '', fax: '',
    address: '', city: '', district: '', latitude: '', longitude: ''
  });



  useEffect(() => {
    fetchContacts(setContacts, setLoading);
  }, []);

  useEffect(() => {
    // Extract unique cities & districts for filtering
    const uniqueCities = [...new Set(contacts.map(c => c.city).filter(Boolean))].sort();
    setCities(uniqueCities);
    
    if (selectedCity) {
      const filteredDistricts = [...new Set(
        contacts
          .filter(c => c.city === selectedCity)
          .map(c => c.district)
          .filter(Boolean)
      )].sort();
      setDistricts(filteredDistricts);
    } else {
      setDistricts([]);
    }
  }, [contacts, selectedCity]);





  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const next = { ...prev, [name]: value };
      if (name === 'address') {
        next.latitude = '';
        next.longitude = '';
      }
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      toast.error('사용자를 먼저 선택해 주세요.');
      return;
    }

    const isEdit = !!formData.id;
    let finalFormData = {
      ...formData,
      company: formData.company || '미지정 업체',
      name: formData.name || '미지정 담당자',
      address: formData.address || '',
      creator: user,
    };

    if (finalFormData.address && (!finalFormData.latitude || !finalFormData.longitude)) {
      try {
        const geoResult = await geocodeAddress(finalFormData.address);
        finalFormData.city = geoResult.city;
        finalFormData.district = geoResult.district;
        finalFormData.latitude = geoResult.latitude.toString();
        finalFormData.longitude = geoResult.longitude.toString();
      } catch (err) {
        finalFormData.city = finalFormData.city || '서울특별시';
        finalFormData.district = finalFormData.district || '서초구';
        finalFormData.latitude = finalFormData.latitude || '37.4979';
        finalFormData.longitude = finalFormData.longitude || '127.0276';
      }
    }

    try {
      toast.loading(isEdit ? '고객 정보를 수정하는 중...' : '고객을 등록하는 중...', { id: 'client-save' });
      
      if (isEdit) {
        await sheetsClient.update('clients', finalFormData);
        setContacts(prev => {
          const next = prev.map(c => c.id === formData.id ? finalFormData : c);
          localStorage.setItem('sheet_v3_clients', JSON.stringify(next));
          return next;
        });
        toast.success('대상자 정보가 성공적으로 수정되었습니다.', { id: 'client-save' });
      } else {
        const saved = await sheetsClient.insert('clients', finalFormData);
        setContacts(prev => {
          const next = [saved, ...prev];
          localStorage.setItem('sheet_v3_clients', JSON.stringify(next));
          return next;
        });
        toast.success('대상자가 성공적으로 등록되었습니다.', { id: 'client-save' });
      }
      
      setIsModalOpen(false);
      // Reset form
      setFormData({
        company: '', title: '', name: '', recommender: '', phone: '', email: '', fax: '',
        address: '', city: '', district: '', latitude: '', longitude: ''
      });
    } catch (error) {
      toast.error('저장 실패: ' + error.message, { id: 'client-save' });
    }
  };

  const handleStartEdit = React.useCallback((contact) => {
    setFormData(contact);
    setIsModalOpen(true);
  }, []);

  const requestDeleteContact = (id) => {
    setDeleteTargetId(id);
    setDeletePassword('');
  };

  const confirmDeleteContact = async () => {
    if (deletePassword !== '0805') {
      toast.error('비밀번호가 일치하지 않습니다.');
      return;
    }
    
    const id = deleteTargetId;
    setDeleteTargetId(null);
    setDeletePassword('');

    try {
      toast.loading('대상자를 삭제하는 중...', { id: 'client-delete' });
      await sheetsClient.delete('clients', id);
      setContacts(prev => {
        const next = prev.filter(c => c.id !== id);
        localStorage.setItem('sheet_v3_clients', JSON.stringify(next));
        return next;
      });
      toast.success('대상자가 삭제되었습니다.', { id: 'client-delete' });
      setIsModalOpen(false);
      setExpandedContactId(null);
    } catch (err) {
      toast.error('삭제 실패: ' + err.message, { id: 'client-delete' });
    }
  };

  const handleToggleSelect = React.useCallback((id) => {
    setSelectedContactIds(prev => 
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  }, []);

  // Filter & Search Logic
  const filteredContacts = React.useMemo(() => {
    return contacts.filter(contact => {
      const matchesSearch = 
        contact.name?.includes(searchQuery) || 
        contact.company?.includes(searchQuery) || 
        contact.address?.includes(searchQuery);
      
      const matchesCity = selectedCity ? contact.city === selectedCity : true;
      const matchesDistrict = selectedDistrict ? contact.district === selectedDistrict : true;
      
      return matchesSearch && matchesCity && matchesDistrict;
    });
  }, [contacts, searchQuery, selectedCity, selectedDistrict]);

  const renderedContacts = React.useMemo(() => {
    return filteredContacts.map(contact => {
      const isExpanded = expandedContactId === contact.id;
      const isSelected = selectedContactIds.includes(contact.id);
      return (
        <div 
          key={contact.id} 
          className={`contact-card ${isExpanded ? 'expanded' : 'collapsed'}`}
          style={{ 
            cursor: 'pointer', 
            display: 'flex', 
            flexDirection: 'column', 
            border: isSelected ? '2px solid #4caf50' : '',
            backgroundColor: isSelected ? '#e8f5e9' : 'var(--bg-secondary)',
            transition: 'background-color 0.2s, border 0.2s'
          }}
          onClick={() => {
            if (isMultiSelectMode) {
              handleToggleSelect(contact.id);
            } else {
              setExpandedContactId(isExpanded ? null : contact.id);
            }
          }}
        >
          {/* 카드 헤더 (항상 노출) */}
          <div 
            className="contact-card-header" 
            style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              borderBottom: isExpanded ? '1px solid var(--border-color)' : 'none',
              padding: '0.85rem 1rem'
            }}
          >
            <div className="contact-company" style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'flex-start', gap: '0.4rem', fontWeight: 600, color: 'var(--text-primary)', minWidth: 0, flex: 1 }}>
              <Building size={16} style={{ color: isSelected ? 'var(--accent-color)' : 'var(--text-secondary)', flexShrink: 0, marginTop: '0.1rem' }} />
              <span style={{ display: 'inline-block', wordBreak: 'keep-all' }}>
                {contact.company}
                {contact.name && (
                  <span style={{ marginLeft: '0.3rem', fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-secondary)' }}>
                    ({contact.name})
                  </span>
                )}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0, marginLeft: '0.5rem' }}>
              <button
                type="button"
                className="btn-secondary"
                style={{ 
                  padding: '0.15rem 0.45rem', 
                  fontSize: '0.7rem', 
                  borderRadius: '4px', 
                  border: '1px solid var(--border-color)', 
                  marginRight: '0.2rem',
                  cursor: 'pointer',
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  flexShrink: 0
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleStartEdit(contact);
                }}
              >
                수정
              </button>
              <button 
                type="button"
                style={{ 
                  padding: '0.2rem 0.5rem', 
                  fontSize: '0.75rem', 
                  borderRadius: '4px', 
                  border: '1px solid var(--border-color)', 
                  cursor: 'pointer',
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  flexShrink: 0
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  navigate('/route', { state: { searchTerm: contact.company || contact.name } });
                }}
              >
                기록
              </button>
            </div>
          </div>
          
          {/* 확장 상세 구역 */}
          {isExpanded && (
            <>
              {/* 카드 본문 */}
              <div className="contact-body" onClick={(e) => e.stopPropagation()} style={{ padding: '1rem', backgroundColor: 'var(--bg-secondary)' }}>
                <div className="contact-name" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <User size={22} className="contact-avatar"/>
                  <div>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>
                      {contact.name} <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-secondary)', marginLeft: '0.3rem' }}>{contact.title || '담당자'}</span>
                    </h3>
                  </div>
                </div>
                <div className="contact-details" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.85rem' }}>
                  {contact.phone && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Phone size={13} style={{ color: 'var(--text-secondary)' }}/> {contact.phone}
                    </div>
                  )}
                  {contact.email && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Mail size={13} style={{ color: 'var(--text-secondary)' }}/> {contact.email}
                    </div>
                  )}
                  {contact.fax && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <FileText size={13} style={{ color: 'var(--text-secondary)' }}/> 팩스: {contact.fax}
                    </div>
                  )}
                </div>
              </div>
              
              {/* 카드 푸터 (행동 버튼 및 주소지 한 줄 출력) */}
              <div className="contact-footer" onClick={(e) => e.stopPropagation()} style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', borderBottomLeftRadius: 'var(--radius-lg)', borderBottomRightRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  {contact.phone && (
                    <a href={`tel:${contact.phone}`} className="btn-secondary btn-sm" title="전화걸기" style={{ padding: '0.35rem 0.5rem', display: 'flex', alignItems: 'center', borderRadius: '4px' }}>
                      <Phone size={13} />
                    </a>
                  )}
                  {contact.phone && (
                    <a href={`sms:${contact.phone}`} className="btn-secondary btn-sm" title="문자보내기" style={{ padding: '0.35rem 0.5rem', display: 'flex', alignItems: 'center', borderRadius: '4px' }}>
                      <MessageSquare size={13} />
                    </a>
                  )}
                  {contact.address && (
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(contact.address).then(() => toast.success('주소가 복사되었습니다.'));
                      }}
                      className="btn-secondary btn-sm" 
                      title="주소 텍스트 복사"
                      style={{ padding: '0.35rem 0.5rem', display: 'flex', alignItems: 'center', backgroundColor: '#03C75A', color: 'white', border: 'none', borderRadius: '4px' }}
                    >
                      <Copy size={13} /> <span style={{ fontSize: '0.7rem', fontWeight: 600, marginLeft: '0.2rem' }}>주소복사</span>
                    </button>
                  )}
                  {contact.company && (
                    <a 
                      href={`https://map.naver.com/v5/search/${encodeURIComponent(contact.company)}`} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="btn-secondary btn-sm" 
                      title="네이버지도 상호명으로 검색"
                      style={{ padding: '0.35rem 0.5rem', display: 'flex', alignItems: 'center', backgroundColor: '#2d60ff', color: 'white', border: 'none', borderRadius: '4px' }}
                    >
                      <Building size={13} /> <span style={{ fontSize: '0.7rem', fontWeight: 600, marginLeft: '0.2rem' }}>상호지도</span>
                    </a>
                  )}
                  <button 
                    type="button"
                    className="btn-secondary btn-sm" 
                    title="이 대상자에게 바로 미팅 기록하기"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate('/meetings', { state: { selectedContactId: contact.id, defaultContactType: '방문' } });
                    }}
                    style={{ padding: '0.35rem 0.5rem', display: 'flex', alignItems: 'center', backgroundColor: 'var(--accent-color)', color: 'white', border: 'none', borderRadius: '4px' }}
                  >
                    <Calendar size={13} /> <span style={{ fontSize: '0.7rem', fontWeight: 600, marginLeft: '0.2rem' }}>미팅</span>
                  </button>
                </div>

                {/* 실제 주소값 아래에 한줄로 출력 */}
                {contact.address && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', color: 'var(--text-secondary)', borderTop: '1px dashed var(--border-color)', paddingTop: '0.4rem', width: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    <MapPin size={12} style={{ flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }} title={contact.address}>
                      {contact.address} ({contact.city} {contact.district})
                    </span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      );
    });
  }, [filteredContacts, expandedContactId, navigate, handleStartEdit, isMultiSelectMode, selectedContactIds, handleToggleSelect]);

  return (
    <div className="contacts-page">
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'nowrap', marginBottom: '0.5rem' }}>
        <h2 className="page-title" style={{ margin: 0, whiteSpace: 'nowrap', fontSize: '1.4rem' }}>대상자 관리</h2>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <button 
            className={`btn-secondary ${isMultiSelectMode ? 'active' : ''}`}
            onClick={() => {
              setIsMultiSelectMode(!isMultiSelectMode);
              if (isMultiSelectMode) setSelectedContactIds([]); // 끄면 선택 초기화
            }}
            style={{ whiteSpace: 'nowrap', padding: '0.4rem 0.6rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.2rem', backgroundColor: isMultiSelectMode ? 'var(--accent-color)' : 'var(--bg-secondary)', color: isMultiSelectMode ? 'white' : 'var(--text-primary)', border: isMultiSelectMode ? 'none' : '1px solid var(--border-color)' }}
          >
            다중 기록
          </button>
          <button 
            className="btn-primary" 
            onClick={() => {
              setFormData({
                company: '', title: '', name: '', recommender: '', phone: '', email: '', fax: '',
                address: '', city: '', district: '', latitude: '', longitude: ''
              });
              setIsModalOpen(true);
            }}
            style={{ whiteSpace: 'nowrap', padding: '0.4rem 0.6rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.2rem', flexShrink: 0 }}
          >
            <Plus size={14} /> 새 대상자 등록
          </button>
        </div>
      </div>

      {/* Filter Options */}
      <div className="filter-row">
        <select 
          className="filter-select"
          value={selectedCity} 
          onChange={(e) => {
            setSelectedCity(e.target.value);
            setSelectedDistrict('');
          }}
        >
          <option value="">-- 시/도 선택 --</option>
          {cities.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <select 
          className="filter-select"
          value={selectedDistrict} 
          disabled={!selectedCity}
          onChange={(e) => setSelectedDistrict(e.target.value)}
        >
          <option value="">-- 시/군/구 선택 --</option>
          {districts.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        
        {(selectedCity || selectedDistrict) && (
          <button 
            className="btn-secondary btn-sm"
            onClick={() => {
              setSelectedCity('');
              setSelectedDistrict('');
            }}
          >
            필터 초기화
          </button>
        )}
      </div>

      {/* Search Input */}
      <div className="search-bar">
        <Search className="search-icon" size={20} />
        <input 
          type="text" 
          placeholder="업체명, 성함, 또는 주소로 검색..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Contact List */}
      <div className="contacts-list">
        {loading ? (
          <div className="loading" style={{ textAlign: 'center', padding: '3rem', width: '100%' }}>로딩 중...</div>
        ) : filteredContacts.length > 0 ? (
          renderedContacts
        ) : (
          <div className="no-data" style={{ gridColumn: 'span 3', textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
            검색 결과가 없습니다.
          </div>
        )}
      </div>

      {/* Floating Action Button for Multi-select */}
      {isMultiSelectMode && selectedContactIds.length > 0 && (
        <div style={{
          position: 'fixed', bottom: '80px', left: '50%', transform: 'translateX(-50%)',
          backgroundColor: 'var(--accent-color)', color: 'white', padding: '0.8rem 1.5rem',
          borderRadius: '30px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', zIndex: 1000,
          display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 600
        }}
        onClick={() => navigate('/meetings', { state: { selectedContactIds } })}
        >
          <Calendar size={18} />
          {selectedContactIds.length}명 상담 기록
        </div>
      )}      {/* New Client Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '550px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 600 }}>
              {formData.id ? '대상자 정보 수정' : '새 대상자 등록'}
            </h3>
            <form onSubmit={handleSubmit} className="form-grid">
              
              <div className="form-group">
                <label>업체명</label>
                <input type="text" name="company" value={formData.company} onChange={handleInputChange} placeholder="예: 삼성전자" />
              </div>
              <div className="form-group">
                <label>성함</label>
                <input type="text" name="name" value={formData.name} onChange={handleInputChange} placeholder="예: 홍길동" />
              </div>
              <div className="form-group">
                <label>직책</label>
                <input type="text" name="title" value={formData.title} onChange={handleInputChange} placeholder="예: 팀장" />
              </div>
              <div className="form-group">
                <label>누구 소개</label>
                <input type="text" name="recommender" value={formData.recommender} onChange={handleInputChange} placeholder="예: 이영희 과장" />
              </div>
              <div className="form-group">
                <label>연락처 (모바일)</label>
                <input type="text" name="phone" value={formData.phone} onChange={handleInputChange} placeholder="예: 010-1234-5678" />
              </div>
              <div className="form-group">
                <label>이메일</label>
                <input type="email" name="email" value={formData.email} onChange={handleInputChange} placeholder="example@domain.com" />
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label>팩스</label>
                <input type="text" name="fax" value={formData.fax} onChange={handleInputChange} placeholder="예: 02-123-4567" />
              </div>

              {/* Address Section */}
              <div className="address-search-group" style={{ gridColumn: 'span 2' }}>
                <label>등록할 주소 (정확한 길찾기를 위해 도로명/지번 권장)</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input 
                    type="text" 
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    placeholder="도로명, 지번 주소 또는 상호명 입력..." 
                    style={{ flex: 1 }}
                  />
                  <button 
                    type="button" 
                    className="btn-secondary" 
                    style={{ padding: '0 1rem', whiteSpace: 'nowrap', backgroundColor: '#2d60ff', color: 'white', border: 'none' }} 
                    onClick={() => {
                      if (!formData.address.trim()) {
                        toast.error('검색할 주소나 상호명을 입력하세요.');
                        return;
                      }
                      window.open(`https://map.naver.com/v5/search/${encodeURIComponent(formData.address)}`, '_blank');
                    }}
                  >
                    지도 검색
                  </button>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.4rem' }}>
                  상호명으로 검색 후, 실제 주소를 찾아 붙여넣으시면 좋습니다. 저장 시 자동으로 위치가 변환됩니다.
                </div>
              </div>

              <div className="modal-actions" style={{ display: 'flex', gap: '0.5rem', width: '100%', marginTop: '1.5rem' }}>
                <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => setIsModalOpen(false)}>취소</button>
                {formData.id && (
                  <button 
                    type="button" 
                    onClick={() => requestDeleteContact(formData.id)}
                    style={{ flex: 1, backgroundColor: '#ffebee', color: '#d32f2f', border: '1px solid #ffcdd2', borderRadius: 'var(--radius-md)', fontWeight: 600, cursor: 'pointer' }}
                  >
                    삭제
                  </button>
                )}
                <button type="submit" className="btn-primary" style={{ flex: 2, fontSize: '1rem' }}>저장하기</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Modal */}
      {deleteTargetId && (
        <div className="modal-overlay" style={{ zIndex: 9999, alignItems: 'center', paddingBottom: 0 }}>
          <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', width: '90%', maxWidth: '320px', textAlign: 'center', padding: '2rem 1.5rem', boxSizing: 'border-box' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', fontWeight: 600 }}>비밀번호 확인</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>삭제하시려면 비밀번호를 입력하세요.</p>
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
              <button className="btn-primary" style={{ flex: 1, padding: '0.8rem', backgroundColor: '#d32f2f', border: 'none' }} onClick={confirmDeleteContact}>확인</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Contacts;
