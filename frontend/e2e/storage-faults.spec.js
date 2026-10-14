/**
 * Browser business-storage fault proof for LLD §§9.1–9.3 (lines 402, 414, 427).
 * Only initial entry uses goto; all subsequent routing uses existing UI links.
 * Real domain operations run against localStorage with one targeted native-method
 * exception. No domain mocks, fabricated results, or new runner configuration.
 * The shared fixture captures and rejects every console/page error.
 */
import { test, expect } from './fixtures.js';

const writer = {
  id: '11111111-1111-4111-8111-111111111111', displayName: 'Avery Lane',
  username: 'avery', password: 'demo-pass', role: 'user', createdAt: '2026-01-01T00:00:00Z'
};
const session = { userId: writer.id, username: writer.username, displayName: writer.displayName, role: writer.role };
const originalPost = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', title: 'Stored notebook',
  content: 'Original\ncontent', createdAt: '2026-01-02T00:00:00Z',
  authorId: writer.id, authorName: writer.displayName
};
const signup = { displayName: 'Fault Journey Writer', username: 'fault-writer', password: 'demo-only-pass' };
const writeError = 'This change could not be saved in this browser.';
const partialError = 'Your account was saved, but sign-in could not be saved in this browser. Sign in once storage is available.';

/** Read exact persisted bytes, not normalized or reparsed business records. */
async function storedBytes(page) {
  return page.evaluate(() => ({
    posts: localStorage.getItem('writespace_posts'),
    users: localStorage.getItem('writespace_users'),
    session: localStorage.getItem('writespace_session'),
    theme: localStorage.getItem('writespace_theme')
  }));
}

/** Install one key-specific fault after real seeding/navigation; preserve all other native calls. */
async function denyStorage(page, method, key) {
  await page.evaluate(({ method, key }) => {
    const native = Storage.prototype[method];
    window.businessStorageFaultAttempts = [];
    Storage.prototype[method] = function (requestedKey, ...args) {
      if (this === window.localStorage && requestedKey === key) {
        window.businessStorageFaultAttempts.push(requestedKey);
        throw new DOMException('Targeted browser storage fault', method === 'setItem' ? 'QuotaExceededError' : 'SecurityError');
      }
      return native.call(this, requestedKey, ...args);
    };
    window.restoreBusinessStorage = () => { Storage.prototype[method] = native; };
  }, { method, key });
}

/** Select dark through the real toggle before capturing the failure baseline. */
async function selectDark(page) {
  await page.getByRole('button', { name: 'Switch to dark mode', exact: true }).click();
  await expect(page.locator('html')).toHaveClass(/\bdark\b/);
  expect((await storedBytes(page)).theme).toBe('dark');
}

/** Prove the current theme remains usable while the business fault is still installed. */
async function exerciseTheme(page) {
  await expect(page.locator('html')).toHaveClass(/\bdark\b/);
  expect((await storedBytes(page)).theme).toBe('dark');
  await page.getByRole('button', { name: 'Switch to light mode', exact: true }).click();
  await expect(page.locator('html')).not.toHaveClass(/\bdark\b/);
  expect((await storedBytes(page)).theme).toBe('light');
  await page.getByRole('button', { name: 'Switch to dark mode', exact: true }).click();
  await expect(page.locator('html')).toHaveClass(/\bdark\b/);
  expect((await storedBytes(page)).theme).toBe('dark');
}

/** Follow the existing responsive account navigation, including its mobile disclosure. */
async function followAccountNav(page, name) {
  const menu = page.getByRole('button', { name: 'Open menu', exact: true });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('navigation', { name: 'Account navigation' }).getByRole('link', { name, exact: true }).click();
}

/** Check every registration input, including both passwords, survives a failed submit. */
async function expectSignupRetained(page) {
  await expect(page.getByLabel('Display name', { exact: true })).toHaveValue(signup.displayName);
  await expect(page.getByLabel('Username', { exact: true })).toHaveValue(signup.username);
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue(signup.password);
  await expect(page.getByLabel('Confirm password', { exact: true })).toHaveValue(signup.password);
}

