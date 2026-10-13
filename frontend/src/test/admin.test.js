/** Verify every local account policy and failure boundary using real storage. */
import { it, expect, vi } from 'vitest';
import { createAdminUser, deleteUser, canDeleteUser, dashboardMetrics } from '../utils/admin.js';
import { listUsers, USERS_KEY } from '../utils/users.js';
import { writeJson } from '../utils/storage.js';
const admin = { userId: 'admin', username: 'admin', displayName: 'Admin', role: 'admin' };
const input = { displayName: ' Riley ', username: ' Riley ', password: ' demo ', role: 'user' };
const id = 'c940f049-1070-49a1-b3cf-75dbe78cb97e';
const record = { id, displayName: 'Riley', username: 'riley', password: 'demo', role: 'user', createdAt: '2026-01-01T00:00:00.000Z' };
const invalid = [undefined, null, '', '  ', 1, false, [], {}];
/** Assert the exact Result envelope. @param {object} result @param {string} code @returns {void} */
function fails(result, code) {
  expect(result).toEqual({ ok: false, error: { code, message: expect.any(String) } });
}
it.each(['user', 'admin'])('creates exact %s record with native UUID and timestamp, retaining fresh accounts', (role) => {
  vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(id);
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-02-03T04:05:06.000Z'));
  try {
    writeJson(USERS_KEY, [{ ...record, id: 'existing', username: 'existing' }]);
    const result = createAdminUser({ ...input, role }, admin);
    expect(result).toEqual({ ok: true, value: { id, ...input, username: 'Riley', role, createdAt: '2026-02-03T04:05:06.000Z' } });
    expect(listUsers().value).toEqual([{ ...record, id: 'existing', username: 'existing' }, result.value]);
    expect(localStorage.getItem('writespace_session')).toBeNull();
  } finally { vi.useRealTimers(); }
});
for (const field of Object.keys(input)) {
  it.each(invalid)(`rejects invalid ${field} %j without reading or writing`, (value) => {
    const read = vi.spyOn(Storage.prototype, 'getItem'); const write = vi.spyOn(Storage.prototype, 'setItem');
    fails(createAdminUser({ ...input, [field]: value }, admin), 'VALIDATION');
    expect(read).not.toHaveBeenCalled(); expect(write).not.toHaveBeenCalled();
  });
}
it.each([null, undefined, {}, [], 1, 'input'])('rejects invalid input object %j', (value) => {
  fails(createAdminUser(value, admin), 'VALIDATION');
});
it.each(['owner', 'USER', 'Admin'])('rejects unsupported role %s', (role) => {
  fails(createAdminUser({ ...input, role }, admin), 'VALIDATION');
});
const actors = [null, undefined, {}, { ...admin, role: 'user' }, { ...admin, role: 'owner' }, { role: 'admin' },
  ...['userId', 'username', 'displayName'].flatMap((field) => invalid.map((value) => ({ ...admin, [field]: value }))), { ...admin, extra: true }];
