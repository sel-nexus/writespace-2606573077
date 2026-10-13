/** Exercise route policy, forms, menus and App with real browser-local domain helpers. */
import { it, expect, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import App from '../App.jsx';
import Login from '../pages/Login.jsx';
import Register from '../pages/Register.jsx';
import { AuthenticatedNavbar } from '../components/AuthenticatedNavbar.jsx';
import { GuestOnly, RequireAuth, RequireAdmin, canAccessRoute } from '../components/RouteGuards.jsx';
import { login } from '../utils/auth.js';
import { getSession, SESSION_KEY } from '../utils/session.js';
import { listUsers, USERS_KEY } from '../utils/users.js';
import { writeJson } from '../utils/storage.js';
const user = { userId: 'u1', username: 'avery', displayName: 'Avery', role: 'user' };
const admin = { userId: 'admin', username: 'admin', displayName: 'Admin', role: 'admin' };
const future = { v7_startTransition: true, v7_relativeSplatPath: true };
/** Show the current destination for redirect assertions. @returns {JSX.Element} */
function Location() {
  const location = useLocation();
  return (
    <p>Location: {location.pathname}</p>
  );
}
/** Render forms or navigation under a test-only router. @param {JSX.Element} element @returns {object} */
function inRouter(element) {
  return render(
    <MemoryRouter future={future}>
      {element}
      <Location />
    </MemoryRouter>
  );
}
/** Fill all public signup fields through their labels. @param {object} actor @param {object} overrides @returns {Promise<void>} */
async function fillSignup(actor, overrides = {}) {
  const values = { 'Display name': 'Avery', Username: 'avery', Password: 'demo', 'Confirm password': 'demo', ...overrides };
  for (const [label, value] of Object.entries(values)) if (value) await actor.type(screen.getByLabelText(label), value);
}
const paths = ['/', '/login', '/register', '/blogs', '/blog/p1', '/write', '/edit/p1', '/admin', '/users', '/unknown'];
it.each(paths)('evaluates guest/user/admin access matrix for %s', (path) => {
  const guest = ['/', '/login', '/register'].includes(path);
  const normal = ['/', '/blogs', '/blog/p1', '/write', '/edit/p1'].includes(path);
  const elevated = normal || ['/admin', '/users'].includes(path);
  expect(canAccessRoute(path, null)).toBe(guest);
  expect(canAccessRoute(path, user)).toBe(normal);
  expect(canAccessRoute(path, admin)).toBe(elevated);
  expect(canAccessRoute(path, { role: 'admin' })).toBe(guest);
});
it.each([
  [GuestOnly, null, true, '/gate'], [GuestOnly, user, false, '/blogs'], [GuestOnly, admin, false, '/admin'],
  [RequireAuth, null, false, '/login'], [RequireAuth, user, true, '/gate'], [RequireAuth, admin, true, '/gate'],
  [RequireAdmin, null, false, '/login'], [RequireAdmin, user, false, '/blogs'], [RequireAdmin, admin, true, '/gate']
])('renders or redirects guard %s for %j', (Guard, session, allowed, destination) => {
  render(
    <MemoryRouter initialEntries={['/gate']} future={future}>
      <Routes>
        <Route path="/gate" element={
          <Guard session={session}>
            <h1>Protected child</h1>
          </Guard>
        } />
        <Route path="*" element={<Location />} />
      </Routes>
      <Location />
    </MemoryRouter>
  );
  expect(Boolean(screen.queryByRole('heading', { name: 'Protected child' }))).toBe(allowed);
  expect(screen.getAllByText(`Location: ${destination}`).length).toBeGreaterThan(0);
});
it.each(['Display name', 'Username', 'Password', 'Confirm password'])('focuses each missing registration field: %s', async (label) => {
  inRouter(
    <Register onSessionChange={vi.fn()} />
  );
  const actor = userEvent.setup();
  await fillSignup(actor, { [label]: '' });
  await actor.click(screen.getByRole('button', { name: 'Create account' }));
  expect(screen.getByLabelText(label)).toHaveFocus();
  expect(screen.getByLabelText(label)).toHaveAccessibleDescription(`${label} is required.`);
  expect(listUsers().value).toEqual([]); expect(getSession().value).toBeNull();
});
it('shows mismatch on confirmation and retains other entered values', async () => {
  inRouter(
    <Register onSessionChange={vi.fn()} />
  );
  const actor = userEvent.setup(); await fillSignup(actor, { 'Confirm password': 'other' });
  await actor.click(screen.getByRole('button', { name: 'Create account' }));
  expect(screen.getByLabelText('Confirm password')).toHaveFocus();
  expect(screen.getByRole('alert')).toHaveTextContent('Passwords do not match.');
  expect(screen.getByLabelText('Display name')).toHaveValue('Avery'); expect(listUsers().value).toEqual([]);
});
it.each(['reserved', 'duplicate'])('focuses username for %s registration rejection', async (mode) => {
  if (mode === 'duplicate') writeJson(USERS_KEY, [{ id: 'u1', displayName: 'Avery', username: 'AVERY', password: 'demo', role: 'user', createdAt: '2026-01-01T00:00:00Z' }]);
  inRouter(
    <Register onSessionChange={vi.fn()} />
  );
  const actor = userEvent.setup(); await fillSignup(actor, { Username: mode === 'reserved' ? 'ADMIN' : 'avery' });
  await actor.click(screen.getByRole('button', { name: 'Create account' }));
  expect(screen.getByLabelText('Username')).toHaveFocus();
  expect(screen.getByRole('alert')).toHaveTextContent(mode === 'reserved' ? 'The admin username is reserved.' : 'That username is already in use.');
  expect(getSession().value).toBeNull();
});
it('registers through App and renders real role and name at the user home', async () => {
  window.history.replaceState({}, '', '/register'); render(
    <App />
  );
  const actor = userEvent.setup(); await fillSignup(actor);
  await actor.click(screen.getByRole('button', { name: 'Create account' }));
  expect(screen.getByRole('heading', { name: 'Hello, Avery.' })).toBeInTheDocument();
  expect(screen.getByText('Signed-in role').nextSibling).toHaveTextContent('user');
  expect(window.location.pathname).toBe('/blogs'); expect(getSession().value.role).toBe('user');
  expect(listUsers().value).toHaveLength(1);
});
it.each(['account', 'session', 'corrupt', 'uuid'])('keeps registration screen usable after %s failure', async (mode) => {
  const onSessionChange = vi.fn();
  inRouter(
    <Register onSessionChange={onSessionChange} />
  );
  if (mode === 'corrupt') window.localStorage.setItem(USERS_KEY, '!');
  if (mode === 'uuid') vi.spyOn(globalThis.crypto, 'randomUUID').mockImplementation(() => { throw new Error('no'); });
  if (['account', 'session'].includes(mode)) {
    const original = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (key === (mode === 'account' ? USERS_KEY : SESSION_KEY)) throw new Error('quota');
      return original.call(this, key, value);
    });
  }
  const actor = userEvent.setup(); await fillSignup(actor);
  await actor.click(screen.getByRole('button', { name: 'Create account' }));
  expect(screen.getByRole('alert')).toBeInTheDocument(); expect(onSessionChange).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Username')).toHaveValue('avery');
  expect(screen.getByText('Location: /')).toBeInTheDocument(); expect(getSession().value).toBeNull();
  if (mode === 'session') {
    expect(screen.getByRole('alert')).toHaveTextContent('Your account was saved'); expect(listUsers().value).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
  } else if (mode !== 'corrupt') expect(listUsers().value).toEqual([]);
});
it.each(['Username', 'Password'])('focuses missing login field %s', async (label) => {
  inRouter(
    <Login onSessionChange={vi.fn()} />
  );
  const actor = userEvent.setup();
  await actor.type(screen.getByLabelText(label === 'Username' ? 'Password' : 'Username'), 'admin');
  await actor.click(screen.getByRole('button', { name: 'Sign in' }));
  expect(screen.getByLabelText(label)).toHaveFocus(); expect(getSession().value).toBeNull();
});
it('shows exact invalid credentials feedback without creating a session', async () => {
  inRouter(
    <Login onSessionChange={vi.fn()} />
  );
  const actor = userEvent.setup(); await actor.type(screen.getByLabelText('Username'), 'unknown');
  await actor.type(screen.getByLabelText('Password'), 'demo'); await actor.click(screen.getByRole('button', { name: 'Sign in' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Invalid username or password.'); expect(getSession().value).toBeNull();
});
it('signs in fixed admin through App then logs out to the public entry', async () => {
  render(
    <App />
  );
  const actor = userEvent.setup();
  await actor.type(screen.getByLabelText('Username'), 'ADMIN'); await actor.type(screen.getByLabelText('Password'), 'admin');
  await actor.click(screen.getByRole('button', { name: 'Sign in' }));
  expect(screen.getByRole('heading', { name: 'Hello, Admin.' })).toBeInTheDocument(); expect(window.location.pathname).toBe('/admin');
  await actor.click(screen.getByRole('button', { name: /Admin/ })); await actor.click(screen.getByRole('button', { name: 'Log out' }));
  expect(getSession().value).toBeNull(); expect(window.location.pathname).toBe('/');
  expect(screen.getByRole('heading', { name: 'Welcome back.' })).toBeInTheDocument();
});
it.each(['corrupt', 'unavailable'])('shows login account-read %s failure without navigation', async (mode) => {
  const changed = vi.fn();
  inRouter(
    <Login onSessionChange={changed} />
  );
  if (mode === 'corrupt') window.localStorage.setItem(USERS_KEY, '!');
  else vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
  const actor = userEvent.setup();
  await actor.type(screen.getByLabelText('Username'), 'avery');
  await actor.type(screen.getByLabelText('Password'), 'demo');
  await actor.click(screen.getByRole('button', { name: 'Sign in' }));
  expect(screen.getByRole('alert')).toHaveTextContent(mode === 'corrupt' ? 'unreadable' : 'unavailable');
  expect(changed).not.toHaveBeenCalled();
  expect(screen.getByText('Location: /')).toBeInTheDocument();
  vi.restoreAllMocks();
  expect(getSession().value).toBeNull();
});
it('signs a stored user in through the real form and routes by role', async () => {
  writeJson(USERS_KEY, [{ id: 'u1', username: 'avery', displayName: 'Avery', password: 'demo', role: 'user', createdAt: '2026-01-01T00:00:00Z' }]);
  const changed = vi.fn();
  inRouter(
    <Login onSessionChange={changed} />
  );
  const actor = userEvent.setup();
  await actor.type(screen.getByLabelText('Username'), 'AVERY');
  await actor.type(screen.getByLabelText('Password'), 'demo');
  await actor.click(screen.getByRole('button', { name: 'Sign in' }));
  expect(getSession().value).toEqual(user);
  expect(changed).toHaveBeenCalledWith(user);
  expect(screen.getByText('Location: /blogs')).toBeInTheDocument();
});
it('keeps login on screen after a session write failure', async () => {
  const changed = vi.fn(); inRouter(
    <Login onSessionChange={changed} />
  );
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
  const actor = userEvent.setup(); await actor.type(screen.getByLabelText('Username'), 'admin');
  await actor.type(screen.getByLabelText('Password'), 'admin'); await actor.click(screen.getByRole('button', { name: 'Sign in' }));
  expect(screen.getByRole('alert')).toHaveTextContent('could not be saved'); expect(changed).not.toHaveBeenCalled();
  expect(screen.getByText('Location: /')).toBeInTheDocument(); expect(getSession().value).toBeNull();
});
it.each([user, admin])('offers only available role links and closes mobile/account disclosures for %j', async (session) => {
  const { rerender } = inRouter(
    <AuthenticatedNavbar session={session} onSessionChange={vi.fn()} />
  );
  expect(screen.queryByRole('link', { name: 'Blogs' })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Users' })).not.toBeInTheDocument();
  rerender(
    <MemoryRouter future={future}>
      <AuthenticatedNavbar session={session} onSessionChange={vi.fn()} availableFeatures={['reading', 'writing', 'admin']} />
      <Location />
    </MemoryRouter>
  );
  expect(screen.getByRole('link', { name: 'Blogs' })).toHaveAttribute('href', '/blogs');
  expect(screen.getByRole('link', { name: 'Write' })).toHaveAttribute('href', '/write');
  expect(Boolean(screen.queryByRole('link', { name: 'Users' }))).toBe(session.role === 'admin');
  const actor = userEvent.setup();
  await actor.click(screen.getByRole('button', { name: 'Open menu' }));
  expect(screen.getByRole('button', { name: 'Close menu' })).toHaveAttribute('aria-expanded', 'true');
  await actor.click(screen.getByRole('button', { name: 'Close menu' }));
  expect(screen.getByRole('button', { name: 'Open menu' })).toHaveAttribute('aria-expanded', 'false');
  await actor.click(screen.getByRole('button', { name: 'Open menu' }));
  await actor.click(screen.getByRole('button', { name: new RegExp(session.displayName) }));
  await actor.keyboard('{Escape}'); expect(screen.queryByRole('button', { name: 'Log out' })).not.toBeInTheDocument();
  await actor.click(screen.getByRole('button', { name: new RegExp(session.displayName) }));
  await actor.click(screen.getByRole('link', { name: 'Blogs' }));
  expect(screen.getByText('Location: /blogs')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Blogs' })).toHaveAttribute('aria-current', 'page');
  expect(screen.queryByRole('button', { name: 'Log out' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Open menu' })).toHaveAttribute('aria-expanded', 'false');
});
it('shows logout denial in the open menu and retains session and route', async () => {
  login({ username: 'admin', password: 'admin' }); const changed = vi.fn();
  inRouter(
    <AuthenticatedNavbar session={admin} onSessionChange={changed} />
  );
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('denied'); });
  const actor = userEvent.setup(); await actor.click(screen.getByRole('button', { name: /Admin/ }));
  await actor.click(screen.getByRole('button', { name: 'Log out' }));
  expect(screen.getByRole('alert')).toHaveTextContent('could not be removed'); expect(changed).not.toHaveBeenCalled();
  expect(getSession().value).toEqual(admin); expect(screen.getByText('Location: /')).toBeInTheDocument();
  vi.restoreAllMocks(); await actor.click(screen.getByRole('button', { name: 'Log out' }));
  expect(getSession().value).toBeNull(); expect(changed).toHaveBeenCalledWith(null);
});
it.each(['/blogs', '/blog/example', '/write', '/edit/example', '/admin', '/users'])('App redirects guest entry %s to login', (path) => {
  window.history.replaceState({}, '', path); render(
    <App />
  );
  expect(window.location.pathname).toBe('/login'); expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
});
it.each(['/login', '/register', '/admin', '/users', '/unknown', '/write', '/blog/example', '/edit/example'])('restores user session and redirects unavailable/forbidden destination %s', (path) => {
  writeJson(SESSION_KEY, user); window.history.replaceState({}, '', path); render(
    <App />
  );
  expect(window.location.pathname).toBe('/blogs'); expect(screen.getByRole('heading', { name: 'Hello, Avery.' })).toBeInTheDocument();
});
it.each(['/login', '/register', '/users'])('restores admin and redirects %s to role home', (path) => {
  writeJson(SESSION_KEY, admin); window.history.replaceState({}, '', path); render(
    <App />
  );
  expect(window.location.pathname).toBe('/admin'); expect(screen.getByText('Signed-in role').nextSibling).toHaveTextContent('admin');
});
it('keeps root public for both roles and restores session after remount', () => {
  for (const session of [user, admin]) {
    writeJson(SESSION_KEY, session); window.history.replaceState({}, '', '/'); render(
      <App />
    );
    expect(window.location.pathname).toBe('/'); expect(screen.getByRole('heading', { name: `Hello, ${session.displayName}.` })).toBeInTheDocument();
    cleanup();
  }
});
it.each(['corrupt', 'unavailable'])('renders safe guest fallback with a warning for %s session storage', (mode) => {
  if (mode === 'corrupt') window.localStorage.setItem(SESSION_KEY, '!');
  else vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
  render(
    <App />
  );
  expect(screen.getByRole('status')).toBeInTheDocument(); expect(screen.getByRole('heading', { name: 'Welcome back.' })).toBeInTheDocument();
});
