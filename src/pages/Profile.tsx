import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import useAuthStore from '../store/useAuthStore';
import { updateUserNickname } from '../lib/api';
import { getSiteSettings } from '../lib/adminApi';
import type { SiteSettings, MarketItem } from '../lib/adminApi';
import { isValidNickname } from '../utils/nickname';
import { User, Coins, Settings, LogOut, Save } from 'lucide-react';
import './Profile.css';

const Profile: React.FC = () => {
  const { user, profile, signOut, updateProfile } = useAuthStore();
  const [nickname, setNickname] = useState(profile?.nickname || '');
  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [settings, setSettings] = useState<SiteSettings | null>(null);

  useEffect(() => {
    getSiteSettings().then(setSettings).catch(console.error);
    if (profile?.nickname) {
      setNickname(profile.nickname);
    }
  }, [profile?.nickname]);

  if (!user || !profile) {
    return <Navigate to="/login" replace />;
  }

  const handleSaveNickname = async () => {
    if (!nickname.trim()) return alert('닉네임을 입력해주세요.');
    if (!isValidNickname(nickname)) return alert('닉네임에는 영문, 숫자, 한글, 한자, 가나만 사용할 수 있습니다.');
    if (nickname === profile.nickname) {
      setIsEditing(false);
      return;
    }
    
    setSubmitting(true);
    try {
      await updateUserNickname(user.uid, nickname);
      updateProfile({ nickname });
      setIsEditing(false);
      alert('닉네임이 변경되었습니다.');
    } catch (error: any) {
      console.error(error);
      if (error.message === 'INVALID_NICKNAME') {
        alert('닉네임에는 영문, 숫자, 한글, 한자, 가나만 사용할 수 있습니다.');
      } else {
        alert('닉네임 변경에 실패했습니다.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const myItems = profile.purchasedStickers || [];
  const marketItems = settings?.marketItems || [];

  return (
    <div className="profile-container">
      <div className="profile-card glass-panel">
        <header className="profile-header">
          <div className="profile-avatar">
            <User size={48} />
          </div>
          <div className="profile-info">
            {isEditing ? (
              <div className="profile-edit-group">
                <input
                  type="text"
                  className="form-input"
                  value={nickname}
                  onChange={e => setNickname(e.target.value)}
                  maxLength={15}
                />
                <button 
                  className="btn btn-primary btn-sm" 
                  onClick={handleSaveNickname}
                  disabled={submitting}
                >
                  <Save size={16} /> 저장
                </button>
                <button 
                  className="btn btn-secondary btn-sm" 
                  onClick={() => {
                    setNickname(profile.nickname);
                    setIsEditing(false);
                  }}
                  disabled={submitting}
                >
                  취소
                </button>
              </div>
            ) : (
              <div className="profile-name-group">
                <h1 className="profile-name">{profile.nickname}</h1>
                <button className="btn-edit-name" onClick={() => setIsEditing(true)}>
                  <Settings size={16} /> 수정
                </button>
              </div>
            )}
            <p className="profile-email">{profile.email}</p>
          </div>
        </header>

        <div className="profile-stats">
          <div className="stat-card">
            <div className="stat-icon odong-icon">
              <Coins size={24} />
            </div>
            <div className="stat-details">
              <span className="stat-label">보유 오동</span>
              <span className="stat-value">{profile.odong.toLocaleString()} <small>오동</small></span>
            </div>
          </div>
        </div>

        <div className="profile-items-section">
          <h2 className="section-title">보유 딱지 현황</h2>
          {myItems.length === 0 ? (
            <p className="empty-message">보유 중인 딱지가 없습니다. 딱지 마켓에서 구매해보세요!</p>
          ) : (
            <div className="profile-items-grid">
              {myItems.map(itemId => {
                const itemDef = marketItems.find(mi => mi.id === itemId);
                if (!itemDef) return null;
                const thumbUrl = (itemDef as any).imageUrls?.[0] || itemDef.imageUrl;
                if (!thumbUrl) return null;
                return (
                  <div key={itemId} className="profile-item-card">
                    <img src={thumbUrl} alt={itemDef.name} className="item-image" />
                    <span className="item-name">{itemDef.name}</span>
                    {(itemDef as any).imageUrls?.length > 1 && (
                      <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>({(itemDef as any).imageUrls.length}종)</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="profile-actions">
          <button className="btn btn-secondary btn-logout" onClick={() => {
            if (confirm('로그아웃 하시겠습니까?')) {
              signOut();
            }
          }}>
            <LogOut size={18} /> 로그아웃
          </button>
        </div>
      </div>
    </div>
  );
};

export default Profile;
