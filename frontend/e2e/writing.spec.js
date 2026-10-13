/** Exercise real authoring forms and persistence; executed later by the parent. */
import { test, expect } from './fixtures.js';
const post = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', title: 'Another author note', content: 'Original\ncontent', createdAt: '2026-01-02T00:00:00Z', authorId: '11111111-1111-4111-8111-111111111111', authorName: 'Avery' };
const stranger = { userId: '55555555-5555-4555-8555-555555555555', username: 'morgan', displayName: 'Morgan', role: 'user' };
const admin = { userId: 'admin', username: 'admin', displayName: 'Admin', role: 'admin' };

/** Open the responsive account navigation before following its link. @param {object} page @param {string} name @returns {Promise<void>} */
async function followNav(page, name) {
  const menu = page.getByRole('button', { name: 'Open menu', exact: true });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('navigation', { name: 'Account navigation' }).getByRole('link', { name, exact: true }).click();
}

test('register, create, reload, read, edit, cancel and delete persist only confirmed changes', async ({ page, seedStorage, browserErrors }) => {
  await seedStorage({});
  await page.goto('/register');
  await page.getByRole('textbox', { name: 'Display name' }).fill('Journey Writer');
  await page.getByRole('textbox', { name: 'Username', exact: true }).fill('journey');
  await page.getByLabel('Password', { exact: true }).fill('demo-pass');
  await page.getByLabel('Confirm password').fill('demo-pass');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  const session = await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_session')));
  await page.getByRole('link', { name: 'Write a Blog', exact: true }).click();
  await page.getByRole('button', { name: 'Publish Blog' }).click();
  await expect(page.getByText('Title is required.', { exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Title' })).toBeFocused();
  const title = '  Journey notebook  ';
  const content = '\n First line\n<script>literal()</script>\n' + 'x'.repeat(10000) + '\n ';
  await page.getByRole('textbox', { name: 'Title' }).fill(title);
  await page.getByRole('textbox', { name: 'Content' }).fill(content);
  await expect(page.getByText(`${content.length} characters`, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Publish Blog' }).click();
  await expect(page).toHaveURL(/\/blog\/[^/]+$/);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts'))[0]);
  expect(saved).toEqual({ id: saved.id, title, content, createdAt: saved.createdAt, authorId: session.userId, authorName: session.displayName });
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
  expect(await page.getByRole('article').locator('p.whitespace-pre-wrap').textContent()).toBe(content);
  await expect(page.getByRole('article').locator('script')).toHaveCount(0);
  await page.getByRole('link', { name: 'Back to All Blogs' }).click();
  await page.getByRole('link', { name: ('Read post: ' + title).replace(/\s+/g, ' ').trim(), exact: true }).click();
  await page.getByRole('link', { name: 'Edit', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Title' })).toHaveValue(title);
  await expect(page.getByRole('textbox', { name: 'Content' })).toHaveValue(content);
  await page.getByRole('textbox', { name: 'Content' }).fill('Discard this');
  await page.getByRole('link', { name: 'Cancel', exact: true }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual([saved]);
  await page.getByRole('link', { name: 'Edit', exact: true }).click();
  await page.getByRole('textbox', { name: 'Title' }).fill(' Revised journey ');
  await page.getByRole('textbox', { name: 'Content' }).fill(' Revised\ncontent ');
  await page.getByRole('button', { name: 'Save Changes' }).click();
  const revised = { ...saved, title: ' Revised journey ', content: ' Revised\ncontent ' };
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual([revised]);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(revised.title);
  await followNav(page, 'Write');
  await page.getByRole('textbox', { name: 'Title' }).fill('Unsaved second note');
  await page.getByRole('link', { name: 'Cancel', exact: true }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual([revised]);
  await page.getByRole('link', { name: ('Read post: ' + revised.title).replace(/\s+/g, ' ').trim(), exact: true }).click();
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page).toHaveURL(new RegExp('/blog/' + saved.id + '$'));
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual([revised]);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  await expect(page.getByText('No posts yet. Be the first to write one!', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual([]);
  expect(browserErrors).toEqual([]);
});

for (const entry of ['/blogs', '/edit/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1']) {
  test(`non-owner ${entry} entry hides mutation controls and preserves another author's data`, async ({ page, seedStorage, browserErrors }) => {
    await seedStorage({ writespace_session: stranger, writespace_posts: [post] });
    await page.goto(entry);
    await expect(page).toHaveURL(/\/blogs$/);
    await expect(page.getByRole('link', { name: 'Edit post: ' + post.title })).toHaveCount(0);
    await expect(page.getByRole('textbox', { name: 'Content' })).toHaveCount(0);
    await page.getByRole('link', { name: 'Read post: ' + post.title }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(post.title);
    await expect(page.getByRole('link', { name: 'Edit', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Delete', exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual([post]);
    expect(browserErrors).toEqual([]);
  });
}

test('admin edits another author through list and reader without changing attribution', async ({ page, seedStorage, browserErrors }) => {
  await seedStorage({ writespace_session: admin, writespace_posts: [post] });
  await page.goto('/blogs');
  await page.getByRole('link', { name: 'Edit post: ' + post.title }).click();
  await expect(page.getByRole('textbox', { name: 'Content' })).toHaveValue(post.content);
  await page.getByRole('textbox', { name: 'Title' }).fill('Admin revision');
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Admin revision');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual([{ ...post, title: 'Admin revision' }]);
  await page.getByRole('link', { name: 'Edit', exact: true }).click();
  await page.getByRole('textbox', { name: 'Content' }).fill('Discarded admin edit');
  await page.getByRole('link', { name: 'Cancel', exact: true }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual([{ ...post, title: 'Admin revision' }]);
  expect(browserErrors).toEqual([]);
});

for (const entry of ['/write', '/edit/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1']) {
  test(`guest initial writing route ${entry} is guarded`, async ({ page, seedStorage, browserErrors }) => {
    await seedStorage({ writespace_posts: [post] });
    await page.goto(entry);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('textbox', { name: 'Content' })).toHaveCount(0);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual([post]);
    expect(browserErrors).toEqual([]);
  });
}
