import React from 'react';
import { Link } from 'react-router-dom';
import useThemeStore from '../../store/useThemeStore';
import useAuthStore from '../../store/useAuthStore';
import useSettingsStore from '../../store/useSettingsStore';
import { Moon, Sun, Menu, User, ShoppingBag, Settings } from 'lucide-react';
import './Navbar.css';

const Navbar: React.FC = () => {
  const { isDark, toggleTheme } = useThemeStore();
  const { profile } = useAuthStore();
  const { settings } = useSettingsStore();

  const logoUrl = settings?.logoUrl || null;

  return (
    <nav className="navbar glass">
      <div className="container navbar-content">
        <Link to="/" className="navbar-logo">
          {logoUrl ? (
            <img src={logoUrl} alt="로고" className="logo-img" style={{ maxHeight: '2rem' }} />
          ) : (
            <span className="logo-text">{settings?.siteTitle || '봉황스페이스'}</span>
          )}
        </Link>
        <div className="navbar-actions">
          <button onClick={toggleTheme} className="icon-button" aria-label="Toggle Theme">
            {isDark ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <Link to="/market" className="icon-button" aria-label="Market">
            <ShoppingBag size={20} />
          </Link>
          {profile?.role === 'admin' && (
            <Link to="/admin" className="icon-button" aria-label="Admin">
              <Settings size={20} />
            </Link>
          )}
          <Link to={profile ? "/profile" : "/login"} className="icon-button" aria-label="Profile/Login">
            <User size={20} />
          </Link>
          <button className="icon-button mobile-menu" aria-label="Menu">
            <Menu size={20} />
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