for (const operation of ['CREATE', 'EDIT']) {
  test(`post ${operation} setItem quota failure retains unsaved form, route, identity and bytes; retry saves once`, async ({ page, seedStorage, browserErrors }) => {
    await seedStorage({ writespace_users: [writer], writespace_posts: [originalPost], writespace_session: session });
    await page.goto('/blogs');
    await selectDark(page);
    if (operation === 'CREATE') {
      await followAccountNav(page, 'Write');
    } else {
      await page.getByRole('link', { name: 'Read post: ' + originalPost.title, exact: true }).click();
      await page.getByRole('link', { name: 'Edit', exact: true }).click();
      await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue(originalPost.title);
      await expect(page.getByRole('textbox', { name: 'Content', exact: true })).toHaveValue(originalPost.content);
    }
    const route = page.url();
    const before = await storedBytes(page);
    const title = ` ${operation} unsaved notebook `;
    const content = ` ${operation} first line\nKeep every unsaved character. `;
    const submit = page.getByRole('button', { name: operation === 'CREATE' ? 'Publish Blog' : 'Save Changes', exact: true });
    await page.getByRole('textbox', { name: 'Title', exact: true }).fill(title);
    await page.getByRole('textbox', { name: 'Content', exact: true }).fill(content);
    await denyStorage(page, 'setItem', 'writespace_posts');
    await submit.click();
    await expect(page.getByRole('alert')).toHaveText(`Not saved. ${writeError}`);
    await expect(page).toHaveURL(route);
    await expect(page.getByRole('button', { name: 'User avatar ' + writer.displayName, exact: true })).toBeVisible();
    await expect(page.getByRole('article')).toHaveCount(0);
    expect(await storedBytes(page)).toEqual(before);
    await exerciseTheme(page);
    await expect(page).toHaveURL(route);
    await expect(page.getByRole('alert')).toHaveText(`Not saved. ${writeError}`);
    await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue(title);
    await expect(page.getByRole('textbox', { name: 'Content', exact: true })).toHaveValue(content);
    await expect(page.getByRole('status')).toHaveText(`${content.length} characters`);
    expect(await storedBytes(page)).toEqual(before);
    expect(await page.evaluate(() => window.businessStorageFaultAttempts)).toEqual(['writespace_posts']);

    await page.evaluate(() => window.restoreBusinessStorage());
    await submit.click();
    await expect(page).toHaveURL(/\/blog\/[^/]+$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
    expect(await page.getByRole('article').locator('p.whitespace-pre-wrap').textContent()).toBe(content);
    await expect(page.getByRole('alert')).toHaveCount(0);
    const after = await storedBytes(page);
    expect({ ...after, posts: before.posts }).toEqual(before);
    const posts = JSON.parse(after.posts);
    if (operation === 'CREATE') {
      expect(posts).toHaveLength(2);
      expect(posts[0]).toEqual(originalPost);
      expect(posts[1]).toEqual({ id: posts[1].id, title, content, createdAt: posts[1].createdAt, authorId: session.userId, authorName: session.displayName });
      expect(posts[1].id).not.toBe(originalPost.id);
      expect(new URL(page.url()).pathname).toBe('/blog/' + posts[1].id);
    } else {
      expect(posts).toEqual([{ ...originalPost, title, content }]);
      expect(new URL(page.url()).pathname).toBe('/blog/' + originalPost.id);
    }
    await expect(page.locator('html')).toHaveClass(/\bdark\b/);
    expect(browserErrors).toEqual([]);
  });
}

test('logout removeItem failure retains identity, session, route and draft; theme works and retry removes only session', async ({ page, seedStorage, browserErrors }) => {
  await seedStorage({ writespace_users: [writer], writespace_posts: [originalPost], writespace_session: session });
  await page.goto('/blogs');
  await selectDark(page);
  await followAccountNav(page, 'Write');
  await page.getByRole('textbox', { name: 'Title', exact: true }).fill('Draft retained on failed logout');
  await page.getByRole('textbox', { name: 'Content', exact: true }).fill('Still signed in\nStill editable');
  const route = page.url();
  const before = await storedBytes(page);
  await denyStorage(page, 'removeItem', 'writespace_session');
  await page.getByRole('button', { name: 'User avatar ' + writer.displayName, exact: true }).click();
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('The session could not be removed in this browser.');
  await expect(page).toHaveURL(route);
  await expect(page.getByRole('navigation', { name: 'Account navigation' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'User avatar ' + writer.displayName, exact: true })).toBeVisible();
  await expect(page.getByText('Signed in as user', { exact: true })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Public navigation' })).toHaveCount(0);
  expect(await storedBytes(page)).toEqual(before);
  await exerciseTheme(page);
  await expect(page).toHaveURL(route);
  await expect(page.getByRole('alert')).toHaveText('The session could not be removed in this browser.');
  await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue('Draft retained on failed logout');
  await expect(page.getByRole('textbox', { name: 'Content', exact: true })).toHaveValue('Still signed in\nStill editable');
  expect(await storedBytes(page)).toEqual(before);
  expect(await page.evaluate(() => window.businessStorageFaultAttempts)).toEqual(['writespace_session']);

  await page.evaluate(() => window.restoreBusinessStorage());
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('navigation', { name: 'Public navigation' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'User avatar ' + writer.displayName, exact: true })).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(await storedBytes(page)).toEqual({ ...before, session: null });
  await expect(page.locator('html')).toHaveClass(/\bdark\b/);
  expect(browserErrors).toEqual([]);
});

for (const key of ['writespace_users', 'writespace_session']) {
  const partial = key === 'writespace_session';
  test(partial
    ? 'partial registration SESSION write failure keeps account but never logs in; failed sign-in retains inputs and restored storage recovers'
    : 'registration account write failure retains all form values and original bytes; restored storage creates one account and logs in',
  async ({ page, seedStorage, browserErrors }) => {
    await seedStorage({ writespace_users: [writer], writespace_posts: [originalPost] });
    await page.goto('/');
    await selectDark(page);
    await page.getByRole('link', { name: 'Get Started Free', exact: true }).click();
    await expect(page).toHaveURL(/\/register$/);
    await page.getByLabel('Display name', { exact: true }).fill(signup.displayName);
    await page.getByLabel('Username', { exact: true }).fill(signup.username);
    await page.getByLabel('Password', { exact: true }).fill(signup.password);
    await page.getByLabel('Confirm password', { exact: true }).fill(signup.password);
    const before = await storedBytes(page);
    await denyStorage(page, 'setItem', key);
    await page.getByRole('button', { name: 'Create account', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveText(partial ? partialError : writeError);
    await expect(page).toHaveURL(/\/register$/);
    await expectSignupRetained(page);
    await expect(page.getByRole('navigation', { name: 'Public navigation' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Account navigation' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'User avatar ' + signup.displayName, exact: true })).toHaveCount(0);
    const failed = await storedBytes(page);
    expect({ ...failed, users: before.users }).toEqual(before);
    let savedAccount;
    if (partial) {
      const users = JSON.parse(failed.users);
      expect(users).toHaveLength(2);
      expect(users[0]).toEqual(writer);
      savedAccount = users[1];
      expect(savedAccount).toEqual({ id: savedAccount.id, ...signup, role: 'user', createdAt: savedAccount.createdAt });
      expect(savedAccount.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      expect(Number.isNaN(Date.parse(savedAccount.createdAt))).toBe(false);
    } else {
      expect(failed).toEqual(before);
    }
    expect(failed.session).toBeNull();
    await exerciseTheme(page);
    await expect(page).toHaveURL(/\/register$/);
    await expectSignupRetained(page);
    await expect(page.getByRole('alert')).toHaveText(partial ? partialError : writeError);
    expect(await storedBytes(page)).toEqual(failed);
    expect(await page.evaluate(() => window.businessStorageFaultAttempts)).toEqual([key]);

    if (partial) {
      // The real saved account is usable, but sign-in must still fail until SESSION storage recovers.
      await page.getByRole('link', { name: 'Sign in', exact: true }).last().click();
      await expect(page).toHaveURL(/\/login$/);
      await page.getByLabel('Username', { exact: true }).fill(signup.username);
      await page.getByLabel('Password', { exact: true }).fill(signup.password);
      await page.getByRole('button', { name: 'Sign in', exact: true }).click();
      await expect(page.getByRole('alert')).toHaveText(writeError);
      await expect(page).toHaveURL(/\/login$/);
      await exerciseTheme(page);
      await expect(page).toHaveURL(/\/login$/);
      await expect(page.getByRole('alert')).toHaveText(writeError);
      await expect(page.getByLabel('Username', { exact: true })).toHaveValue(signup.username);
      await expect(page.getByLabel('Password', { exact: true })).toHaveValue(signup.password);
      await expect(page.getByRole('navigation', { name: 'Account navigation' })).toHaveCount(0);
      expect(await storedBytes(page)).toEqual(failed);
      expect(await page.evaluate(() => window.businessStorageFaultAttempts)).toEqual([key, key]);
    }
    await page.evaluate(() => window.restoreBusinessStorage());
    await page.getByRole('button', { name: partial ? 'Sign in' : 'Create account', exact: true }).click();
    await expect(page).toHaveURL(/\/blogs$/);
    await expect(page.getByRole('heading', { name: 'All Blogs', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'User avatar ' + signup.displayName, exact: true })).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
    const recovered = await storedBytes(page);
    expect(recovered.posts).toBe(before.posts);
    expect(recovered.theme).toBe(before.theme);
    const users = JSON.parse(recovered.users);
    expect(users).toHaveLength(2);
    expect(users[0]).toEqual(writer);
    if (partial) {
      expect(recovered.users).toBe(failed.users);
      expect(users[1]).toEqual(savedAccount);
    } else {
      expect(users[1]).toEqual({ id: users[1].id, ...signup, role: 'user', createdAt: users[1].createdAt });
    }
    expect(JSON.parse(recovered.session)).toEqual({ userId: users[1].id, username: signup.username, displayName: signup.displayName, role: 'user' });
    await expect(page.locator('html')).toHaveClass(/\bdark\b/);
    expect(browserErrors).toEqual([]);
  });
}
