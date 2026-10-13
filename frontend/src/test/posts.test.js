/** Verify post reader and mutation contracts through real browser-local storage. */
import { it, expect, vi } from 'vitest';
import { POSTS_KEY, listPosts, getPost, formatPostDate, excerpt, createPost, updatePost, deletePost, canMutatePost } from '../utils/posts.js';
import { writeJson } from '../utils/storage.js';
const post = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', title: 'A note', content: 'First line\nSecond line', createdAt: '2026-01-02T00:00:00.000Z', authorId: '11111111-1111-4111-8111-111111111111', authorName: 'Avery' };
const secondId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
const thirdId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3';
const otherPostId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4';
const otherUserId = '55555555-5555-4555-8555-555555555555';
it('returns an empty successful list and null lookup for absent storage', () => {
  expect(listPosts()).toEqual({ ok: true, value: [] });
  expect(getPost('missing')).toEqual({ ok: true, value: null });
  expect(localStorage.getItem(POSTS_KEY)).toBeNull();
});
it('sorts newest first with stable ties, rereads changes and never rewrites bytes', () => {
  const second = { ...post, id: secondId };
  const newest = { ...post, id: thirdId, createdAt: '2026-02-02T00:00:00Z' };
  writeJson(POSTS_KEY, [post, newest, second]);
  const raw = localStorage.getItem(POSTS_KEY);
  expect(listPosts().value.map(({ id }) => id)).toEqual([thirdId, post.id, secondId]);
  expect(getPost(secondId)).toEqual({ ok: true, value: second });
  expect(getPost('absent')).toEqual({ ok: true, value: null });
  expect(localStorage.getItem(POSTS_KEY)).toBe(raw);
  writeJson(POSTS_KEY, [newest]);
  expect(getPost(secondId).value).toBeNull();
});
it.each([null, {}, 'text', 12, true, [null], [[]], [{ ...post, extra: 'no' }]])('rejects malformed collection %j without repair', (value) => {
  writeJson(POSTS_KEY, value);
  const raw = localStorage.getItem(POSTS_KEY);
  expect(listPosts().error.code).toBe('CORRUPT_DATA');
  expect(getPost(post.id).error.code).toBe('CORRUPT_DATA');
  expect(localStorage.getItem(POSTS_KEY)).toBe(raw);
});
it.each(['p1', 'admin', 'not-a-uuid', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaZ', ` ${post.id}`, `${post.id} `])('rejects malformed persisted Post ID %s without changing bytes', (id) => {
  const raw = JSON.stringify([{ ...post, id }], null, 2);
  localStorage.setItem(POSTS_KEY, raw);
  expect(listPosts().error.code).toBe('CORRUPT_DATA');
  expect(getPost(post.id).error.code).toBe('CORRUPT_DATA');
  expect(createPost(input, owner).error.code).toBe('CORRUPT_DATA');
  expect(updatePost(post.id, input, owner).error.code).toBe('CORRUPT_DATA');
  expect(deletePost(post.id, owner, () => true).error.code).toBe('CORRUPT_DATA');
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
  expect(getPost(post.id).error.code).toBe('CORRUPT_DATA');
  expect(localStorage.getItem(POSTS_KEY)).toBe('!');
});
it('propagates unavailable storage from both readers', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
  expect(listPosts().error.code).toBe('STORAGE_UNAVAILABLE');
  expect(getPost(post.id).error.code).toBe('STORAGE_UNAVAILABLE');
});
it.each([['2026-01-02T00:00:00Z', 'Jan 02, 2026'], ['2026-12-31T23:59:59Z', 'Dec 31, 2026'], ['bad', 'Unknown date'], [null, 'Unknown date']])('formats %s as %s', (value, expected) => {
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

const owner = { userId: post.authorId, username: 'avery', displayName: 'Avery', role: 'user' };
const administrator = { ...owner, userId: 'admin', role: 'admin' };
const input = { title: '  New title  ', content: '\n <script>bad()</script>\n' + 'x'.repeat(10000) + '\n ' };
const mutations = [
  (actor) => createPost(input, actor),
  (actor) => updatePost(post.id, input, actor),
  (actor) => deletePost(post.id, actor, () => true)
];
for (const mutate of mutations) {
  it.each([null, undefined, {}, { ...owner, role: undefined }, { ...owner, role: '' }, { ...owner, role: 'root' }, { ...owner, role: 1 }])('rejects missing or invalid mutation role %j', (actor) => {
    writeJson(POSTS_KEY, [post]);
    const raw = localStorage.getItem(POSTS_KEY);
    expect(mutate(actor).error.code).toBe('FORBIDDEN_ROLE');
    expect(localStorage.getItem(POSTS_KEY)).toBe(raw);
  });
  for (const field of ['userId', 'username', 'displayName']) {
    it.each([undefined, null, '', '  ', 1, true, {}, []])(`rejects invalid actor ${field}: %j`, (value) => {
      writeJson(POSTS_KEY, [post]);
      const raw = localStorage.getItem(POSTS_KEY);
      expect(mutate({ ...owner, [field]: value }).error.code).toBe('VALIDATION');
      expect(localStorage.getItem(POSTS_KEY)).toBe(raw);
    });
  }
  it('rejects actor schema extras including passwords', () => {
    expect(mutate({ ...owner, password: 'no' }).error.code).toBe('VALIDATION');
    expect(localStorage.getItem(POSTS_KEY)).toBeNull();
  });
  it.each(['!', '{}', '[null]'])('does not overwrite corrupt collection %s', (raw) => {
    localStorage.setItem(POSTS_KEY, raw);
    expect(mutate(owner).error.code).toBe('CORRUPT_DATA');
    expect(localStorage.getItem(POSTS_KEY)).toBe(raw);
  });
  it('refuses unavailable fresh storage', () => {
    writeJson(POSTS_KEY, [post]);
    const raw = localStorage.getItem(POSTS_KEY);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    expect(mutate(owner).error.code).toBe('STORAGE_UNAVAILABLE');
    vi.restoreAllMocks();
    expect(localStorage.getItem(POSTS_KEY)).toBe(raw);
  });
  it('returns write failure with unchanged collection', () => {
    writeJson(POSTS_KEY, [post]);
    const raw = localStorage.getItem(POSTS_KEY);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(mutate(owner).error.code).toBe('STORAGE_WRITE_FAILED');
    expect(localStorage.getItem(POSTS_KEY)).toBe(raw);
  });
  it('returns serialization failure with unchanged collection', () => {
    writeJson(POSTS_KEY, [post]);
    const raw = localStorage.getItem(POSTS_KEY);
    vi.spyOn(JSON, 'stringify').mockImplementation(() => { throw new Error('serialization'); });
    expect(mutate(owner).error.code).toBe('SERIALIZATION_FAILED');
    expect(localStorage.getItem(POSTS_KEY)).toBe(raw);
  });
}
for (const save of [(value) => createPost(value, owner), (value) => updatePost(post.id, value, owner)]) {
  it.each([null, undefined, {}, [], 'text', 1, true])('rejects invalid post input %j', (value) => {
    expect(save(value).error.code).toBe('VALIDATION');
    expect(localStorage.getItem(POSTS_KEY)).toBeNull();
  });
  for (const field of ['title', 'content']) {
    it.each([undefined, null, '', ' \n ', 1, true, {}, []])(`rejects invalid post ${field}: %j`, (value) => {
      writeJson(POSTS_KEY, [post]);
      const raw = localStorage.getItem(POSTS_KEY);
      expect(save({ ...input, [field]: value }).error.code).toBe('VALIDATION');
      expect(localStorage.getItem(POSTS_KEY)).toBe(raw);
    });
  }
}
for (const actor of [owner, administrator]) {
  it(`creates exact native UUID records with untrimmed unlimited plain text for ${actor.role}`, () => {
    writeJson(POSTS_KEY, [post]);
    const saved = createPost({ ...input, id: 'ignored', authorId: 'spoofed' }, actor);
    expect(saved.ok).toBe(true);
    expect(saved.value.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(saved.value).toEqual({ id: saved.value.id, ...input, createdAt: saved.value.createdAt, authorId: actor.userId, authorName: actor.displayName });
    expect(new Date(saved.value.createdAt).toISOString()).toBe(saved.value.createdAt);
    expect(getPost(saved.value.id).value).toEqual(saved.value);
    expect(listPosts().value).toHaveLength(2);
  });
  it(`updates only title/content and preserves reread metadata for ${actor.role}`, () => {
    writeJson(POSTS_KEY, [post]);
    const fresh = { ...post, authorName: 'Fresh name', createdAt: '2026-03-01T00:00:00Z' };
    writeJson(POSTS_KEY, [fresh, { ...post, id: otherPostId }]);
    const saved = updatePost(post.id, { ...input, authorId: 'spoof', createdAt: 'bad' }, actor);
    expect(saved).toEqual({ ok: true, value: { ...fresh, ...input } });
    expect(getPost(post.id).value).toEqual({ ...fresh, ...input });
    expect(getPost(otherPostId).value).toEqual({ ...post, id: otherPostId });
  });
  it(`deletes confirmed target only for ${actor.role}`, () => {
    writeJson(POSTS_KEY, [post, { ...post, id: otherPostId }]);
    expect(deletePost(post.id, actor, () => true)).toEqual({ ok: true, value: null });
    expect(getPost(post.id).value).toBeNull();
    expect(listPosts().value).toEqual([{ ...post, id: otherPostId }]);
  });
}
it.each(['missing', 'throws', 'empty', 'malformed', 'no-crypto'])('fails closed when native UUID is %s', (mode) => {
  writeJson(POSTS_KEY, [post]);
  const raw = localStorage.getItem(POSTS_KEY);
  vi.stubGlobal('crypto', mode === 'no-crypto' ? undefined : mode === 'missing' ? {} : {
    randomUUID: () => { if (mode === 'throws') throw new Error('unsupported'); return mode === 'malformed' ? 'native-id' : ''; }
  });
  expect(createPost(input, owner).error.code).toBe('ID_GENERATION_FAILED');
  expect(localStorage.getItem(POSTS_KEY)).toBe(raw);
});
for (const id of [null, undefined, '', '  ', 1, true, {}, []]) {
  it(`rejects invalid mutation ID ${JSON.stringify(id)}`, () => {
    expect(updatePost(id, input, owner).error.code).toBe('VALIDATION');
    expect(deletePost(id, owner, () => true).error.code).toBe('VALIDATION');
    expect(localStorage.getItem(POSTS_KEY)).toBeNull();
  });
}
it.each([undefined, null, true, 'yes', {}])('rejects invalid confirmation callback %j', (confirm) => {
  writeJson(POSTS_KEY, [post]);
  expect(deletePost(post.id, owner, confirm).error.code).toBe('VALIDATION');
  expect(getPost(post.id).value).toEqual(post);
});
it('does not confirm absent targets, invalid actors or non-owners', () => {
  writeJson(POSTS_KEY, [post]);
  const confirm = vi.fn(() => true);
  const raw = localStorage.getItem(POSTS_KEY);
  expect(updatePost('missing', input, owner).error.code).toBe('NOT_FOUND');
  expect(deletePost('missing', owner, confirm).error.code).toBe('NOT_FOUND');
  expect(deletePost(post.id, null, confirm).error.code).toBe('FORBIDDEN_ROLE');
  const stranger = { ...owner, userId: otherUserId };
  expect(updatePost(post.id, input, stranger).error.code).toBe('FORBIDDEN_OWNER');
  expect(deletePost(post.id, stranger, confirm).error.code).toBe('FORBIDDEN_OWNER');
  expect(confirm).not.toHaveBeenCalled();
  expect(localStorage.getItem(POSTS_KEY)).toBe(raw);
});
it('rechecks changed ownership and removed targets before mutations', () => {
  writeJson(POSTS_KEY, [post]);
  expect(canMutatePost(getPost(post.id).value, owner)).toBe(true);
  writeJson(POSTS_KEY, [{ ...post, authorId: otherUserId }]);
  const raw = localStorage.getItem(POSTS_KEY);
  expect(updatePost(post.id, input, owner).error.code).toBe('FORBIDDEN_OWNER');
  expect(deletePost(post.id, owner, () => true).error.code).toBe('FORBIDDEN_OWNER');
  expect(localStorage.getItem(POSTS_KEY)).toBe(raw);
  writeJson(POSTS_KEY, []);
  expect(updatePost(post.id, input, owner).error.code).toBe('NOT_FOUND');
  expect(deletePost(post.id, owner, () => true).error.code).toBe('NOT_FOUND');
});
it('cancelled confirmation retains exact bytes and writes nothing', () => {
  writeJson(POSTS_KEY, [post]);
  const raw = localStorage.getItem(POSTS_KEY);
  const write = vi.spyOn(Storage.prototype, 'setItem');
  expect(deletePost(post.id, owner, () => false).error.code).toBe('CANCELLED');
  expect(write).not.toHaveBeenCalled();
  expect(localStorage.getItem(POSTS_KEY)).toBe(raw);
});
it('policy accepts owner/admin only with valid session and post', () => {
  expect(canMutatePost(post, owner)).toBe(true);
  expect(canMutatePost(post, administrator)).toBe(true);
  expect(canMutatePost(post, { ...owner, userId: '66666666-6666-4666-8666-666666666666' })).toBe(false);
  for (const actor of [null, {}, { role: 'admin' }, { ...owner, role: 'root' }]) expect(canMutatePost(post, actor)).toBe(false);
  for (const value of [null, {}, { ...post, content: '' }]) expect(canMutatePost(value, owner)).toBe(false);
});
