/** Isolate browser state and fail each journey on any browser-side error. */
import { test as base, expect } from '@playwright/test';
export { expect };
export const test = base.extend({
  browserErrors: [async ({ page }, use) => {
    const errors = [];
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('pageerror', (error) => errors.push(error.message));
    await use(errors);
    expect(errors).toEqual([]);
  }, { auto: true }],
  seedStorage: async ({ page }, use) => {
    await use(async (records) => {
      await page.addInitScript((values) => {
        if (!sessionStorage.getItem('writespace_test_seeded')) {
          localStorage.clear();
          for (const [key, value] of Object.entries(values)) localStorage.setItem(key, JSON.stringify(value));
          sessionStorage.setItem('writespace_test_seeded', 'true');
        }
      }, records);
    });
  }
});
