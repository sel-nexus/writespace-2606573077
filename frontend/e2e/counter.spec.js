/** Author real-storage counter journeys and preflight attachments; the parent owns execution. */
import { test, expect } from './fixtures.js';

const fields = ['authorId', 'authorName', 'content', 'createdAt', 'id', 'title'];

/** Follow account navigation through the responsive menu rather than direct URLs.
 * Args:
 *   page: Browser page containing the shipped navigation.
 *   name: Exact account link name to activate.
 */
async function nav(page, name) {
  const menu = page.getByRole('button', { name: 'Open menu', exact: true });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('navigation', { name: 'Account navigation' })
    .getByRole('link', { name, exact: true }).click();
}

/** Read every localStorage key without writing test-derived count data.
 * Args:
 *   page: Browser page sharing the application's real storage origin.
 * Returns:
 *   Exact persisted bytes for schema and incidental-write assertions.
 */
async function storage(page) {
  return page.evaluate(() => Object.fromEntries(
    Object.keys(localStorage).sort().map((key) => [key, localStorage.getItem(key)])
  ));
}

/** Attach create/edit field and counter evidence for the parent's visual preflight.
 * Args:
 *   page: Browser page at a meaningful authoring state.
 *   testInfo: Playwright attachment owner.
 *   name: Theme, viewport and state label for the evidence.
 */
