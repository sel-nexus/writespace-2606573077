/** Exercise themed local community workflows and attach evidence; the parent owns execution. */
import { test, expect } from './fixtures.js';

const owner = {
  id: '11111111-1111-4111-8111-111111111111', displayName: 'Avery', username: 'avery',
  password: 'demo', role: 'user', createdAt: '2026-01-01T00:00:00Z'
};
const admin = { userId: 'admin', username: 'admin', displayName: 'Admin', role: 'admin' };
const post = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', title: 'Community notebook',
  content: 'First line\n\n<script>literal()</script>\n' + 'x'.repeat(150),
  authorId: owner.id, authorName: owner.displayName, createdAt: '2026-01-02T00:00:00Z'
};

/** Follow the shipped account navigation at either viewport. */
async function nav(page, name) {
  const menu = page.getByRole('button', { name: 'Open menu', exact: true });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('navigation', { name: 'Account navigation' }).getByRole('link', { name, exact: true }).click();
}

/** Persist the requested appearance through explicit native toggle actions only. */
async function chooseMode(page, mode) {
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  if (mode === 'light') await page.getByRole('button', { name: 'Switch to light mode' }).click();
  await expect(page.locator('html')).toHaveClass(mode === 'dark' ? /\bdark\b/ : /^(?!.*\bdark\b).*$/);
  expect(await page.evaluate(() => localStorage.getItem('writespace_theme'))).toBe(mode);
}

