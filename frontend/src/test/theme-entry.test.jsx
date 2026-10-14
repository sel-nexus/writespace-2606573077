/** Verify entry presentation and real local-account behavior under the root theme in both modes. */
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, within, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import App from '../App.jsx';
import Landing from '../pages/Landing.jsx';
import Login from '../pages/Login.jsx';
import Register from '../pages/Register.jsx';
import { Field } from '../components/Field.jsx';
import { Alert } from '../components/Alert.jsx';
import { Footer } from '../components/Footer.jsx';

const tagline = 'Your thoughts. Your space. Beautifully simple.';
const reader = {
  id: '11111111-1111-4111-8111-111111111111',
  displayName: 'Avery', username: 'avery', password: 'demo', role: 'user',
  createdAt: '2026-01-01T00:00:00Z'
};
const session = {
  userId: reader.id, displayName: 'Avery', username: 'avery', role: 'user'
};
const post = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', title: 'Local note',
  content: 'First line\nSecond line', createdAt: '2026-01-02T00:00:00Z',
  authorId: reader.id, authorName: 'Avery'
};

/** Expose navigation outcomes without mocking route or domain behavior. @returns {JSX.Element} */
function Location() {
  const { pathname } = useLocation();
  return (
    <p>Location: {pathname}</p>
  );
}

/** Supply only a test router for isolated components. @param {JSX.Element} element @returns {object} */
function inRouter(element) {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      {element}
      <Location />
    </MemoryRouter>
  );
}

/** Exercise a controlled field rather than substituting its change behavior. @returns {JSX.Element} */
function EditableField({ error = '', required = false }) {
  const [value, setValue] = useState('');
  return (
    <Field
      id="nickname"
      label="Nickname"
      value={value}
      required={required}
      error={error}
      autoComplete="nickname"
      onChange={(event) => setValue(event.target.value)}
    />
  );
}

/** Fill registration through shipped accessible labels. @param {object} actor @param {object} overrides @returns {Promise<void>} */
async function fillSignup(actor, overrides = {}) {
  const values = {
    'Display name': 'Avery', Username: 'avery', Password: 'demo',
    'Confirm password': 'demo', ...overrides
  };
  for (const [label, value] of Object.entries(values)) {
    if (value) await actor.type(screen.getByLabelText(label), value);
  }
}

/** Read exact local records while leaving missing values distinct from empty arrays. @returns {object} */
function records() {
  return {
    users: localStorage.getItem('writespace_users'),
    posts: localStorage.getItem('writespace_posts'),
    session: localStorage.getItem('writespace_session'),
    theme: localStorage.getItem('writespace_theme')
  };
}

