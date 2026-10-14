/** Compose available features with one router and a persisted session snapshot. */
import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Landing from './pages/Landing.jsx';
import { PublicNavbar } from './components/PublicNavbar.jsx';
import { Footer } from './components/Footer.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Blogs from './pages/Blogs.jsx';
import BlogDetail from './pages/BlogDetail.jsx';
import WriteBlog from './pages/WriteBlog.jsx';
import EditBlog from './pages/EditBlog.jsx';
import { GuestOnly, RequireAuth, RequireAdmin } from './components/RouteGuards.jsx';
import { AuthenticatedNavbar } from './components/AuthenticatedNavbar.jsx';
import { Alert } from './components/Alert.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import Users from './pages/Users.jsx';
import { sessionType } from './components/ui.js';
import { getSession } from './utils/session.js';
import { roleHome } from './utils/auth.js';
import { applyRootTheme, readTheme, setThemePreference } from './utils/theme.js';

/** Select navigation inside the single router; root remains public for signed-in roles. @param {object} props @returns {JSX.Element} */
function RouteNavbar({ session, onSessionChange, theme, onToggle }) {
  const { pathname } = useLocation();
  return session && pathname !== '/' ? (
    <AuthenticatedNavbar
      session={session}
      onSessionChange={onSessionChange}
      availableFeatures={['reading', 'writing', 'admin']}
      theme={theme}
      onToggle={onToggle}
    />
  ) : (
    <PublicNavbar session={session} theme={theme} onToggle={onToggle} />
  );
}
RouteNavbar.propTypes = {
  session: sessionType,
  onSessionChange: PropTypes.func.isRequired,
  theme: PropTypes.oneOf(['light', 'dark']).isRequired,
  onToggle: PropTypes.func.isRequired
};

/** Keep the initial storage warning visible while allowing recovery through forms. @returns {JSX.Element} */
export default function App() {
  const [bootstrap] = useState(() => getSession());
  const [session, setSession] = useState(bootstrap.ok ? bootstrap.value : null);
  const [warning, setWarning] = useState(bootstrap.ok ? '' : bootstrap.error.message);
  const [theme, setTheme] = useState(readTheme);
  useEffect(() => {
    applyRootTheme(theme);
  }, [theme]);
  /** Select appearance only on activation; failed persistence keeps memory intact. @returns {void} */
  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    setThemePreference(next);
  }
  /** Update memory only after the calling action has succeeded. @param {import('./utils/validation.js').Session|null} value @returns {void} */
  function sessionChanged(value) { setSession(value); setWarning(''); }
  return (
    <BrowserRouter future={{ v7_relativeSplatPath: true }}>
      <div className="min-h-screen bg-background font-sans text-foreground dark:bg-slate-950 dark:text-slate-100">
        <a
          href="#main"
          className="sr-only rounded bg-surface p-3 focus:not-sr-only focus:absolute focus:z-20 dark:bg-slate-800 dark:text-slate-100"
        >
          Skip to content
        </a>
        <RouteNavbar
          session={session}
          onSessionChange={sessionChanged}
          theme={theme}
          onToggle={toggleTheme}
        />
        <main id="main">
          {warning && (
            <div className="mx-auto max-w-5xl px-5 pt-6">
              <Alert variant="warning" message={warning} />
            </div>
          )}
          <Routes>
            <Route path="/" element={<Landing session={session} />} />
            <Route path="/login" element={
              <GuestOnly session={session}>
                <Login onSessionChange={sessionChanged} />
              </GuestOnly>
            } />
            <Route path="/register" element={
              <GuestOnly session={session}>
                <Register onSessionChange={sessionChanged} />
              </GuestOnly>
            } />
            <Route path="/blogs" element={
              <RequireAuth session={session}>
                {session && <Blogs session={session} />}
              </RequireAuth>
            } />
            <Route path="/admin" element={
              <RequireAdmin session={session}>
                {session && <AdminDashboard session={session} />}
              </RequireAdmin>
            } />
            <Route path="/users" element={
              <RequireAdmin session={session}>
                {session && <Users session={session} />}
              </RequireAdmin>
            } />
            <Route path="/blog/:id" element={
              <RequireAuth session={session}>
                {session && <BlogDetail session={session} />}
              </RequireAuth>
            } />
            <Route path="/write" element={
              <RequireAuth session={session}>
                {session && <WriteBlog session={session} />}
              </RequireAuth>
            } />
            <Route path="/edit/:id" element={
              <RequireAuth session={session}>
                {session && <EditBlog session={session} />}
              </RequireAuth>
            } />
            <Route path="*" element={<Navigate to={roleHome(session)} replace />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  );
}
