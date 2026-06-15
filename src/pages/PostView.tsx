import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { MessageSquare, ThumbsUp, ThumbsDown, Eye, Clock, User, ExternalLink } from 'lucide-react';
import DOMPurify from 'dompurify';
import useAuthStore from '../store/useAuthStore';
import { getAnonNickname } from '../utils/nickname';
import { getPost, votePost, getComments, createComment, getBoards, deletePost, deleteComment } from '../lib/api';
import type { Post, Comment, Board } from '../lib/api';
import { getSiteSettings, getBoardSettings } from '../lib/adminApi';
import type { SiteSettings, BoardSettings } from '../lib/adminApi';
import { hashPassword } from '../utils/crypto';
import NotFound from '../components/common/NotFound';
import './PostView.css';

const PostView: React.FC = () => {
  const { boardId, postId } = useParams<{ boardId: string, postId: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuthStore();

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [boardSettings, setBoardSettings] = useState<BoardSettings | null>(null);
  const [boardMetaLoaded, setBoardMetaLoaded] = useState(false);
  const [boards, setBoards] = useState<Board[]>([]);

  const [commentText, setCommentText] = useState('');
  const [anonNickname, setAnonNickname] = useState('');
  const [anonPassword, setAnonPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showStickerPopup, setShowStickerPopup] = useState(false);

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
    getSiteSettings().then(setSettings).catch(console.error);
    getBoardSettings(boardId).then(setBoardSettings).catch(console.error)
      .finally(() => setBoardMetaLoaded(true));
    getBoards().then(setBoards).catch(console.error);
  }, [boardId]);

  useEffect(() => {
    const fetchData = async () => {
      if (!boardId || !postId) return;
      try {
        const fetchedPost = await getPost(boardId, Number(postId));
        if (fetchedPost && fetchedPost.id) {
          setPost(fetchedPost);
          const fetchedComments = await getComments(fetchedPost.id);
          setComments(fetchedComments);
        }
      } catch (error) {
        console.error('Failed to fetch post:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [boardId, postId]);

  const anonAuthors = Array.from(new Set(comments.filter(c => !c.authorUid).map(c => c.authorName)));
  const nextAnonName = getAnonNickname(anonAuthors.length, settings?.defaultAnonSuffix || '봉군');

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    if (commentText.length > 500) {
      alert('댓글은 최대 500자까지 작성 가능합니다.');
      return;
    }
    if (!user && !anonPassword) {
      alert('비회원은 비밀번호를 입력해야 합니다.');
      return;
    }
    if (!post || !post.id) return;

    setSubmitting(true);
    try {
      await createComment(post.id, {
        authorUid: user ? user.uid : null,
        authorName: user && profile ? profile.nickname : (anonNickname.trim() || nextAnonName),
        authorPassword: user ? undefined : anonPassword,
        content: commentText,
      });
      setCommentText('');
      setAnonPassword('');
      setAnonNickname('');
      const newComments = await getComments(post.id);
      setComments(newComments);
      setPost(prev => prev ? { ...prev, commentCount: prev.commentCount + 1 } : prev);
    } catch (error: any) {
      if (error.message === 'PROFANITY_DETECTED') {
        alert('금칙어가 포함되어 있어 댓글을 등록할 수 없습니다.');
      } else {
        console.error('Failed to add comment:', error);
        alert('댓글 등록에 실패했습니다.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditPost = async () => {
    if (!post || !post.id) return;
    let enteredPw = '';
    // 관리자도 타인 글 수정 불가 (본인 글이거나 비밀번호가 있는 글만 가능)
    if (user?.uid === post.authorUid) {
      // 본인 게시글 - 통과
    } else if (!post.authorUid && post.authorPassword) {
      const pw = prompt('작성 시 입력한 비밀번호를 입력해주세요.');
      if (!pw) return;
      if (post.authorSalt) {
        const hashedPw = await hashPassword(pw, post.authorSalt);
        if (hashedPw !== post.authorPassword) return alert('비밀번호가 일치하지 않습니다.');
      } else {
        if (pw !== post.authorPassword) return alert('비밀번호가 일치하지 않습니다.');
      }
      enteredPw = pw;
    } else {
      return alert('수정 권한이 없습니다.');
    }
    navigate(`/${boardId}/write?edit=${post.postId}`, { state: { password: enteredPw } });
  };

  const handleDeletePost = async () => {
    if (!post || !post.id) return;
    // 관리자는 비밀번호 확인 없이 삭제 가능
    if (profile?.role !== 'admin') {
      if (user?.uid !== post.authorUid) {
        if (!post.authorUid && post.authorPassword) {
          const pw = prompt('작성 시 입력한 비밀번호를 입력해주세요.');
          if (!pw) return;
          if (post.authorSalt) {
            const hashedPw = await hashPassword(pw, post.authorSalt);
            if (hashedPw !== post.authorPassword) return alert('비밀번호가 일치하지 않습니다.');
          } else {
            if (pw !== post.authorPassword) return alert('비밀번호가 일치하지 않습니다.');
          }
        } else {
          return alert('권한이 없습니다.');
        }
      }
    }
    
    if (!confirm('정말 이 게시글을 삭제하시겠습니까?')) return;
    try {
      await deletePost(post.id);
      alert('삭제되었습니다.');
      navigate(`/${boardId}`);
    } catch (e) {
      console.error(e);
      alert('삭제 실패. (Firebase 보안 규칙에서 관리자 삭제가 허용되어 있는지 확인해주세요)');
    }
  };

  const handleDeleteComment = async (commentId: string, authorUid: string | null, authorPw?: string, authorSalt?: string) => {
    if (!post || !post.id) return;
    // 관리자는 비밀번호 확인 없이 삭제 가능
    if (profile?.role !== 'admin') {
      if (user?.uid !== authorUid) {
        if (!authorUid && authorPw) {
          const pw = prompt('댓글 작성 시 입력한 비밀번호를 입력해주세요.');
          if (!pw) return;
          if (authorSalt) {
            const hashedPw = await hashPassword(pw, authorSalt);
            if (hashedPw !== authorPw) return alert('비밀번호가 일치하지 않습니다.');
          } else {
            if (pw !== authorPw) return alert('비밀번호가 일치하지 않습니다.');
          }
        } else {
          return alert('권한이 없습니다.');
        }
      }
    }
    
    if (!confirm('댓글을 삭제하시겠습니까?')) return;
    try {
      await deleteComment(post.id, commentId);
      setComments(prev => prev.filter(c => c.id !== commentId));
    } catch (e) {
      console.error(e);
      alert('삭제 실패. (Firebase 보안 규칙 확인 요망)');
    }
  };

  const handleVote = async (type: 'like' | 'dislike') => {
    if (!post || !post.id) return;

    const today = new Date().toDateString();
    const voteKey = `vote_${post.id}`;
    const lastVoteDate = localStorage.getItem(voteKey);

    if (lastVoteDate === today) {
      return alert('추천/비추천은 한 게시글당 하루에 한 번만 가능합니다.');
    }

    try {
      await votePost(post.id, type);
      localStorage.setItem(voteKey, today);

      setPost(prev => prev ? {
        ...prev,
        likes: type === 'like' ? prev.likes + 1 : prev.likes,
        dislikes: type === 'dislike' ? prev.dislikes + 1 : prev.dislikes
      } : prev);
    } catch (error) {
      console.error('Failed to vote:', error);
    }
  };

  const renderCommentContent = (content: string) => {
    // split by [딱지:url]
    const parts = content.split(/(\[딱지:[^\]]+\])/);
    return parts.map((part, i) => {
      if (part.startsWith('[딱지:') && part.endsWith(']')) {
        const url = part.substring(4, part.length - 1);
        return <img key={i} src={url} alt="딱지" className="comment-sticker" style={{ maxWidth: '100px', maxHeight: '100px', display: 'block', marginTop: '0.5rem', borderRadius: '8px' }} />;
      }
      return <span key={i} style={{ whiteSpace: 'pre-wrap' }}>{part}</span>;
    });
  };

  if (boardMetaLoaded && !boardSettings) {
    return <NotFound />;
  }

  if (loading) return <div className="post-view-container"><p style={{ textAlign: 'center' }}>게시글을 불러오는 중입니다...</p></div>;
  if (!post) return <div className="post-view-container"><p style={{ textAlign: 'center' }}>존재하지 않는 게시글이거나 삭제되었습니다.</p></div>;

  const postDateStr = post.createdAt?.toDate
    ? new Intl.DateTimeFormat('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(post.createdAt.toDate())
    : '방금 전';

  const likeName = settings?.likeName || '대봉황';
  const dislikeName = settings?.dislikeName || '닭둘기';
  const allowVotes = boardSettings?.allowVotes ?? false;
  const allowComments = boardSettings?.allowComments ?? false;
  const allowUserComment = (boardSettings?.allowUserComment ?? false) || profile?.role === 'admin';

  // 인기게시판(전당)에서 볼 때: 원본 게시판 링크 표시
  const popularBoardId = settings?.popularBoardId || 'juksil';
  const isJuksil = boardId === popularBoardId;
  // 자동 복사 시스템: originBoardId/originPostId 필드 우선, fallback으로 boardId 사용
  const originBoardId = (post as any).originBoardId || null;
  const originPostId = (post as any).originPostId || null;
  const originBoardName = originBoardId
    ? (boards.find(b => b.id === originBoardId)?.name || originBoardId)
    : null;

  return (
    <div className="post-view-container">
      <div className="post-view-card glass-panel">
        <header className="post-header">
          {/* 죽실 원본 링크 */}
          {isJuksil && originBoardId && originPostId && (
            <Link to={`/${originBoardId}/${originPostId}`} className="origin-link">
              <ExternalLink size={13} />
              원본: {originBoardName || originBoardId}
            </Link>
          )}

          <h1 className="post-title">
            {post.prefix && <span className="post-prefix">{post.prefix}</span>}
            {post.title}
          </h1>
          <div className="post-meta">
            <div className="meta-left">
              <span className="meta-item"><User size={16} /> {post.authorName}</span>
              <span className="meta-item"><Clock size={16} /> {postDateStr}</span>
            </div>
            <div className="meta-right">
              <span className="meta-item"><Eye size={16} /> {post.views}</span>
              <span className="meta-item"><MessageSquare size={16} /> {post.commentCount}</span>
            </div>
          </div>
          {(profile?.role === 'admin' || user?.uid === post.authorUid || (!post.authorUid && post.authorPassword)) && (
            <div className="post-manage-actions">
              <button className="btn btn-secondary btn-sm" onClick={handleEditPost}>수정</button>
              <button className="btn btn-danger btn-sm" onClick={handleDeletePost}>삭제</button>
            </div>
          )}
        </header>

        <div
          className="post-body ql-editor"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(post.content, {
            ADD_TAGS: ['iframe'],
            ADD_ATTR: ['class', 'target', 'data-sticker', 'src', 'frameborder', 'allowfullscreen', 'allow'],
            ALLOW_DATA_ATTR: true,
          }) }}
        />

        {/* 투표 버튼 */}
        {allowVotes && (
          <div className="post-actions">
            <button className="btn-action btn-like" onClick={() => handleVote('like')}>
              <ThumbsUp size={18} /> {likeName} {post.likes}
            </button>
            <button className="btn-action btn-dislike" onClick={() => handleVote('dislike')}>
              <ThumbsDown size={18} /> {dislikeName} {post.dislikes}
            </button>
          </div>
        )}
      </div>

      {/* 댓글 섹션 */}
      {allowComments && (
        <div className="comments-section glass-panel">
          <h3 className="comments-title">댓글 ({post.commentCount})</h3>

          <ul className="comments-list">
            {comments.map(c => {
              const commentDateStr = c.createdAt?.toDate
                ? new Intl.DateTimeFormat('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(c.createdAt.toDate())
                : '방금 전';
              return (
                <li key={c.id} className="comment-item">
                  <div className="comment-header">
                    <div className="comment-header-left">
                      <span className="comment-author">{c.authorName}</span>
                      <span className="comment-time">{commentDateStr}</span>
                    </div>
                    {(profile?.role === 'admin' || user?.uid === c.authorUid || (!c.authorUid && c.authorPassword)) && (
                      <button className="btn-comment-delete" onClick={() => c.id && handleDeleteComment(c.id, c.authorUid, c.authorPassword, c.authorSalt)}>삭제</button>
                    )}
                  </div>
                  <div className="comment-content">{renderCommentContent(c.content)}</div>
                </li>
              );
            })}
          </ul>

          {/* 댓글 작성 폼 */}
          {allowUserComment && (
            <form onSubmit={handleCommentSubmit} className="comment-form">
              {!user && (
                <div className="comment-anon-inputs">
                  <input
                    type="text"
                    placeholder={`닉네임 (${nextAnonName})`}
                    value={anonNickname}
                    onChange={e => setAnonNickname(e.target.value.slice(0, 15))}
                    className="form-input comment-pw"
                    style={{ width: '160px' }}
                  />
                  <input
                    type="password"
                    placeholder="댓글 비밀번호"
                    value={anonPassword}
                    onChange={e => setAnonPassword(e.target.value)}
                    className="form-input comment-pw"
                  />
                </div>
              )}
              <div className="comment-input-group">
                <textarea
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  placeholder="댓글을 남겨보세요. (최대 500자)"
                  className="form-input comment-textarea"
                  maxLength={500}
                  rows={3}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <button type="submit" disabled={submitting} className="btn btn-primary submit-comment-btn" style={{ flex: 1, padding: '0.5rem' }}>
                    {submitting ? '등록 중...' : '등록'}
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    style={{ padding: '0.5rem', fontSize: '0.85rem' }}
                    onClick={() => setShowStickerPopup(!showStickerPopup)}
                  >
                    딱지
                  </button>
                </div>
              </div>
              {showStickerPopup && (
                <div className="sticker-popup glass-panel" style={{ marginTop: '0.5rem', padding: '1rem', display: 'flex', gap: '1rem', overflowX: 'auto' }}>
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
                            onClick={async () => {
                              setShowStickerPopup(false);
                              if (!user && !anonPassword) {
                                alert('비회원은 비밀번호를 입력해야 합니다.');
                                return;
                              }
                              setSubmitting(true);
                              try {
                                await createComment(post!.id!, {
                                  authorUid: user ? user.uid : null,
                                  authorName: user && profile ? profile.nickname : (anonNickname.trim() || nextAnonName),
                                  authorPassword: user ? undefined : anonPassword,
                                  content: `[딱지:${url}]`,
                                });
                                setAnonPassword('');
                                setAnonNickname('');
                                const newComments = await getComments(post!.id!);
                                setComments(newComments);
                                setPost(prev => prev ? { ...prev, commentCount: prev.commentCount + 1 } : prev);
                              } catch (error: any) {
                                if (error?.message === 'PROFANITY_DETECTED') {
                                  alert('금칙어가 포함되어 있어 댓글을 등록할 수 없습니다.');
                                } else {
                                  alert('댓글 등록에 실패했습니다.');
                                }
                              } finally {
                                setSubmitting(false);
                              }
                            }}
                          />
                        ))}
                      </div>
                    ))
                  )}
                </div>
              )}
            </form>
          )}
          {!allowUserComment && (
            <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: '1rem' }}>
              댓글 작성이 제한된 게시판입니다.
            </p>
          )}
        </div>
      )}

      <div className="post-nav">
        <Link to={`/${boardId}`} className="btn btn-secondary">목록으로</Link>
      </div>
    </div>
  );
};

export default PostView;
