/** Compose the accounts slice with one router and a persisted session snapshot. */
import { useState } from 'react';
import PropTypes from 'prop-types';
import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
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

/** Keep the initial storage warning visible while allowing recovery through forms. @returns {JSX.Element} */
export default function App() {
  const [bootstrap] = useState(() => getSession());
  const [session, setSession] = useState(bootstrap.ok ? bootstrap.value : null);
  const [warning, setWarning] = useState(bootstrap.ok ? '' : bootstrap.error.message);
  /** Update memory only after the calling action has succeeded. @param {import('./utils/validation.js').Session|null} value @returns {void} */
  function sessionChanged(value) { setSession(value); setWarning(''); }
  const accountHome = (
    <RequireAuth session={session}>
      {session && <AccountHome session={session} />}
    </RequireAuth>
  );
  return (
    <BrowserRouter future={{ v7_relativeSplatPath: true }}>
      <div className="min-h-screen bg-background font-sans text-foreground">
        <a href="#main" className="sr-only rounded bg-surface p-3 focus:not-sr-only focus:absolute focus:z-20">Skip to content</a>
        {session ? (
          <AuthenticatedNavbar session={session} onSessionChange={sessionChanged} availableFeatures={[]} />
        ) : (
          <header className="border-b border-border bg-surface">
            <nav aria-label="Account entry" className="mx-auto flex max-w-6xl flex-wrap items-center gap-5 px-5 py-4">
              <Link to="/" className={`mr-auto font-display text-2xl font-bold ${ui.focus}`}>WriteSpace.</Link>
              <Link to="/login" className={ui.link}>Sign in</Link>
              <Link to="/register" className={ui.link}>Create an account</Link>
            </nav>
          </header>
        )}
        <main id="main">
          {warning && (
            <div className="mx-auto max-w-5xl px-5 pt-6">
              <Alert variant="warning" message={warning} />
            </div>
          )}
          <Routes>
            <Route path="/" element={session ? (
              <AccountHome session={session} />
            ) : (
              <Login onSessionChange={sessionChanged} />
            )} />
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
            <Route path="/blogs" element={accountHome} />
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
                <Navigate to={roleHome(session)} replace />
              </RequireAuth>
            } />
            <Route path="/write" element={
              <RequireAuth session={session}>
                <Navigate to={roleHome(session)} replace />
              </RequireAuth>
            } />
            <Route path="/edit/:id" element={
              <RequireAuth session={session}>
                <Navigate to={roleHome(session)} replace />
              </RequireAuth>
            } />
            <Route path="*" element={<Navigate to={roleHome(session)} replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
