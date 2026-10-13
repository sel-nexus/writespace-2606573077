/** Exercise authoring through production routes and real local storage. */
import { it, expect, vi } from 'vitest';
import { render, screen, act, fireEvent, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App.jsx';
import { POSTS_KEY, getPost, listPosts } from '../utils/posts.js';
import { SESSION_KEY } from '../utils/session.js';
import { writeJson } from '../utils/storage.js';
const owner = { userId: '11111111-1111-4111-8111-111111111111', username: 'avery', displayName: 'Avery', role: 'user' };
const admin = { userId: 'admin', username: 'admin', displayName: 'Admin', role: 'admin' };
const stranger = { ...owner, userId: '55555555-5555-4555-8555-555555555555' };
const post = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', title: 'Original note', content: 'Original\ncontent', createdAt: '2026-01-02T00:00:00Z', authorId: owner.userId, authorName: 'Avery' };
/** Mount the production router with an initial session fixture. @param {string} path @param {object|null} session @returns {object} */
function open(path = '/write', session = owner) {
  if (session) writeJson(SESSION_KEY, session);
  window.history.replaceState({}, '', path);
  return render(<App />);
}
/** Enter text without altering whitespace or imposing a typing-time limit. @param {string} title @param {string} content @returns {void} */
function fill(title = '  Written title  ', content = '\n Written content\n ') {
  fireEvent.change(screen.getByRole('textbox', { name: 'Title' }), { target: { value: title } });
  fireEvent.change(screen.getByRole('textbox', { name: 'Content' }), { target: { value: content } });
}
it.each(['/write', `/edit/${post.id}`])('requires both fields with aria errors and first-invalid focus on %s', async (path) => {
  writeJson(POSTS_KEY, [post]);
  open(path);
  fill('  ', '\n ');
  const title = screen.getByRole('textbox', { name: 'Title' });
  const content = screen.getByRole('textbox', { name: 'Content' });
  const raw = localStorage.getItem(POSTS_KEY);
  const actor = userEvent.setup();
  await actor.click(screen.getByRole('button', { name: path === '/write' ? 'Publish Blog' : 'Save Changes' }));
  expect(title).toHaveFocus();
  expect(title).toHaveAttribute('aria-invalid', 'true');
  expect(title).toHaveAttribute('aria-describedby', 'title-error');
  expect(screen.getByText('Title is required.')).toHaveAttribute('id', 'title-error');
  expect(content).toHaveAttribute('aria-describedby', 'content-error content-count');
  expect(content).toHaveAttribute('aria-required', 'true');
  expect(content).toBeRequired();
  expect(screen.getByText('Content is required.')).toHaveAttribute('id', 'content-error');
  fill('Valid', ' ');
  await actor.click(screen.getByRole('button', { name: path === '/write' ? 'Publish Blog' : 'Save Changes' }));
  expect(content).toHaveFocus();
  expect(screen.queryByText('Title is required.')).not.toBeInTheDocument();
  expect(localStorage.getItem(POSTS_KEY)).toBe(raw);
});
it.each([owner, admin])('creates unlimited plain text, counts live, persists and opens reader for %j', async (session) => {
  const { container } = open('/write', session);
  const content = '\n<script>bad()</script>\n' + 'x'.repeat(10000) + '\n ';
  const title = ' <img src=x onerror="bad()"> ';
  const textarea = screen.getByRole('textbox', { name: 'Content' });
  expect(screen.getByText('0 characters')).toHaveAttribute('aria-live', 'polite');
  expect(textarea).toHaveClass('min-h-64');
  expect(textarea).not.toHaveAttribute('maxlength');
  expect(screen.getByRole('textbox', { name: 'Title' })).not.toHaveAttribute('maxlength');
  fill(title, content);
  expect(screen.getByText(`${content.length} characters`)).toBeInTheDocument();
  await userEvent.setup().click(screen.getByRole('button', { name: 'Publish Blog' }));
  const saved = listPosts().value[0];
  expect(window.location.pathname).toBe(`/blog/${saved.id}`);
  expect(saved).toMatchObject({ title, content, authorId: session.userId, authorName: session.displayName });
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(title.trim());
  expect(container.querySelector('p.whitespace-pre-wrap').textContent).toBe(content);
  expect(container.querySelector('script, img')).toBeNull();
  cleanup();
  render(<App />);
  expect(screen.getByRole('article').querySelector('p.whitespace-pre-wrap').textContent).toBe(content);
});
it.each([owner, admin])('prefills and edits while preserving all original metadata for %j', async (session) => {
  writeJson(POSTS_KEY, [post]);
  open('/blogs', session);
  await userEvent.setup().click(screen.getByRole('link', { name: `Edit post: ${post.title}` }));
  expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue(post.title);
  expect(screen.getByRole('textbox', { name: 'Content' })).toHaveValue(post.content);
  expect(screen.getByText(`${post.content.length} characters`)).toBeInTheDocument();
  fill();
  await userEvent.setup().click(screen.getByRole('button', { name: 'Save Changes' }));
  expect(window.location.pathname).toBe(`/blog/${post.id}`);
  expect(getPost(post.id).value).toEqual({ ...post, title: '  Written title  ', content: '\n Written content\n ' });
});
it.each(['/write', `/edit/${post.id}`])('cancel discards unsaved text with no write on %s', async (path) => {
  writeJson(POSTS_KEY, [post]);
  open(path);
  const raw = localStorage.getItem(POSTS_KEY);
  const write = vi.spyOn(Storage.prototype, 'setItem');
  fill();
  await userEvent.setup().click(screen.getByRole('link', { name: 'Cancel' }));
  expect(window.location.pathname).toBe(path === '/write' ? '/blogs' : `/blog/${post.id}`);
  expect(localStorage.getItem(POSTS_KEY)).toBe(raw);
  expect(write).not.toHaveBeenCalled();
});
for (const path of ['/write', `/edit/${post.id}`]) {
  it.each(['quota', 'corrupt', 'denied', ...(path === '/write' ? ['uuid'] : ['owner-changed', 'removed'])])(`keeps form and storage unchanged on ${path} failure %s`, async (mode) => {
    writeJson(POSTS_KEY, [post]);
    open(path);
    fill();
    if (mode === 'corrupt') localStorage.setItem(POSTS_KEY, '!');
    if (mode === 'owner-changed') writeJson(POSTS_KEY, [{ ...post, authorId: stranger.userId }]);
    if (mode === 'removed') writeJson(POSTS_KEY, []);
    const raw = localStorage.getItem(POSTS_KEY);
    if (mode === 'quota') vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    if (mode === 'uuid') vi.stubGlobal('crypto', {});
    if (mode === 'denied') {
      const original = Storage.prototype.getItem;
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (key) {
        if (key === POSTS_KEY) throw new Error('denied');
        return original.call(this, key);
      });
    }
    await userEvent.setup().click(screen.getByRole('button', { name: path === '/write' ? 'Publish Blog' : 'Save Changes' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Not saved.');
    expect(screen.getByRole('alert')).toHaveTextContent({ quota: 'could not be saved', corrupt: 'unreadable', denied: 'unavailable', uuid: 'post ID', 'owner-changed': 'own posts', removed: 'Post not found' }[mode]);
    expect(window.location.pathname).toBe(path);
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue('  Written title  ');
    expect(screen.getByRole('textbox', { name: 'Content' })).toHaveValue('\n Written content\n ');
    vi.restoreAllMocks();
    expect(localStorage.getItem(POSTS_KEY)).toBe(raw);
  });
}
it('redirects non-owner initial edit and hides all mutation entry points', async () => {
  writeJson(POSTS_KEY, [post]);
  const raw = localStorage.getItem(POSTS_KEY);
  open(`/edit/${post.id}`, stranger);
  expect(window.location.pathname).toBe('/blogs');
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: `Edit post: ${post.title}` })).not.toBeInTheDocument();
  await userEvent.setup().click(screen.getByRole('link', { name: `Read post: ${post.title}` }));
  expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  expect(localStorage.getItem(POSTS_KEY)).toBe(raw);
});
it('refreshes prefill and authorization when only the edit URL ID changes', () => {
  writeJson(POSTS_KEY, [post, { ...post, id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', title: 'Second note', content: 'Second content' }, { ...post, id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb5', authorId: stranger.userId }]);
  open(`/edit/${post.id}`);
  fill('Unsaved first note', 'Unsaved content');
  act(() => {
    window.history.pushState({}, '', '/edit/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue('Second note');
  expect(screen.getByRole('textbox', { name: 'Content' })).toHaveValue('Second content');
  act(() => {
    window.history.pushState({}, '', '/edit/missing');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  expect(screen.getByRole('heading', { name: 'Post not found' })).toBeInTheDocument();
  act(() => {
    window.history.pushState({}, '', '/edit/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb5');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  expect(window.location.pathname).toBe('/blogs');
  expect(getPost(post.id).value).toEqual(post);
  expect(getPost('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2').value.title).toBe('Second note');
});
it.each(['missing', 'corrupt', 'denied'])('renders edit %s safely with working back navigation', async (mode) => {
  if (mode === 'corrupt') localStorage.setItem(POSTS_KEY, '!');
  if (mode === 'denied') {
    const original = Storage.prototype.getItem;
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (key) {
      if (key === POSTS_KEY) throw new Error('denied');
      return original.call(this, key);
    });
  }
  open('/edit/missing');
  expect(screen.getByRole('heading', { name: 'Post not found' })).toBeInTheDocument();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  if (mode !== 'missing') expect(screen.getByRole('status')).toBeInTheDocument();
  await userEvent.setup().click(screen.getByRole('link', { name: 'Back to All Blogs' }));
  expect(window.location.pathname).toBe('/blogs');
});
it.each(['/write', `/edit/${post.id}`])('guards guest writing route %s', (path) => {
  writeJson(POSTS_KEY, [post]);
  open(path, null);
  expect(window.location.pathname).toBe('/login');
  expect(screen.queryByRole('textbox', { name: 'Content' })).not.toBeInTheDocument();
  expect(getPost(post.id).value).toEqual(post);
});
it.each([owner, admin])('reader edit is reachable and delete cancellation then success works for %j', async (session) => {
  writeJson(POSTS_KEY, [post]);
  open(`/blog/${post.id}`, session);
  const actor = userEvent.setup();
  await actor.click(screen.getByRole('link', { name: 'Edit', exact: true }));
  expect(window.location.pathname).toBe(`/edit/${post.id}`);
  await actor.click(screen.getByRole('link', { name: 'Cancel' }));
  const raw = localStorage.getItem(POSTS_KEY);
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  await actor.click(screen.getByRole('button', { name: 'Delete' }));
  expect(window.location.pathname).toBe(`/blog/${post.id}`);
  expect(localStorage.getItem(POSTS_KEY)).toBe(raw);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  confirm.mockReturnValue(true);
  await actor.click(screen.getByRole('button', { name: 'Delete' }));
  expect(window.location.pathname).toBe('/blogs');
  expect(listPosts().value).toEqual([]);
  expect(screen.getByText('No posts yet. Be the first to write one!')).toBeInTheDocument();
});
it.each(['quota', 'corrupt', 'denied', 'owner-changed', 'removed'])('delete failure %s stays visible on reader without false success', async (mode) => {
  writeJson(POSTS_KEY, [post]);
  open(`/blog/${post.id}`);
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
  if (mode === 'corrupt') localStorage.setItem(POSTS_KEY, '!');
  if (mode === 'owner-changed') writeJson(POSTS_KEY, [{ ...post, authorId: stranger.userId }]);
  if (mode === 'removed') writeJson(POSTS_KEY, []);
  const raw = localStorage.getItem(POSTS_KEY);
  if (mode === 'quota') vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
  if (mode === 'denied') vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
  await userEvent.setup().click(screen.getByRole('button', { name: 'Delete' }));
  expect(window.location.pathname).toBe(`/blog/${post.id}`);
  expect(screen.getByRole('alert')).toHaveTextContent('Not deleted.');
  expect(screen.getByRole('article', { name: post.title })).toBeInTheDocument();
  if (mode !== 'quota') expect(confirm).not.toHaveBeenCalled();
  vi.restoreAllMocks();
  expect(localStorage.getItem(POSTS_KEY)).toBe(raw);
});
