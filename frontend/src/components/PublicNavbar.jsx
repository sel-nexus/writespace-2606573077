/** Public entry remains available on the landing route for every role. */
import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Avatar } from './Avatar.jsx';
import { sessionType, ui } from './ui.js';
import { roleHome } from '../utils/auth.js';
/** Render active links and a stateful responsive disclosure. @param {object} props @returns {JSX.Element} */
export function PublicNavbar({ session = null }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const navClass = ({ isActive }) => `${ui.focus} rounded-full px-4 py-3 ${
    isActive ? 'bg-surface-raised text-primary-800' : 'text-foreground-muted hover:text-primary-700'}`;
  return (
    <header className="border-b border-border bg-surface">
      <nav aria-label="Public navigation" className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-5 py-4">
        <Link to="/" onClick={close} className={`mr-auto font-display text-2xl font-bold ${ui.focus}`}>
          WriteSpace<span className="text-primary-600">.</span>
        </Link>
        <button type="button" aria-expanded={open} aria-controls="public-navigation"
          onClick={() => setOpen(!open)} className={`min-h-11 rounded-control px-3 sm:hidden ${ui.focus}`}>
          {open ? 'Close menu' : 'Open menu'}
        </button>
        <div id="public-navigation" onKeyDown={(event) => { if (event.key === 'Escape') close(); }}
          className={`${open ? 'flex' : 'hidden'} order-last w-full flex-col gap-3 sm:order-none sm:flex sm:w-auto sm:flex-row sm:items-center`}>
          <NavLink to="/" end onClick={close} className={navClass}>Home</NavLink>
          {session ? (
            <>
              <span className="flex items-center gap-2">
                <Avatar role={session.role} />
                <span className="max-w-40 truncate font-semibold">{session.displayName}</span>
              </span>
              <NavLink to={roleHome(session)} onClick={close} className={navClass}>Dashboard</NavLink>
            </>
          ) : (
            <>
              <NavLink to="/login" onClick={close} className={navClass}>Login</NavLink>
              <NavLink to="/register" onClick={close} className={ui.button}>Get Started</NavLink>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
PublicNavbar.propTypes = { session: sessionType };
