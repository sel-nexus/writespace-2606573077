/** Compose available features with one router and a persisted session snapshot. */
import { useState } from 'react';
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
import { Avatar } from './components/Avatar.jsx';
import { ui, sessionType } from './components/ui.js';
import { getSession } from './utils/session.js';
import { roleHome } from './utils/auth.js';

/** Render a real account summary, not an unimplemented feature page. @param {object} props @returns {JSX.Element} */
function AccountHome({ session }) {
  return (
    <section className="mx-auto max-w-3xl space-y-8 px-5 py-16">
      <p className="text-xs font-bold uppercase tracking-[.2em] text-primary-700">Account home</p>
      <h1 className="font-display text-hero tracking-tight">Hello, {session.displayName}.</h1>
      <div className={`${ui.card} space-y-5`}>
        <Avatar role={session.role} />
        <h2 className="font-display text-2xl font-bold">Your browser-local account</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
          <dt className="text-foreground-muted">Username</dt>
          <dd className="break-words font-semibold">{session.username}</dd>
          <dt className="text-foreground-muted">Signed-in role</dt>
          <dd className="font-semibold">{session.role}</dd>
        </dl>
        <p className="text-sm leading-relaxed text-foreground-muted">
          This is a local demo. Your session stays in this browser.
          Use the account menu above to log out.
        </p>
      </div>
    </section>
  );
}
AccountHome.propTypes = { session: sessionType.isRequired };

/** Select navigation inside the single router; root remains public for signed-in roles. @param {object} props @returns {JSX.Element} */
function RouteNavbar({ session, onSessionChange }) {
  const { pathname } = useLocation();
  return session && pathname !== '/' ? (
    <AuthenticatedNavbar session={session} onSessionChange={onSessionChange} availableFeatures={['reading', 'writing']} />
  ) : (
    <PublicNavbar session={session} />
  );
}
RouteNavbar.propTypes = { session: sessionType, onSessionChange: PropTypes.func.isRequired };

/** Keep the initial storage warning visible while allowing recovery through forms. @returns {JSX.Element} */
export default function App() {
  const [bootstrap] = useState(() => getSession());
  const [session, setSession] = useState(bootstrap.ok ? bootstrap.value : null);
  const [warning, setWarning] = useState(bootstrap.ok ? '' : bootstrap.error.message);
  /** Update memory only after the calling action has succeeded. @param {import('./utils/validation.js').Session|null} value @returns {void} */
  function sessionChanged(value) { setSession(value); setWarning(''); }
  return (
    <BrowserRouter future={{ v7_relativeSplatPath: true }}>
      <div className="min-h-screen bg-background font-sans text-foreground">
        <a href="#main" className="sr-only rounded bg-surface p-3 focus:not-sr-only focus:absolute focus:z-20">Skip to content</a>
        <RouteNavbar session={session} onSessionChange={sessionChanged} />
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
                {session && <AccountHome session={session} />}
              </RequireAdmin>
            } />
            <Route path="/users" element={
              <RequireAdmin session={session}>
                <Navigate to={roleHome(session)} replace />
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
