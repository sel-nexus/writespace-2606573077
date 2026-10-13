/** Verify read-only post contracts through real browser-local storage. */
import { it, expect, vi } from 'vitest';
import { POSTS_KEY, listPosts, getPost, formatPostDate, excerpt } from '../utils/posts.js';
import { writeJson } from '../utils/storage.js';
const post = { id: 'p1', title: 'A note', content: 'First line\nSecond line', createdAt: '2026-01-02T00:00:00.000Z', authorId: 'u1', authorName: 'Avery' };
it('returns an empty successful list and null lookup for absent storage', () => {
  expect(listPosts()).toEqual({ ok: true, value: [] });
  expect(getPost('missing')).toEqual({ ok: true, value: null });
  expect(localStorage.getItem(POSTS_KEY)).toBeNull();
});
it('sorts newest first with stable ties, rereads changes and never rewrites bytes', () => {
  const second = { ...post, id: 'p2' };
  const newest = { ...post, id: 'p3', createdAt: '2026-02-02T00:00:00Z' };
  writeJson(POSTS_KEY, [post, newest, second]);
  const raw = localStorage.getItem(POSTS_KEY);
  expect(listPosts().value.map(({ id }) => id)).toEqual(['p3', 'p1', 'p2']);
  expect(getPost('p2')).toEqual({ ok: true, value: second });
  expect(getPost('absent')).toEqual({ ok: true, value: null });
  expect(localStorage.getItem(POSTS_KEY)).toBe(raw);
  writeJson(POSTS_KEY, [newest]);
  expect(getPost('p2').value).toBeNull();
});
it.each([null, {}, 'text', 12, true, [null], [[]], [{ ...post, extra: 'no' }]])('rejects malformed collection %j without repair', (value) => {
  writeJson(POSTS_KEY, value);
  const raw = localStorage.getItem(POSTS_KEY);
  expect(listPosts().error.code).toBe('CORRUPT_DATA');
  expect(getPost('p1').error.code).toBe('CORRUPT_DATA');
  expect(localStorage.getItem(POSTS_KEY)).toBe(raw);
});
for (const field of Object.keys(post)) {
  it(`rejects missing required field ${field}`, () => {
    const invalid = { ...post }; delete invalid[field];
    writeJson(POSTS_KEY, [invalid]);
    expect(listPosts().error.code).toBe('CORRUPT_DATA');
  });
  it.each([null, 1, true, {}, [], '', '   '])(`rejects non-text or empty ${field}: %j`, (value) => {
    writeJson(POSTS_KEY, [{ ...post, [field]: value }]);
    expect(listPosts().error.code).toBe('CORRUPT_DATA');
  });
}
it.each(['yesterday', '2026-01-02', '2026-13-02T00:00:00Z', '2026-02-30T00:00:00Z', '2026-01-02T24:00:00Z', '2026-01-02T00:00:00+01:00'])('rejects invalid ISO timestamp %s', (createdAt) => {
  writeJson(POSTS_KEY, [{ ...post, createdAt }]);
  expect(listPosts().error.code).toBe('CORRUPT_DATA');
});
it.each(['2026-01-02T00:00:00Z', '2026-01-02T00:00:00.1Z', '2024-02-29T23:59:59.123Z'])('accepts valid ISO timestamp %s', (createdAt) => {
  writeJson(POSTS_KEY, [{ ...post, createdAt }]);
  expect(listPosts().ok).toBe(true);
});
it('propagates parse failure and keeps corrupt bytes intact', () => {
  localStorage.setItem(POSTS_KEY, '!');
  expect(listPosts().error.code).toBe('CORRUPT_DATA');
  expect(getPost('p1').error.code).toBe('CORRUPT_DATA');
  expect(localStorage.getItem(POSTS_KEY)).toBe('!');
});
it('propagates unavailable storage from both readers', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
  expect(listPosts().error.code).toBe('STORAGE_UNAVAILABLE');
  expect(getPost('p1').error.code).toBe('STORAGE_UNAVAILABLE');
});
it.each([['2026-01-02T00:00:00Z', 'Jan 02 2026'], ['2026-12-31T23:59:59Z', 'Dec 31 2026'], ['bad', 'Unknown date'], [null, 'Unknown date']])('formats %s as %s', (value, expected) => {
  expect(formatPostDate(value)).toBe(expected);
});
it.each([0, 1, 119, 120, 121, 10000])('takes exactly the first 120 characters from length %i', (length) => {
  const text = 'x'.repeat(length);
  expect(excerpt(text)).toBe(text.slice(0, 120));
});
it('preserves plain text and whitespace and tolerates invalid excerpt input', () => {
  expect(excerpt('<script>no</script>\n next')).toBe('<script>no</script>\n next');
  expect(excerpt(null)).toBe('');
});
