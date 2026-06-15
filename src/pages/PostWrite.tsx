import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom';
import useAuthStore from '../store/useAuthStore';
import useSettingsStore from '../store/useSettingsStore';
import { createPost, updatePost, getPost } from '../lib/api';
import { getSiteSettings, getBoardSettings } from '../lib/adminApi';
import type { SiteSettings, BoardSettings } from '../lib/adminApi';
import { getAnonNickname } from '../utils/nickname';
import { hashPassword } from '../utils/crypto';
import RichEditor from '../components/common/RichEditor';
import NotFound from '../components/common/NotFound';
import './PostWrite.css';

const PostWrite: React.FC = () => {
  const { boardId } = useParams<{ boardId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const editPostId = searchParams.get('edit');
  const { user, profile } = useAuthStore();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [prefix, setPrefix] = useState('');
  const [nickname, setNickname] = useState('봉군');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [boardSettings, setBoardSettings] = useState<BoardSettings | null>(null);
  const [boardMetaLoaded, setBoardMetaLoaded] = useState(false);
  const [showStickerPopup, setShowStickerPopup] = useState(false);
  const { settings } = useSettingsStore();

  const purchasedStickers = useMemo(() => {
    if (!settings?.marketItems) return [];
    const freeItems = settings.marketItems.filter(item => item.price === 0);
    const boughtItems = profile?.purchasedStickers
      ? settings.marketItems.filter(item => item.price > 0 && profile.purchasedStickers!.includes(item.id))
      : [];
    return [...freeItems, ...boughtItems];
  }, [profile?.purchasedStickers, settings?.marketItems]);

  useEffect(() => {
    if (!boardId) return;
    setBoardMetaLoaded(false);
    getBoardSettings(boardId).then(b => {
      setBoardSettings(b);
      if (b?.prefixes?.length && !editPostId) setPrefix(b.prefixes[0]);
    }).catch(console.error)
      .finally(() => setBoardMetaLoaded(true));

    if (editPostId) {
      getPost(boardId, Number(editPostId)).then(async p => {
        if (p) {
          // 권한 체크
          if (user?.uid !== p.authorUid) {
            if (!p.authorUid && p.authorPassword) {
              const providedPassword = location.state?.password;
              let isOk = false;
              if (providedPassword) {
                if (p.authorSalt) {
                  const hashedPw = await hashPassword(providedPassword, p.authorSalt);
                  if (hashedPw === p.authorPassword) isOk = true;
                } else {
                  if (providedPassword === p.authorPassword) isOk = true;
                }
              }
              if (!isOk) {
                alert('수정 권한이 없습니다.');
                return navigate(-1);
              }
            } else {
              alert('수정 권한이 없습니다.');
              return navigate(-1);
            }
          }
          setTitle(p.title);
          setContent(p.content);
          if (p.prefix) setPrefix(p.prefix);
        }
      }).catch(console.error);
    }
  }, [boardId, editPostId, location.state, navigate, profile?.role, user?.uid]);

  if (!boardMetaLoaded) {
    return (
      <div className="post-write-container">
        <p style={{ textAlign: 'center' }}>게시판 정보를 불러오는 중입니다...</p>
      </div>
    );
  }

  if (!boardSettings) {
    return <NotFound />;
  }

  const canWrite = boardSettings.allowUserPost || profile?.role === 'admin';
  if (!canWrite) {
    return (
      <div className="post-write-container">
        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
          <h2>글쓰기 권한이 없습니다</h2>
          <p style={{ color: 'var(--color-text-secondary)', marginTop: '0.5rem' }}>
            관리자에 의해 이 게시판의 글쓰기가 제한되었습니다.
          </p>
          <button className="btn btn-secondary" style={{ marginTop: '1rem' }} onClick={() => navigate(-1)}>
            돌아가기
          </button>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      alert('제목과 내용을 모두 입력해주세요.');
      return;
    }
    if (content.length > 50000) {
      alert('게시글 내용은 50000자를 초과할 수 없습니다.');
      return;
    }
    if (content.includes('<iframe') || content.includes('<video') || content.includes('class="ql-video"')) {
      alert('게시글에는 iframe이나 비디오를 삽입할 수 없습니다.');
      return;
    }
    const imageCount = (content.match(/<img /g) || []).length;
    if (imageCount > 20) {
      alert('사진은 최대 20장까지만 첨부할 수 있습니다.');
      return;
    }
    if (!user && (!nickname.trim() || !password)) {
      alert('비회원은 게시글 수정/삭제를 위한 비밀번호를 입력해야 합니다.');
      return;
    }
    if (!boardId) return;

    setSubmitting(true);
    try {
      if (editPostId) {
        // Find document ID by postId
        const postData = await getPost(boardId, Number(editPostId));
        if (postData?.id) {
          await updatePost(postData.id, {
            title,
            content,
            prefix: prefix || undefined,
          });
          alert('게시글이 수정되었습니다!');
          navigate(`/${boardId}/${editPostId}`);
        } else {
          alert('수정할 게시글을 찾을 수 없습니다.');
        }
      } else {
        await createPost({
          boardId,
          title,
          content,
          prefix: prefix || undefined,
          authorUid: user ? user.uid : null,
          authorName: user && profile ? profile.nickname : nickname,
          authorPassword: user ? undefined : password,
        });
        alert(user ? '게시글이 등록되었습니다! (오동 획득)' : '게시글이 등록되었습니다!');
        navigate(`/${boardId}`);
      }
    } catch (error: any) {
      console.error('Error creating/updating post:', error);
      if (error.message === 'PROFANITY_DETECTED') {
        alert('게시글에 금칙어가 포함되어 있어 작성/수정할 수 없습니다.');
      } else if (error.message === 'BOARD_NOT_FOUND') {
        alert('존재하지 않는 게시판입니다.');
        navigate('/');
      } else {
        alert(`게시글 등록/수정에 실패했습니다. (사유: ${error.message || '알 수 없는 오류'})`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const hasPrefixes = boardSettings?.prefixes && boardSettings.prefixes.length > 0;

  return (
    <div className="post-write-container">
      <h1 className="page-title">{editPostId ? '글 수정' : '글쓰기'}</h1>

      <form onSubmit={handleSubmit} className="post-write-form glass-panel">
        {/* 말머리 선택 */}
        {hasPrefixes && (
          <div className="form-group">
            <label>말머리</label>
            <div className="prefix-options">
              <button
                type="button"
                className={`prefix-btn ${prefix === '' ? 'active' : ''}`}
                onClick={() => setPrefix('')}
              >없음</button>
              {boardSettings!.prefixes.map(p => (
                <button
                  type="button"
                  key={p}
                  className={`prefix-btn ${prefix === p ? 'active' : ''}`}
                  onClick={() => setPrefix(p)}
                >{p}</button>
              ))}
            </div>
          </div>
        )}

        <div className="form-group">
          <label>제목</label>
          <div className="title-input-row">
            {prefix && <span className="post-prefix">{prefix}</span>}
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="제목을 입력하세요"
              className="form-input"
            />
          </div>
        </div>

        {!user && (
          <div className="form-row">
            <div className="form-group">
              <label>닉네임 (비회원)</label>
              <input
                type="text"
                value={nickname}
                onChange={e => setNickname(e.target.value)}
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label>비밀번호</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="게시글 수정/삭제용"
                className="form-input"
              />
            </div>
          </div>
        )}

        <div className="form-group" data-color-mode="light">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '0.5rem' }}>
            <label style={{ marginBottom: 0 }}>내용</label>
            <button 
              type="button" 
              className="btn btn-secondary btn-sm"
              onClick={() => setShowStickerPopup(!showStickerPopup)}
            >
              내 딱지함
            </button>
          </div>
          
          {showStickerPopup && (
            <div className="sticker-popup glass-panel" style={{ marginBottom: '1rem', padding: '1rem', display: 'flex', gap: '1rem', overflowX: 'auto' }}>
              {purchasedStickers.length === 0 ? (
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>보유한 딱지가 없습니다. 딱지마켓에서 구매해보세요!</p>
              ) : (
                purchasedStickers.map(pack => (
                  <div key={pack.id} style={{ display: 'flex', gap: '0.5rem' }}>
                    {(pack.imageUrls || (pack.imageUrl ? [pack.imageUrl] : [])).map((url, idx) => (
                      <img 
                        key={idx} 
                        src={url} 
                        alt="딱지" 
                        style={{ width: '60px', height: '60px', objectFit: 'contain', cursor: 'pointer', border: '1px solid var(--color-border)', borderRadius: '4px', flexShrink: 0 }}
                        onClick={() => {
                          setContent(prev => prev + `<p><img src="${url}" width="80" height="80" alt="딱지" /></p>`);
                          setShowStickerPopup(false);
                        }}
                      />
                    ))}
                  </div>
                ))
              )}
            </div>
          )}

          <RichEditor
            value={content}
            onChange={setContent}
            placeholder="내용을 입력하세요..."
            disableVideo={true}
          />
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>
            취소
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? '저장 중...' : (editPostId ? '수정 완료' : '등록')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PostWrite;
