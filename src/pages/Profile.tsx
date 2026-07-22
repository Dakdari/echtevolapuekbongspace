import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import useAuthStore from '../store/useAuthStore';
import { updateUserNickname, submitAppeal } from '../lib/api';
import { getSiteSettings } from '../lib/adminApi';
import type { SiteSettings, MarketItem } from '../lib/adminApi';
import { isValidNickname } from '../utils/nickname';
import { User, Coins, Settings, LogOut, Save, Shield } from 'lucide-react';
import './Profile.css';

const Profile: React.FC = () => {
  const { user, profile, signOut, updateProfile } = useAuthStore();
  const [nickname, setNickname] = useState(profile?.nickname || '');
  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [settings, setSettings] = useState<SiteSettings | null>(null);

  // Appeal states
  const [isAppealing, setIsAppealing] = useState(false);
  const [appealReason, setAppealReason] = useState('');
  const [appealSubmitting, setAppealSubmitting] = useState(false);

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

  const handleAppealSubmit = async () => {
    if (!appealReason.trim()) return alert('항소 사유를 입력해주세요.');
    if (!confirm('항소는 단 1회만 가능하며 기각 시 재항소가 불가합니다. 제출하시겠습니까?')) return;
    
    setAppealSubmitting(true);
    try {
      await submitAppeal(user.uid, profile.nickname, appealReason);
      updateProfile({ appealStatus: 'pending' });
      setIsAppealing(false);
      alert('항소가 접수되었습니다.');
    } catch (e: any) {
      console.error(e);
      alert('항소 접수 실패: ' + (e?.message || e));
    } finally {
      setAppealSubmitting(false);
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

        {profile.isBanned && (
          <div className="ban-alert" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1.5rem' }}>
            <h3 style={{ color: '#ef4444', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Shield size={18} /> 계정 이용 제한 안내
            </h3>
            <p style={{ color: 'var(--color-text)', fontSize: '0.9rem', marginBottom: '1rem' }}>
              회원님의 계정은 운영 원칙 위반으로 인해 현재 차단된 상태입니다.
              <br/>
              <strong>제한 기간:</strong> {profile.banUntil ? `${new Date(profile.banUntil).toLocaleString()} 까지` : '무기한'}
            </p>
            
            {!profile.banUntil && (
              <div className="appeal-section" style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(239,68,68,0.2)' }}>
                {(!profile.appealStatus || profile.appealStatus === 'none') && !isAppealing && (
                  <div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>무기한 차단의 경우 단 1회 항소할 수 있습니다.</p>
                    <button className="btn btn-primary btn-sm" onClick={() => setIsAppealing(true)}>차단 항소하기</button>
                  </div>
                )}
                {isAppealing && (
                  <div className="appeal-form">
                    <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>항소 사유를 상세히 적어주세요. 기각 시 재항소가 불가합니다.</p>
                    <textarea 
                      className="form-input" 
                      rows={4} 
                      value={appealReason}
                      onChange={e => setAppealReason(e.target.value)}
                      placeholder="사유 입력..."
                      style={{ marginBottom: '0.5rem' }}
                    />
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="btn btn-primary btn-sm" onClick={handleAppealSubmit} disabled={appealSubmitting}>제출하기</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => setIsAppealing(false)} disabled={appealSubmitting}>취소</button>
                    </div>
                  </div>
                )}
                {profile.appealStatus === 'pending' && (
                  <p style={{ color: '#eab308', fontWeight: 600, fontSize: '0.9rem' }}>항소 심사 대기 중입니다. 결과를 기다려주세요.</p>
                )}
                {profile.appealStatus === 'rejected' && (
                  <p style={{ color: '#ef4444', fontWeight: 600, fontSize: '0.9rem' }}>항소가 기각되었습니다. 더 이상 항소할 수 없습니다.</p>
                )}
              </div>
            )}
          </div>
        )}

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