for (const mode of ['light', 'dark']) {
  describe(`${mode} public entry and authentication`, () => {
    beforeEach(() => {
      localStorage.clear();
      localStorage.setItem('writespace_theme', mode);
      document.documentElement.classList.toggle('dark', mode === 'dark');
      window.history.replaceState({}, '', '/');
    });
    afterEach(() => {
      cleanup();
      vi.restoreAllMocks();
      document.documentElement.classList.remove('dark');
      localStorage.clear();
      window.history.replaceState({}, '', '/');
    });

    it('preserves hero, features, empty copy, disclosure, layout and paired surfaces without writes', () => {
      const before = records();
      render(
        <App />
      );
      expect(document.documentElement.classList.contains('dark')).toBe(mode === 'dark');
      const hero = screen.getByRole('heading', { level: 1, name: tagline });
      expect(hero).toHaveClass('font-display', 'text-hero', 'font-bold', 'tracking-tight');
      expect(hero.closest('[aria-labelledby]')).toHaveClass('grid', 'gap-12', 'lg:grid-cols-[1.2fr_1fr]');
      expect(hero.closest('.max-w-6xl')).toHaveClass('dark:text-slate-100');
      const features = screen.getByRole('region', { name: 'Features' });
      expect(features).toHaveClass('border-border', 'dark:border-slate-700', 'sm:grid-cols-3');
      expect(within(features).getAllByRole('heading').map((element) => element.textContent.trim())).toEqual([
        'Write Freely', 'Private & Local', 'Instant & Fast'
      ]);
      for (const article of within(features).getAllByRole('article')) {
        expect(article).toHaveClass('bg-surface', 'dark:bg-slate-800', 'rounded-card', 'p-6');
        expect(article.querySelector('p:last-child')).toHaveClass('text-foreground-muted', 'dark:text-slate-300');
      }
      expect(screen.getByText('No posts yet — check back soon!')).toHaveClass(
        'bg-surface', 'border-dashed', 'dark:bg-slate-800', 'dark:border-slate-700', 'dark:text-slate-300'
      );
      expect(screen.getByRole('complementary', { name: 'Local demo disclosure' })).toHaveTextContent('Passwords are stored in plaintext.');
      expect(screen.getByRole('complementary')).toHaveClass('bg-surface-raised', 'dark:bg-slate-800', 'dark:text-slate-300');
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Get Started Free' })).toHaveClass(
        'bg-primary-600', 'text-white', 'dark:focus-visible:ring-primary-300', 'dark:focus-visible:ring-offset-slate-950'
      );
      expect(records()).toEqual(before);
    });

    it('preserves newest previews, metadata and guest gate with landing-local dark styling', async () => {
      const posts = [1, 4, 2, 3].map((day) => ({
        ...post, id: `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa${day}`,
        title: `Note ${day}`, createdAt: `2026-01-0${day}T00:00:00Z`
      }));
      localStorage.setItem('writespace_posts', JSON.stringify(posts));
      const before = records();
      render(
        <App />
      );
      const recent = screen.getByRole('region', { name: 'Recent writing' });
      expect(within(recent).getAllByRole('heading', { level: 3 }).map((element) => element.textContent)).toEqual(['Note 4', 'Note 3', 'Note 2']);
      expect(within(recent).getAllByText('Avery')).toHaveLength(3);
      expect(within(recent).getByText('Jan 04, 2026')).toHaveAttribute('datetime', '2026-01-04T00:00:00Z');
      const grid = within(recent).getAllByRole('article')[0].parentElement;
      expect(grid).toHaveClass('md:grid-cols-2', 'lg:grid-cols-3', 'dark:[&>article]:bg-slate-800', 'dark:[&_time]:text-slate-300', 'dark:[&>article>p]:text-slate-300');
      await userEvent.setup().click(screen.getByRole('link', { name: 'Read post: Note 4' }));
      expect(window.location.pathname).toBe('/login');
      expect(screen.getByRole('heading', { name: 'Welcome back.' })).toBeInTheDocument();
      expect(records()).toEqual(before);
    });

    it.each(['corrupt', 'schema', 'unavailable'])('keeps failed %s previews readable without repairing storage', (failure) => {
      localStorage.setItem('writespace_posts', failure === 'schema' ? JSON.stringify([{ ...post, title: 42 }]) : '!');
      const before = records();
      if (failure === 'unavailable') {
        const original = Storage.prototype.getItem;
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (key) {
          if (key === 'writespace_posts') throw new Error('denied');
          return original.call(this, key);
        });
      }
      inRouter(
        <Landing />
      );
      expect(screen.getByRole('status')).toHaveTextContent(failure === 'unavailable' ? 'unavailable' : failure === 'schema' ? 'invalid format' : 'unreadable');
      expect(screen.getByRole('status')).toHaveClass('dark:bg-amber-950', 'dark:text-amber-200', 'dark:border-amber-800');
      expect(screen.getByText('No posts yet — check back soon!')).toBeInTheDocument();
      vi.restoreAllMocks();
      expect(records()).toEqual(before);
    });

    it.each([
      ['Get Started Free', '/register', 'Start your next chapter.'],
      ['Start Reading', '/login', 'Welcome back.'],
      ['Go to Dashboard', '/login', 'Welcome back.']
    ])('keeps guest %s navigation and secondary focus presentation', async (name, path, heading) => {
      render(
        <App />
      );
      const link = screen.getByRole('link', { name });
      if (name !== 'Get Started Free') {
        expect(link).toHaveClass('text-primary-700', 'dark:text-primary-300', 'dark:hover:decoration-primary-300', 'dark:focus-visible:ring-primary-300');
      }
      await userEvent.setup().click(link);
      expect(window.location.pathname).toBe(path);
      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
      expect(records()).toEqual({ users: null, posts: null, session: null, theme: mode });
    });

    it.each([
      [session, '/blogs'],
      [{ userId: 'admin', username: 'admin', displayName: 'Admin', role: 'admin' }, '/admin']
    ])('preserves role-aware public dashboard destination for %j', async (identity, destination) => {
      localStorage.setItem('writespace_session', JSON.stringify(identity));
      const before = records();
      render(
        <App />
      );
      expect(screen.getByRole('heading', { name: tagline })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Start Reading' })).toHaveAttribute('href', '/blogs');
      await userEvent.setup().click(screen.getByRole('link', { name: 'Go to Dashboard' }));
      expect(window.location.pathname).toBe(destination);
      expect(records()).toEqual(before);
    });

    it.each(['Display name', 'Username', 'Password', 'Confirm password'])('retains required signup validation and first-error focus for %s', async (label) => {
      const changed = vi.fn();
      inRouter(
        <Register onSessionChange={changed} />
      );
      const actor = userEvent.setup();
      await fillSignup(actor, { [label]: '' });
      await actor.click(screen.getByRole('button', { name: 'Create account' }));
      const field = screen.getByLabelText(label);
      expect(field).toHaveFocus();
      expect(field).toHaveAccessibleDescription(`${label} is required.`);
      expect(field).toHaveAttribute('aria-invalid', 'true');
      expect(field).toHaveClass('dark:aria-[invalid=true]:border-red-400', 'dark:focus:ring-primary-300');
      const alerts = screen.getAllByRole('alert');
      expect(alerts).toHaveLength(label === 'Password' ? 2 : 1);
      for (const alert of alerts) expect(alert).toHaveClass('text-error', 'dark:text-red-300');
      if (label === 'Password') expect(alerts[1]).toHaveTextContent('Passwords do not match.');
      expect(changed).not.toHaveBeenCalled();
      expect(records()).toEqual({ users: null, posts: null, session: null, theme: mode });
    });

    it.each(['Username', 'Password'])('retains login required validation and focus for %s', async (label) => {
      inRouter(
        <Login onSessionChange={vi.fn()} />
      );
      const actor = userEvent.setup();
      await actor.type(screen.getByLabelText(label === 'Username' ? 'Password' : 'Username'), 'admin');
      await actor.click(screen.getByRole('button', { name: 'Sign in' }));
      expect(screen.getByLabelText(label)).toHaveFocus();
      expect(screen.getByLabelText(label)).toHaveAccessibleDescription(`${label} is required.`);
      expect(records()).toEqual({ users: null, posts: null, session: null, theme: mode });
    });

    it.each(['mismatch', 'reserved', 'duplicate'])('preserves %s signup rejection, values and focus without writes', async (failure) => {
      if (failure === 'duplicate') localStorage.setItem('writespace_users', JSON.stringify([reader]));
      const before = records();
      const changed = vi.fn();
      inRouter(
        <Register onSessionChange={changed} />
      );
      const actor = userEvent.setup();
      await fillSignup(actor, {
        Username: failure === 'reserved' ? ' ADMIN ' : failure === 'duplicate' ? ' AVERY ' : 'avery',
        'Confirm password': failure === 'mismatch' ? 'Demo' : 'demo'
      });
      await actor.click(screen.getByRole('button', { name: 'Create account' }));
      const message = failure === 'mismatch' ? 'Passwords do not match.' : failure === 'reserved' ? 'The admin username is reserved.' : 'That username is already in use.';
      expect(screen.getByRole('alert')).toHaveTextContent(message);
      expect(screen.getByLabelText(failure === 'mismatch' ? 'Confirm password' : 'Username')).toHaveFocus();
      expect(screen.getByLabelText('Display name')).toHaveValue('Avery');
      expect(screen.getByLabelText('Password')).toHaveValue('demo');
      expect(changed).not.toHaveBeenCalled();
      expect(records()).toEqual(before);
    });

    it('recovers from invalid credentials to fixed-admin login without rewriting accounts or theme', async () => {
      const changed = vi.fn();
      inRouter(
        <Login onSessionChange={changed} />
      );
      const actor = userEvent.setup();
      await actor.type(screen.getByLabelText('Username'), 'ADMIN');
      await actor.type(screen.getByLabelText('Password'), 'wrong');
      await actor.click(screen.getByRole('button', { name: 'Sign in' }));
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid username or password.');
      expect(screen.getByRole('alert')).toHaveClass('bg-error-light', 'dark:bg-red-950', 'dark:text-red-200');
      expect(screen.getByLabelText('Username')).toHaveValue('ADMIN');
      expect(screen.getByLabelText('Username')).toHaveAttribute('aria-invalid', 'false');
      expect(records()).toEqual({ users: null, posts: null, session: null, theme: mode });
      await actor.clear(screen.getByLabelText('Password'));
      await actor.type(screen.getByLabelText('Password'), 'admin');
      await actor.click(screen.getByRole('button', { name: 'Sign in' }));
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByText('Location: /admin')).toBeInTheDocument();
      expect(JSON.parse(records().session)).toEqual({ userId: 'admin', username: 'admin', displayName: 'Admin', role: 'admin' });
      expect(records().users).toBeNull();
      expect(records().theme).toBe(mode);
    });

    it.each(['account', 'session', 'corrupt'])('preserves readable signup %s failure and exact partial state', async (failure) => {
      const changed = vi.fn();
      if (failure === 'corrupt') localStorage.setItem('writespace_users', '!');
      if (failure !== 'corrupt') {
        const original = Storage.prototype.setItem;
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
          if (key === (failure === 'account' ? 'writespace_users' : 'writespace_session')) throw new Error('quota');
          return original.call(this, key, value);
        });
      }
      inRouter(
        <Register onSessionChange={changed} />
      );
      const actor = userEvent.setup();
      await fillSignup(actor);
      await actor.click(screen.getByRole('button', { name: 'Create account' }));
      expect(screen.getByRole('alert')).toHaveClass('dark:border-red-800', 'dark:bg-red-950', 'dark:text-red-200');
      expect(screen.getByText('Location: /')).toBeInTheDocument();
      expect(screen.getByLabelText('Username')).toHaveValue('avery');
      expect(changed).not.toHaveBeenCalled();
      expect(records().session).toBeNull();
      expect(records().theme).toBe(mode);
      if (failure === 'session') {
        expect(screen.getByRole('alert')).toHaveTextContent('Your account was saved');
        const users = JSON.parse(records().users);
        expect(users).toHaveLength(1);
        expect(users[0]).toEqual({ ...reader, id: expect.any(String), createdAt: expect.any(String) });
      } else {
        expect(records().users).toBe(failure === 'corrupt' ? '!' : null);
      }
    });

    it.each(['corrupt', 'unavailable', 'session'])('keeps login usable after %s storage failure', async (failure) => {
      localStorage.setItem('writespace_users', failure === 'corrupt' ? '!' : JSON.stringify([reader]));
      const before = records();
      const changed = vi.fn();
      const method = failure === 'session' ? 'setItem' : 'getItem';
      if (failure !== 'corrupt') {
        const original = Storage.prototype[method];
        vi.spyOn(Storage.prototype, method).mockImplementation(function (key, value) {
          if (key === (failure === 'session' ? 'writespace_session' : 'writespace_users')) throw new Error('denied');
          return original.call(this, key, value);
        });
      }
      inRouter(
        <Login onSessionChange={changed} />
      );
      const actor = userEvent.setup();
      await actor.type(screen.getByLabelText('Username'), 'avery');
      await actor.type(screen.getByLabelText('Password'), 'demo');
      await actor.click(screen.getByRole('button', { name: 'Sign in' }));
      expect(screen.getByRole('alert')).toHaveTextContent(failure === 'corrupt' ? 'unreadable' : failure === 'unavailable' ? 'unavailable' : 'could not be saved');
      expect(screen.getByRole('alert')).toHaveClass('dark:text-red-200');
      expect(screen.getByText('Location: /')).toBeInTheDocument();
      expect(screen.getByLabelText('Password')).toHaveValue('demo');
      expect(changed).not.toHaveBeenCalled();
      vi.restoreAllMocks();
      expect(records()).toEqual(before);
    });

    it('signs up, reloads by remount, logs out and signs in through real links with exact identity and independent theme', async () => {
      const actor = userEvent.setup();
      let view = render(
        <App />
      );
      await actor.click(screen.getByRole('link', { name: 'Get Started Free' }));
      const card = screen.getByRole('heading', { name: 'Create an account' }).parentElement;
      expect(card).toHaveClass('bg-surface', 'border-border', 'dark:bg-slate-800', 'dark:border-slate-700');
      expect(screen.getByRole('button', { name: 'Create account' })).toHaveClass('bg-primary-600', 'dark:focus-visible:ring-offset-slate-800');
      await fillSignup(actor);
      await actor.click(screen.getByRole('button', { name: 'Create account' }));
      expect(window.location.pathname).toBe('/blogs');
      const saved = records();
      const users = JSON.parse(saved.users);
      expect(users).toHaveLength(1);
      expect(users[0]).toEqual({ ...reader, id: expect.any(String), createdAt: expect.any(String) });
      expect(JSON.parse(saved.session)).toEqual({ ...session, userId: users[0].id });
      expect(saved.posts).toBeNull();
      expect(saved.theme).toBe(mode);
      view.unmount();
      view = render(
        <App />
      );
      expect(screen.getByRole('heading', { name: 'All Blogs' })).toBeInTheDocument();
      expect(records()).toEqual(saved);
      await actor.click(screen.getByRole('button', { name: /Avery/ }));
      await actor.click(screen.getByRole('button', { name: 'Log out' }));
      expect(window.location.pathname).toBe('/');
      expect(records()).toEqual({ ...saved, session: null });
      await actor.click(screen.getByRole('link', { name: 'Start Reading' }));
      expect(screen.getByText(/Demo administrator: username/)).toHaveClass('bg-surface-raised', 'dark:bg-slate-900', 'dark:text-primary-200');
      const signupLink = screen.getByRole('link', { name: 'Create an account' });
      expect(signupLink).toHaveClass('dark:text-primary-300', 'dark:focus-visible:ring-primary-300');
      await actor.click(signupLink);
      await actor.click(screen.getByRole('link', { name: 'Sign in' }));
      await actor.type(screen.getByLabelText('Username'), ' AVERY ');
      await actor.type(screen.getByLabelText('Password'), 'demo');
      await actor.click(screen.getByRole('button', { name: 'Sign in' }));
      expect(window.location.pathname).toBe('/blogs');
      expect(records()).toEqual(saved);
      view.unmount();
    });

    it('preserves optional controlled field semantics, keyboard editing, error association and recovery', async () => {
      const view = render(
        <EditableField />
      );
      const actor = userEvent.setup();
      const input = screen.getByRole('textbox', { name: 'Nickname' });
      await actor.tab();
      expect(input).toHaveFocus();
      await actor.type(input, 'Avery');
      expect(input).toHaveValue('Avery');
      expect(input).not.toBeRequired();
      expect(input).toHaveAttribute('autocomplete', 'nickname');
      expect(input).toHaveAttribute('aria-invalid', 'false');
      expect(input).not.toHaveAttribute('aria-describedby');
      expect(input).toHaveClass('bg-surface', 'text-foreground', 'border-border', 'focus:ring-2', 'dark:bg-slate-900', 'dark:text-slate-100', 'dark:border-slate-600', 'dark:focus:ring-primary-300');
      view.rerender(
        <EditableField error="Try another name." required />
      );
      expect(input).toHaveFocus();
      expect(input).toBeRequired();
      expect(input).toHaveAccessibleDescription('Try another name.');
      expect(screen.getByRole('alert')).toHaveAttribute('id', 'nickname-error');
      view.rerender(
        <EditableField required />
      );
      expect(input).toHaveFocus();
      expect(input).not.toHaveAttribute('aria-describedby');
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it.each([
      ['error', 'alert', 'assertive', 'dark:bg-red-950', 'dark:text-red-200', 'dark:border-red-800', 'bg-error-light'],
      ['warning', 'status', 'polite', 'dark:bg-amber-950', 'dark:text-amber-200', 'dark:border-amber-800', 'bg-warning-light'],
      ['info', 'status', 'polite', 'dark:bg-slate-900', 'dark:text-primary-200', 'dark:border-primary-800', 'bg-info-light'],
      ['success', 'status', 'polite', 'dark:bg-green-950', 'dark:text-green-200', 'dark:border-green-800', 'bg-success-light']
    ])('preserves %s alert announcement, paired colors and empty-message removal', (variant, role, live, background, text, border, light) => {
      const view = render(
        <Alert variant={variant} message="Feedback <not markup>" />
      );
      expect(screen.getByRole(role)).toHaveTextContent('Feedback <not markup>');
      expect(screen.getByRole(role)).toHaveAttribute('aria-live', live);
      expect(screen.getByRole(role)).toHaveClass(background, text, border, light, 'rounded-control', 'p-4');
      view.rerender(
        <Alert variant={variant} message="" />
      );
      expect(view.container).toBeEmptyDOMElement();
    });

    it('preserves footer landmark, shipped destinations, year and keyboard link activation', async () => {
      inRouter(
        <Footer />
      );
      const footer = screen.getByRole('contentinfo');
      expect(footer).toHaveClass('bg-surface', 'border-border', 'dark:bg-slate-900', 'dark:border-slate-700');
      expect(footer).toHaveTextContent(`© ${new Date().getFullYear()} WriteSpace.`);
      const links = within(screen.getByRole('navigation', { name: 'Footer' })).getAllByRole('link');
      expect(links.map((link) => [link.textContent.trim(), link.getAttribute('href')])).toEqual([
        ['Home', '/'], ['All Blogs', '/blogs'], ['Login', '/login'], ['Register', '/register']
      ]);
      const actor = userEvent.setup();
      for (const link of links) {
        await actor.tab();
        expect(link).toHaveFocus();
        expect(link).toHaveClass('min-h-11', 'text-primary-700', 'dark:text-primary-300', 'dark:focus-visible:ring-primary-300');
      }
      await actor.keyboard('{Enter}');
      expect(screen.getByText('Location: /register')).toBeInTheDocument();
      expect(records()).toEqual({ users: null, posts: null, session: null, theme: mode });
    });
  });
}
