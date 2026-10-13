/** Exercise seeded reading journeys on shared desktop/mobile projects; run by the parent. */
import { test, expect } from './fixtures.js';
const post = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', title: 'Browser notebook', content: 'First line\n\nSecond line\n<img src=x onerror="bad()">\n' + 'x'.repeat(180),
  createdAt: '2026-01-02T00:00:00Z', authorId: '11111111-1111-4111-8111-111111111111', authorName: 'Avery Lane'
};

for (const role of ['user', 'admin']) {
  test(`${role} reads all sorted cards, full content, reload and back without mutations`, async ({ page, seedStorage, browserErrors, isMobile }) => {
    const session = { userId: role === 'admin' ? 'admin' : '11111111-1111-4111-8111-111111111111', username: role, displayName: 'Demo Reader', role };
    const records = [
      post,
      { ...post, id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4', title: 'Newest notebook', createdAt: '2026-01-04T00:00:00Z' },
      { ...post, id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', title: 'Third notebook', createdAt: '2026-01-03T00:00:00Z' },
      { ...post, id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', title: 'Oldest notebook', createdAt: '2026-01-01T00:00:00Z' }
    ];
    await seedStorage({ writespace_session: session, writespace_posts: records });
    await page.goto('/');
    await page.getByRole('link', { name: 'Start Reading', exact: true }).click();
    await expect(page).toHaveURL(/\/blogs$/);
    const list = page.getByRole('region', { name: 'All Blogs' });
    await expect(list.getByRole('heading', { level: 3 })).toHaveText(['Newest notebook', 'Third notebook', 'Browser notebook', 'Oldest notebook']);
    await expect(list.getByRole('article')).toHaveCount(4);
    const card = list.getByRole('article').nth(2);
    await expect(card.getByText('Avery Lane', { exact: true })).toBeVisible();
    await expect(card.locator('time')).toHaveText('Jan 02, 2026');
    await expect(card.locator('time')).toHaveAttribute('datetime', post.createdAt);
    expect(await card.locator('p.whitespace-pre-wrap').textContent()).toBe(post.content.slice(0, 120));
    const columns = await list.locator('.grid').evaluate((node) => getComputedStyle(node).gridTemplateColumns.split(' ').length);
    expect(columns).toBe(isMobile ? 1 : 3);
    await card.getByRole('link', { name: 'Read post: Browser notebook' }).click();
    await expect(page).toHaveURL(/\/blog\/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1$/);
    const reader = page.getByRole('article', { name: post.title });
    await expect(reader.getByRole('heading', { level: 1 })).toHaveText(post.title);
    await expect(reader.getByText('By Avery Lane', { exact: true })).toBeVisible();
    await expect(reader.locator('time')).toHaveText('Jan 02, 2026');
    await expect(reader.locator('time')).toHaveAttribute('datetime', post.createdAt);
    expect(await reader.locator('p.whitespace-pre-wrap').textContent()).toBe(post.content);
    expect(await reader.locator('p.whitespace-pre-wrap').evaluate((node) => getComputedStyle(node).whiteSpace)).toBe('pre-wrap');
    await expect(reader.locator('img, script')).toHaveCount(0);
    await expect(reader.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/edit/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1');
    await expect(reader.getByRole('button', { name: 'Delete' })).toBeEnabled();
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(post.title);
    expect(await reader.locator('p.whitespace-pre-wrap').textContent()).toBe(post.content);
    await page.getByRole('link', { name: 'Back to All Blogs' }).click();
    await expect(page).toHaveURL(/\/blogs$/);
    await expect(list.getByRole('article')).toHaveCount(4);
    // Check both sides of each explicit blog-grid boundary, not just representative widths.
    for (const [width, expectedColumns] of [[767, 1], [768, 2], [1023, 2], [1024, 3]]) {
      await page.setViewportSize({ width, height: 900 });
      await expect.poll(() => list.locator('.grid').evaluate(
        (node) => getComputedStyle(node).gridTemplateColumns.split(' ').length
      )).toBe(expectedColumns);
      await expect(list.getByRole('article')).toHaveCount(4);
      await expect(card.getByText('Avery Lane', { exact: true })).toBeVisible();
      await expect(card.locator('time')).toHaveText('Jan 02, 2026');
      await expect(card.getByRole('link', { name: 'Read post: Browser notebook' })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    }
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual(records);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_session')))).toEqual(session);
    expect(browserErrors).toEqual([]);
  });
}

test('empty blogs remain usable after reload with no dead writing link', async ({ page, seedStorage, browserErrors }) => {
  const session = { userId: '11111111-1111-4111-8111-111111111111', username: 'avery', displayName: 'Avery Lane', role: 'user' };
  await seedStorage({ writespace_session: session, writespace_posts: [] });
  await page.goto('/blogs');
  await expect(page.getByRole('heading', { name: 'All Blogs' })).toBeVisible();
  await expect(page.getByText('No posts yet. Be the first to write one!', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Write a Blog' })).toHaveAttribute('href', '/write');
  await expect(page.getByRole('button', { name: 'Write a Blog' })).toHaveCount(0);
  await expect(page.getByRole('article')).toHaveCount(0);
  await page.reload();
  await expect(page.getByText('No posts yet. Be the first to write one!', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: /WriteSpace/ }).click();
  await page.getByRole('link', { name: 'Start Reading', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'All Blogs' })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_session')))).toEqual(session);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual([]);
  expect(browserErrors).toEqual([]);
});

for (const path of ['/blogs', '/blog/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1']) {
  test(`guest initial protected URL ${path} hides posts and reaches signup through a click`, async ({ page, seedStorage, browserErrors }) => {
    await seedStorage({ writespace_posts: [post] });
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByRole('heading', { name: post.title })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'All Blogs' })).toHaveCount(0);
    await page.getByRole('main').getByRole('link', { name: 'Create an account', exact: true }).click();
    await expect(page).toHaveURL(/\/register$/);
    expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual([post]);
    expect(browserErrors).toEqual([]);
  });
}

test('missing post offers a real back journey to available cards', async ({ page, seedStorage, browserErrors }) => {
  await seedStorage({ writespace_session: { userId: '11111111-1111-4111-8111-111111111111', username: 'avery', displayName: 'Avery Lane', role: 'user' }, writespace_posts: [post] });
  await page.goto('/blog/missing');
  await expect(page.getByRole('heading', { name: 'Post not found' })).toBeVisible();
  await page.getByRole('link', { name: 'Back to All Blogs' }).click();
  await page.getByRole('link', { name: 'Read post: Browser notebook' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(post.title);
  expect(browserErrors).toEqual([]);
});

for (const path of ['/blogs', '/blog/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1']) {
  test(`corrupt posts at ${path} warn without rewriting local bytes`, async ({ page, seedStorage, browserErrors }) => {
    await seedStorage({ writespace_session: { userId: '11111111-1111-4111-8111-111111111111', username: 'avery', displayName: 'Avery Lane', role: 'user' }, writespace_posts: 'invalid collection' });
    await page.goto(path);
    await expect(page.getByRole('status')).toContainText('invalid format');
    if (path === '/blogs') {
      await expect(page.getByText('No posts yet. Be the first to write one!', { exact: true })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Write a Blog' })).toHaveAttribute('href', '/write');
    } else {
      await expect(page.getByRole('heading', { name: 'Post not found' })).toBeVisible();
      await page.getByRole('link', { name: 'Back to All Blogs' }).click();
      await expect(page.getByRole('heading', { name: 'All Blogs' })).toBeVisible();
      await expect(page.getByRole('status')).toContainText('invalid format');
    }
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toBe('invalid collection');
    expect(browserErrors).toEqual([]);
  });
}
