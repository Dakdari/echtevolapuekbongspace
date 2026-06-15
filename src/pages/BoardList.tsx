import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getBoards } from '../lib/api';
import type { Board as BoardType } from '../lib/api';
import { getSiteSettings } from '../lib/adminApi';
import type { SiteSettings } from '../lib/adminApi';
import './BoardList.css';

const BoardList: React.FC = () => {
  const [boards, setBoards] = useState<BoardType[]>([]);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [fetchedBoards, fetchedSettings] = await Promise.all([
          getBoards(),
          getSiteSettings().catch(() => null)
        ]);
        if (fetchedBoards.length > 0) {
          setBoards(fetchedBoards);
        } else {
          setBoards([
            { id: 'free', name: '자유게시판', description: '자유롭게 이야기를 나누는 공간입니다.', type: 'normal' },
            { id: 'qna', name: '질문게시판', description: '궁금한 점을 질문하고 답변을 받아보세요.', type: 'normal' },
            { id: 'info', name: '정보게시판', description: '유용한 정보를 공유하는 게시판입니다.', type: 'normal' },
            { id: 'anon', name: '완전익명게시판', description: '누구도 작성자를 알 수 없는 비밀스러운 공간.', type: 'anon' },
            { id: 'juksil', name: '죽실', description: `${fetchedSettings?.likeName || '대봉황'}(추천)을 많이 받은 인기 게시글이 모이는 곳입니다.`, type: 'popular' },
          ]);
        }
        setSettings(fetchedSettings);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div className="board-list-container"><p style={{ textAlign: 'center' }}>게시판을 불러오는 중입니다...</p></div>;

  return (
    <div className="board-list-container">
      <h1 className="page-title">게시판 목록</h1>
      <div className="boards-grid">
        {boards.map((board) => (
          <Link to={`/${board.id}`} key={board.id} className="board-card glass-panel">
            <h2 className="board-name">{board.name}</h2>
            <p className="board-desc">{board.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default BoardList;