/** Sign in through the production form. */
async function signIn(page, username, password = 'demo') {
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

/** Log out via the actual menu and reach sign-in through the landing action. */
async function logout(page, name) {
  await page.getByRole('button', { name: new RegExp(name) }).click();
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await page.getByRole('link', { name: 'Start Reading', exact: true }).click();
}

/** Read exact storage bytes for persistence and no-cascade checks. */
async function storage(page) {
  return page.evaluate(() => Object.fromEntries(
    Object.keys(localStorage).sort().map((key) => [key, localStorage.getItem(key)])
  ));
}

/** Enter all account fields through labels, leaving submission explicit in each journey. */
async function fillAccount(page, username, role) {
  await page.getByLabel('Display name', { exact: true }).fill(`${username} Name`);
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill('demo');
  await page.getByLabel('Role', { exact: true }).selectOption(role);
}

/** Select the one visible account layout, rather than clicking a hidden duplicate control. */
async function accounts(page) {
  return await page.getByRole('table').isVisible() ? page.getByRole('table') : page.getByLabel('Account cards');
}

/** Attach rendered evidence for meaningful states without executing a separate scanner. */
async function attachView(page, testInfo, name) {
  await testInfo.attach(`${name}-screenshot`, {
    body: await page.screenshot({ fullPage: true, animations: 'disabled' }), contentType: 'image/png'
  });
  await testInfo.attach(`${name}-accessibility`, {
    body: JSON.stringify(await page.accessibility.snapshot({ interestingOnly: false }), null, 2),
    contentType: 'application/json'
  });
  const styles = await page.evaluate(() => {
    const selectors = [
      'main', 'h1', 'main article', 'article time', 'article > p', 'article a',
      'main dl > div', '[aria-labelledby="latest-posts"]', '[aria-labelledby="latest-posts"] ol',
      '[aria-labelledby="create-user"]', 'table', 'thead', 'tbody', 'td',
      '[aria-label="Account cards"] article', '[aria-label="Account cards"] dt',
      'form', 'input', 'textarea', 'select', 'form button', ':focus-visible', '[role="alert"]', '[role="status"]'
    ];
    return selectors.flatMap((selector) => [...document.querySelectorAll(selector)].map((element) => {
      const style = getComputedStyle(element);
      return {
        selector, tag: element.tagName, classes: element.className, text: element.textContent,
        color: style.color, background: style.backgroundColor, borderColor: style.borderColor,
        borderTopColor: style.borderTopColor, fontFamily: style.fontFamily, fontSize: style.fontSize,
        lineHeight: style.lineHeight, outline: style.outline, boxShadow: style.boxShadow,
        display: style.display, width: element.getBoundingClientRect().width
      };
    }));
  });
  await testInfo.attach(`${name}-computed-styles`, {
    body: JSON.stringify(styles, null, 2), contentType: 'application/json'
  });
  await testInfo.attach(`${name}-html`, { body: await page.content(), contentType: 'text/html' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

for (const mode of ['light', 'dark']) {
  for (const [viewportName, viewport] of [
    ['desktop', { width: 1280, height: 900 }], ['mobile', { width: 390, height: 844 }]
  ]) {
    test.describe(`${mode} ${viewportName} community`, () => {
      test.use({ viewport });

      test('admin metrics, responsive accounts, cross-author edits and real post/account deletion remain unchanged', async ({ page, seedStorage }, testInfo) => {
        await seedStorage({ writespace_users: [owner], writespace_posts: [post] });
        await page.goto('/login');
        await chooseMode(page, mode);
        await signIn(page, 'admin', 'admin');
        await expect(page).toHaveURL(/\/admin$/);
        const before = await storage(page);
        const surface = mode === 'dark' ? 'rgb(30, 41, 59)' : 'rgb(255, 255, 255)';
        for (const [label, count] of [['Total Posts', '1'], ['Total Users', '2'], ['Total Admins', '1'], ['Total users', '1']]) {
          const metric = page.getByText(label, { exact: true }).locator('..');
          await expect(metric.locator('dd').first()).toHaveText(count);
          await expect(metric).toHaveCSS('background-color', surface);
        }
        await attachView(page, testInfo, `${mode}-${viewportName}-admin-metrics`);
        await page.getByRole('link', { name: 'Manage Users', exact: true }).click();
        await page.getByLabel('Role', { exact: true }).focus();
        await expect(page.getByLabel('Role')).toHaveCSS('background-color', mode === 'dark' ? 'rgb(15, 23, 42)' : surface);
        await attachView(page, testInfo, `${mode}-${viewportName}-account-form-focus`);
        // Verify the exact responsive boundary and capture both meaningful layouts in each theme.
        for (const width of [639, 640]) {
          await page.setViewportSize({ width, height: 900 });
          const list = await accounts(page);
          await expect(page.locator('table')).toBeVisible({ visible: width === 640 });
          await expect(page.getByLabel('Account cards')).toBeVisible({ visible: width === 639 });
          if (width === 640) {
            await expect(list.getByRole('columnheader')).toHaveText(['Account', 'Username', 'Role', 'Created date', 'Action']);
            await expect(page.locator('table').locator('..')).toHaveCSS('background-color', surface);
          } else {
            await expect(list.getByRole('article', { name: 'Account: avery' })).toHaveCSS('background-color', surface);
          }
          await expect(list.getByRole('button', { name: 'Delete account: admin' })).toBeDisabled();
          await expect(list.getByRole('button', { name: 'Delete account: admin' }))
            .toHaveAttribute('title', 'Default admin cannot be deleted');
          await expect(list.getByRole('img', { name: 'User avatar' })).toBeVisible();
          await expect(list.getByText('Jan 01, 2026', { exact: true })).toBeVisible();
          await attachView(page, testInfo, `${mode}-${viewportName}-${width === 640 ? 'table' : 'cards'}`);
        }
        await page.setViewportSize(viewport);
        expect(await storage(page)).toEqual(before);
        await fillAccount(page, 'riley', '');
        await page.getByRole('button', { name: 'Create account', exact: true }).click();
        await expect(page.getByLabel('Role')).toBeFocused();
        await expect(page.getByRole('alert')).toHaveText('Role is required.');
        await attachView(page, testInfo, `${mode}-${viewportName}-role-error`);
        expect(await storage(page)).toEqual(before);
        for (const [username, role] of [['riley', 'user'], ['manager', 'admin']]) {
          await fillAccount(page, username, role);
          await page.getByRole('button', { name: 'Create account', exact: true }).click();
          await expect(page.getByRole('status')).toHaveText('Account created.');
          await expect((await accounts(page)).getByRole('button', { name: `Delete account: ${username}` })).toBeVisible();
        }
        const created = await storage(page);
        const records = JSON.parse(created.writespace_users);
        expect(records[0]).toEqual(owner);
        expect(records.slice(1).map((record) => record.role)).toEqual(['user', 'admin']);
        for (const record of records.slice(1)) {
          expect(Object.keys(record).sort()).toEqual(['createdAt', 'displayName', 'id', 'password', 'role', 'username']);
          expect(record.id).toMatch(/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i);
          expect(new Date(record.createdAt).toISOString()).toBe(record.createdAt);
        }
        await fillAccount(page, 'RILEY', 'user');
        await page.getByRole('button', { name: 'Create account', exact: true }).click();
        await expect(page.getByRole('alert')).toHaveText('That username is already in use.');
        await expect(page.getByLabel('Username')).toBeFocused();
        expect(await storage(page)).toEqual(created);
        const deleteAccount = (await accounts(page)).getByRole('button', { name: 'Delete account: riley' });
        page.once('dialog', (dialog) => dialog.dismiss());
        await deleteAccount.click();
        await expect(page.getByRole('status')).toHaveText('Deletion cancelled.');
        expect(await storage(page)).toEqual(created);
        page.once('dialog', (dialog) => dialog.accept());
        await deleteAccount.click();
        await expect(page.getByRole('status')).toHaveText('Account deleted.');
        const removed = await storage(page);
        expect(JSON.parse(removed.writespace_users)).toEqual(records.filter((record) => record.username !== 'riley'));
        expect(removed.writespace_posts).toBe(before.writespace_posts);
        expect(removed.writespace_session).toBe(before.writespace_session);
        expect(removed.writespace_theme).toBe(mode);
        await nav(page, 'Dashboard');
        await page.getByRole('link', { name: `Edit post: ${post.title}` }).click();
        await expect(page.getByLabel('Content')).toHaveValue(post.content);
        await page.getByLabel('Title').fill('Admin revision');
        await page.getByRole('button', { name: 'Save Changes' }).click();
        const revised = { ...post, title: 'Admin revision' };
        expect(JSON.parse((await storage(page)).writespace_posts)).toEqual([revised]);
        const reader = page.getByRole('article', { name: revised.title });
        await expect(reader).toHaveCSS('background-color', surface);
        await expect(reader.locator('p.whitespace-pre-wrap')).toHaveText(post.content);
        await expect(reader.locator('script')).toHaveCount(0);
        await attachView(page, testInfo, `${mode}-${viewportName}-dark-reader`);
        await nav(page, 'Dashboard');
        const removePost = page.getByRole('button', { name: 'Delete post: Admin revision' });
        page.once('dialog', (dialog) => dialog.dismiss());
        await removePost.click();
        await expect(page.getByRole('status')).toHaveText('Deletion cancelled.');
        expect(JSON.parse((await storage(page)).writespace_posts)).toEqual([revised]);
        page.once('dialog', (dialog) => dialog.accept());
        await removePost.click();
        await expect(page.getByRole('status')).toHaveText('Post deleted.');
        expect(JSON.parse((await storage(page)).writespace_posts)).toEqual([]);
        await expect(page.getByText('Total Posts', { exact: true }).locator('..').locator('dd').first()).toHaveText('0');
        await attachView(page, testInfo, `${mode}-${viewportName}-admin-empty`);
        await logout(page, 'Admin');
        await signIn(page, 'manager');
        await expect(page).toHaveURL(/\/admin$/);
        await page.getByRole('link', { name: 'Manage Users', exact: true }).click();
        await expect((await accounts(page)).getByRole('button', { name: 'Delete account: manager' })).toBeDisabled();
        await expect((await accounts(page)).getByRole('button', { name: 'Delete account: manager' }))
          .toHaveAttribute('title', 'You cannot delete your own account.');
        expect((await storage(page)).writespace_theme).toBe(mode);
      });

      test('regular reader retains owner-only controls, authoring validation, edit, cancel and confirmed deletion', async ({ page, seedStorage }, testInfo) => {
        const other = { ...post, id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', authorId: 'admin', authorName: 'Admin', title: 'Other author' };
        await seedStorage({ writespace_users: [owner], writespace_posts: [post, other] });
        await page.goto('/login');
        await chooseMode(page, mode);
        await signIn(page, 'avery');
        await expect(page).toHaveURL(/\/blogs$/);
        const before = await storage(page);
        const list = page.getByRole('region', { name: 'All Blogs' });
        await expect(list.getByRole('link', { name: 'Edit post: Other author' })).toHaveCount(0);
        const card = list.getByRole('article').filter({ has: page.getByRole('heading', { name: post.title }) });
        await expect(card.locator('time')).toHaveText('Jan 02, 2026');
        if (mode === 'dark') {
          await expect(card).toHaveCSS('background-color', 'rgb(30, 41, 59)');
          await expect(card).toHaveCSS('border-top-color', 'rgb(99, 102, 241)');
          await expect(card.locator('time')).toHaveCSS('color', 'rgb(203, 213, 225)');
        }
        await attachView(page, testInfo, `${mode}-${viewportName}-post-cards`);
        await list.getByRole('link', { name: 'Read post: Other author' }).click();
        await expect(page.getByRole('button', { name: 'Delete', exact: true })).toHaveCount(0);
        await expect(page.getByRole('link', { name: 'Edit', exact: true })).toHaveCount(0);
        await page.getByRole('link', { name: 'Back to All Blogs' }).click();
        expect(await storage(page)).toEqual(before);
        await nav(page, 'Write');
        await page.getByRole('button', { name: 'Publish Blog' }).click();
        await expect(page.getByLabel('Title')).toBeFocused();
        await expect(page.getByText('Title is required.')).toBeVisible();
        await expect(page.getByText('Content is required.')).toBeVisible();
        await page.getByLabel('Content').focus();
        await attachView(page, testInfo, `${mode}-${viewportName}-post-form-error-focus`);
        expect(await storage(page)).toEqual(before);
        await page.getByLabel('Title').fill('  New local note  ');
        await page.getByLabel('Content').fill('\n New words\n ');
        await page.getByRole('button', { name: 'Publish Blog' }).click();
        const saved = JSON.parse((await storage(page)).writespace_posts).find((record) => record.title === '  New local note  ');
        expect(saved).toEqual({
          id: expect.any(String), title: '  New local note  ', content: '\n New words\n ',
          authorId: owner.id, authorName: owner.displayName, createdAt: expect.any(String)
        });
        await expect(page).toHaveURL(new RegExp(`/blog/${saved.id}$`));
        await page.getByRole('link', { name: 'Edit', exact: true }).click();
        await expect(page.getByLabel('Content')).toHaveValue(saved.content);
        await page.getByLabel('Title').fill('Unsaved');
        const preCancel = await storage(page);
        await page.getByRole('link', { name: 'Cancel', exact: true }).click();
        expect(await storage(page)).toEqual(preCancel);
        await page.getByRole('link', { name: 'Edit', exact: true }).click();
        await page.getByLabel('Title').fill('Revised local note');
        await page.getByRole('button', { name: 'Save Changes' }).click();
        const revised = { ...saved, title: 'Revised local note' };
        expect(JSON.parse((await storage(page)).writespace_posts).find((record) => record.id === saved.id)).toEqual(revised);
        page.once('dialog', (dialog) => dialog.dismiss());
        const beforeDelete = await storage(page);
        await page.getByRole('button', { name: 'Delete', exact: true }).click();
        await expect(page).toHaveURL(new RegExp(`/blog/${saved.id}$`));
        expect(await storage(page)).toEqual(beforeDelete);
        page.once('dialog', (dialog) => dialog.accept());
        await page.getByRole('button', { name: 'Delete', exact: true }).click();
        await expect(page).toHaveURL(/\/blogs$/);
        expect(JSON.parse((await storage(page)).writespace_posts)).toEqual([post, other]);
        expect((await storage(page)).writespace_session).toBe(before.writespace_session);
        expect((await storage(page)).writespace_theme).toBe(mode);
        const menu = page.getByRole('button', { name: 'Open menu', exact: true });
        if (await menu.isVisible()) await menu.click();
        await expect(page.getByRole('navigation', { name: 'Account navigation' }).getByRole('link', { name: 'Users', exact: true })).toHaveCount(0);
        await expect(page.getByRole('navigation', { name: 'Account navigation' }).getByRole('link', { name: 'Dashboard', exact: true })).toHaveCount(0);
      });

      test('missing reader and corrupt admin collections retain safe themed fallbacks and raw storage', async ({ page, seedStorage }, testInfo) => {
        await seedStorage({ writespace_session: admin, writespace_posts: 'invalid posts', writespace_users: 'invalid users' });
        await page.goto('/blog/missing');
        await chooseMode(page, mode);
        const before = await storage(page);
        await expect(page.getByRole('heading', { name: 'Post not found' })).toBeVisible();
        await expect(page.getByRole('status')).toContainText('invalid format');
        await attachView(page, testInfo, `${mode}-${viewportName}-not-found-warning`);
        await page.getByRole('link', { name: 'Back to All Blogs' }).click();
        await expect(page.getByText('No posts yet. Be the first to write one!')).toBeVisible();
        await expect(page.getByRole('article')).toHaveCount(0);
        await attachView(page, testInfo, `${mode}-${viewportName}-list-empty-warning`);
        await nav(page, 'Dashboard');
        await expect(page.getByRole('status')).toHaveCount(2);
        await expect(page.getByText('Total Users', { exact: true }).locator('..').locator('dd').first()).toHaveText('1');
        await expect(page.getByText('Total users', { exact: true }).locator('..').locator('dd').first()).toHaveText('0');
        await page.getByRole('link', { name: 'Manage Users', exact: true }).click();
        await expect((await accounts(page)).getByRole('button', { name: 'Delete account: admin' })).toBeDisabled();
        await fillAccount(page, 'riley', 'user');
        await page.getByRole('button', { name: 'Create account', exact: true }).click();
        await expect(page.getByRole('alert')).toContainText('invalid format');
        await expect(page.getByLabel('Username')).toHaveValue('riley');
        await attachView(page, testInfo, `${mode}-${viewportName}-account-storage-error`);
        expect(await storage(page)).toEqual(before);
      });
    });
  }
}
