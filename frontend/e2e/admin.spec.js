/** Exercise real admin community journeys; the parent owns execution. */
import { test, expect } from './fixtures.js';
const owner = { id: '4cf1f2ec-7b46-4c74-b41d-166dfcc09aaa', displayName: 'Avery', username: 'avery', password: 'demo', role: 'user', createdAt: '2026-01-01T00:00:00Z' };
const post = { id: '8e52ad1c-d59e-4f17-9975-5cab77b1a210', title: 'Avery notebook', content: 'Original\nwords', createdAt: '2026-01-02T00:00:00Z', authorId: owner.id, authorName: owner.displayName };
/** Follow enabled navigation at either viewport. @param {object} page @param {string} name @returns {Promise<void>} */
async function nav(page, name) {
  const menu = page.getByRole('button', { name: 'Open menu', exact: true });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('navigation', { name: 'Account navigation' }).getByRole('link', { name, exact: true }).click();
}
/** Sign in using actual demo fields. @param {object} page @param {string} username @param {string} password @returns {Promise<void>} */
async function signIn(page, username, password = 'demo') {
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}
/** Exit through the real account menu. @param {object} page @param {string} name @returns {Promise<void>} */
async function logout(page, name) {
  await page.getByRole('button', { name: new RegExp(name) }).click();
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await page.getByRole('link', { name: 'Start Reading', exact: true }).click();
}
/** Fill creation fields through accessible labels. @param {object} page @param {string} username @param {string} role @returns {Promise<void>} */
async function create(page, username, role) {
  await page.getByLabel('Display name', { exact: true }).fill(username + ' Name');
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill('demo');
  await page.getByLabel('Role', { exact: true }).selectOption(role);
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
}
/** Find the visible list at the current viewport. @param {object} page @returns {Promise<object>} */
async function accounts(page) {
  return await page.getByRole('table').isVisible() ? page.getByRole('table') : page.getByLabel('Account cards');
}

test('fixed admin creates both roles; duplicate, cancellation, reload and confirmed delete preserve unrelated data', async ({ page, seedStorage, browserErrors }) => {
  await seedStorage({ writespace_users: [owner], writespace_posts: [post] });
  await page.goto('/users');
  await expect(page).toHaveURL(/\/login$/);
  await signIn(page, 'ADMIN', 'admin');
  await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();
  await page.getByRole('link', { name: 'Manage Users', exact: true }).click();
  const list = await accounts(page);
  await expect(list.getByRole('button', { name: 'Delete account: admin' })).toBeDisabled();
  await expect(list.getByRole('button', { name: 'Delete account: admin' })).toHaveAttribute('title', 'Default admin cannot be deleted');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByLabel('Display name')).toBeFocused();
  await create(page, 'riley', 'user');
  await expect(page.getByRole('status')).toHaveText('Account created.');
  await create(page, 'manager', 'admin');
  await expect(page.getByRole('status')).toHaveText('Account created.');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_users')));
  expect(stored.map((account) => account.role)).toEqual(['user', 'user', 'admin']);
  expect(stored.some((account) => account.id === 'admin')).toBe(false);
  for (const account of stored.slice(1)) {
    expect(Object.keys(account).sort()).toEqual(['createdAt', 'displayName', 'id', 'password', 'role', 'username']);
    expect(account.id).toMatch(/^[0-9a-f-]{36}$/i); expect(new Date(account.createdAt).toISOString()).toBe(account.createdAt);
  }
  await create(page, 'RILEY', 'user');
  await expect(page.getByLabel('Username')).toBeFocused();
  await expect(page.getByRole('alert')).toHaveText('That username is already in use.');
  await page.reload();
  const reloaded = await accounts(page);
  await expect(reloaded.getByRole('button', { name: 'Delete account: riley' })).toBeVisible();
  page.once('dialog', (dialog) => dialog.dismiss());
  await reloaded.getByRole('button', { name: 'Delete account: riley' }).click();
  await expect(page.getByRole('status')).toHaveText('Deletion cancelled.');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_users')))).toEqual(stored);
  page.once('dialog', (dialog) => dialog.accept());
  await reloaded.getByRole('button', { name: 'Delete account: riley' }).click();
  await expect(page.getByRole('status')).toHaveText('Account deleted.');
  await page.reload();
  await expect((await accounts(page)).getByRole('button', { name: 'Delete account: riley' })).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual([post]);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_session')))).toEqual({ userId: 'admin', username: 'admin', displayName: 'Admin', role: 'admin' });
  expect(browserErrors).toEqual([]);
});

