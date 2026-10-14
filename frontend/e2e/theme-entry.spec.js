/** Exercise themed public/signup/login journeys and attach parent-owned visual preflight evidence. */
import { test, expect } from './fixtures.js';

const reader = {
  id: '11111111-1111-4111-8111-111111111111', displayName: 'Existing Reader',
  username: 'existing', password: 'demo', role: 'user', createdAt: '2026-01-01T00:00:00Z'
};
const posts = [1, 4, 2, 3].map((day) => ({
  id: `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa${day}`, title: `Entry note ${day}`,
  content: `Browser-local words ${day}.`, createdAt: `2026-01-0${day}T00:00:00Z`,
  authorId: reader.id, authorName: reader.displayName
}));

/** Select appearance using the shipped toggle, including an explicit persisted light choice. @param {object} page @param {string} mode @returns {Promise<void>} */
async function chooseMode(page, mode) {
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  if (mode === 'light') await page.getByRole('button', { name: 'Switch to light mode' }).click();
  await expect(page.locator('html')).toHaveClass(mode === 'dark' ? /\bdark\b/ : /^(?!.*\bdark\b).*$/);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('writespace_theme'))).toBe(mode);
}

/** Read every persisted key and its exact bytes for no-incidental-write assertions. @param {object} page @returns {Promise<object>} */
async function storage(page) {
  return page.evaluate(() => Object.fromEntries(
    Object.keys(localStorage).sort().map((key) => [key, localStorage.getItem(key)])
  ));
}

