import React from 'react';
import { Link } from 'react-router-dom';

const NotFound: React.FC = () => (
  <div style={{ textAlign: 'center', marginTop: '5rem' }}>
    <h2>404 - Page Not Found</h2>
    <p style={{ color: 'var(--color-text-secondary)', marginTop: '0.5rem' }}>
      요청하신 페이지를 찾을 수 없습니다.
    </p>
    <Link to="/" className="btn btn-secondary" style={{ display: 'inline-block', marginTop: '1.5rem' }}>
      홈으로
    </Link>
  </div>
);

export default NotFound;
