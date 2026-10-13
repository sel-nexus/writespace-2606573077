/** Exercise public entry with real storage, routing and keyboard interactions. */
import { it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import App from '../App.jsx';
import Landing from '../pages/Landing.jsx';
import { PublicNavbar } from '../components/PublicNavbar.jsx';
import { Footer } from '../components/Footer.jsx';
import { PostCard } from '../components/PostCard.jsx';
import { POSTS_KEY } from '../utils/posts.js';
import { writeJson } from '../utils/storage.js';
import { SESSION_KEY, getSession } from '../utils/session.js';
const tagline = 'Your thoughts. Your space. Beautifully simple.';
const user = { userId: 'u1', displayName: 'Avery', username: 'avery', role: 'user' };
const admin = { userId: 'admin', displayName: 'Admin', username: 'admin', role: 'admin' };
const post = { id: 'p1', title: 'Local note', content: 'First line\nSecond line', createdAt: '2026-01-02T00:00:00Z', authorId: 'u1', authorName: 'Avery' };
/** Expose router destination for interaction assertions. @returns {JSX.Element} */
function Location() {
  const { pathname } = useLocation();
  return <p>Location: {pathname}</p>;
}
/** Supply a test router without replacing domain readers. @param {JSX.Element} element @returns {object} */
function inRouter(element) {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      {element}
      <Location />
    </MemoryRouter>
  );
}
it('renders exact landing content, empty copy and honest demo disclosure', () => {
  render(<App />);
  expect(screen.getByRole('heading', { level: 1, name: tagline })).toBeInTheDocument();
  const features = screen.getByRole('region', { name: 'Features' });
  expect(within(features).getAllByRole('article')).toHaveLength(3);
  for (const name of ['Write Freely', 'Private & Local', 'Instant & Fast']) {
    expect(within(features).getByRole('heading', { name })).toBeInTheDocument();
  }
  expect(screen.getByText('No posts yet — check back soon!')).toBeInTheDocument();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(screen.getByRole('complementary', { name: 'Local demo disclosure' })).toHaveTextContent('Passwords are stored in plaintext.');
  expect(screen.getByRole('complementary')).toHaveTextContent('Do not use real credentials');
});
it('shows only three newest local previews with metadata and guest gate', async () => {
  writeJson(POSTS_KEY, [1, 4, 2, 3].map((day) => ({ ...post, id: `p${day}`, title: `Note ${day}`, createdAt: `2026-01-0${day}T00:00:00Z` })));
  render(<App />);
  const recent = screen.getByRole('region', { name: 'Recent writing' });
  expect(within(recent).getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toEqual(['Note 4', 'Note 3', 'Note 2']);
  expect(within(recent).getAllByRole('article')).toHaveLength(3);
  expect(within(recent).getByText('Jan 04 2026')).toBeInTheDocument();
  expect(within(recent).getAllByText('Avery')).toHaveLength(3);
  await userEvent.setup().click(screen.getByRole('link', { name: 'Read post: Note 4' }));
  expect(window.location.pathname).toBe('/login');
  expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  expect(getSession().value).toBeNull();
});
it.each(['corrupt', 'schema', 'unavailable'])('renders empty previews and warning after %s read without repair', (mode) => {
  if (mode === 'corrupt') localStorage.setItem(POSTS_KEY, '!');
  if (mode === 'schema') writeJson(POSTS_KEY, [{ ...post, title: 42 }]);
  const raw = localStorage.getItem(POSTS_KEY);
  if (mode === 'unavailable') vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
  inRouter(<Landing />);
  expect(screen.getByRole('heading', { name: tagline })).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent(mode === 'unavailable' ? 'unavailable' : mode === 'schema' ? 'invalid format' : 'unreadable');
  expect(screen.getByText('No posts yet — check back soon!')).toBeInTheDocument();
  vi.restoreAllMocks();
  expect(localStorage.getItem(POSTS_KEY)).toBe(raw);
});
it.each([
  ['Get Started Free', '/register', 'Start your next chapter.'],
  ['Start Reading', '/login', 'Sign in'],
  ['Go to Dashboard', '/login', 'Sign in']
])('guest %s enters %s through a real App click', async (name, path, heading) => {
  render(<App />);
  await userEvent.setup().click(screen.getByRole('link', { name }));
  expect(window.location.pathname).toBe(path);
  expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
});
it.each([user, admin])('keeps root public and routes dashboard for $role without losing session', async (session) => {
  writeJson(SESSION_KEY, session);
  render(<App />);
  expect(screen.getByRole('navigation', { name: 'Public navigation' })).toHaveTextContent(session.displayName);
  expect(screen.queryByRole('navigation', { name: 'Account navigation' })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Start Reading' })).toHaveAttribute('href', '/blogs');
  await userEvent.setup().click(screen.getByRole('link', { name: 'Go to Dashboard' }));
  expect(window.location.pathname).toBe(session.role === 'admin' ? '/admin' : '/blogs');
  expect(screen.getByRole('navigation', { name: 'Account navigation' })).toBeInTheDocument();
  expect(getSession().value).toEqual(session);
});
it.each([null, user, admin])('shows public nav role/guest links, active Home and toggles mobile disclosure for %j', async (session) => {
  inRouter(<PublicNavbar session={session} />);
  expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
  if (session) {
    expect(screen.getByRole('img', { name: session.role === 'admin' ? 'Administrator avatar' : 'User avatar' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', session.role === 'admin' ? '/admin' : '/blogs');
    expect(screen.queryByRole('link', { name: 'Login' })).not.toBeInTheDocument();
  } else {
    expect(screen.getByRole('link', { name: 'Login' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: 'Get Started' })).toHaveAttribute('href', '/register');
  }
  const actor = userEvent.setup();
  await actor.click(screen.getByRole('button', { name: 'Open menu' }));
  expect(screen.getByRole('button', { name: 'Close menu' })).toHaveAttribute('aria-expanded', 'true');
  expect(document.getElementById('public-navigation')).toHaveClass('flex');
  await actor.click(screen.getByRole('button', { name: 'Close menu' }));
  expect(screen.getByRole('button', { name: 'Open menu' })).toHaveAttribute('aria-expanded', 'false');
  await actor.click(screen.getByRole('button', { name: 'Open menu' }));
  await actor.click(screen.getByRole('link', { name: session ? 'Dashboard' : 'Login' }));
  expect(screen.getByRole('button', { name: 'Open menu' })).toHaveAttribute('aria-expanded', 'false');
  expect(screen.getByText(`Location: ${session ? session.role === 'admin' ? '/admin' : '/blogs' : '/login'}`)).toBeInTheDocument();
});
it('closes public mobile nav with Escape and marks Login active after navigation', async () => {
  inRouter(<PublicNavbar />);
  const actor = userEvent.setup();
  await actor.click(screen.getByRole('button', { name: 'Open menu' }));
  screen.getByRole('link', { name: 'Home' }).focus();
  await actor.keyboard('{Escape}');
  expect(screen.getByRole('button', { name: 'Open menu' })).toHaveAttribute('aria-expanded', 'false');
  await actor.click(screen.getByRole('link', { name: 'Login' }));
  expect(screen.getByRole('link', { name: 'Login' })).toHaveAttribute('aria-current', 'page');
});
it.each([null, user, admin])('PostCard safely renders text and role destination for %j', async (session) => {
  const content = '<img src=x onerror=alert(1)>\n' + 'x'.repeat(200);
  inRouter(<PostCard post={{ ...post, content }} session={session} />);
  expect(screen.getByText((_, element) => element.tagName === 'P' && element.textContent === content.slice(0, 120))).toBeInTheDocument();
  expect(document.querySelector('img')).toBeNull();
  expect(screen.getByRole('img', { name: 'User avatar' })).toBeInTheDocument();
  expect(screen.getByText('Jan 02 2026')).toHaveAttribute('datetime', post.createdAt);
  await userEvent.setup().click(screen.getByRole('link', { name: 'Read post: Local note' }));
  expect(screen.getByText(`Location: ${session ? '/blog/p1' : '/login'}`)).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /Edit/ })).not.toBeInTheDocument();
});
it('cycles accents and distinguishes fixed-admin author without reading users', () => {
  inRouter(
    <>
      {[0, 1, 2, 3].map((index) => (
        <PostCard key={index} post={{ ...post, authorId: 'admin' }} index={index} />
      ))}
    </>
  );
  const cards = screen.getAllByRole('article');
  expect(cards[0]).toHaveClass('border-t-primary-500');
  expect(cards[1]).toHaveClass('border-t-pink-500');
  expect(cards[2]).toHaveClass('border-t-teal-500');
  expect(cards[3]).toHaveClass('border-t-primary-500');
  expect(screen.getAllByRole('img', { name: 'Administrator avatar' })).toHaveLength(4);
});
it('footer contains only exact source links/year with keyboard focus styling and navigation', async () => {
  inRouter(<Footer />);
  const links = within(screen.getByRole('navigation', { name: 'Footer' })).getAllByRole('link');
  expect(links.map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
    ['Home', '/'], ['All Blogs', '/blogs'], ['Login', '/login'], ['Register', '/register']
  ]);
  expect(screen.getByRole('contentinfo')).toHaveTextContent(`© ${new Date().getFullYear()} WriteSpace.`);
  const actor = userEvent.setup();
  for (const link of links) {
    await actor.tab();
    expect(link).toHaveFocus();
    expect(link).toHaveClass('focus-visible:ring-2');
  }
  await actor.keyboard('{Enter}');
  expect(screen.getByText('Location: /register')).toBeInTheDocument();
});
