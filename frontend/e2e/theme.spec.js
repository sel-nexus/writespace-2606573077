/** Exercise real storage-backed appearance journeys; use goto only for initial entry. */
import { test, expect } from './fixtures.js';

/**
 * Seed raw preference bytes once and instrument only preference writes.
 * Args:
 *   page: The isolated browser page.
 *   options: Raw preference, optional identity, and targeted storage fault.
 * Returns:
 *   A registered init script; reloads preserve real localStorage instead of reseeding.
 */
async function prepareTheme(page, { raw = null, session = null, fault = null } = {}) {
  await page.addInitScript(({ raw, session, fault }) => {
    if (!sessionStorage.getItem('theme_journey_seeded')) {
      localStorage.clear();
      if (raw !== null) localStorage.setItem('writespace_theme', raw);
      if (session) localStorage.setItem('writespace_session', JSON.stringify(session));
      localStorage.setItem('writespace_posts', '[]');
      localStorage.setItem('writespace_users', '[]');
      sessionStorage.setItem('theme_journey_seeded', 'true');
    }
    const realGet = Storage.prototype.getItem;
    const realSet = Storage.prototype.setItem;
    const descriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');
    window.themeWriteAttempts = [];
    Storage.prototype.setItem = function (key, value) {
      if (this === window.localStorage && key === 'writespace_theme') {
        window.themeWriteAttempts.push([key, value]);
        if (fault === 'write') throw new DOMException('Quota exceeded', 'QuotaExceededError');
      }
      return realSet.call(this, key, value);
    };
    if (fault === 'read') {
      Storage.prototype.getItem = function (key) {
        if (this === window.localStorage && key === 'writespace_theme') {
          throw new DOMException('Read denied', 'SecurityError');
        }
        return realGet.call(this, key);
      };
    }
    if (fault === 'property') {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() { throw new DOMException('Access denied', 'SecurityError'); }
      });
    }
    window.restoreThemeStorage = () => {
      Storage.prototype.getItem = realGet;
      Storage.prototype.setItem = realSet;
      if (fault === 'property') Object.defineProperty(window, 'localStorage', descriptor);
    };
  }, { raw, session, fault });
}

/** Open responsive navigation only when the browser renders its mobile trigger. */
async function openMobileMenu(page) {
  const menu = page.getByRole('button', { name: 'Open menu' });
  if (await menu.isVisible()) await menu.click();
}