it.each(actors)('rejects invalid/nonadmin actor %j in both mutations and pure policy', (actor) => {
  const code = actor?.role === 'admin' ? 'VALIDATION' : 'FORBIDDEN_ROLE';
  const read = vi.spyOn(Storage.prototype, 'getItem'); const confirm = vi.fn(() => true);
  fails(createAdminUser(input, actor), code); fails(deleteUser(id, actor, confirm), code);
  expect(canDeleteUser(id, actor)).toBe(false); expect(read).not.toHaveBeenCalled(); expect(confirm).not.toHaveBeenCalled();
});
it.each(['admin', 'ADMIN', ' AdMiN '])('reserves username %s case-insensitively', (username) => {
  fails(createAdminUser({ ...input, username }, admin), 'RESERVED_USERNAME'); expect(listUsers().value).toEqual([]);
});
it('rereads users and rejects a newly added case-insensitive duplicate', () => {
  expect(listUsers().value).toEqual([]); writeJson(USERS_KEY, [record]);
  fails(createAdminUser(input, admin), 'USERNAME_TAKEN'); expect(listUsers().value).toEqual([record]);
});
it.each([undefined, null, '', ' ', 5, {}, 'not-a-uuid', 'admin', id])('rejects invalid or colliding native UUID %j', (value) => {
  writeJson(USERS_KEY, [{ ...record, username: 'other' }]);
  vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(value);
  fails(createAdminUser(input, admin), 'ID_GENERATION_FAILED'); expect(listUsers().value).toHaveLength(1);
});
it.each(['missing', 'throws'])('handles %s UUID API without fabricated fallback', (mode) => {
  if (mode === 'missing') vi.stubGlobal('crypto', {});
  else vi.spyOn(globalThis.crypto, 'randomUUID').mockImplementation(() => { throw new Error('unsupported'); });
  fails(createAdminUser(input, admin), 'ID_GENERATION_FAILED'); expect(listUsers().value).toEqual([]);
});
it.each(['!', '{}', '[{}]', JSON.stringify([{ ...record, role: 'owner' }]), JSON.stringify([record, record])])('fails closed on corrupt collection %s', (bytes) => {
  localStorage.setItem(USERS_KEY, bytes); const write = vi.spyOn(Storage.prototype, 'setItem'); const confirm = vi.fn(() => true);
  fails(createAdminUser(input, admin), 'CORRUPT_DATA'); fails(deleteUser(id, admin, confirm), 'CORRUPT_DATA');
  expect(localStorage.getItem(USERS_KEY)).toBe(bytes); expect(write).not.toHaveBeenCalled(); expect(confirm).not.toHaveBeenCalled();
});
it('rejects denied reads in both mutations', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
  fails(createAdminUser(input, admin), 'STORAGE_UNAVAILABLE'); fails(deleteUser(id, admin, () => true), 'STORAGE_UNAVAILABLE');
});
it.each(['create', 'delete'])('does not report success on denied %s writes', (mode) => {
  writeJson(USERS_KEY, [record]); const before = localStorage.getItem(USERS_KEY);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
  fails(mode === 'create' ? createAdminUser({ ...input, username: 'new' }, admin) : deleteUser(id, admin, () => true), 'STORAGE_WRITE_FAILED');
  expect(localStorage.getItem(USERS_KEY)).toBe(before);
});
it.each(['create', 'delete'])('propagates serialization failure on %s', (mode) => {
  writeJson(USERS_KEY, [record]);
  vi.spyOn(JSON, 'stringify').mockImplementation(() => { throw new Error('serialization'); });
  fails(mode === 'create' ? createAdminUser({ ...input, username: 'new' }, admin) : deleteUser(id, admin, () => true), 'SERIALIZATION_FAILED');
});
it.each(invalid)('rejects invalid deletion ID %j', (value) => {
  fails(deleteUser(value, admin, () => true), 'VALIDATION'); expect(canDeleteUser(value, admin)).toBe(false);
});
it.each([undefined, null, true, 'yes', {}])('rejects invalid confirmation %j', (confirm) => {
  fails(deleteUser(id, admin, confirm), 'VALIDATION');
});
it.each([['admin', admin, 'PROTECTED_ACCOUNT', 'Default admin cannot be deleted'],
  [id, { ...admin, userId: id }, 'SELF_DELETE', 'You cannot delete your own account.']])('protects %s before even reading/confirming', (target, actor, code, message) => {
  const read = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
  const confirm = vi.fn(() => true); const write = vi.spyOn(Storage.prototype, 'setItem');
  expect(deleteUser(target, actor, confirm)).toEqual({ ok: false, error: { code, message } });
  expect(canDeleteUser(target, actor)).toBe(false); expect(read).not.toHaveBeenCalled(); expect(write).not.toHaveBeenCalled(); expect(confirm).not.toHaveBeenCalled();
});
it('finds absence before confirmation', () => {
  const confirm = vi.fn(() => true); fails(deleteUser(id, admin, confirm), 'NOT_FOUND'); expect(confirm).not.toHaveBeenCalled();
});
it('cancels eligible deletion without writing', () => {
  writeJson(USERS_KEY, [record]); const write = vi.spyOn(Storage.prototype, 'setItem');
  fails(deleteUser(id, admin, () => false), 'CANCELLED'); expect(listUsers().value).toEqual([record]); expect(write).not.toHaveBeenCalled();
});
it('deletes only the fresh target and never cascades posts or session', () => {
  writeJson(USERS_KEY, [record, { ...record, id: 'other', username: 'other' }]);
  localStorage.setItem('writespace_posts', 'posts preserved'); localStorage.setItem('writespace_session', 'session preserved');
  expect(canDeleteUser(id, admin)).toBe(true); expect(deleteUser(id, admin, () => true)).toEqual({ ok: true, value: null });
  expect(listUsers().value).toEqual([{ ...record, id: 'other', username: 'other' }]);
  expect(localStorage.getItem('writespace_posts')).toBe('posts preserved'); expect(localStorage.getItem('writespace_session')).toBe('session preserved');
  fails(deleteUser(id, admin, () => true), 'NOT_FOUND');
});
it('computes pure counts with fixed admin once and regular users separately', () => {
  const users = [record, { ...record, id: 'a2', username: 'a2', role: 'admin' }];
  const post = { id: 'p1', title: 'Title', content: 'Text', authorId: id, authorName: 'Riley', createdAt: record.createdAt };
  expect(dashboardMetrics([post, { ...post, id: 'p2' }], users)).toEqual({ totalPosts: 2, totalUsers: 3, totalAdmins: 2, regularUsers: 1 });
  expect(users).toHaveLength(2);
  expect(dashboardMetrics([], [...users, { ...record, id: 'admin', username: 'admin', role: 'admin' }]).totalAdmins).toBe(2);
});
it.each([undefined, null, 0, 'invalid', {}, [], [null], [{}], [{ id: 'p1', createdAt: 'invalid' }]])('handles empty/invalid metric posts %j', (posts) => {
  expect(dashboardMetrics(posts, []).totalPosts).toBe(0);
});
it.each([undefined, null, 0, 'invalid', {}, [], [null], [{}]])('handles empty/invalid metric users %j', (users) => {
  expect(dashboardMetrics(null, users)).toEqual({ totalPosts: 0, totalUsers: 1, totalAdmins: 1, regularUsers: 0 });
});
