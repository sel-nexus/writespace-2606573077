/** Public journeys use real seeded storage and clicks after initial entry; run by the parent. */
import { test, expect } from './fixtures.js';
const tagline = 'Your thoughts. Your space. Beautifully simple.';
const post = { id: 'p1', title: 'Browser notebook', content: 'A locally saved first line.\n' + 'x'.repeat(150), createdAt: '2026-01-02T00:00:00Z', authorId: 'u1', authorName: 'Avery Lane' };
/** Save text-based preflight evidence and a screenshot for human review. @param {object} page @param {string} state @returns {Promise<void>} */
async function capture(page, state) {
  const info = test.info();
  await info.attach(`${state}-accessibility`, { body: JSON.stringify(await page.accessibility.snapshot({ interestingOnly: false }), null, 2), contentType: 'application/json' });
  await info.attach(`${state}-html`, { body: await page.content(), contentType: 'text/html' });
  const styles = await page.evaluate(() => {
    const heading = getComputedStyle(document.querySelector('h1'));
    const grid = document.querySelector('[aria-labelledby="recent-title"] > .grid');
    const floating = document.querySelector('.motion-safe\\:animate-float');
    return {
      font: heading.fontFamily, fontSize: heading.fontSize,
      gridColumns: grid ? getComputedStyle(grid).gridTemplateColumns : null,
      animation: floating ? getComputedStyle(floating).animationName : null,
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth
    };
  });
  await info.attach(`${state}-styles`, { body: JSON.stringify(styles, null, 2), contentType: 'application/json' });
  expect(styles.horizontalOverflow).toBe(false);
  await page.screenshot({ path: info.outputPath(`${state}.png`), fullPage: true });
}
test('empty landing, footer links, registration and login entry via clicks', async ({ page, seedStorage, browserErrors }) => {
  await seedStorage({});
  await page.goto('/');
  await expect(page.getByRole('heading', { name: tagline })).toBeVisible();
  await expect(page.getByText('No posts yet — check back soon!')).toBeVisible();
  for (const name of ['Write Freely', 'Private & Local', 'Instant & Fast']) {
    await expect(page.getByRole('heading', { name })).toBeVisible();
  }
  await expect(page.getByRole('complementary')).toContainText('Passwords are stored in plaintext.');
  const footer = page.getByRole('navigation', { name: 'Footer' });
  await expect(footer.getByRole('link')).toHaveText(['Home', 'All Blogs', 'Login', 'Register']);
  await expect(page.getByRole('contentinfo')).toContainText(String(new Date().getFullYear()));
  await capture(page, 'empty');
  await page.getByRole('link', { name: 'Get Started Free' }).click();
  await expect(page.getByRole('heading', { name: 'Start your next chapter.' })).toBeVisible();
  await footer.getByRole('link', { name: 'Home', exact: true }).click();
  await page.getByRole('link', { name: 'Start Reading' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await footer.getByRole('link', { name: 'Home', exact: true }).click();
  await page.getByRole('link', { name: 'Go to Dashboard' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await footer.getByRole('link', { name: 'Home', exact: true }).click();
  await footer.getByRole('link', { name: 'All Blogs', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(browserErrors).toEqual([]);
});
test('three newest previews persist on reload and guest selection enters login', async ({ page, seedStorage, browserErrors }) => {
  await seedStorage({ writespace_posts: [1, 4, 2, 3].map((day) => ({ ...post, id: `p${day}`, title: `Notebook ${day}`, createdAt: `2026-01-0${day}T00:00:00Z` })) });
  await page.goto('/');
  const recent = page.getByRole('region', { name: 'Recent writing' });
  await expect(recent.getByRole('heading', { level: 3 })).toHaveText(['Notebook 4', 'Notebook 3', 'Notebook 2']);
  await expect(recent.getByText('Jan 04 2026')).toBeVisible();
  await expect(recent.getByText('Avery Lane')).toHaveCount(3);
  await expect(recent.getByText(post.content.slice(0, 120), { exact: true })).toHaveCount(3);
  await capture(page, 'populated');
  await page.reload();
  await expect(recent.getByRole('article')).toHaveCount(3);
  await recent.getByRole('link', { name: 'Read post: Notebook 4' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole('navigation', { name: 'Footer' }).getByRole('link', { name: 'Home', exact: true }).click();
  await expect(recent.getByRole('article')).toHaveCount(3);
  expect(browserErrors).toEqual([]);
});
for (const role of ['user', 'admin']) {
  test(`${role} root keeps public navigation and routes by role without losing session`, async ({ page, seedStorage, browserErrors, isMobile }) => {
    const session = { userId: role === 'admin' ? 'admin' : 'u1', username: role, displayName: 'Demo Reader', role };
    await seedStorage({ writespace_session: session, writespace_posts: [post] });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: tagline })).toBeVisible();
    const nav = page.getByRole('navigation', { name: 'Public navigation' });
    if (isMobile) {
      await nav.getByRole('button', { name: 'Open menu' }).click();
      await expect(nav.getByRole('button', { name: 'Close menu' })).toHaveAttribute('aria-expanded', 'true');
      await capture(page, `${role}-mobile-open`);
      await nav.getByRole('button', { name: 'Close menu' }).click();
      await nav.getByRole('button', { name: 'Open menu' }).click();
    }
    await expect(nav.getByText('Demo Reader', { exact: true })).toBeVisible();
    await expect(nav.getByRole('img', { name: role === 'admin' ? 'Administrator avatar' : 'User avatar' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Home', exact: true })).toHaveAttribute('aria-current', 'page');
    await nav.getByRole('link', { name: 'Dashboard', exact: true }).click();
    await expect(page).toHaveURL(role === 'admin' ? /\/admin$/ : /\/blogs$/);
    await page.getByRole('link', { name: /WriteSpace/ }).click();
    await page.getByRole('link', { name: 'Go to Dashboard' }).click();
    await expect(page).toHaveURL(role === 'admin' ? /\/admin$/ : /\/blogs$/);
    await page.getByRole('link', { name: /WriteSpace/ }).click();
    await expect(page.getByRole('link', { name: 'Read post: Browser notebook' })).toHaveAttribute('href', '/blog/p1');
    await page.getByRole('link', { name: 'Start Reading' }).click();
    await expect(page).toHaveURL(/\/blogs$/);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_session')))).toEqual(session);
    expect(browserErrors).toEqual([]);
  });
}
test('guest mobile menu opens/closes, active links and reduced-motion decoration', async ({ page, seedStorage, browserErrors }) => {
  await seedStorage({});
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Public navigation' });
  await expect(nav.getByRole('link', { name: 'Login', exact: true })).toBeHidden();
  await nav.getByRole('button', { name: 'Open menu' }).click();
  await expect(nav.getByRole('link', { name: 'Login', exact: true })).toBeVisible();
  await capture(page, 'guest-mobile-open');
  expect(await page.locator('.motion-safe\\:animate-float').evaluate((node) => getComputedStyle(node).animationName)).toBe('none');
  await nav.getByRole('button', { name: 'Close menu' }).click();
  await expect(nav.getByRole('link', { name: 'Login', exact: true })).toBeHidden();
  await nav.getByRole('button', { name: 'Open menu' }).click();
  await nav.getByRole('link', { name: 'Login', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(nav.getByRole('button', { name: 'Open menu' })).toHaveAttribute('aria-expanded', 'false');
  await nav.getByRole('button', { name: 'Open menu' }).click();
  await expect(nav.getByRole('link', { name: 'Login', exact: true })).toHaveAttribute('aria-current', 'page');
  await nav.getByRole('link', { name: 'Get Started', exact: true }).click();
  await expect(page).toHaveURL(/\/register$/);
  expect(browserErrors).toEqual([]);
});
test('corrupt records fall back without destroying local bytes', async ({ page, seedStorage, browserErrors }) => {
  await seedStorage({ writespace_posts: 'not an array' });
  await page.goto('/');
  await expect(page.getByRole('status')).toContainText('invalid format');
  await expect(page.getByText('No posts yet — check back soon!')).toBeVisible();
  await capture(page, 'corrupt');
  await page.getByRole('link', { name: 'Start Reading' }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toBe('not an array');
  expect(browserErrors).toEqual([]);
});
