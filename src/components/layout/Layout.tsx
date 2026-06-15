import React, { useEffect } from 'react';
import { Outlet, Link } from 'react-router-dom';
import Navbar from './Navbar';
import useThemeStore from '../../store/useThemeStore';
import useSettingsStore from '../../store/useSettingsStore';
import HelmetManager from '../common/HelmetManager';

const Layout: React.FC = () => {
  const { isDark } = useThemeStore();
  const { footerDocs, loadSettings } = useSettingsStore();

  useEffect(() => {
    if (isDark) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, [isDark]);

  useEffect(() => {
    loadSettings();
  }, []);

  return (
    <div className="page-wrapper">
      <HelmetManager />
      <Navbar />
      <main className="container" style={{ flex: 1, padding: '2rem 1.5rem', width: '100%' }}>
        <Outlet />
      </main>
      <footer style={{ padding: '3rem 2rem', textAlign: 'center', color: 'var(--color-text-muted)', borderTop: '1px solid var(--color-border)', marginTop: 'auto' }}>
        <div className="container">
          <p>&copy; {new Date().getFullYear()} 봉황스페이스. All rights reserved.</p>
          {footerDocs.length > 0 && (
            <div style={{ marginTop: '1rem', display: 'flex', gap: '1.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              {footerDocs.map(d => (
                <Link key={d.id} to={`/page/${d.slug}`} style={{ color: 'var(--color-text-muted)', textDecoration: 'none' }}>{d.title}</Link>
              ))}
            </div>
          )}
        </div>
      </footer>
    </div>
  );
};

export default Layout;
