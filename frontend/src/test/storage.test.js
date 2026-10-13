/** Exercise JSON boundaries and typed record rejection without modifying corrupt bytes. */
import { describe, it, expect, vi } from 'vitest';
import { readJson, writeJson, removeKey } from '../utils/storage.js';
import { listUsers, USERS_KEY } from '../utils/users.js';
import { listPosts, POSTS_KEY } from '../utils/posts.js';
import { getSession, setSession, SESSION_KEY } from '../utils/session.js';
import { isUuid, isUser, isSession, isRole, isIsoTimestamp, isNonEmptyString, normalizeUsername, requiredErrors } from '../utils/validation.js';
const account = { id: '11111111-1111-4111-8111-111111111111', displayName: 'Avery', username: 'avery', password: 'demo', role: 'user', createdAt: '2026-01-01T00:00:00.000Z' };
const session = { userId: account.id, displayName: 'Avery', username: 'avery', role: 'user' };

describe('JSON storage', () => {
  it('returns fallback only for a missing key and rereads written JSON', () => {
    expect(readJson('x', [])).toEqual({ ok: true, value: [] });
    expect(writeJson('x', { text: 'hello' })).toEqual({ ok: true, value: undefined });
    expect(readJson('x', null)).toEqual({ ok: true, value: { text: 'hello' } });
    writeJson('x', null);
    expect(readJson('x', 'fallback').value).toBeNull();
    writeJson('other', [1]);
    expect(removeKey('x')).toEqual({ ok: true, value: undefined });
    expect(readJson('x', 'missing').value).toBe('missing');
    expect(readJson('other', []).value).toEqual([1]);
  });
  it('preserves malformed bytes and reports parse corruption', () => {
    window.localStorage.setItem('x', '{broken');
    expect(readJson('x', []).error.code).toBe('CORRUPT_DATA');
    expect(window.localStorage.getItem('x')).toBe('{broken');
  });
  it('contains denied storage access and denied reads', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    expect(readJson('x', []).error.code).toBe('STORAGE_UNAVAILABLE');
  });
  it('contains a throwing storage property getter across all operations', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new Error('denied'); });
    expect(readJson('x', []).error.code).toBe('STORAGE_UNAVAILABLE');
    expect(writeJson('x', {}).error.code).toBe('STORAGE_WRITE_FAILED');
    expect(removeKey('x').error.code).toBe('STORAGE_UNAVAILABLE');
  });
  it.each([undefined, 1n])('rejects unserializable value %s without changing existing state', (value) => {
    writeJson('x', 'keep');
    expect(writeJson('x', value).error.code).toBe('SERIALIZATION_FAILED');
    expect(readJson('x', null).value).toBe('keep');
  });
  it('rejects circular and throwing serialization', () => {
    const circular = {}; circular.self = circular;
    expect(writeJson('x', circular).error.code).toBe('SERIALIZATION_FAILED');
    expect(writeJson('x', { toJSON() { throw new Error('bad'); } }).error.code).toBe('SERIALIZATION_FAILED');
    expect(readJson('x', null).value).toBeNull();
  });
  it('reports denied writes without replacing persisted JSON', () => {
    writeJson('x', 'keep');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(writeJson('x', 'new').error.code).toBe('STORAGE_WRITE_FAILED');
    expect(readJson('x', null).value).toBe('keep');
  });
  it('reports denied removal and preserves the record', () => {
    writeJson('x', 'keep');
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('denied'); });
    expect(removeKey('x').error.code).toBe('STORAGE_UNAVAILABLE');
    expect(readJson('x', null).value).toBe('keep');
  });
});
describe('typed record boundaries', () => {
  it('accepts exact users and both session roles and reads fresh arrays', () => {
    expect(listUsers().value).toEqual([]);
    writeJson(USERS_KEY, [account]);
    expect(listUsers().value).toEqual([account]);
    writeJson(USERS_KEY, [{ ...account, role: 'admin' }]);
    expect(listUsers().value[0].role).toBe('admin');
    expect(getSession().value).toBeNull();
    expect(setSession(session).ok).toBe(true);
    expect(getSession().value).toEqual(session);
    setSession({ ...session, role: 'admin' });
    expect(getSession().value.role).toBe('admin');
  });
  it.each([null, {}, 'text', [null], [{ ...account, id: 'native-id' }], [{ ...account, id: 'admin' }], [{ ...account, id: ` ${account.id}` }], [{ ...account, extra: true }], [{ ...account, role: 'owner' }], [{ ...account, createdAt: 'January 1' }]])('rejects malformed user roots/members %j', (value) => {
    writeJson(USERS_KEY, value);
    const bytes = window.localStorage.getItem(USERS_KEY);
    expect(listUsers().error.code).toBe('CORRUPT_DATA');
    expect(window.localStorage.getItem(USERS_KEY)).toBe(bytes);
  });
  it.each(Object.keys(account))('rejects a missing or wrongly typed user field %s', (key) => {
    const missing = { ...account }; delete missing[key];
    for (const value of [missing, { ...account, [key]: 1 }, { ...account, [key]: ' ' }]) {
      writeJson(USERS_KEY, [value]);
      expect(listUsers().error.code).toBe('CORRUPT_DATA');
      expect(isUser(value)).toBe(false);
    }
  });
  it.each(['u1', 'admin', 'not-a-uuid', ` ${account.id}`, `${account.id} `])('rejects malformed persisted User ID %s with exact byte preservation', (id) => {
    const bytes = JSON.stringify([{ ...account, id }], null, 2);
    localStorage.setItem(USERS_KEY, bytes);
    expect(listUsers().error.code).toBe('CORRUPT_DATA');
    expect(localStorage.getItem(USERS_KEY)).toBe(bytes);
  });
  it.each([
    '2024-02-29T23:59:59Z',
    '2024-02-29T23:59:59.1Z',
    '2024-02-29T23:59:59.12Z',
    '2024-02-29T23:59:59.123Z'
  ])('accepts real leap-day timestamps %s without changing user or post bytes', (createdAt) => {
    expect(isIsoTimestamp(createdAt)).toBe(true);
    const user = { ...account, createdAt };
    const post = { id: account.id, title: 'Leap day', content: 'Keep text', createdAt,
      authorId: account.id, authorName: account.displayName };
    for (const [key, record, read] of [[USERS_KEY, user, listUsers], [POSTS_KEY, post, listPosts]]) {
      const bytes = JSON.stringify([record], null, 2);
      localStorage.setItem(key, bytes);
      expect(read()).toEqual({ ok: true, value: [record] });
      expect(localStorage.getItem(key)).toBe(bytes);
    }
  });
  it.each([
    '2024-02-30T00:00:00Z',
    '2026-02-29T00:00:00Z',
    '2024-02-29T24:00:00Z'
  ])('rejects calendar/time rollover %s with exact user and post byte preservation', (createdAt) => {
    expect(isIsoTimestamp(createdAt)).toBe(false);
    const user = { ...account, createdAt };
    expect(isUser(user)).toBe(false);
    const post = { id: account.id, title: 'Invalid date', content: 'Keep text', createdAt,
      authorId: account.id, authorName: account.displayName };
    for (const [key, record, read] of [[USERS_KEY, user, listUsers], [POSTS_KEY, post, listPosts]]) {
      const bytes = JSON.stringify([record], null, 2);
      localStorage.setItem(key, bytes);
      expect(read().error.code).toBe('CORRUPT_DATA');
      expect(localStorage.getItem(key)).toBe(bytes);
    }
  });
  it('accepts the fixed admin only as a session identity, not a collection User ID', () => {
    const admin = { userId: 'admin', username: 'admin', displayName: 'Admin', role: 'admin' };
    expect(setSession(admin)).toEqual({ ok: true, value: undefined });
    expect(getSession().value).toEqual(admin);
    expect(isUser({ ...account, id: 'admin', role: 'admin' })).toBe(false);
  });
  it('rejects case-insensitive duplicates and preserves bytes', () => {
    writeJson(USERS_KEY, [account, { ...account, id: '22222222-2222-4222-8222-222222222222', username: ' AVERY ' }]);
    expect(listUsers().error.code).toBe('CORRUPT_DATA');
    expect(readJson(USERS_KEY, []).value).toHaveLength(2);
  });
  it.each([[], 'bad', { ...session, userId: 'native-id' }, { ...session, password: 'bad' }, { ...session, role: 'owner' }])('rejects malformed session %j', (value) => {
    writeJson(SESSION_KEY, value);
    expect(getSession().error.code).toBe('CORRUPT_DATA');
    expect(setSession(value).error.code).toBe('VALIDATION');
    expect(readJson(SESSION_KEY, null).value).toEqual(value);
  });
  it.each(Object.keys(session))('rejects missing and invalid session field %s', (key) => {
    const missing = { ...session }; delete missing[key];
    for (const value of [missing, { ...session, [key]: 1 }, { ...session, [key]: '' }]) {
      expect(isSession(value)).toBe(false);
      expect(setSession(value).error.code).toBe('VALIDATION');
      writeJson(SESSION_KEY, value);
      expect(getSession().error.code).toBe('CORRUPT_DATA');
    }
  });
  it('propagates corrupt JSON and denied reads for both typed readers', () => {
    window.localStorage.setItem(USERS_KEY, '!'); window.localStorage.setItem(SESSION_KEY, '!');
    expect(listUsers().error.code).toBe('CORRUPT_DATA');
    expect(getSession().error.code).toBe('CORRUPT_DATA');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('no'); });
    expect(listUsers().error.code).toBe('STORAGE_UNAVAILABLE');
    expect(getSession().error.code).toBe('STORAGE_UNAVAILABLE');
  });
  it('validates UUID syntax without normalizing malformed values', () => {
    expect(isUuid(account.id)).toBe(true);
    expect(isUuid('AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA')).toBe(true);
    for (const value of [undefined, null, 123, {}, [], '', 'admin', 'u1', account.id.replaceAll('-', ''), ` ${account.id}`, `${account.id} `]) {
      expect(isUuid(value)).toBe(false);
    }
  });
  it('validates text, role, ISO timestamps and missing form objects', () => {
    expect(normalizeUsername(' AVERY ')).toBe('avery');
    expect(isNonEmptyString(' a ')).toBe(true);
    for (const value of [null, 1, '', ' ']) expect(isNonEmptyString(value)).toBe(false);
    expect(isRole('user')).toBe(true); expect(isRole('admin')).toBe(true); expect(isRole('other')).toBe(false);
    expect(isIsoTimestamp(account.createdAt)).toBe(true);
    for (const value of [null, 'bad', '2026-99-01T00:00:00Z', '2026-01-01']) expect(isIsoTimestamp(value)).toBe(false);
    expect(requiredErrors(undefined, { name: 'Name' })).toEqual({ name: 'Name is required.' });
  });
});
