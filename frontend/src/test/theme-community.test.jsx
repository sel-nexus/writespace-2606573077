/** Verify paired community presentation through production routes and real local helpers. */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, within, fireEvent, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App.jsx';
import { POSTS_KEY, listPosts } from '../utils/posts.js';
import { USERS_KEY, listUsers } from '../utils/users.js';
import { SESSION_KEY, getSession } from '../utils/session.js';
import { writeJson } from '../utils/storage.js';

const owner = {
  userId: '11111111-1111-4111-8111-111111111111', username: 'avery', displayName: 'Avery', role: 'user'
};
const admin = { userId: 'admin', username: 'admin', displayName: 'Admin', role: 'admin' };
const stranger = { ...owner, userId: '55555555-5555-4555-8555-555555555555', username: 'other' };
const account = {
  id: owner.userId, username: 'avery', displayName: 'Avery', password: 'demo',
  role: 'user', createdAt: '2026-01-01T00:00:00Z'
};
const post = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', title: 'Community notebook',
  content: 'First line\n\n<script>literal()</script>\n' + 'x'.repeat(150),
  createdAt: '2026-01-02T00:00:00Z', authorId: owner.userId, authorName: 'Avery'
};

afterEach(() => document.documentElement.classList.remove('dark'));

/** Mount an actual initial route with an explicit stored preference and optional session. */
function open(path, mode, session = owner) {
  localStorage.setItem('writespace_theme', mode);
  if (session) writeJson(SESSION_KEY, session);
  else localStorage.removeItem(SESSION_KEY);
  window.history.replaceState({}, '', path);
  const view = render(<App />);
  expect(document.documentElement.classList.contains('dark')).toBe(mode === 'dark');
  return view;
}

/** Read raw bytes to detect unwanted changes outside the requested business operation. */
function bytes() {
  return Object.fromEntries(Object.keys(localStorage).sort().map((key) => [key, localStorage.getItem(key)]));
}

/** Enter controlled account fields through real DOM changes and supported role options. */
function fillAccount(username = 'riley', role = 'user') {
  for (const [label, value] of [['Display name', 'Riley'], ['Username', username], ['Password', 'demo']]) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  }
  fireEvent.change(screen.getByLabelText('Role'), { target: { value: role } });
}

/** Enter exact authoring strings, preserving whitespace and line breaks. */
function fillPost(title, content) {
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: title } });
  fireEvent.change(screen.getByLabelText('Content'), { target: { value: content } });
}

/** Simulate only a browser persistence exception, leaving production domain helpers intact. */
function failWrites(key) {
  const original = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (name, value) {
    if (name === key) throw new Error('quota');
    return original.call(this, name, value);
  });
}

