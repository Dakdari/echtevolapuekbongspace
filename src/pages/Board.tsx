import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { PenLine } from 'lucide-react';
import { getPostsByBoard, getPopularPosts, getBoards } from '../lib/api';
import type { Post, Board as BoardType } from '../lib/api';
import { getSiteSettings, getBoardSettings } from '../lib/adminApi';
import type { SiteSettings, BoardSettings } from '../lib/adminApi';
import useAuthStore from '../store/useAuthStore';
import NotFound from '../components/common/NotFound';
import './Board.css';

type TabType = string;

const Board: React.FC = () => {
  const { boardId } = useParams<{ boardId: string }>();
  const { user, profile } = useAuthStore();
  const [posts, setPosts] = useState<Post[]>([]);
  const [popularPosts, setPopularPosts] = useState<Post[]>([]);
  const [boards, setBoards] = useState<BoardType[]>([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [boardSettings, setBoardSettings] = useState<BoardSettings | null>(null);
  const [boardMetaLoaded, setBoardMetaLoaded] = useState(false);
  const [selectedTab, setSelectedTab] = useState<TabType>('전체');

  useEffect(() => {
    if (!boardId) return;
    setBoardMetaLoaded(false);
    Promise.all([
      getSiteSettings(),
      getBoardSettings(boardId),
      getBoards(),
    ]).then(([s, b, fetchedBoards]) => {
      setSettings(s);
      setBoardSettings(b);
      setBoards(fetchedBoards);
    }).catch(console.error)
      .finally(() => setBoardMetaLoaded(true));
  }, [boardId]);

  const boardName = boards.find(b => b.id === boardId)?.name || boardSettings?.name || '게시판';

  useEffect(() => {
    if (!boardId) return;
    const fetchData = async () => {
      try {
        const fetched = await getPostsByBoard(boardId);
        setPosts(fetched);
        const popularBoardId = settings?.popularBoardId || 'juksil';
        if (boardId !== popularBoardId) {
          const threshold = settings?.popularPostThreshold ?? 5;
          const popular = await getPopularPosts(boardId, threshold, 10);
          setPopularPosts(popular);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [boardId, settings]);

  const formatDate = (ts: any) =>
    ts?.toDate
      ? new Intl.DateTimeFormat('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' }).format(ts.toDate())
      : '방금 전';

  const likeName = settings?.likeName || '대봉황';
  const popularBoardId = settings?.popularBoardId || 'juksil';
  const isPopularBoard = boardId === popularBoardId;
  const canWrite = boardSettings?.allowUserPost ?? false;
  const hasPrefixes = boardSettings?.prefixes && boardSettings.prefixes.length > 0;

  // 인기글 ID 세트 (배지 표시용)
  const popularPostIds = new Set(popularPosts.map(p => p.id));

  // 탭 필터링
  const filteredPosts = (() => {
    if (selectedTab === '인기글') return popularPosts;
    if (selectedTab === '전체') return posts;
    return posts.filter(p => p.prefix === selectedTab);
  })();

  // 전체 탭: 상위 3 인기글을 맨 위에 고정 (인기게시판 제외)
  const pinnedPopular = (selectedTab === '전체' && !isPopularBoard) ? popularPosts.slice(0, 3) : [];
  const pinnedIds = new Set(pinnedPopular.map(p => p.id));
  const regularPosts = selectedTab === '전체' ? filteredPosts.filter(p => !pinnedIds.has(p.id)) : filteredPosts;

  const renderPostRow = (post: Post, isPinned = false) => (
    <li
      key={(isPinned ? 'pinned-' : '') + (post.id || post.postId)}
      className={`board-post-item${isPinned ? ' is-popular-pinned' : ''}`}
    >
      <span className="col-id">
        {isPinned ? <span className="popular-badge">🐦</span> : post.postId}
      </span>
      <Link
        to={`/${boardId}/${post.postId}`}
        className="col-title post-link"
      >
        {post.prefix && <span className="post-prefix">{post.prefix}</span>}
        {!isPinned && popularPostIds.has(post.id!) && (
          <span className="popular-badge" title="인기글">🐦</span>
        )}
        {post.title}
        {isPopularBoard && ((post as any).originBoardId || post.boardId) && (
          <span className="origin-board-badge">
            {boards.find(b => b.id === ((post as any).originBoardId || post.boardId))?.name || (post as any).originBoardId || post.boardId}
          </span>
        )}
        {post.commentCount > 0 && (
          <span className="comment-count">[{post.commentCount}]</span>
        )}
      </Link>
      <span className="col-author">{post.authorName}</span>
      <span className="col-time">{formatDate(post.createdAt)}</span>
      <span className="col-views">{post.views}</span>
      <span className="col-likes">{post.likes}</span>
    </li>
  );

  if (boardMetaLoaded && !boardSettings) {
    return <NotFound />;
  }

  return (
    <div className="board-container">
      {boardSettings?.headerInfo && (
        <div className="board-notice glass-panel" dangerouslySetInnerHTML={{ __html: boardSettings.headerInfo }} />
      )}

      <div className="board-header">
        <h1 className="page-title">{boardSettings?.name || boardName}</h1>
        {!isPopularBoard && (canWrite || profile?.role === 'admin') && (
          <Link to={`/${boardId}/write`} className="btn btn-primary">
            <PenLine size={18} style={{ marginRight: '0.5rem' }} />
            글쓰기
          </Link>
        )}
      </div>

      {/* 탭: 전체 | [말머리] | 🐦 인기글 */}
      {!isPopularBoard && (
        <div className="board-category-tabs">
          <button
            className={`category-tab ${selectedTab === '전체' ? 'active' : ''}`}
            onClick={() => setSelectedTab('전체')}
          >
            전체
          </button>
          {hasPrefixes && boardSettings!.prefixes.map(p => (
            <button
              key={p}
              className={`category-tab ${selectedTab === p ? 'active' : ''}`}
              onClick={() => setSelectedTab(p)}
            >
              {p}
            </button>
          ))}
          {popularPosts.length > 0 && (
            <button
              className={`category-tab ${selectedTab === '인기글' ? 'active' : ''}`}
              onClick={() => setSelectedTab('인기글')}
            >
              🐦 인기글
            </button>
          )}
        </div>
      )}

      <div className="glass-panel board-content">
        <div className="post-list-header">
          <span className="col-id">번호</span>
          <span className="col-title">제목</span>
          <span className="col-author">작성자</span>
          <span className="col-time">작성일</span>
          <span className="col-views">조회수</span>
          <span className="col-likes">{likeName}</span>
        </div>

        {loading ? (
          <div className="empty-state">게시글을 불러오는 중입니다...</div>
        ) : filteredPosts.length === 0 && pinnedPopular.length === 0 ? (
          <div className="empty-state">아직 작성된 글이 없습니다.</div>
        ) : (
          <ul className="board-post-list">
            {pinnedPopular.map(post => renderPostRow(post, true))}
            {regularPosts.map(post => renderPostRow(post, false))}
          </ul>
        )}
      </div>

      {boardSettings?.footerInfo && (
        <div className="board-notice glass-panel" dangerouslySetInnerHTML={{ __html: boardSettings.footerInfo }} />
      )}
    </div>
  );
};

export default Board;