for (const role of ['user', 'admin']) {
  test(`admin-created ${role} logs in with correct role behavior and self protection`, async ({ page, seedStorage, browserErrors }) => {
    await seedStorage({ writespace_users: [owner] });
    await page.goto('/login');
    await signIn(page, 'admin', 'admin');
    await page.getByRole('link', { name: 'Manage Users', exact: true }).click();
    await create(page, 'created', role);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_users')).find((account) => account.username === 'created'));
    await logout(page, 'Admin');
    await signIn(page, 'CREATED');
    await expect(page).toHaveURL(role === 'admin' ? /\/admin$/ : /\/blogs$/);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_session')))).toEqual({ userId: saved.id, username: 'created', displayName: 'created Name', role });
    if (role === 'admin') {
      await page.getByRole('link', { name: 'Manage Users', exact: true }).click();
      const control = (await accounts(page)).getByRole('button', { name: 'Delete account: created' });
      await expect(control).toBeDisabled(); await expect(control).toHaveAttribute('title', 'You cannot delete your own account.');
      await page.reload(); await expect((await accounts(page)).getByRole('button', { name: 'Delete account: created' })).toBeDisabled();
    } else {
      await nav(page, 'Blogs');
      await expect(page.getByRole('navigation', { name: 'Account navigation' }).getByRole('link', { name: 'Users', exact: true })).toHaveCount(0);
      await page.getByRole('link', { name: /WriteSpace/ }).click();
      await page.getByRole('link', { name: 'Go to Dashboard' }).click();
      await expect(page).toHaveURL(/\/blogs$/);
      await page.reload(); await expect(page.getByRole('heading', { name: 'All Blogs' })).toBeVisible();
    }
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_users')))).toHaveLength(2);
    expect(browserErrors).toEqual([]);
  });
}

test('dashboard edits and deletes another author with cancel/reload and accurate five-newest metrics', async ({ page, seedStorage, browserErrors }) => {
  const posts = [1, 6, 2, 5, 3, 4].map((day) => ({ ...post, id: `p${day}`, title: `Note ${day}`, createdAt: `2026-01-0${day}T00:00:00Z` }));
  await seedStorage({ writespace_users: [owner], writespace_posts: posts });
  await page.goto('/login');
  await signIn(page, 'admin', 'admin');
  const latest = page.getByRole('region', { name: 'Latest Posts' });
  await expect(latest.getByRole('heading', { level: 3 })).toHaveText(['Note 6', 'Note 5', 'Note 4', 'Note 3', 'Note 2']);
  for (const [label, count] of [['Total Posts', '6'], ['Total Users', '2'], ['Total Admins', '1'], ['Total users', '1']]) {
    await expect(page.getByText(label, { exact: true }).locator('..').locator('dd').first()).toHaveText(count);
  }
  await latest.getByRole('link', { name: 'Edit post: Note 6' }).click();
  await expect(page.getByLabel('Content')).toHaveValue(post.content);
  await page.getByLabel('Title').fill('Admin revision');
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await expect(page).toHaveURL(/\/blog\/p6$/);
  const revised = await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')).find((item) => item.id === 'p6'));
  expect(revised).toEqual({ ...posts.find((item) => item.id === 'p6'), title: 'Admin revision' });
  await nav(page, 'Dashboard');
  page.once('dialog', (dialog) => dialog.dismiss());
  await latest.getByRole('button', { name: 'Delete post: Admin revision' }).click();
  await expect(page.getByRole('status')).toHaveText('Deletion cancelled.');
  await page.reload(); await expect(latest.getByRole('link', { name: 'Admin revision', exact: true })).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await latest.getByRole('button', { name: 'Delete post: Admin revision' }).click();
  await expect(page.getByRole('status')).toHaveText('Post deleted.');
  await expect(latest.getByRole('heading', { level: 3 })).toHaveText(['Note 5', 'Note 4', 'Note 3', 'Note 2', 'Note 1']);
  await page.reload(); await expect(page.getByText('Total Posts', { exact: true }).locator('..').locator('dd').first()).toHaveText('5');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_users')))).toEqual([owner]);
  await page.getByRole('link', { name: 'Write New Post' }).click();
  await expect(page.getByRole('heading', { name: 'Write a Blog' })).toBeVisible();
  await page.getByRole('link', { name: 'Cancel', exact: true }).click();
  expect(browserErrors).toEqual([]);
});
