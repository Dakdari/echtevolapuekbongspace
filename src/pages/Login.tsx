import React from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/useAuthStore';
import './Login.css';

const Login: React.FC = () => {
  const { signInWithGoogle, user, loading } = useAuthStore();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const handleLogin = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      alert('로그인 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="login-container">
      <div className="login-card glass-panel">
        <h1 className="login-title">로그인</h1>
        <p className="login-desc">봉황스페이스에 오신 것을 환영합니다.</p>
        
        <button onClick={handleLogin} disabled={loading} className="btn btn-primary login-btn">
          {loading ? '처리 중...' : 'Google 계정으로 로그인'}
        </button>
        
        <div className="login-footer">
          <p>회원가입은 선택 사항이며, 비회원도 익명으로 사이트를 자유롭게 이용하실 수 있습니다.</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
