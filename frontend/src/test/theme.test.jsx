/** Verify independent appearance helpers and real root/navigation interactions. */
import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../App.jsx';
import { PublicNavbar } from '../components/PublicNavbar.jsx';
import { AuthenticatedNavbar } from '../components/AuthenticatedNavbar.jsx';
import { ThemeToggle } from '../components/ThemeToggle.jsx';
import { readString, writeString } from '../utils/storage.js';
import { applyRootTheme, normalizeTheme, readTheme, setThemePreference, THEME_KEY } from '../utils/theme.js';

const session = {
  userId: '11111111-1111-4111-8111-111111111111',
  username: 'avery',
  displayName: 'Avery',
  role: 'user'
};

afterEach(() => {
  document.documentElement.className = '';
});

describe('plain string and theme helpers', () => {
  it.each(['light', 'dark', '', '"dark"', '{broken'])('reads and writes exact plain bytes %j', (value) => {
    expect(readString(THEME_KEY)).toEqual({ ok: true, value: null });
    expect(writeString(THEME_KEY, value)).toEqual({ ok: true, value: undefined });
    expect(readString(THEME_KEY)).toEqual({ ok: true, value });
    expect(localStorage.getItem(THEME_KEY)).toBe(value);
  });

  it.each(['method', 'property'])('contains %s read and write faults without corrupting saved bytes', (boundary) => {
    localStorage.setItem(THEME_KEY, 'dark');
    if (boundary === 'method') {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    } else {
      vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new Error('denied'); });
    }
    expect(readString(THEME_KEY).error.code).toBe('STORAGE_UNAVAILABLE');
    expect(readTheme()).toBe('light');
    expect(writeString(THEME_KEY, 'light').error.code).toBe('STORAGE_WRITE_FAILED');
    expect(setThemePreference('light').error.code).toBe('STORAGE_WRITE_FAILED');
    vi.restoreAllMocks();
    expect(localStorage.getItem(THEME_KEY)).toBe('dark');
  });

  it.each([
    ['light', 'light'], ['dark', 'dark'], [null, 'light'], [undefined, 'light'],
    ['', 'light'], ['sepia', 'light'], ['DARK', 'light'], [' dark ', 'light'],
    ['"dark"', 'light'], [false, 'light'], [1, 'light'], [{}, 'light'], [[], 'light']
  ])('normalizes %j to %s without writing', (raw, expected) => {
    const write = vi.spyOn(Storage.prototype, 'setItem');
    expect(normalizeTheme(raw)).toBe(expected);
    expect(write).not.toHaveBeenCalled();
  });

  it.each([null, 'light', 'dark', 'sepia', '"dark"', ''])('reads preference %j without repairing storage', (raw) => {
    if (raw !== null) localStorage.setItem(THEME_KEY, raw);
    const write = vi.spyOn(Storage.prototype, 'setItem');
    expect(readTheme()).toBe(raw === 'dark' ? 'dark' : 'light');
    expect(localStorage.getItem(THEME_KEY)).toBe(raw);
    expect(write).not.toHaveBeenCalled();
  });

  it.each(['light', 'dark', 'sepia'])('persists normalized %s only under the sole theme key', (mode) => {
    localStorage.setItem('writespace_session', JSON.stringify(session));
    localStorage.setItem('writespace_posts', '[]');
    localStorage.setItem('writespace_users', '[]');
    const write = vi.spyOn(Storage.prototype, 'setItem');
    expect(setThemePreference(mode)).toEqual({ ok: true, value: undefined });
    expect(write.mock.calls).toEqual([[THEME_KEY, mode === 'dark' ? 'dark' : 'light']]);
    expect(localStorage.getItem('writespace_session')).toBe(JSON.stringify(session));
    expect(localStorage.getItem('writespace_posts')).toBe('[]');
    expect(localStorage.getItem('writespace_users')).toBe('[]');
    expect(localStorage.length).toBe(4);
  });

  it('applies and removes only html.dark idempotently without storage access', () => {
    document.documentElement.className = 'retained';
    const read = vi.spyOn(Storage.prototype, 'getItem');
    const write = vi.spyOn(Storage.prototype, 'setItem');
    applyRootTheme('dark');
    applyRootTheme('dark');
    expect(document.documentElement.className).toBe('retained dark');
    applyRootTheme('light');
    expect(document.documentElement.className).toBe('retained');
    applyRootTheme('dark');
    applyRootTheme('sepia');
    expect(document.documentElement.className).toBe('retained');
    expect(read).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });
});

