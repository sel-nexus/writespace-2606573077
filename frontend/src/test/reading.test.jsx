/** Verify reading pages through real routes and browser-local records. */
import { it, expect, vi } from 'vitest';
import { render, screen, within, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../App.jsx';
import Blogs from '../pages/Blogs.jsx';
import { SESSION_KEY, getSession } from '../utils/session.js';
import { POSTS_KEY } from '../utils/posts.js';
import { writeJson } from '../utils/storage.js';

const user = { userId: '11111111-1111-4111-8111-111111111111', username: 'avery', displayName: 'Avery Lane', role: 'user' };
const admin = { userId: 'admin', username: 'admin', displayName: 'Admin', role: 'admin' };
const post = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', title: 'A browser notebook', content: 'First line\n\nSecond line\n' + 'x'.repeat(180),
  createdAt: '2026-01-02T00:00:00Z', authorId: '11111111-1111-4111-8111-111111111111', authorName: 'Avery Lane'
};
/** Seed a session and mount the production router at its initial destination.
 * @param {string} path @param {object|null} session @returns {object}
 */
function openApp(path = '/blogs', session = user) {
  if (session) writeJson(SESSION_KEY, session);
  window.history.replaceState({}, '', path);
  return render(<App />);
}

it.each([user, admin])('reads sorted cards, full text and back navigation without changing %j session', async (session) => {
  const records = [
    post,
    { ...post, id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', title: 'Newest note', createdAt: '2026-01-04T00:00:00Z', authorId: 'admin', authorName: 'Admin' },
    { ...post, id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', title: 'Oldest note', createdAt: '2026-01-01T00:00:00Z' },
    { ...post, id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3', title: 'Same-day note' }
  ];
  writeJson(POSTS_KEY, records);
  const bytes = window.localStorage.getItem(POSTS_KEY);
  openApp('/blogs', session);
  const region = screen.getByRole('region', { name: 'All Blogs' });
  expect(within(region).getAllByRole('heading', { level: 3 }).map((node) => node.textContent))
    .toEqual(['Newest note', 'A browser notebook', 'Same-day note', 'Oldest note']);
  expect(region.querySelector('.grid')).toHaveClass('grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-3');
  const card = within(region).getAllByRole('article')[1];
  expect(within(card).getByText('Avery Lane')).toBeInTheDocument();
  expect(card.querySelector('time')).toHaveAttribute('datetime', post.createdAt);
  expect(card.querySelector('time')).toHaveTextContent('Jan 02, 2026');
  expect(card.querySelector('p.whitespace-pre-wrap').textContent).toBe(post.content.slice(0, 120));
  expect(screen.getByRole('link', { name: 'Write', exact: true })).toHaveAttribute('href', '/write');
  const actor = userEvent.setup();
  await actor.click(within(card).getByRole('link', { name: 'Read post: A browser notebook' }));
  expect(window.location.pathname).toBe(`/blog/${post.id}`);
  expect(screen.getByRole('heading', { level: 1, name: post.title })).toBeInTheDocument();
  const reader = screen.getByRole('article', { name: post.title });
  expect(within(reader).getByText('By Avery Lane')).toBeInTheDocument();
  expect(reader.querySelector('time')).toHaveAttribute('datetime', post.createdAt);
  expect(reader.querySelector('time')).toHaveTextContent('Jan 02, 2026');
  expect(reader.querySelector('p.whitespace-pre-wrap').textContent).toBe(post.content);
  expect(reader.querySelector('p.whitespace-pre-wrap')).toHaveClass('whitespace-pre-wrap');
  expect(within(reader).getByRole('button', { name: 'Delete' })).toBeEnabled();
  expect(within(reader).getByRole('link', { name: 'Edit' })).toHaveAttribute('href', `/edit/${post.id}`);
  await actor.click(screen.getByRole('link', { name: 'Back to All Blogs' }));
  expect(window.location.pathname).toBe('/blogs');
  expect(screen.getByRole('heading', { name: 'All Blogs' })).toBeInTheDocument();
  expect(getSession().value).toEqual(session);
  expect(window.localStorage.getItem(POSTS_KEY)).toBe(bytes);
});

it.each(['absent', 'empty'])('shows exact %s collection empty copy with an active writing action', (mode) => {
  if (mode === 'empty') writeJson(POSTS_KEY, []);
  openApp();
  expect(screen.getByText('No posts yet. Be the first to write one!')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Write a Blog' })).toHaveAttribute('href', '/write');
  expect(screen.queryByRole('button', { name: 'Write a Blog' })).not.toBeInTheDocument();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(screen.queryByRole('article')).not.toBeInTheDocument();
});
it('enables the empty writing link only when the writing slice supplies availability', () => {
  render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Blogs session={user} writingAvailable />
    </MemoryRouter>
  );
  expect(screen.getByRole('link', { name: 'Write a Blog' })).toHaveAttribute('href', '/write');
  expect(screen.queryByRole('button', { name: 'Write a Blog' })).not.toBeInTheDocument();
});

it('disables unavailable empty writing without a link or storage changes', async () => {
  writeJson(SESSION_KEY, user);
  writeJson(POSTS_KEY, []);
  const beforeSession = localStorage.getItem(SESSION_KEY);
  const beforePosts = localStorage.getItem(POSTS_KEY);
  const write = vi.spyOn(Storage.prototype, 'setItem');
  const remove = vi.spyOn(Storage.prototype, 'removeItem');
  const clear = vi.spyOn(Storage.prototype, 'clear');
  render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Blogs session={user} writingAvailable={false} />
    </MemoryRouter>
  );
  expect(screen.getByText('No posts yet. Be the first to write one!')).toBeInTheDocument();
  const action = screen.getByRole('button', { name: 'Write a Blog' });
  expect(action).toBeDisabled();
  expect(screen.queryByRole('link', { name: 'Write a Blog' })).not.toBeInTheDocument();
  await userEvent.setup().click(action);
  expect(write).not.toHaveBeenCalled();
  expect(remove).not.toHaveBeenCalled();
  expect(clear).not.toHaveBeenCalled();
  expect(localStorage.getItem(SESSION_KEY)).toBe(beforeSession);
  expect(localStorage.getItem(POSTS_KEY)).toBe(beforePosts);
});

it.each(['absent', 'empty', 'unknown'])('renders Post not found and a working back action for %s data', async (mode) => {
  if (mode === 'empty') writeJson(POSTS_KEY, []);
  if (mode === 'unknown') writeJson(POSTS_KEY, [post]);
  openApp('/blog/missing');
  expect(screen.getByRole('heading', { name: 'Post not found' })).toBeInTheDocument();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(screen.queryByRole('article')).not.toBeInTheDocument();
  await userEvent.setup().click(screen.getByRole('link', { name: 'Back to All Blogs' }));
  expect(window.location.pathname).toBe('/blogs');
  expect(screen.getByRole('heading', { name: 'All Blogs' })).toBeInTheDocument();
});

for (const path of ['/blogs', `/blog/${post.id}`]) {
  it.each(['malformed', 'invalid-root', 'invalid-record', 'unavailable'])('keeps %s posts safe on ' + path, (mode) => {
    writeJson(SESSION_KEY, user);
    if (mode === 'malformed') window.localStorage.setItem(POSTS_KEY, '!');
    if (mode === 'invalid-root') writeJson(POSTS_KEY, {});
    if (mode === 'invalid-record') writeJson(POSTS_KEY, [{ ...post, content: null }]);
    const bytes = window.localStorage.getItem(POSTS_KEY);
    if (mode === 'unavailable') {
      const original = Storage.prototype.getItem;
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (key) {
        if (key === POSTS_KEY) throw new Error('denied');
        return original.call(this, key);
      });
    }
    const write = vi.spyOn(Storage.prototype, 'setItem');
    window.history.replaceState({}, '', path);
    render(<App />);
    expect(screen.getByRole('status')).toHaveTextContent(mode === 'unavailable' ? 'unavailable' : mode === 'malformed' ? 'unreadable' : 'invalid format');
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
    if (path === '/blogs') {
      expect(screen.getByText('No posts yet. Be the first to write one!')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Write a Blog' })).toHaveAttribute('href', '/write');
    } else {
      expect(screen.getByRole('heading', { name: 'Post not found' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Back to All Blogs' })).toHaveAttribute('href', '/blogs');
    }
    expect(window.location.pathname).toBe(path);
    expect(write).not.toHaveBeenCalled();
    vi.restoreAllMocks();
    expect(window.localStorage.getItem(POSTS_KEY)).toBe(bytes);
    expect(getSession().value).toEqual(user);
  });
}

it.each(['/blogs', `/blog/${post.id}`])('guards guest entry %s without exposing seeded content', (path) => {
  writeJson(POSTS_KEY, [post]);
  openApp(path, null);
  expect(window.location.pathname).toBe('/login');
  expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'All Blogs' })).not.toBeInTheDocument();
  expect(screen.queryByText(post.title)).not.toBeInTheDocument();
  expect(getSession().value).toBeNull();
});
it.each(['/blogs', `/blog/${post.id}`])('fails closed for an invalid session on %s', (path) => {
  writeJson(POSTS_KEY, [post]);
  writeJson(SESSION_KEY, { role: 'admin' });
  openApp(path, null);
  expect(window.location.pathname).toBe('/login');
  expect(screen.getByRole('status')).toBeInTheDocument();
  expect(screen.queryByText(post.title)).not.toBeInTheDocument();
});
it('renders literal markup in title, author and full content without creating executable elements', async () => {
  const literal = {
    ...post,
    title: '<script>bad()</script>',
    authorName: '<b>Writer</b>',
    content: '<img src=x onerror="bad()">\n<script>bad()</script>\nLast line'
  };
  writeJson(POSTS_KEY, [literal]);
  const { container } = openApp();
  expect(screen.getByRole('heading', { name: literal.title })).toBeInTheDocument();
  await userEvent.setup().click(screen.getByRole('link', { name: `Read post: ${literal.title}` }));
  expect(screen.getByText(`By ${literal.authorName}`)).toBeInTheDocument();
  expect(container.querySelector('p.whitespace-pre-wrap').textContent).toBe(literal.content);
  expect(container.querySelector('script, img, b')).toBeNull();
});
it('refreshes detail when navigation changes only the URL id and survives remount', async () => {
  writeJson(POSTS_KEY, [post, { ...post, id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', title: 'Second notebook', content: 'Different full content\nNext line' }]);
  openApp(`/blog/${post.id}`);
  // A real footer link returns to the list, whose card opens the second URL.
  const actor = userEvent.setup();
  await actor.click(within(screen.getByRole('navigation', { name: 'Footer' })).getByRole('link', { name: 'All Blogs' }));
  await actor.click(screen.getByRole('link', { name: 'Read post: Second notebook' }));
  expect(window.location.pathname).toBe('/blog/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2');
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Second notebook');
  expect(screen.getByRole('article').querySelector('p.whitespace-pre-wrap').textContent).toBe('Different full content\nNext line');
  act(() => {
    window.history.pushState({}, '', `/blog/${post.id}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(post.title);
  expect(screen.getByRole('article').querySelector('p.whitespace-pre-wrap').textContent).toBe(post.content);
  act(() => {
    window.history.pushState({}, '', '/blog/missing');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  expect(screen.getByRole('heading', { name: 'Post not found' })).toBeInTheDocument();
  expect(screen.queryByRole('article')).not.toBeInTheDocument();
  act(() => {
    window.history.pushState({}, '', '/blog/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  cleanup();
  render(<App />);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Second notebook');
  expect(getSession().value).toEqual(user);
});