async function attachForm(page, testInfo, name) {
  await testInfo.attach(`${name}-screenshot`, {
    body: await page.screenshot({ fullPage: true, animations: 'disabled' }), contentType: 'image/png'
  });
  await testInfo.attach(`${name}-accessibility`, {
    body: JSON.stringify(await page.accessibility.snapshot({ interestingOnly: false }), null, 2),
    contentType: 'application/json'
  });
  const styles = await page.evaluate(() => {
    const selectors = [
      'main', 'h1', 'form', 'label[for="title"]', '#title', 'label[for="content"]',
      '#content', '#content-count', '#content-error', 'form button', 'form a', ':focus-visible'
    ];
    return selectors.flatMap((selector) => [...document.querySelectorAll(selector)].map((element) => {
      const style = getComputedStyle(element);
      return {
        selector, tag: element.tagName, classes: element.className, text: element.textContent,
        value: 'value' in element ? element.value : null,
        role: element.getAttribute('role'), describedBy: element.getAttribute('aria-describedby'),
        live: element.getAttribute('aria-live'), atomic: element.getAttribute('aria-atomic'),
        color: style.color, background: style.backgroundColor, borderColor: style.borderColor,
        fontFamily: style.fontFamily, fontSize: style.fontSize, fontVariantNumeric: style.fontVariantNumeric,
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

for (const theme of ['light', 'dark']) {
  for (const [viewportName, viewport] of [
    ['desktop', { width: 1280, height: 900 }], ['mobile', { width: 390, height: 844 }]
  ]) {
    test.describe(`${theme} ${viewportName} counter`, () => {
      test.use({ viewport });

      test('create, read, edit, reload and cancel retain derived counts and exact local post schema', async ({ page, seedStorage, browserErrors }, testInfo) => {
        // Only bootstrap navigation is direct. Accounts, posts and routes are reached through UI.
        await seedStorage({});
        await page.goto('/');
        await page.getByRole('button', { name: 'Switch to dark mode' }).click();
        if (theme === 'light') await page.getByRole('button', { name: 'Switch to light mode' }).click();
        await page.getByRole('link', { name: 'Start Reading', exact: true }).click();
        await page.getByLabel('Username', { exact: true }).fill('admin');
        await page.getByLabel('Password', { exact: true }).fill('admin');
        await page.getByRole('button', { name: 'Sign in', exact: true }).click();
        await expect(page).toHaveURL(/\/admin$/);
        await nav(page, 'Write');
        await expect(page).toHaveURL(/\/write$/);
        const before = await storage(page);
        expect(before.writespace_theme).toBe(theme);
        expect(JSON.parse(before.writespace_session)).toEqual({
          userId: 'admin', username: 'admin', displayName: 'Admin', role: 'admin'
        });
        await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /\bdark\b/ : /^(?!.*\bdark\b).*$/);
        const title = page.getByRole('textbox', { name: 'Title', exact: true });
        const content = page.getByRole('textbox', { name: 'Content', exact: true });
        const count = page.locator('#content-count');
        await expect(content).toHaveValue('');
        await expect(count).toHaveText('0 characters');
        await expect(count).toHaveAttribute('role', 'status');
        await expect(count).toHaveAttribute('aria-live', 'polite');
        await expect(count).toHaveAttribute('aria-atomic', 'true');
        await expect(content).toHaveAttribute('aria-describedby', 'content-count');
        expect(await content.getAttribute('maxlength')).toBeNull();
        expect(await title.getAttribute('maxlength')).toBeNull();
        await expect(count).toBeVisible();
        await expect(count).toHaveCSS('font-variant-numeric', 'tabular-nums');
        if (theme === 'dark') await expect(count).toHaveCSS('color', 'rgb(203, 213, 225)');
        await expect(content).toHaveCSS('background-color', theme === 'dark' ? 'rgb(15, 23, 42)' : 'rgb(255, 255, 255)');
        await content.focus();
        await attachForm(page, testInfo, `${theme}-${viewportName}-create-empty-focus`);

        await content.pressSequentially('abc');
        await expect(count).toHaveText('3 characters');
        await content.press('Backspace');
        await expect(content).toHaveValue('ab');
        await expect(count).toHaveText('2 characters');
        await content.fill('');
        await expect(count).toHaveText('0 characters');
        await page.getByRole('button', { name: 'Publish Blog' }).click();
        await expect(title).toBeFocused();
        await expect(page.getByText('Title is required.', { exact: true })).toBeVisible();
        await expect(page.getByText('Content is required.', { exact: true })).toBeVisible();
        await expect(content).toHaveAttribute('aria-describedby', 'content-error content-count');
        await title.fill('  Counter notebook  ');
        await content.fill(' \t\n ');
        await expect(count).toHaveText('4 characters');
        await page.getByRole('button', { name: 'Publish Blog' }).click();
        await expect(content).toBeFocused();
        await expect(content).toHaveAttribute('aria-invalid', 'true');
        await attachForm(page, testInfo, `${theme}-${viewportName}-create-required-error`);
        expect(await storage(page)).toEqual(before);

        const text = ' \n😀e\u0301\n' + 'x'.repeat(20000) + '\n ';
        await content.fill(text);
        await expect(content).toHaveValue(text);
        await expect(count).toHaveText(`${text.length} characters`);
        await content.focus();
        await attachForm(page, testInfo, `${theme}-${viewportName}-create-large-count`);
        expect(await storage(page)).toEqual(before);
        const earliest = await page.evaluate(() => Date.now());
        await page.getByRole('button', { name: 'Publish Blog' }).click();
        await expect(page).toHaveURL(/\/blog\/[\da-f-]+$/);
        const created = await storage(page);
        const records = JSON.parse(created.writespace_posts);
        expect(records).toHaveLength(1);
        const saved = records[0];
        expect(Object.keys(saved).sort()).toEqual(fields);
        expect(saved.id).toMatch(/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i);
        expect(new Date(saved.createdAt).toISOString()).toBe(saved.createdAt);
        expect(Date.parse(saved.createdAt)).toBeGreaterThanOrEqual(earliest);
        expect(Date.parse(saved.createdAt)).toBeLessThanOrEqual(await page.evaluate(() => Date.now()));
        expect(saved).toEqual({
          id: saved.id, title: '  Counter notebook  ', content: text,
          createdAt: saved.createdAt, authorId: 'admin', authorName: 'Admin'
        });
        expect(created).toEqual({ ...before, writespace_posts: JSON.stringify([saved]) });
        await expect(page).toHaveURL(new RegExp(`/blog/${saved.id}$`));
        expect(await page.getByRole('article').locator('p.whitespace-pre-wrap').textContent()).toBe(text);
        await expect(count).toHaveCount(0);
        await page.reload();
        expect(await storage(page)).toEqual(created);
        expect(await page.getByRole('article').locator('p.whitespace-pre-wrap').textContent()).toBe(text);
        await page.getByRole('link', { name: 'Edit', exact: true }).click();
        await expect(content).toHaveValue(text);
        await expect(title).toHaveValue(saved.title);
        await expect(count).toHaveText(`${text.length} characters`);
        await content.focus();
        await attachForm(page, testInfo, `${theme}-${viewportName}-edit-prefill-focus`);

        await content.fill('');
        await expect(count).toHaveText('0 characters');
        await page.getByRole('button', { name: 'Save Changes' }).click();
        await expect(content).toBeFocused();
        await expect(content).toHaveAttribute('aria-describedby', 'content-error content-count');
        await attachForm(page, testInfo, `${theme}-${viewportName}-edit-empty-error`);
        expect(await storage(page)).toEqual(created);
        const revisedText = '\n Revised 😀e\u0301\n ';
        await title.fill('  Revised counter notebook  ');
        await content.fill(revisedText);
        await expect(count).toHaveText(`${revisedText.length} characters`);
        await attachForm(page, testInfo, `${theme}-${viewportName}-edit-revised-count`);
        expect(await storage(page)).toEqual(created);
        await page.getByRole('button', { name: 'Save Changes' }).click();
        const revised = { ...saved, title: '  Revised counter notebook  ', content: revisedText };
        const updated = { ...created, writespace_posts: JSON.stringify([revised]) };
        await expect(page).toHaveURL(new RegExp(`/blog/${saved.id}$`));
        expect(await storage(page)).toEqual(updated);
        expect(Object.keys(JSON.parse(updated.writespace_posts)[0]).sort()).toEqual(fields);
        expect(await page.getByRole('article').locator('p.whitespace-pre-wrap').textContent()).toBe(revisedText);
        await page.reload();
        expect(await storage(page)).toEqual(updated);
        expect(await page.getByRole('article').locator('p.whitespace-pre-wrap').textContent()).toBe(revisedText);
        await page.getByRole('link', { name: 'Edit', exact: true }).click();
        await expect(content).toHaveValue(revisedText);
        await expect(count).toHaveText(`${revisedText.length} characters`);
        await title.fill('Unsaved title');
        await content.fill('Discard 😀');
        await expect(count).toHaveText('10 characters');
        await page.getByRole('link', { name: 'Cancel', exact: true }).click();
        expect(await storage(page)).toEqual(updated);
        await page.reload();
        await page.getByRole('link', { name: 'Edit', exact: true }).click();
        await expect(title).toHaveValue(revised.title);
        await expect(content).toHaveValue(revisedText);
        await expect(count).toHaveText(`${revisedText.length} characters`);
        await page.getByRole('link', { name: 'Cancel', exact: true }).click();

        await nav(page, 'Write');
        await expect(count).toHaveText('0 characters');
        await title.fill('Cancelled create');
        await content.fill('Never saved');
        await expect(count).toHaveText('11 characters');
        await page.getByRole('link', { name: 'Cancel', exact: true }).click();
        await expect(page).toHaveURL(/\/blogs$/);
        expect(await storage(page)).toEqual(updated);
        await page.getByRole('link', { name: /^Read post:\s*Revised counter notebook\s*$/ }).click();
        expect(await page.getByRole('article').locator('p.whitespace-pre-wrap').textContent()).toBe(revisedText);
        await nav(page, 'Write');
        await expect(content).toHaveValue('');
        await expect(count).toHaveText('0 characters');
        expect(await storage(page)).toEqual(updated);
        expect(browserErrors).toEqual([]);
      });
    });
  }
}