describe('root-owned theme lifecycle', () => {
  it.each([null, 'light', 'dark', '', 'sepia', '"dark"'])('initializes %j in StrictMode and rerenders without writes', (raw) => {
    if (raw !== null) localStorage.setItem(THEME_KEY, raw);
    document.documentElement.className = 'retained dark';
    const write = vi.spyOn(Storage.prototype, 'setItem');
    const view = render(<StrictMode><App /></StrictMode>);
    view.rerender(<StrictMode><App /></StrictMode>);
    expect(document.documentElement.classList.contains('dark')).toBe(raw === 'dark');
    expect(document.documentElement.classList.contains('retained')).toBe(true);
    expect(screen.getByRole('button', { name: raw === 'dark' ? 'Switch to light mode' : 'Switch to dark mode' })).toBeInTheDocument();
    expect(write).not.toHaveBeenCalled();
    expect(localStorage.getItem(THEME_KEY)).toBe(raw);
  });

  it.each(['method', 'property'])('defaults to light on a throwing storage %s without writing', (boundary) => {
    document.documentElement.className = 'dark';
    const write = vi.spyOn(Storage.prototype, 'setItem');
    if (boundary === 'method') {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    } else {
      vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new Error('denied'); });
    }
    render(<App />);
    expect(document.documentElement).not.toHaveClass('dark');
    expect(screen.getByRole('button', { name: 'Switch to dark mode' })).toBeInTheDocument();
    expect(write).not.toHaveBeenCalled();
  });

  it('persists pointer, Enter, and Space selections exactly once each and reuses saved mode on remount', async () => {
    const actor = userEvent.setup();
    const write = vi.spyOn(Storage.prototype, 'setItem');
    render(<StrictMode><App /></StrictMode>);
    await actor.click(screen.getByRole('button', { name: 'Switch to dark mode' }));
    expect(document.documentElement).toHaveClass('dark');
    expect(localStorage.getItem(THEME_KEY)).toBe('dark');
    await actor.keyboard('{Enter}');
    expect(document.documentElement).not.toHaveClass('dark');
    expect(localStorage.getItem(THEME_KEY)).toBe('light');
    await actor.keyboard(' ');
    expect(document.documentElement).toHaveClass('dark');
    expect(write.mock.calls).toEqual([[THEME_KEY, 'dark'], [THEME_KEY, 'light'], [THEME_KEY, 'dark']]);
    cleanup();
    render(<App />);
    expect(document.documentElement).toHaveClass('dark');
    expect(write).toHaveBeenCalledTimes(3);
  });

  it.each(['method', 'property'])('keeps toggled root appearance on failed %s writes', async (boundary) => {
    localStorage.setItem(THEME_KEY, 'light');
    render(<App />);
    if (boundary === 'method') {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    } else {
      vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new Error('denied'); });
    }
    const actor = userEvent.setup();
    await actor.click(screen.getByRole('button', { name: 'Switch to dark mode' }));
    expect(document.documentElement).toHaveClass('dark');
    await actor.click(screen.getByRole('button', { name: 'Switch to light mode' }));
    expect(document.documentElement).not.toHaveClass('dark');
    await actor.click(screen.getByRole('button', { name: 'Switch to dark mode' }));
    vi.restoreAllMocks();
    expect(localStorage.getItem(THEME_KEY)).toBe('light');
    expect(document.documentElement).toHaveClass('dark');
    cleanup();
    render(<App />);
    expect(document.documentElement).not.toHaveClass('dark');
  });

  it.each(['user', 'admin'])('preserves preference through %s route/menu changes and session-only logout', async (role) => {
    const identity = role === 'admin' ? { userId: 'admin', username: 'admin', displayName: 'Avery', role } : session;
    localStorage.setItem('writespace_session', JSON.stringify(identity));
    localStorage.setItem('writespace_posts', '[]');
    localStorage.setItem('writespace_users', '[]');
    localStorage.setItem(THEME_KEY, 'dark');
    const write = vi.spyOn(Storage.prototype, 'setItem');
    const remove = vi.spyOn(Storage.prototype, 'removeItem');
    const actor = userEvent.setup();
    render(<App />);
    await actor.click(screen.getByRole('button', { name: 'Open menu' }));
    await actor.click(within(screen.getByRole('navigation', { name: 'Public navigation' })).getByRole('link', { name: 'Dashboard' }));
    expect(window.location.pathname).toBe(role === 'admin' ? '/admin' : '/blogs');
    await actor.click(screen.getByRole('button', { name: 'Open menu' }));
    await actor.click(screen.getByRole('button', { name: 'Close menu' }));
    await actor.click(screen.getByRole('button', { name: /Avery/ }));
    expect(screen.getByText(`Signed in as ${role}`)).toBeInTheDocument();
    await actor.keyboard('{Escape}');
    expect(screen.queryByRole('button', { name: 'Log out' })).not.toBeInTheDocument();
    await actor.click(screen.getByRole('button', { name: /Avery/ }));
    await actor.click(screen.getByRole('button', { name: 'Log out' }));
    expect(window.location.pathname).toBe('/');
    expect(localStorage.getItem('writespace_session')).toBeNull();
    expect(localStorage.getItem(THEME_KEY)).toBe('dark');
    expect(localStorage.getItem('writespace_posts')).toBe('[]');
    expect(localStorage.getItem('writespace_users')).toBe('[]');
    expect(remove.mock.calls).toEqual([['writespace_session']]);
    expect(write).not.toHaveBeenCalled();
    expect(document.documentElement).toHaveClass('dark');
    await actor.click(screen.getByRole('button', { name: 'Switch to light mode' }));
    await actor.click(screen.getByRole('button', { name: 'Open menu' }));
    await actor.click(within(screen.getByRole('navigation', { name: 'Public navigation' })).getByRole('link', { name: 'Login', exact: true }));
    expect(window.location.pathname).toBe('/login');
    expect(write.mock.calls).toEqual([[THEME_KEY, 'light']]);
  });

  it('activates authenticated theme control while preserving session and disclosures', async () => {
    localStorage.setItem('writespace_session', JSON.stringify(session));
    window.history.replaceState({}, '', '/blogs');
    const write = vi.spyOn(Storage.prototype, 'setItem');
    render(<App />);
    const actor = userEvent.setup();
    await actor.click(screen.getByRole('button', { name: /Avery/ }));
    await actor.click(screen.getByRole('button', { name: 'Switch to dark mode' }));
    expect(document.documentElement).toHaveClass('dark');
    expect(screen.getByText('Signed in as user')).toBeInTheDocument();
    expect(localStorage.getItem('writespace_session')).toBe(JSON.stringify(session));
    expect(write.mock.calls).toEqual([[THEME_KEY, 'dark']]);
  });
});

