import React, { useState, useEffect } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { getFooterDocument } from '../lib/adminApi';
import type { FooterDocument } from '../lib/adminApi';
import './FooterPage.css';

const FooterPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [doc, setDoc] = useState<FooterDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    getFooterDocument(slug).then(d => {
      if (!d) setNotFound(true);
      else setDoc(d);
    }).catch(console.error).finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <div className="footer-page-container glass-panel"><p style={{ textAlign: 'center', padding: '3rem' }}>로딩 중...</p></div>;
  if (notFound) return <Navigate to="/" replace />;

  return (
    <div className="footer-page-container">
      <div className="footer-page-card glass-panel">
        <h1 className="footer-page-title">{doc?.title}</h1>
        <div
          className="footer-page-content ql-editor"
          dangerouslySetInnerHTML={{ __html: doc?.content || '' }}
        />
      </div>
    </div>
  );
};

export default FooterPage;