/** Capture representative rendered evidence for the parent's desktop/mobile preflight. @param {object} page @param {object} testInfo @param {string} name @returns {Promise<void>} */
async function attachView(page, testInfo, name) {
  await testInfo.attach(`${name}-screenshot`, {
    body: await page.screenshot({ fullPage: true, animations: 'disabled' }),
    contentType: 'image/png'
  });
  await testInfo.attach(`${name}-accessibility`, {
    body: JSON.stringify(await page.accessibility.snapshot({ interestingOnly: false }), null, 2),
    contentType: 'application/json'
  });
  const styles = await page.evaluate(() => {
    const selectors = [
      'main', 'h1', '[aria-label="Features"] article',
      '[aria-labelledby="recent-title"] article', '[aria-labelledby="recent-title"] time',
      '[aria-labelledby="recent-title"] article > p',
      '[aria-labelledby="recent-title"] a', '[aria-label="Local demo disclosure"]',
      'form', 'form input', 'form button', 'form input:focus', '[role="alert"]',
      '[role="status"]', 'footer', 'footer a', 'a:focus-visible'
    ];
    return selectors.flatMap((selector) => [...document.querySelectorAll(selector)].map((element) => {
      const style = getComputedStyle(element);
      return {
        selector, tag: element.tagName, text: element.textContent,
        classes: element.className, color: style.color, background: style.backgroundColor,
        borderColor: style.borderColor, borderTopColor: style.borderTopColor,
        fontFamily: style.fontFamily, fontSize: style.fontSize, lineHeight: style.lineHeight,
        outline: style.outline, boxShadow: style.boxShadow, display: style.display,
        width: element.getBoundingClientRect().width
      };
    }));
  });
  await testInfo.attach(`${name}-computed-styles`, {
    body: JSON.stringify(styles, null, 2), contentType: 'application/json'
  });
  await testInfo.attach(`${name}-html`, {
    body: await page.content(), contentType: 'text/html'
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

/** Fill or replace signup controls using visible labels. @param {object} page @param {object} overrides @returns {Promise<void>} */
async function fillSignup(page, overrides = {}) {
  const values = {
    'Display name': 'Avery Lane', Username: 'avery', Password: 'demo-pass',
    'Confirm password': 'demo-pass', ...overrides
  };
  for (const [label, value] of Object.entries(values)) await page.getByLabel(label, { exact: true }).fill(value);
}

/** Open the shipped account menu and log out rather than mutating the session in test code. @param {object} page @returns {Promise<void>} */
async function logout(page) {
  await page.getByRole('button', { name: /Avery Lane/ }).click();
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
}

for (const mode of ['light', 'dark']) {
  test(`${mode}: visitor previews, signup validation, login recovery and reload preserve exact records`, async ({ page, seedStorage }, testInfo) => {
    await seedStorage({ writespace_posts: posts, writespace_users: [reader] });
    await page.goto('/');
    await chooseMode(page, mode);
    const initial = await storage(page);
    expect(initial).toEqual({
      writespace_posts: JSON.stringify(posts), writespace_users: JSON.stringify([reader]),
      writespace_theme: mode
    });
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your thoughts. Your space. Beautifully simple.');
    await expect(page.getByRole('region', { name: 'Features' }).getByRole('article')).toHaveCount(3);
    const recent = page.getByRole('region', { name: 'Recent writing' });
    await expect(recent.getByRole('heading', { level: 3 })).toHaveText(['Entry note 4', 'Entry note 3', 'Entry note 2']);
    await expect(recent.getByText('Jan 04, 2026')).toBeVisible();
    await expect(recent.getByText('Existing Reader', { exact: true })).toHaveCount(3);
    await expect(recent.getByRole('article').first()).toHaveCSS('background-color', mode === 'dark' ? 'rgb(30, 41, 59)' : 'rgb(255, 255, 255)');
    if (mode === 'dark') {
      await expect(recent.locator('time').first()).toHaveCSS('color', 'rgb(203, 213, 225)');
      await expect(recent.getByRole('article').first().locator(':scope > p')).toHaveCSS('color', 'rgb(203, 213, 225)');
    }
    await expect(page.getByRole('contentinfo')).toHaveCSS('background-color', mode === 'dark' ? 'rgb(15, 23, 42)' : 'rgb(255, 255, 255)');
    await attachView(page, testInfo, `${mode}-public-previews`);

    await recent.getByRole('link', { name: 'Read post: Entry note 4' }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
    expect(await storage(page)).toEqual(initial);
    await page.getByRole('link', { name: 'Create an account', exact: true }).click();
    await expect(page).toHaveURL(/\/register$/);
    await expect(page.getByRole('heading', { name: 'Start your next chapter.' })).toBeVisible();
    await expect(page.getByLabel('Display name')).toHaveCSS('background-color', mode === 'dark' ? 'rgb(15, 23, 42)' : 'rgb(255, 255, 255)');
    await expect(page.getByLabel('Display name')).toHaveAttribute('autocomplete', 'nickname');
    await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'password');
    await expect(page.getByLabel('Confirm password')).toHaveAttribute('autocomplete', 'new-password');
    await attachView(page, testInfo, `${mode}-register-pristine`);

    for (const label of ['Display name', 'Username', 'Password', 'Confirm password']) {
      await fillSignup(page, { [label]: '' });
      await page.getByRole('button', { name: 'Create account', exact: true }).click();
      const field = page.getByLabel(label, { exact: true });
      await expect(field).toBeFocused();
      await expect(field).toHaveAttribute('aria-invalid', 'true');
      const errorId = await field.getAttribute('aria-describedby');
      await expect(page.locator(`[id="${errorId}"]`)).toHaveText(`${label} is required.`);
      expect(await storage(page)).toEqual(initial);
    }
    await fillSignup(page, { 'Confirm password': 'Demo-pass' });
    await page.getByRole('button', { name: 'Create account', exact: true }).click();
    await expect(page.getByLabel('Confirm password')).toBeFocused();
    await expect(page.getByRole('alert')).toHaveText('Passwords do not match.');
    await expect(page.getByLabel('Password', { exact: true })).toHaveValue('demo-pass');
    if (mode === 'dark') {
      await expect(page.getByRole('alert')).toHaveCSS('color', 'rgb(252, 165, 165)');
      await expect(page.getByLabel('Confirm password')).toHaveCSS('border-color', 'rgb(248, 113, 113)');
    }
    expect(await page.getByLabel('Confirm password').evaluate((element) => getComputedStyle(element).boxShadow)).not.toBe('none');
    await attachView(page, testInfo, `${mode}-register-error-focus`);
    for (const [username, message] of [
      [' ADMIN ', 'The admin username is reserved.'],
      [' EXISTING ', 'That username is already in use.']
    ]) {
      await fillSignup(page, { Username: username });
      await page.getByRole('button', { name: 'Create account', exact: true }).click();
      await expect(page.getByLabel('Username')).toBeFocused();
      await expect(page.getByRole('alert')).toHaveText(message);
      expect(await storage(page)).toEqual(initial);
    }
    await fillSignup(page);
    await page.getByRole('button', { name: 'Create account', exact: true }).click();
    await expect(page).toHaveURL(/\/blogs$/);
    await expect(page.getByRole('heading', { name: 'All Blogs', exact: true })).toBeVisible();
    const saved = await storage(page);
    const users = JSON.parse(saved.writespace_users);
    expect(users).toHaveLength(2);
    expect(users[0]).toEqual(reader);
    expect(users[1]).toEqual({
      id: expect.stringMatching(/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i),
      displayName: 'Avery Lane', username: 'avery', password: 'demo-pass', role: 'user',
      createdAt: expect.any(String)
    });
    expect(new Date(users[1].createdAt).toISOString()).toBe(users[1].createdAt);
    expect(JSON.parse(saved.writespace_session)).toEqual({
      userId: users[1].id, displayName: 'Avery Lane', username: 'avery', role: 'user'
    });
    expect(saved).toEqual({ ...initial, writespace_users: JSON.stringify(users), writespace_session: saved.writespace_session });
    await page.reload();
    await expect(page.getByRole('heading', { name: 'All Blogs', exact: true })).toBeVisible();
    expect(await storage(page)).toEqual(saved);
    await expect(page.locator('html')).toHaveClass(mode === 'dark' ? /\bdark\b/ : /^(?!.*\bdark\b).*$/);
    await logout(page);
    const loggedOut = { ...saved };
    delete loggedOut.writespace_session;
    expect(await storage(page)).toEqual(loggedOut);

    await page.getByRole('link', { name: 'Start Reading', exact: true }).click();
    for (const label of ['Username', 'Password']) {
      await page.getByLabel('Username', { exact: true }).fill(label === 'Username' ? '' : 'avery');
      await page.getByLabel('Password', { exact: true }).fill(label === 'Password' ? '' : 'demo-pass');
      await page.getByRole('button', { name: 'Sign in', exact: true }).click();
      await expect(page.getByLabel(label, { exact: true })).toBeFocused();
      await expect(page.getByRole('alert')).toHaveText(`${label} is required.`);
      expect(await storage(page)).toEqual(loggedOut);
    }
    await page.getByLabel('Username', { exact: true }).fill(' AVERY ');
    await page.getByLabel('Password', { exact: true }).fill('wrong');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('alert')).toHaveText('Invalid username or password.');
    await expect(page.getByRole('alert')).toHaveAttribute('aria-live', 'assertive');
    await expect(page.getByLabel('Username')).toHaveValue(' AVERY ');
    await expect(page.getByLabel('Username')).toHaveAttribute('aria-invalid', 'false');
    if (mode === 'dark') await expect(page.getByRole('alert')).toHaveCSS('background-color', 'rgb(69, 10, 10)');
    await page.getByLabel('Password', { exact: true }).focus();
    await attachView(page, testInfo, `${mode}-login-error-focus`);
    expect(await storage(page)).toEqual(loggedOut);
    await page.getByRole('link', { name: 'Create an account', exact: true }).click();
    await page.getByRole('link', { name: 'Sign in', exact: true }).click();
    await page.getByLabel('Username', { exact: true }).fill(' AVERY ');
    await page.getByLabel('Password', { exact: true }).fill('demo-pass');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page).toHaveURL(/\/blogs$/);
    expect(await storage(page)).toEqual(saved);
    await page.reload();
    await expect(page.getByRole('button', { name: /Avery Lane/ })).toBeVisible();
    expect(await storage(page)).toEqual(saved);
    await logout(page);
    const footer = page.getByRole('navigation', { name: 'Footer' });
    await expect(footer.getByRole('link')).toHaveText(['Home', 'All Blogs', 'Login', 'Register']);
    const registerLink = footer.getByRole('link', { name: 'Register', exact: true });
    await registerLink.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/register$/);
    expect(await storage(page)).toEqual(loggedOut);
  });

  test(`${mode}: malformed local collections keep public/auth failures readable and bytes unchanged`, async ({ page, seedStorage }, testInfo) => {
    await seedStorage({ writespace_posts: 'invalid posts', writespace_users: 'invalid users' });
    await page.goto('/');
    await chooseMode(page, mode);
    const before = await storage(page);
    await expect(page.getByText('No posts yet — check back soon!')).toBeVisible();
    await expect(page.getByRole('status')).toContainText('invalid format');
    await expect(page.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    if (mode === 'dark') await expect(page.getByRole('status')).toHaveCSS('background-color', 'rgb(69, 26, 3)');
    await attachView(page, testInfo, `${mode}-public-empty-warning`);
    await page.getByRole('link', { name: 'Get Started Free', exact: true }).click();
    await fillSignup(page);
    await page.getByRole('button', { name: 'Create account', exact: true }).click();
    await expect(page).toHaveURL(/\/register$/);
    await expect(page.getByRole('alert')).toContainText('invalid format');
    await expect(page.getByLabel('Username')).toHaveValue('avery');
    await attachView(page, testInfo, `${mode}-register-storage-error`);
    expect(await storage(page)).toEqual(before);
    await page.getByRole('link', { name: 'Sign in', exact: true }).click();
    await page.getByLabel('Username', { exact: true }).fill('avery');
    await page.getByLabel('Password', { exact: true }).fill('demo-pass');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('alert')).toContainText('invalid format');
    expect(await storage(page)).toEqual(before);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
    expect(await storage(page)).toEqual(before);
  });
}