describe('native accessible control and navigation composition', () => {
  it('never activates while rendering or focusing and exposes target/focus utilities', async () => {
    const onToggle = vi.fn();
    const view = render(<ThemeToggle theme="light" onToggle={onToggle} />);
    const button = screen.getByRole('button', { name: 'Switch to dark mode' });
    expect(button).toHaveAttribute('type', 'button');
    expect(button).toHaveClass('min-h-11', 'min-w-11', 'focus-visible:ring-2');
    await userEvent.setup().tab();
    expect(button).toHaveFocus();
    view.rerender(<ThemeToggle theme="dark" onToggle={onToggle} />);
    expect(screen.getByRole('button', { name: 'Switch to light mode' })).toHaveFocus();
    expect(onToggle).not.toHaveBeenCalled();
  });

  it.each([PublicNavbar, AuthenticatedNavbar])('keeps %s toggle outside the mobile disclosure and does not activate on render/menu changes', async (Navbar) => {
    const onToggle = vi.fn();
    const view = render(
      <MemoryRouter>
        <Navbar session={session} onSessionChange={vi.fn()} theme="dark" onToggle={onToggle} />
      </MemoryRouter>
    );
    const button = screen.getByRole('button', { name: 'Switch to light mode' });
    expect(button.closest('#public-navigation, #account-navigation')).toBeNull();
    const actor = userEvent.setup();
    await actor.click(screen.getByRole('button', { name: 'Open menu' }));
    await actor.click(screen.getByRole('button', { name: 'Close menu' }));
    view.rerender(
      <MemoryRouter>
        <Navbar session={session} onSessionChange={vi.fn()} theme="light" onToggle={onToggle} />
      </MemoryRouter>
    );
    expect(onToggle).not.toHaveBeenCalled();
    await actor.click(screen.getByRole('button', { name: 'Switch to dark mode' }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