for (const raw of [null, 'light', 'dark', 'sepia', '"dark"', '']) {
  test(`raw preference ${JSON.stringify(raw)} initializes without writes and persists explicit selection`, async ({ page, browserErrors }) => {
    await prepareTheme(page, { raw });
    await page.goto('/');
    const dark = raw === 'dark';
    await expect(page.locator('html')).toHaveClass(dark ? /\bdark\b/ : /^(?!.*\bdark\b).*$/);
    expect(await page.evaluate(() => localStorage.getItem('writespace_theme'))).toBe(raw);
    expect(await page.evaluate(() => window.themeWriteAttempts)).toEqual([]);
    const toggle = page.getByRole('button', { name: dark ? 'Switch to light mode' : 'Switch to dark mode' });
    await expect(toggle).toBeVisible();
    const bounds = await toggle.boundingBox();
    expect(bounds.height).toBeGreaterThanOrEqual(44);
    expect(bounds.width).toBeGreaterThanOrEqual(44);
    await openMobileMenu(page);
    await page.getByRole('navigation', { name: 'Public navigation' }).getByRole('link', { name: 'Login', exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    expect(await page.evaluate(() => window.themeWriteAttempts)).toEqual([]);
    await expect(page.getByLabel('Username', { exact: true })).toBeVisible();
    await page.keyboard.press('Tab');
    await toggle.focus();
    await expect(toggle).toBeFocused();
    expect(await toggle.evaluate((button) => getComputedStyle(button).boxShadow)).not.toBe('none');
    await page.keyboard.press('Enter');
    const selected = dark ? 'light' : 'dark';
    expect(await page.evaluate(() => localStorage.getItem('writespace_theme'))).toBe(selected);
    expect(await page.evaluate(() => window.themeWriteAttempts)).toEqual([['writespace_theme', selected]]);
    await page.reload();
    await expect(page.locator('html')).toHaveClass(selected === 'dark' ? /\bdark\b/ : /^(?!.*\bdark\b).*$/);
    expect(await page.evaluate(() => window.themeWriteAttempts)).toEqual([]);
    await page.getByRole('button', { name: selected === 'dark' ? 'Switch to light mode' : 'Switch to dark mode' }).click();
    expect(await page.evaluate(() => localStorage.getItem('writespace_theme'))).toBe(dark ? 'dark' : 'light');
    expect(browserErrors).toEqual([]);
  });
}

for (const role of ['user', 'admin']) {
  test(`${role} route, mobile and account menus, keyboard toggle, reload, and logout stay independent`, async ({ page, browserErrors }) => {
    const session = {
      userId: role === 'admin' ? 'admin' : '11111111-1111-4111-8111-111111111111',
      username: 'avery', displayName: 'Avery', role
    };
    await prepareTheme(page, { raw: 'dark', session });
    await page.goto('/');
    await openMobileMenu(page);
    await page.getByRole('navigation', { name: 'Public navigation' }).getByRole('link', { name: 'Dashboard' }).click();
    await expect(page).toHaveURL(role === 'admin' ? /\/admin$/ : /\/blogs$/);
    await openMobileMenu(page);
    await page.getByRole('navigation', { name: 'Account navigation' }).getByRole('link', { name: 'Write', exact: true }).click();
    await expect(page).toHaveURL(/\/write$/);
    await page.getByRole('button', { name: /Avery/ }).click();
    await expect(page.getByText(`Signed in as ${role}`, { exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Log out' })).toBeHidden();
    expect(await page.evaluate(() => window.themeWriteAttempts)).toEqual([]);
    const toggle = page.getByRole('button', { name: 'Switch to light mode' });
    await toggle.focus();
    await page.keyboard.press('Space');
    await expect(page.locator('html')).not.toHaveClass(/\bdark\b/);
    await page.getByRole('button', { name: 'Switch to dark mode' }).click();
    expect(await page.evaluate(() => window.themeWriteAttempts)).toEqual([
      ['writespace_theme', 'light'], ['writespace_theme', 'dark']
    ]);
    await page.reload();
    await expect(page.locator('html')).toHaveClass(/\bdark\b/);
    await page.getByRole('button', { name: /Avery/ }).click();
    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('navigation', { name: 'Public navigation' })).toBeVisible();
    expect(await page.evaluate(() => ({
      theme: localStorage.getItem('writespace_theme'), session: localStorage.getItem('writespace_session'),
      posts: localStorage.getItem('writespace_posts'), users: localStorage.getItem('writespace_users'),
      attempts: window.themeWriteAttempts
    }))).toEqual({ theme: 'dark', session: null, posts: '[]', users: '[]', attempts: [] });
    await page.reload();
    await expect(page.locator('html')).toHaveClass(/\bdark\b/);
    expect(browserErrors).toEqual([]);
  });
}

for (const fault of ['read', 'write', 'property']) {
  test(`${fault} storage fault preserves runtime selection without overwriting real saved preference`, async ({ page, browserErrors }) => {
    await prepareTheme(page, { raw: fault === 'write' ? 'light' : 'dark', fault });
    await page.goto('/');
    await expect(page.locator('html')).not.toHaveClass(/\bdark\b/);
    await page.getByRole('button', { name: 'Switch to dark mode' }).click();
    await expect(page.locator('html')).toHaveClass(/\bdark\b/);
    await openMobileMenu(page);
    await page.getByRole('navigation', { name: 'Public navigation' }).getByRole('link', { name: 'Login', exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('button', { name: 'Switch to light mode' })).toBeVisible();
    const saved = await page.evaluate(() => {
      window.restoreThemeStorage();
      return localStorage.getItem('writespace_theme');
    });
    expect(saved).toBe(fault === 'write' ? 'light' : 'dark');
    expect(await page.evaluate(() => window.themeWriteAttempts)).toEqual(fault === 'property' ? [] : [['writespace_theme', 'dark']]);
    await page.reload();
    // The read/property denial remains installed on reload; neither may repair saved bytes.
    await expect(page.locator('html')).not.toHaveClass(/\bdark\b/);
    expect(await page.evaluate(() => window.themeWriteAttempts)).toEqual([]);
    expect(await page.evaluate(() => {
      window.restoreThemeStorage();
      return localStorage.getItem('writespace_theme');
    })).toBe(saved);
    expect(browserErrors).toEqual([]);
  });
}
