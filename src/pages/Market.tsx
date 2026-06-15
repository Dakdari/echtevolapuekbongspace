import React, { useState, useEffect } from 'react';
import useAuthStore from '../store/useAuthStore';
import { getSiteSettings } from '../lib/adminApi';
import type { SiteSettings, MarketItem } from '../lib/adminApi';
import { purchaseStickerPack } from '../lib/api';
import './Market.css';

const Market: React.FC = () => {
  const { user, profile } = useAuthStore();
  const [siteSettings, setSiteSettings] = useState<SiteSettings | null>(null);
  
  useEffect(() => {
    getSiteSettings().then(setSiteSettings).catch(console.error);
  }, []);

  const handlePurchase = async (packId: string, price: number) => {
    if (!user || !profile) {
      alert('회원만 딱지 팩을 구매할 수 있습니다.');
      return;
    }
    if (profile.odong < price) {
      alert('오동이 부족합니다! 글을 쓰거나 댓글을 달아 오동을 획득하세요.');
      return;
    }
    if (profile.purchasedStickers?.includes(packId)) {
      alert('이미 구매한 딱지 팩입니다.');
      return;
    }

    try {
      await purchaseStickerPack(user.uid, packId, price);
      // 전역 상태 즉시 업데이트
      useAuthStore.getState().updateProfile({ 
        odong: profile.odong - price,
        purchasedStickers: [...(profile.purchasedStickers || []), packId]
      });
      alert('딱지 팩을 성공적으로 구매했습니다!');
    } catch (e: any) {
      console.error(e);
      alert(`구매 실패: ${e?.message || e}`);
    }
  };

  return (
    <div className="market-container">
      <div className="market-header glass-panel">
        <h1 className="page-title">{siteSettings?.marketName || '딱지마켓'}</h1>
        <p className="market-desc">
          오동을 사용하여 다양한 <strong>아이템</strong>을 구매하세요!
        </p>
        <div className="user-odong-info">
          내 보유 오동: <strong>{profile ? profile.odong : 0}</strong> 오동
          {!user && <span className="login-prompt"> (로그인 필요)</span>}
        </div>
      </div>

      <div className="stickers-grid">
        {(!siteSettings?.marketItems || siteSettings.marketItems.length === 0) ? (
          <p style={{ textAlign: 'center', gridColumn: '1 / -1', color: 'var(--color-text-secondary)', padding: '2rem' }}>
            등록된 상품이 없습니다.
          </p>
        ) : (
          siteSettings.marketItems.map(item => (
            <div key={item.id} className="sticker-card glass-panel" style={{ padding: '1rem' }}>
              <div className="sticker-image-wrapper" style={{ marginBottom: '1rem', height: '150px', display: 'flex', overflowX: 'auto', gap: '0.5rem', scrollSnapType: 'x mandatory' }}>
                {(item.imageUrls || (item.imageUrl ? [item.imageUrl] : [])).map((url, idx) => (
                  <img key={idx} src={url} alt={`${item.name} ${idx + 1}`} className="sticker-image" style={{ width: '100%', flex: '0 0 100%', height: '100%', borderRadius: '8px', objectFit: 'contain', scrollSnapAlign: 'start' }} />
                ))}
              </div>
              
              <h3 className="sticker-name" style={{ marginBottom: '0.5rem', fontSize: '1.2rem', fontWeight: 'bold' }}>
                {item.name} {item.imageUrls && item.imageUrls.length > 1 && <span style={{fontSize: '0.85rem', color: 'var(--color-text-muted)'}}>({item.imageUrls.length}종)</span>}
              </h3>
              
              <div className="sticker-buy-section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
                <span className="sticker-price" style={{ color: item.price === 0 ? 'var(--color-success, #22c55e)' : 'var(--color-primary)', fontWeight: 'bold' }}>
                  {item.price === 0 ? '🆓 무료' : `${item.price} 오동`}
                </span>
                {item.price === 0 ? (
                  <span style={{ color: 'var(--color-text-muted)', fontWeight: 'bold', fontSize: '0.85rem' }}>모두 사용 가능</span>
                ) : profile?.purchasedStickers?.includes(item.id) ? (
                  <span style={{ color: 'var(--color-text-muted)', fontWeight: 'bold' }}>보유 중</span>
                ) : (
                  <button 
                    className="btn btn-primary btn-sm"
                    onClick={() => handlePurchase(item.id, item.price)}
                  >
                    구매하기
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Market;