for (const mode of ['light', 'dark']) {
  describe(`${mode} community`, () => {
    it('preserves sorted cards, accents, avatars, literal full text, metadata and back navigation', async () => {
      writeJson(POSTS_KEY, [post, { ...post, id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', title: 'Newer', createdAt: '2026-01-03T00:00:00Z' }]);
      open('/blogs', mode);
      const before = bytes();
      const region = screen.getByRole('region', { name: 'All Blogs' });
      expect(within(region).getAllByRole('heading', { level: 3 }).map((node) => node.textContent))
        .toEqual(['Newer', post.title]);
      expect(region.querySelector('.grid')).toHaveClass('grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-3');
      const card = within(region).getAllByRole('article')[1];
      expect(card).toHaveClass('bg-surface', 'border-t-violet-500', 'dark:border-t-violet-500', 'dark:bg-slate-800', 'dark:border-slate-700');
      expect(within(card).getByRole('img', { name: 'User avatar' })).toHaveClass('bg-violet-100', 'text-violet-800');
      expect(card.querySelector('time')).toHaveClass('text-foreground-muted', 'dark:text-slate-300');
      expect(card.querySelector('time')).toHaveTextContent('Jan 02, 2026');
      expect(card.querySelector('p.whitespace-pre-wrap').textContent).toBe(post.content.slice(0, 120));
      const read = within(card).getByRole('link', { name: `Read post: ${post.title}` });
      expect(read).toHaveClass('dark:text-primary-300', 'dark:focus-visible:ring-primary-400');
      await userEvent.setup().click(read);
      const article = screen.getByRole('article', { name: post.title });
      expect(article).toHaveClass('bg-surface', 'dark:bg-slate-800', 'dark:text-slate-100');
      expect(article.querySelector('p.whitespace-pre-wrap').textContent).toBe(post.content);
      expect(article.querySelector('script')).toBeNull();
      expect(within(article).getByText('By Avery').parentElement).toHaveClass('dark:text-slate-300');
      expect(within(article).getByRole('link', { name: 'Edit' })).toHaveAttribute('href', `/edit/${post.id}`);
      expect(within(article).getByRole('button', { name: 'Delete' })).toHaveClass('dark:bg-red-700');
      await userEvent.setup().click(screen.getByRole('link', { name: 'Back to All Blogs' }));
      expect(window.location.pathname).toBe('/blogs');
      expect(bytes()).toEqual(before);
    });

    it.each(['empty', 'corrupt', 'not-found'])('keeps %s reader fallback and navigation unchanged', async (state) => {
      if (state === 'empty') writeJson(POSTS_KEY, []);
      if (state === 'corrupt') localStorage.setItem(POSTS_KEY, '!');
      if (state === 'not-found') writeJson(POSTS_KEY, [post]);
      open(state === 'not-found' ? '/blog/missing' : '/blogs', mode);
      const before = bytes();
      expect(screen.queryByRole('article')).not.toBeInTheDocument();
      if (state === 'not-found') {
        expect(screen.getByRole('heading', { name: 'Post not found' }).parentElement).toHaveClass('dark:text-slate-100');
        await userEvent.setup().click(screen.getByRole('link', { name: 'Back to All Blogs' }));
        expect(window.location.pathname).toBe('/blogs');
      } else {
        const empty = screen.getByText('No posts yet. Be the first to write one!');
        expect(empty).toHaveClass('text-foreground-muted', 'dark:text-slate-300');
        expect(empty.parentElement).toHaveClass('bg-surface', 'dark:bg-slate-800');
        expect(screen.getByRole('link', { name: 'Write a Blog' })).toHaveAttribute('href', '/write');
        if (state === 'corrupt') expect(screen.getByRole('status')).toHaveTextContent('unreadable');
      }
      expect(bytes()).toEqual(before);
    });

    it('hides non-owner edit/delete controls on cards and reader without changing records', async () => {
      writeJson(POSTS_KEY, [post]);
      open('/blogs', mode, stranger);
      const before = bytes();
      expect(screen.queryByRole('link', { name: `Edit post: ${post.title}` })).not.toBeInTheDocument();
      await userEvent.setup().click(screen.getByRole('link', { name: `Read post: ${post.title}` }));
      expect(screen.queryByRole('link', { name: 'Edit', exact: true })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
      expect(bytes()).toEqual(before);
    });

    it.each(['cancel', 'success', 'failure'])('owner deletion %s preserves original outcomes', async (outcome) => {
      writeJson(POSTS_KEY, [post]);
      open(`/blog/${post.id}`, mode);
      const before = bytes();
      vi.spyOn(window, 'confirm').mockReturnValue(outcome !== 'cancel');
      if (outcome === 'failure') failWrites(POSTS_KEY);
      await userEvent.setup().click(screen.getByRole('button', { name: 'Delete' }));
      if (outcome === 'success') {
        expect(window.location.pathname).toBe('/blogs');
        expect(listPosts().value).toEqual([]);
        expect(bytes()).toEqual({ ...before, [POSTS_KEY]: '[]' });
      } else {
        expect(window.location.pathname).toBe(`/blog/${post.id}`);
        expect(screen.getByRole('article', { name: post.title })).toBeInTheDocument();
        if (outcome === 'failure') expect(screen.getByRole('alert')).toHaveTextContent('Not deleted.');
        else expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(bytes()).toEqual(before);
      }
    });

    it.each(['cancel', 'success', 'failure'])('dashboard deletion %s keeps exact metric labels and data semantics', async (outcome) => {
      writeJson(POSTS_KEY, [post]);
      writeJson(USERS_KEY, [account]);
      open('/admin', mode, admin);
      const before = bytes();
      for (const [label, count] of [['Total Posts', '1'], ['Total Users', '2'], ['Total Admins', '1'], ['Total users', '1']]) {
        const term = screen.getByText(label, { exact: true });
        expect(term.tagName).toBe('DT');
        expect(term.nextSibling).toHaveTextContent(count);
        expect(term.parentElement).toHaveClass('bg-surface', 'dark:bg-slate-800', 'dark:border-slate-700');
        expect(term.nextSibling).toHaveClass('text-primary-800', 'dark:text-primary-300');
      }
      expect(screen.getByRole('heading', { name: 'Admin Dashboard' }).parentElement)
        .toHaveClass('from-secondary-800', 'to-primary-800');
      const latest = screen.getByRole('region', { name: 'Latest Posts' });
      expect(latest).toHaveClass('dark:bg-slate-800');
      expect(latest.querySelector('ol')).toHaveClass('dark:divide-slate-700');
      expect(screen.getByRole('link', { name: 'Manage Users' })).toHaveAttribute('href', '/users');
      vi.spyOn(window, 'confirm').mockReturnValue(outcome !== 'cancel');
      if (outcome === 'failure') failWrites(POSTS_KEY);
      await userEvent.setup().click(screen.getByRole('button', { name: `Delete post: ${post.title}` }));
      if (outcome === 'success') {
        expect(screen.getByRole('status')).toHaveTextContent('Post deleted.');
        expect(screen.getByText('Total Posts', { exact: true }).nextSibling).toHaveTextContent('0');
        expect(bytes()).toEqual({ ...before, [POSTS_KEY]: '[]' });
      } else {
        expect(screen.getByRole(outcome === 'cancel' ? 'status' : 'alert'))
          .toHaveTextContent(outcome === 'cancel' ? 'Deletion cancelled.' : 'could not be saved');
        expect(screen.getByText('Total Posts', { exact: true }).nextSibling).toHaveTextContent('1');
        expect(bytes()).toEqual(before);
      }
    });

    it('retains accessible desktop table/mobile metadata and both protected identity controls', () => {
      writeJson(USERS_KEY, [{ ...account, role: 'admin' }]);
      open('/users', mode, { ...owner, role: 'admin' });
      const before = bytes();
      const table = screen.getByRole('table');
      expect(table.parentElement).toHaveClass('hidden', 'sm:block', 'bg-surface', 'dark:bg-slate-800');
      expect(table.querySelector('thead')).toHaveClass('bg-surface-raised', 'dark:bg-slate-900');
      expect(table.querySelector('tbody')).toHaveClass('dark:divide-slate-700');
      expect(within(table).getAllByRole('columnheader').map((node) => node.textContent))
        .toEqual(['Account', 'Username', 'Role', 'Created date', 'Action']);
      const cards = screen.getByLabelText('Account cards');
      expect(cards).toHaveClass('sm:hidden');
      const card = within(cards).getByRole('article', { name: 'Account: avery' });
      expect(card).toHaveClass('dark:bg-slate-800', 'dark:border-slate-700');
      expect(within(card).getByText('Jan 01, 2026')).toBeInTheDocument();
      expect(within(card).getByText('Role')).toHaveClass('dark:text-slate-300');
      expect(within(card).getByText('admin', { exact: true })).toHaveClass('dark:bg-secondary-950', 'dark:text-secondary-200');
      expect(within(card).getByRole('img', { name: 'Administrator avatar' })).toBeInTheDocument();
      for (const [name, reason] of [['admin', 'Default admin cannot be deleted'], ['avery', 'You cannot delete your own account.']]) {
        for (const button of screen.getAllByRole('button', { name: `Delete account: ${name}` })) {
          expect(button).toBeDisabled();
          expect(button).toHaveAttribute('title', reason);
          expect(button).toHaveClass('dark:text-red-300', 'dark:focus-visible:ring-red-400');
          expect(button.parentElement).toHaveAttribute('tabindex', '0');
        }
      }
      expect(bytes()).toEqual(before);
    });

    it.each(['user', 'admin'])('account creation validates required Role and saves exact %s schema', async (role) => {
      open('/users', mode, admin);
      const before = bytes();
      fillAccount('riley', '');
      await userEvent.setup().click(screen.getByRole('button', { name: 'Create account' }));
      const select = screen.getByLabelText('Role');
      expect(select).toHaveFocus();
      expect(select).toHaveAccessibleDescription('Role is required.');
      expect(select).toHaveClass('dark:bg-slate-900', 'dark:text-slate-100', 'dark:aria-[invalid=true]:border-red-400');
      expect(screen.getByText('Role is required.')).toHaveClass('dark:text-red-300');
      expect(bytes()).toEqual(before);
      fireEvent.change(select, { target: { value: role } });
      await userEvent.setup().click(screen.getByRole('button', { name: 'Create account' }));
      expect(screen.getByRole('status')).toHaveTextContent('Account created.');
      expect(screen.getByLabelText('Display name')).toHaveFocus();
      const saved = listUsers().value[0];
      expect(saved).toEqual({
        id: expect.stringMatching(/^[0-9a-f-]{36}$/i), displayName: 'Riley', username: 'riley',
        password: 'demo', role, createdAt: expect.any(String)
      });
      expect(new Date(saved.createdAt).toISOString()).toBe(saved.createdAt);
      expect(screen.getAllByRole('button', { name: 'Delete account: riley' })).toHaveLength(2);
      expect(getSession().value).toEqual(admin);
      expect(localStorage.getItem('writespace_theme')).toBe(mode);
    });

    it.each(['cancel', 'success', 'failure'])('account deletion %s never changes posts/session/theme', async (outcome) => {
      writeJson(POSTS_KEY, [post]);
      writeJson(USERS_KEY, [account]);
      open('/users', mode, admin);
      const before = bytes();
      vi.spyOn(window, 'confirm').mockReturnValue(outcome !== 'cancel');
      if (outcome === 'failure') failWrites(USERS_KEY);
      await userEvent.setup().click(within(screen.getByLabelText('Account cards')).getByRole('button', { name: 'Delete account: avery' }));
      if (outcome === 'success') {
        expect(screen.getByRole('status')).toHaveTextContent('Account deleted.');
        expect(screen.queryByRole('button', { name: 'Delete account: avery' })).not.toBeInTheDocument();
        expect(bytes()).toEqual({ ...before, [USERS_KEY]: '[]' });
      } else {
        expect(screen.getByRole(outcome === 'cancel' ? 'status' : 'alert'))
          .toHaveTextContent(outcome === 'cancel' ? 'Deletion cancelled.' : 'could not be saved');
        expect(screen.getAllByRole('button', { name: 'Delete account: avery' })).toHaveLength(2);
        expect(bytes()).toEqual(before);
      }
    });

    it('keeps failed account creation input and error feedback without a false save', async () => {
      writeJson(USERS_KEY, [account]);
      open('/users', mode, admin);
      const before = bytes();
      fillAccount();
      failWrites(USERS_KEY);
      await userEvent.setup().click(screen.getByRole('button', { name: 'Create account' }));
      expect(screen.getByRole('alert')).toHaveTextContent('could not be saved');
      expect(screen.getByLabelText('Password')).toHaveValue('demo');
      expect(screen.getByLabelText('Role')).toHaveValue('user');
      expect(screen.queryByText('Account created.')).not.toBeInTheDocument();
      expect(bytes()).toEqual(before);
    });

    it.each(['/admin', '/users'])('guards %s for guests and regular users in this mode', (path) => {
      for (const session of [null, owner]) {
        open(path, mode, session);
        expect(window.location.pathname).toBe(session ? '/blogs' : '/login');
        expect(screen.queryByRole('heading', { name: 'Admin Dashboard' })).not.toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: 'Manage Users' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Create account' })).not.toBeInTheDocument();
        cleanup();
      }
    });

    it('renders corrupt admin collections as readable warnings without overwriting raw bytes', () => {
      localStorage.setItem(USERS_KEY, '!');
      localStorage.setItem(POSTS_KEY, '!');
      open('/admin', mode, admin);
      const before = bytes();
      expect(screen.getAllByRole('status')).toHaveLength(2);
      expect(screen.getByText('Total Users', { exact: true }).nextSibling).toHaveTextContent('1');
      expect(screen.getByText('Total users', { exact: true }).nextSibling).toHaveTextContent('0');
      expect(screen.getByText('No posts yet. Be the first to write one!')).toHaveClass('dark:text-slate-300');
      cleanup();
      open('/users', mode, admin);
      expect(screen.getByRole('status')).toHaveTextContent('unreadable');
      expect(screen.getByRole('table').querySelectorAll('tbody tr')).toHaveLength(1);
      expect(screen.getByLabelText('Account cards').querySelectorAll('article')).toHaveLength(1);
      expect(bytes()).toEqual(before);
    });

    it.each(['/write', `/edit/${post.id}`])('preserves required fields, failures, cancel and exact successful save on %s', async (path) => {
      writeJson(POSTS_KEY, [post]);
      open(path, mode);
      const before = bytes();
      const content = screen.getByLabelText('Content');
      const form = content.closest('form');
      expect(form).toHaveClass('bg-surface', 'dark:bg-slate-800', 'dark:border-slate-700');
      expect(content).toHaveClass('min-h-64', 'dark:bg-slate-900', 'dark:text-slate-100', 'dark:focus:ring-primary-400');
      expect(content).not.toHaveAttribute('maxlength');
      expect(content).toHaveValue(path === '/write' ? '' : post.content);
      const label = path === '/write' ? 'Publish Blog' : 'Save Changes';
      fillPost(' ', '\n ');
      await userEvent.setup().click(screen.getByRole('button', { name: label }));
      expect(screen.getByLabelText('Title')).toHaveFocus();
      expect(content).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByText('Content is required.')).toHaveClass('dark:text-red-300');
      expect(bytes()).toEqual(before);
      fillPost('  Revised  ', '\n New words\n ');
      failWrites(POSTS_KEY);
      await userEvent.setup().click(screen.getByRole('button', { name: label }));
      expect(screen.getByRole('alert')).toHaveTextContent('Not saved.');
      expect(content).toHaveValue('\n New words\n ');
      expect(window.location.pathname).toBe(path);
      expect(bytes()).toEqual(before);
      vi.restoreAllMocks();
      await userEvent.setup().click(screen.getByRole('link', { name: 'Cancel' }));
      expect(window.location.pathname).toBe(path === '/write' ? '/blogs' : `/blog/${post.id}`);
      expect(bytes()).toEqual(before);
      cleanup();
      open(path, mode);
      fillPost('  Revised  ', '\n New words\n ');
      await userEvent.setup().click(screen.getByRole('button', { name: label }));
      const saved = listPosts().value.find((item) => item.title === '  Revised  ');
      expect(saved).toEqual({
        ...(path === '/write' ? { ...post, id: expect.any(String), createdAt: expect.any(String) } : post),
        title: '  Revised  ', content: '\n New words\n '
      });
      expect(window.location.pathname).toBe(`/blog/${saved.id}`);
      expect(getSession().value).toEqual(owner);
      expect(localStorage.getItem('writespace_theme')).toBe(mode);
    });
  });
}
