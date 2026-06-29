import React, { createContext, useContext, useState, useEffect } from 'react';
import toast from 'react-hot-toast';

const UserContext = createContext();

export const useUser = () => {
  return useContext(UserContext);
};

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('current_sales_user');
    return saved || null;
  });
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [pendingUser, setPendingUser] = useState(null);
  const [passwordInput, setPasswordInput] = useState('');

  const changeUser = (newUser) => {
    if (user && newUser !== user) {
      setPendingUser(newUser);
      setShowPasswordModal(true);
    } else {
      setUser(newUser);
      localStorage.setItem('current_sales_user', newUser);
    }
  };

  const confirmPassword = () => {
    if (passwordInput === '0805') {
      setUser(pendingUser);
      localStorage.setItem('current_sales_user', pendingUser);
      setShowPasswordModal(false);
      setPendingUser(null);
      setPasswordInput('');
      toast.success(`${pendingUser}(으)로 사용자가 변경되었습니다.`);
    } else {
      toast.error('비밀번호가 틀렸습니다.');
    }
  };

  const cancelPassword = () => {
    setShowPasswordModal(false);
    setPendingUser(null);
    setPasswordInput('');
  };

  return (
    <UserContext.Provider value={{ user, changeUser }}>
      {children}
      {showPasswordModal && (
        <div className="password-modal-overlay" style={overlayStyle}>
          <div className="password-modal" style={modalStyle}>
            <h3 style={{ marginTop: 0 }}>사용자 변경 권한 확인</h3>
            <p style={{ fontSize: '0.9rem', color: '#64748b' }}>사용자를 변경하려면 비밀번호를 입력해주세요.</p>
            <input 
              type="password" 
              value={passwordInput} 
              onChange={(e) => setPasswordInput(e.target.value)} 
              placeholder="비밀번호"
              style={inputStyle}
            />
            <div style={buttonContainerStyle}>
              <button onClick={cancelPassword} style={cancelButtonStyle}>취소</button>
              <button onClick={confirmPassword} style={confirmButtonStyle}>확인</button>
            </div>
          </div>
        </div>
      )}
    </UserContext.Provider>
  );
};

const overlayStyle = {
  position: 'fixed',
  top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: 'rgba(0,0,0,0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 9999
};

const modalStyle = {
  backgroundColor: '#fff',
  padding: '2rem',
  borderRadius: '8px',
  width: '300px',
  boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
};

const inputStyle = {
  width: '100%',
  padding: '0.75rem',
  marginTop: '1rem',
  marginBottom: '1.5rem',
  border: '1px solid #cbd5e1',
  borderRadius: '4px',
  boxSizing: 'border-box'
};

const buttonContainerStyle = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '0.5rem'
};

const cancelButtonStyle = {
  padding: '0.5rem 1rem',
  backgroundColor: '#f1f5f9',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer'
};

const confirmButtonStyle = {
  padding: '0.5rem 1rem',
  backgroundColor: '#0f172a',
  color: '#fff',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer'
};
