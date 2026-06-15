import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getRecentPosts, getActiveAds, getPopularPosts, getBoards, getBoardRankings, getPostsByBoard } from '../lib/api';
import type { Post, AdBanner, Board } from '../lib/api';
import useSettingsStore from '../store/useSettingsStore';
import './Home.css';

// Admin.tsx에서 정의한 HomeWidget과 동일한 구조
interface HomeWidget {
  id: string;
  type: 'recent' | 'board' | 'market' | 'custom' | 'ranking';
  label: string;
  data?: string;
  content?: string;
}

const Home: React.FC = () => {
  const { settings } = useSettingsStore();
  const [recentPosts, setRecentPosts] = useState<Post[]>([]);
  const [ads, setAds] = useState<AdBanner[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  
  // boardId -> Post[] 맵 (각 게시판 위젯용)
  const [boardPostsMap, setBoardPostsMap] = useState<Record<string, Post[]>>({});
  const [boardRankings, setBoardRankings] = useState<{ board: Board; postCount: number }[]>([]);

  // 랜덤 배너: 광고 목록 중 무작위 1개 선택
  const randomAd = useMemo(() => {
    if (ads.length === 0) return null;
    return ads[Math.floor(Math.random() * ads.length)];
  }, [ads]);

  useEffect(() => {
    Promise.all([
      getRecentPosts(5),
      getActiveAds(),
      getBoards()
    ]).then(([posts, fetchedAds, fetchedBoards]) => {
      setRecentPosts(posts);
      setAds(fetchedAds);
      setBoards(fetchedBoards);
    }).catch(console.error);
  }, []);

  // 위젯 목록 변경 시 각 board 위젯의 데이터를 개별적으로 로드
  useEffect(() => {
    if (!settings || !settings.homeWidgets) return;
    
    // settings.homeWidgets가 아직 마이그레이션 안 된 string[]일 수 있음
    const widgets: any[] = settings.homeWidgets;
    if (widgets.length > 0 && typeof widgets[0] === 'string') {
      const popBoardId = settings.popularBoardId || 'juksil';
      const popThreshold = settings.juksilThreshold || 10;
      if ((widgets as string[]).includes('popular_board')) {
        getPostsByBoard(popBoardId, 5)
          .then(posts => setBoardPostsMap(prev => ({ ...prev, [popBoardId]: posts })))
          .catch(console.error);
      }
    } else {
      // HomeWidget[] 인 경우
      const boardWidgets = (widgets as HomeWidget[]).filter(w => w.type === 'board' && w.data);
      boardWidgets.forEach(w => {
        const boardId = w.data!;
        // 인기게시판(전당)인 경우 popularPosts 로드, 아니면 최신 글 로드
        if (boardId === settings.popularBoardId) {
          getPostsByBoard(boardId, 5)
            .then(posts => setBoardPostsMap(prev => ({ ...prev, [boardId]: posts })))
            .catch(console.error);
        } else {
          // 해당 게시판 최신 글 로드
          getPostsByBoard(boardId, 5)
            .then(posts => setBoardPostsMap(prev => ({ ...prev, [boardId]: posts })))
            .catch(console.error);
        }
      });

      const rankingWidgets = (widgets as HomeWidget[]).filter(w => w.type === 'ranking');
      if (rankingWidgets.length > 0) {
        getBoardRankings()
          .then(setBoardRankings)
          .catch(console.error);
      }
    }
  }, [settings]);

  const boardNames = boards.reduce((acc, b) => {
    acc[b.id] = b.name;
    return acc;
  }, {} as Record<string, string>);

  const renderLegacyHome = () => {
    const homeWidgets = (settings?.homeWidgets || ['notice', 'popular_board', 'recent_posts']) as string[];
    const popularBoardId = settings?.popularBoardId || 'juksil';
    const popularBoardName = boardNames[popularBoardId] || '인기게시판';
    const popularPosts = boardPostsMap[popularBoardId] || [];

    return (
      <>
        {/* 광고 배너: 랜덤 1개 크게 표시 */}
        {homeWidgets.includes('notice') && randomAd && (
          <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
            <a href={randomAd.linkUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-block', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--color-border)', maxWidth: '100%' }}>
              <img src={randomAd.imageUrl} alt={randomAd.title} style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', display: 'block' }} />
            </a>
          </div>
        )}
        <div className="main-content-grid">
          {homeWidgets.includes('recent_posts') && renderRecentPostsWidget('최신 글', '/boards')}
          <aside className="sidebar">
            {homeWidgets.includes('popular_board') && renderBoardWidget(popularBoardName, popularBoardId, popularPosts)}
            <div className="market-preview glass-panel">
              <div className="section-header">
                <h2 className="section-title">{settings?.marketName || '딱지 마켓'}</h2>
                <Link to="/market" className="view-more">이동 &rsaquo;</Link>
              </div>
              {settings?.marketItems && settings.marketItems.length > 0 ? (
                settings.marketItems.slice(0, 3).map(item => (
                  <div key={item.id} className="market-item">
                    <div className="market-item-img" style={{ backgroundImage: `url(${item.imageUrl})`, backgroundSize: 'contain', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}></div>
                    <div className="market-item-info">
                      <strong>{item.name}</strong>
                      <span>{item.price} 오동</span>
                    </div>
                  </div>
                ))
              ) : (
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', textAlign: 'center', padding: '1rem 0' }}>등록된 상품이 없습니다.</p>
              )}
            </div>
          </aside>
        </div>
      </>
    );
  };

  const renderRecentPostsWidget = (title: string, link: string) => (
    <section className="recent-posts-section glass-panel" style={{ width: '100%', marginBottom: '1.5rem' }}>
      <div className="section-header">
        <h2 className="section-title">{title}</h2>
        <Link to={link} className="view-more">더보기 &rsaquo;</Link>
      </div>
      {recentPosts.length === 0 ? (
        <p style={{ padding: '1rem', color: 'var(--color-text-muted)' }}>최신 글이 없습니다.</p>
      ) : (
        <ul className="board-list" style={{ marginTop: '0.5rem' }}>
          {recentPosts.map((post) => {
            const boardName = (boardNames[post.boardId] || '게시판').substring(0, 2);
            return (
              <li key={post.id || post.postId}>
                <Link to={`/${post.boardId}/${post.postId}`} className="board-link" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="post-board-badge" style={{ padding: '0.1rem 0.3rem', fontSize: '0.7rem' }}>{boardName}</span>
                  <span className="home-post-title" style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{post.title}</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>👍 {post.likes}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );

  const renderBoardWidget = (title: string, boardId: string, posts: Post[]) => (
    <div className="popular-boards glass-panel" style={{ width: '100%', marginBottom: '1.5rem' }}>
      <div className="section-header">
        <h2 className="section-title">{boardId === settings?.popularBoardId ? '🏆 ' : ''}{title}</h2>
        <Link to={`/${boardId}`} className="view-more">바로가기 &rsaquo;</Link>
      </div>
      <ul className="board-list" style={{ marginTop: '0.5rem' }}>
        {posts.length === 0 ? (
          <li style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', padding: '0.5rem' }}>게시글이 없습니다.</li>
        ) : (
          posts.map((post, idx) => (
            <li key={post.id || post.postId}>
              <Link to={`/${post.boardId}/${post.postId}`} className="board-link" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {boardId === settings?.popularBoardId && <span className="board-rank">{idx + 1}</span>}
                <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{post.title}</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>👍 {post.likes}</span>
              </Link>
            </li>
          ))
        )}
      </ul>
    </div>
  );

  const renderRankingWidget = (title: string) => (
    <div className="ranking-widget glass-panel" style={{ width: '100%', marginBottom: '1.5rem' }}>
      <div className="section-header">
        <h2 className="section-title">{title}</h2>
        <Link to="/boards" className="view-more">전체 게시판 &rsaquo;</Link>
      </div>
      <ul className="board-list" style={{ marginTop: '0.5rem' }}>
        {boardRankings.length === 0 ? (
          <li style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', padding: '0.5rem' }}>게시판이 없습니다.</li>
        ) : (
          boardRankings.map((item, idx) => (
            <li key={item.board.id}>
              <Link to={`/${item.board.id}`} className="board-link" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="board-rank">{idx + 1}</span>
                <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.board.name}</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>글 {item.postCount}</span>
              </Link>
            </li>
          ))
        )}
      </ul>
    </div>
  );

  const renderMarketWidget = (title: string) => (
    <div className="market-preview glass-panel" style={{ width: '100%', marginBottom: '1.5rem' }}>
      <div className="section-header">
        <h2 className="section-title">{title}</h2>
        <Link to="/market" className="view-more">이동 &rsaquo;</Link>
      </div>
      {settings?.marketItems && settings.marketItems.length > 0 ? (
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          {settings.marketItems.slice(0, 3).map(item => (
            <div key={item.id} className="market-item" style={{ flex: '1 1 100px' }}>
              <div className="market-item-img" style={{ backgroundImage: `url(${item.imageUrl})`, backgroundSize: 'contain', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}></div>
              <div className="market-item-info">
                <strong>{item.name}</strong>
                <span>{item.price} 오동</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', textAlign: 'center', padding: '1rem 0' }}>등록된 상품이 없습니다.</p>
      )}
    </div>
  );

  const renderCustomWidget = (title: string, content: string) => (
    <div className="custom-widget glass-panel" style={{ width: '100%', marginBottom: '1.5rem' }}>
      {title && (
        <div className="section-header">
          <h2 className="section-title">{title}</h2>
        </div>
      )}
      <div className="ql-editor" dangerouslySetInnerHTML={{ __html: content }} />
    </div>
  );

  const renderDynamicHome = (widgets: HomeWidget[]) => {
    // 2단 레이아웃을 위한 분배 (단순히 화면 꽉 차게 렌더링)
    return (
      <div className="dynamic-home-container" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* 광고 배너: 랜덤 1개 크게 표시 */}
        {randomAd && (
          <div style={{ marginBottom: '0.5rem', textAlign: 'center' }}>
            <a href={randomAd.linkUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-block', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--color-border)', maxWidth: '100%', width: '100%' }}>
              <img src={randomAd.imageUrl} alt={randomAd.title} style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', display: 'block' }} />
            </a>
          </div>
        )}
        <div className="dynamic-widgets-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
          {widgets.map(w => {
            switch (w.type) {
              case 'recent':
                return <div key={w.id}>{renderRecentPostsWidget(w.label, '/boards')}</div>;
              case 'board':
                return <div key={w.id}>{renderBoardWidget(w.label, w.data || '', boardPostsMap[w.data || ''] || [])}</div>;
              case 'market':
                return <div key={w.id}>{renderMarketWidget(w.label)}</div>;
              case 'custom':
                return <div key={w.id} style={{ gridColumn: '1 / -1' }}>{renderCustomWidget(w.label, w.content || '')}</div>;
              case 'ranking':
                return <div key={w.id}>{renderRankingWidget(w.label)}</div>;
              default:
                return null;
            }
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="home-container">
      {(!settings?.homeWidgets || settings.homeWidgets.length === 0 || typeof settings.homeWidgets[0] === 'string') 
        ? renderLegacyHome() 
        : renderDynamicHome(settings.homeWidgets as any as HomeWidget[])}
    </div>
  );
};

export default Home;
