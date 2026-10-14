/** Show enabled role destinations with independent theme, mobile, and account controls. */
import { useState } from 'react';
import PropTypes from 'prop-types';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Avatar } from './Avatar.jsx';
import { ThemeToggle } from './ThemeToggle.jsx';
import { Alert } from './Alert.jsx';
import { ui, sessionType } from './ui.js';
import { logout } from '../utils/auth.js';
const routeLinks = [
  { feature: 'reading', to: '/blogs', label: 'Blogs' },
  { feature: 'writing', to: '/write', label: 'Write' },
  { feature: 'admin', to: '/admin', label: 'Dashboard', admin: true },
  { feature: 'admin', to: '/users', label: 'Users', admin: true }
];

/** Render enabled destinations and forward explicit theme activation to the root. @param {object} props @returns {JSX.Element} */
export function AuthenticatedNavbar({ session, onSessionChange, availableFeatures = [], theme = 'light', onToggle }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const links = routeLinks.filter((link) => availableFeatures.includes(link.feature) && (!link.admin || session.role === 'admin'));
  /** Close disclosures after navigation without changing appearance. @returns {void} */
  function closeMenus() { setMobileOpen(false); setAccountOpen(false); }
  /** Retain identity and location when storage removal fails; never touch theme. @returns {void} */
  function handleLogout() {
    const result = logout();
    if (!result.ok) { setError(result.error.message); return; }
    onSessionChange(null);
    closeMenus();
    navigate('/');
  }
  return (
    <header className="border-b border-border bg-surface dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
      <nav aria-label="Account navigation" className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-5 py-4">
        <Link to="/" onClick={closeMenus} className={`mr-auto font-display text-2xl font-bold ${ui.focus} dark:focus-visible:ring-primary-400 dark:focus-visible:ring-offset-slate-900`}>
          WriteSpace
          <span className="text-primary-600 dark:text-primary-400">.</span>
        </Link>
        <ThemeToggle theme={theme} onToggle={onToggle} />
        <button
          type="button"
          aria-expanded={mobileOpen}
          aria-controls="account-navigation"
          onClick={() => setMobileOpen(!mobileOpen)}
          className={`min-h-11 rounded-control px-3 sm:hidden ${ui.focus} dark:hover:bg-slate-800 dark:focus-visible:ring-primary-400 dark:focus-visible:ring-offset-slate-900`}
        >
          {mobileOpen ? 'Close menu' : 'Open menu'}
        </button>
        <div
          id="account-navigation"
          className={`${mobileOpen ? 'flex' : 'hidden'} order-last w-full flex-col gap-3 sm:order-none sm:flex sm:w-auto sm:flex-row`}
        >
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={closeMenus}
              className={({ isActive }) => `${ui.focus} dark:focus-visible:ring-primary-400 dark:focus-visible:ring-offset-slate-900 rounded-full px-4 py-3 ${
                isActive
                  ? 'bg-surface-raised text-primary-800 dark:bg-slate-800 dark:text-primary-200'
                  : 'text-foreground-muted dark:text-slate-300 dark:hover:text-primary-300'
              }`}
            >
              {link.label}
            </NavLink>
          ))}
        </div>
        <div className="relative">
          <button
            type="button"
            aria-expanded={accountOpen}
            aria-controls="account-actions"
            onClick={() => setAccountOpen(!accountOpen)}
            onKeyDown={(event) => { if (event.key === 'Escape') setAccountOpen(false); }}
            className={`flex min-h-11 items-center gap-2 rounded-full ${ui.focus} dark:focus-visible:ring-primary-400 dark:focus-visible:ring-offset-slate-900`}
          >
            <Avatar role={session.role} />
            <span className="max-w-40 truncate text-sm font-semibold">{session.displayName}</span>
          </button>
          {accountOpen && (
            <div
              id="account-actions"
              onKeyDown={(event) => { if (event.key === 'Escape') setAccountOpen(false); }}
              className="absolute left-0 z-10 mt-3 w-64 space-y-3 rounded-card border border-border bg-surface p-4 shadow-focal sm:left-auto sm:right-0 dark:border-slate-700 dark:bg-slate-900"
            >
              <p className="text-sm text-foreground-muted dark:text-slate-300">Signed in as {session.role}</p>
              <button type="button" onClick={handleLogout} className={`${ui.button} dark:focus-visible:ring-primary-400 dark:focus-visible:ring-offset-slate-900`}>
                Log out
              </button>
              <Alert message={error} />
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}
AuthenticatedNavbar.propTypes = {
  session: sessionType.isRequired,
  onSessionChange: PropTypes.func.isRequired,
  availableFeatures: PropTypes.arrayOf(PropTypes.oneOf(['reading', 'writing', 'admin'])),
  theme: PropTypes.oneOf(['light', 'dark']),
  onToggle: PropTypes.func
};
