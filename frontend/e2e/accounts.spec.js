/** Exercise accounts through real forms and clicks; only initial entry uses goto. */
import { test, expect } from './fixtures.js';

test('signup, persisted home, logout, validation and normal sign-in', async ({ page, seedStorage, browserErrors }) => {
  await seedStorage({});
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Your thoughts. Your space. Beautifully simple.' })).toBeVisible();
  await page.getByRole('link', { name: 'Get Started Free' }).click();
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByLabel('Display name')).toBeFocused();
  await page.getByLabel('Display name').fill('Avery Lane');
  await page.getByLabel('Username', { exact: true }).fill('Admin');
  await page.getByLabel('Password', { exact: true }).fill('demo');
  await page.getByLabel('Confirm password').fill('different');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('alert')).toHaveText('Passwords do not match.');
  await page.getByLabel('Confirm password').fill('demo');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('alert')).toHaveText('The admin username is reserved.');
  await page.getByLabel('Username', { exact: true }).fill('avery');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  await expect(page.getByRole('heading', { name: 'All Blogs' })).toBeVisible();
  await page.getByRole('button', { name: /Avery Lane/ }).click();
  await expect(page.getByText('Signed in as user', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Avery Lane/ }).click();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'All Blogs' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Avery Lane/ })).toBeVisible();
  const records = await page.evaluate(() => ({
    users: JSON.parse(localStorage.getItem('writespace_users')),
    session: JSON.parse(localStorage.getItem('writespace_session'))
  }));
  expect(records.users).toHaveLength(1);
  expect(records.session).toEqual({ userId: records.users[0].id, username: 'avery', displayName: 'Avery Lane', role: 'user' });
  await page.screenshot({ path: test.info().outputPath('account-home.png'), fullPage: true });
  await page.getByRole('button', { name: /Avery Lane/ }).click();
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: 'Your thoughts. Your space. Beautifully simple.' })).toBeVisible();
  await page.getByRole('link', { name: 'Get Started Free' }).click();
  await page.getByLabel('Display name').fill('Other');
  await page.getByLabel('Username', { exact: true }).fill('AVERY');
  await page.getByLabel('Password', { exact: true }).fill('demo');
  await page.getByLabel('Confirm password').fill('demo');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('alert')).toHaveText('That username is already in use.');
  await page.getByRole('link', { name: 'Sign in', exact: true }).last().click();
  await page.getByLabel('Username', { exact: true }).fill('AVERY');
  await page.getByLabel('Password', { exact: true }).fill('wrong');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert')).toHaveText('Invalid username or password.');
  await page.getByLabel('Password', { exact: true }).fill('demo');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'All Blogs' })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_session')))).toEqual(records.session);
  await page.getByRole('button', { name: /Avery Lane/ }).click();
  await expect(page.getByText('Signed in as user', { exact: true })).toBeVisible();
  expect(browserErrors).toEqual([]);
});

for (const path of ['/blogs', '/blog/example', '/write', '/edit/example', '/admin', '/users']) {
  test(`guest entry ${path}, fixed admin login and logout`, async ({ page, seedStorage, browserErrors, isMobile }) => {
    await seedStorage({});
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
    await page.getByLabel('Username', { exact: true }).fill('ADMIN');
    await page.getByLabel('Password', { exact: true }).fill('admin');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();
    await expect(page.getByText('Total Admins', { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();
    if (isMobile) await page.getByRole('button', { name: 'Open menu' }).click();
    await page.getByRole('navigation', { name: 'Account navigation' }).getByRole('link', { name: 'Dashboard', exact: true }).click();
    await page.getByRole('link', { name: /WriteSpace/ }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: 'Your thoughts. Your space. Beautifully simple.' })).toBeVisible();
    await page.getByRole('link', { name: 'Go to Dashboard' }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await page.getByRole('button', { name: /Admin/ }).click();
    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(page.getByRole('heading', { name: 'Your thoughts. Your space. Beautifully simple.' })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
    expect(browserErrors).toEqual([]);
  });
}

for (const role of ['user', 'admin']) {
  for (const path of ['/login', '/register', '/admin', '/users']) {
    test(`${role} session entry ${path} resolves role home`, async ({ page, seedStorage, browserErrors }) => {
      const session = { userId: role === 'admin' ? 'admin' : '11111111-1111-4111-8111-111111111111', username: role, displayName: 'Demo Reader', role };
      await seedStorage({ writespace_session: session });
      await page.goto(path);
      await expect(page).toHaveURL(role === 'admin' ? (path === '/users' ? /\/users$/ : /\/admin$/) : /\/blogs$/);
      await expect(page.getByRole('heading', { name: role === 'admin' ? (path === '/users' ? 'Manage Users' : 'Admin Dashboard') : 'All Blogs' })).toBeVisible();
      expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_session')))).toEqual(session);
      await page.getByRole('button', { name: /Demo Reader/ }).click();
      await expect(page.getByText(`Signed in as ${role}`, { exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Log out' }).click();
      await expect(page.getByRole('heading', { name: 'Your thoughts. Your space. Beautifully simple.' })).toBeVisible();
      await page.getByRole('link', { name: 'Start Reading', exact: true }).click();
      await expect(page).toHaveURL(/\/login$/);
      expect(browserErrors).toEqual([]);
    });
  }
}
