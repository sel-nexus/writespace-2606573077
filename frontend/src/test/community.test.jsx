/** Exercise real community screens, local persistence, and every App route. */
import { it, expect, vi } from 'vitest';
import { render, screen, within, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AdminDashboard from '../pages/AdminDashboard.jsx';
import Users from '../pages/Users.jsx';
import App from '../App.jsx';
import { listUsers, USERS_KEY } from '../utils/users.js';
import { listPosts, POSTS_KEY } from '../utils/posts.js';
import { getSession, SESSION_KEY } from '../utils/session.js';
import { writeJson } from '../utils/storage.js';
const admin = { userId: 'admin', username: 'admin', displayName: 'Admin', role: 'admin' };
const user = { userId: '11111111-1111-4111-8111-111111111111', username: 'avery', displayName: 'Avery', role: 'user' };
const record = { id: user.userId, username: 'avery', displayName: 'Avery', password: 'demo', role: 'user', createdAt: '2026-01-01T00:00:00Z' };
const post = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', title: 'Note 1', content: 'Text', authorId: user.userId, authorName: 'Avery', createdAt: '2026-01-01T00:00:00Z' };
/** Render a community screen in a test-only router. @param {JSX.Element} element @returns {object} */
function show(element) {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      {element}
    </MemoryRouter>
  );
}
/** Enter account fields through labels. @param {object} actor @param {object} overrides @returns {Promise<void>} */
async function fill(actor, overrides = {}) {
  const values = { 'Display name': 'Riley', Username: 'riley', Password: 'demo', Role: 'user', ...overrides };
  for (const [label, value] of Object.entries(values)) {
    if (!value) continue;
    if (label === 'Role') await actor.selectOptions(screen.getByLabelText(label), value);
    else await actor.type(screen.getByLabelText(label), value);
  }
}
/** Read exact-label stat values. @param {string} label @returns {HTMLElement} */
function stat(label) { return screen.getByText(label, { exact: true }).nextSibling; }
it('shows four sourced counts, violet/indigo banner, five newest posts, and quick actions', () => {
  writeJson(USERS_KEY, [record, { ...record, id: '33333333-3333-4333-8333-333333333333', username: 'a2', role: 'admin' }]);
  const posts = [1, 6, 3, 2, 5, 4].map((day) => ({ ...post, id: `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa${day}`, title: `Note ${day}`, createdAt: `2026-01-0${day}T00:00:00Z` }));
  writeJson(POSTS_KEY, posts); show(<AdminDashboard session={admin} />);
  expect(stat('Total Posts')).toHaveTextContent('6'); expect(stat('Total Users')).toHaveTextContent('3');
  expect(stat('Total Admins')).toHaveTextContent('2'); expect(stat('Total users')).toHaveTextContent('1');
  expect(screen.getByRole('heading', { name: 'Admin Dashboard' }).parentElement).toHaveClass('from-secondary-800', 'to-primary-800');
  expect(screen.getByText('Registered accounts + built-in admin')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Write New Post' })).toHaveAttribute('href', '/write');
  expect(screen.getByRole('link', { name: 'Manage Users' })).toHaveAttribute('href', '/users');
  const latest = screen.getByRole('region', { name: 'Latest Posts' });
  expect(within(latest).getAllByRole('heading', { level: 3 }).map((node) => node.textContent)).toEqual(['Note 6', 'Note 5', 'Note 4', 'Note 3', 'Note 2']);
  expect(screen.queryByRole('link', { name: 'Note 1' })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Edit post: Note 6' })).toHaveAttribute('href', '/edit/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa6');
  expect(listPosts().value).toHaveLength(6);
});
it.each(['success', 'cancel', 'write', 'corrupt', 'absent', 'read'])('dashboard post deletion handles %s without false success', async (mode) => {
  writeJson(POSTS_KEY, [post]); show(<AdminDashboard session={admin} />);
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(mode !== 'cancel');
  if (mode === 'write') vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
  if (mode === 'corrupt') localStorage.setItem(POSTS_KEY, '!');
  if (mode === 'absent') writeJson(POSTS_KEY, []);
  if (mode === 'read') vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
  await userEvent.setup().click(screen.getByRole('button', { name: 'Delete post: Note 1' }));
  if (mode === 'success') {
    expect(screen.getByRole('status')).toHaveTextContent('Post deleted.'); expect(stat('Total Posts')).toHaveTextContent('0');
    expect(screen.queryByRole('button', { name: 'Delete post: Note 1' })).not.toBeInTheDocument(); expect(listPosts().value).toEqual([]);
  } else {
    expect(screen.getByRole(mode === 'cancel' ? 'status' : 'alert')).toBeInTheDocument();
    expect(screen.queryByText('Post deleted.')).not.toBeInTheDocument(); expect(stat('Total Posts')).toHaveTextContent('1');
    if (['corrupt', 'absent', 'read'].includes(mode)) expect(confirm).not.toHaveBeenCalled();
    if (mode === 'write' || mode === 'cancel') expect(listPosts().value).toEqual([post]);
  }
});
it.each(['empty', 'corrupt', 'denied'])('dashboard renders %s fallback with appropriate warning', (mode) => {
  if (mode === 'corrupt') { localStorage.setItem(POSTS_KEY, '!'); localStorage.setItem(USERS_KEY, '{}'); }
  if (mode === 'denied') vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
  show(<AdminDashboard session={admin} />);
  expect(stat('Total Posts')).toHaveTextContent('0'); expect(stat('Total Users')).toHaveTextContent('1'); expect(stat('Total Admins')).toHaveTextContent('1'); expect(stat('Total users')).toHaveTextContent('0');
  expect(screen.getByText('No posts yet. Be the first to write one!')).toBeInTheDocument();
  if (mode !== 'empty') expect(screen.getAllByRole('status')).toHaveLength(2);
});
it('shows fixed logical admin and complete account metadata in desktop table/mobile cards without persisting it', () => {
  writeJson(USERS_KEY, [record]); show(<Users session={admin} />);
  const table = screen.getByRole('table'); expect(table.parentElement).toHaveClass('hidden', 'sm:block');
  const cards = screen.getByLabelText('Account cards'); expect(cards).toHaveClass('sm:hidden');
  expect(within(table).getAllByRole('columnheader').map((node) => node.textContent)).toEqual(['Account', 'Username', 'Role', 'Created date', 'Action']);
  const card = screen.getByRole('article', { name: 'Account: avery' });
  expect(within(card).getByRole('img', { name: 'User avatar' })).toBeInTheDocument();
  expect(card).toHaveTextContent('Avery'); expect(card).toHaveTextContent('avery'); expect(card).toHaveTextContent('user'); expect(card).toHaveTextContent('Jan 01, 2026');
  expect(screen.getAllByRole('button', { name: 'Delete account: admin' })).toHaveLength(2);
  for (const control of screen.getAllByRole('button', { name: 'Delete account: admin' })) {
    expect(control).toBeDisabled(); expect(control).toHaveAttribute('title', 'Default admin cannot be deleted');
  }
  expect(listUsers().value).toEqual([record]); expect(screen.queryByText('demo')).not.toBeInTheDocument();
});
it.each(['Display name', 'Username', 'Password', 'Role'])('focuses each required account field %s with error association', async (label) => {
  show(<Users session={admin} />); const actor = userEvent.setup(); await fill(actor, { [label]: '' });
  await actor.click(screen.getByRole('button', { name: 'Create account' }));
  expect(screen.getByLabelText(label)).toHaveFocus(); expect(screen.getByLabelText(label)).toHaveAccessibleDescription(`${label} is required.`);
  expect(screen.getByLabelText(label)).toHaveAttribute('aria-invalid', 'true'); expect(listUsers().value).toEqual([]);
});
it.each(['user', 'admin'])('creates %s account, refreshes both layouts and leaves session unchanged', async (role) => {
  writeJson(SESSION_KEY, admin); show(<Users session={admin} />); const actor = userEvent.setup(); await fill(actor, { Role: role });
  await actor.click(screen.getByRole('button', { name: 'Create account' }));
  expect(screen.getByRole('status')).toHaveTextContent('Account created.'); expect(screen.getByLabelText('Display name')).toHaveFocus();
  expect(screen.getByLabelText('Username')).toHaveValue(''); expect(screen.getByLabelText('Role')).toHaveValue('');
  expect(listUsers().value[0]).toMatchObject({ displayName: 'Riley', username: 'riley', role });
  expect(screen.getAllByRole('button', { name: 'Delete account: riley' })).toHaveLength(2); expect(getSession().value).toEqual(admin);
});
it.each(['reserved', 'duplicate'])('retains fields and focuses username after %s failure', async (mode) => {
  show(<Users session={admin} />);
  if (mode === 'duplicate') writeJson(USERS_KEY, [{ ...record, username: 'RILEY' }]);
  const actor = userEvent.setup(); await fill(actor, { Username: mode === 'reserved' ? 'AdMiN' : 'riley' });
  await actor.click(screen.getByRole('button', { name: 'Create account' }));
  expect(screen.getByLabelText('Username')).toHaveFocus(); expect(screen.getByLabelText('Username')).toHaveAccessibleDescription(mode === 'reserved' ? 'The admin username is reserved.' : 'That username is already in use.');
  expect(screen.getByLabelText('Password')).toHaveValue('demo'); expect(screen.getByLabelText('Role')).toHaveValue('user'); expect(screen.queryByText('Account created.')).not.toBeInTheDocument();
});
it.each(['write', 'read', 'corrupt', 'uuid'])('account form remains usable after %s failure', async (mode) => {
  show(<Users session={admin} />); const actor = userEvent.setup(); await fill(actor);
  if (mode === 'write') vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
  if (mode === 'read') vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
  if (mode === 'corrupt') localStorage.setItem(USERS_KEY, '!');
  if (mode === 'uuid') vi.spyOn(globalThis.crypto, 'randomUUID').mockImplementation(() => { throw new Error('unsupported'); });
  await actor.click(screen.getByRole('button', { name: 'Create account' }));
  expect(screen.getByRole('alert')).toBeInTheDocument(); expect(screen.queryByText('Account created.')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Display name')).toHaveValue('Riley'); expect(screen.getByLabelText('Password')).toHaveValue('demo');
  expect(screen.getByLabelText('Role')).toHaveValue('user');
  vi.restoreAllMocks(); if (mode === 'corrupt') expect(localStorage.getItem(USERS_KEY)).toBe('!'); else expect(listUsers().value).toEqual([]);
});
it('disables self and fixed controls in both layouts without invoking confirmation', async () => {
  const current = { ...record, role: 'admin' }; writeJson(USERS_KEY, [current]);
  show(<Users session={{ ...user, role: 'admin' }} />); const actor = userEvent.setup(); const confirm = vi.spyOn(window, 'confirm');
  for (const name of ['admin', 'avery']) for (const control of screen.getAllByRole('button', { name: `Delete account: ${name}` })) {
    expect(control).toBeDisabled(); await actor.click(control);
  }
  expect(confirm).not.toHaveBeenCalled(); expect(listUsers().value).toEqual([current]);
  expect(screen.getAllByTitle('You cannot delete your own account.')).toHaveLength(4);
});
it.each(['success', 'cancel', 'write', 'corrupt', 'absent', 'read'])('account deletion handles %s and never changes posts/session', async (mode) => {
  writeJson(USERS_KEY, [record]); writeJson(POSTS_KEY, [post]); writeJson(SESSION_KEY, admin);
  show(<Users session={admin} />); const beforePosts = localStorage.getItem(POSTS_KEY); const beforeSession = localStorage.getItem(SESSION_KEY);
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(mode !== 'cancel');
  if (mode === 'write') vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
  if (mode === 'corrupt') localStorage.setItem(USERS_KEY, '!');
  if (mode === 'absent') writeJson(USERS_KEY, []);
  if (mode === 'read') vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
  await userEvent.setup().click(screen.getAllByRole('button', { name: 'Delete account: avery' })[0]);
  if (mode === 'success') {
    expect(screen.getByRole('status')).toHaveTextContent('Account deleted.'); expect(screen.queryByRole('button', { name: 'Delete account: avery' })).not.toBeInTheDocument(); expect(listUsers().value).toEqual([]);
  } else {
    expect(screen.getByRole(mode === 'cancel' ? 'status' : 'alert')).toBeInTheDocument(); expect(screen.queryByText('Account deleted.')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Delete account: avery' })).toHaveLength(2);
    if (['read', 'corrupt', 'absent'].includes(mode)) expect(confirm).not.toHaveBeenCalled();
  }
  vi.restoreAllMocks(); expect(localStorage.getItem(POSTS_KEY)).toBe(beforePosts); expect(localStorage.getItem(SESSION_KEY)).toBe(beforeSession);
});
it.each(['corrupt', 'read'])('users page displays a warning for %s data and does not write a synthetic account', (mode) => {
  if (mode === 'corrupt') localStorage.setItem(USERS_KEY, '{}');
  else vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
  const write = vi.spyOn(Storage.prototype, 'setItem'); show(<Users session={admin} />);
  expect(screen.getByRole('status')).toHaveTextContent(mode === 'corrupt' ? 'invalid format' : 'unavailable');
  expect(screen.getAllByRole('button', { name: 'Delete account: admin' })).toHaveLength(2); expect(write).not.toHaveBeenCalled();
});
const routes = [
  ['/', 'Your thoughts. Your space. Beautifully simple.'], ['/login', 'Welcome back.'], ['/register', 'Start your next chapter.'],
  ['/blogs', 'All Blogs'], [`/blog/${post.id}`, 'Note 1'], ['/write', 'Write a Blog'], [`/edit/${post.id}`, 'Edit Blog'], ['/admin', 'Admin Dashboard'], ['/users', 'Manage Users']
];
it.each(routes)('App renders actual final route %s for permitted role', (path, heading) => {
  writeJson(POSTS_KEY, [post]); if (!['/', '/login', '/register'].includes(path)) writeJson(SESSION_KEY, admin);
  window.history.replaceState({}, '', path); render(<App />);
  expect(window.location.pathname).toBe(path); expect(screen.getByRole('heading', { name: heading, level: 1 })).toBeInTheDocument();
  expect(screen.queryByText('Account home')).not.toBeInTheDocument();
});
it.each(['/admin', '/users'])('App rejects guest and regular-user %s without rendering community controls', (path) => {
  for (const session of [null, user]) {
    if (session) writeJson(SESSION_KEY, session); else localStorage.removeItem(SESSION_KEY);
    window.history.replaceState({}, '', path); render(<App />);
    expect(window.location.pathname).toBe(session ? '/blogs' : '/login'); expect(screen.queryByRole('heading', { name: 'Admin Dashboard' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Manage Users' })).not.toBeInTheDocument(); cleanup();
  }
});
it('App dashboard quicklinks navigate to real writing/users and admin navigation stays enabled', async () => {
  writeJson(SESSION_KEY, admin); window.history.replaceState({}, '', '/admin'); render(<App />); const actor = userEvent.setup();
  await actor.click(screen.getByRole('link', { name: 'Write New Post' })); expect(window.location.pathname).toBe('/write');
  await actor.click(screen.getByRole('link', { name: 'Dashboard', exact: true }));
  await actor.click(screen.getByRole('link', { name: 'Manage Users' })); expect(window.location.pathname).toBe('/users');
  expect(screen.getByRole('link', { name: 'Users', exact: true })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('heading', { name: 'Manage Users' })).toBeInTheDocument();
});
it('App dashboard edit link saves a cross-author post and preserves attribution', async () => {
  writeJson(POSTS_KEY, [post]); writeJson(SESSION_KEY, admin); window.history.replaceState({}, '', '/admin'); render(<App />);
  const actor = userEvent.setup(); await actor.click(screen.getByRole('link', { name: 'Edit post: Note 1' }));
  expect(window.location.pathname).toBe(`/edit/${post.id}`); expect(screen.getByLabelText('Content')).toHaveValue('Text');
  await actor.clear(screen.getByLabelText('Title')); await actor.type(screen.getByLabelText('Title'), 'Revised');
  await actor.click(screen.getByRole('button', { name: 'Save Changes' })); expect(window.location.pathname).toBe(`/blog/${post.id}`);
  expect(listPosts().value).toEqual([{ ...post, title: 'Revised' }]);
});
it.each(['/write', `/edit/${post.id}`, `/blog/${post.id}`])('regular user can use actual permitted route %s', (path) => {
  writeJson(POSTS_KEY, [post]); writeJson(SESSION_KEY, user); window.history.replaceState({}, '', path); render(<App />);
  expect(window.location.pathname).toBe(path); expect(screen.queryByRole('link', { name: 'Users', exact: true })).not.toBeInTheDocument();
});
