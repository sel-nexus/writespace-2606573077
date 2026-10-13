/** Verify account actions through persisted state and every recoverable failure category. */
import { describe, it, expect, vi } from 'vitest';
import { register, login, logout, roleHome } from '../utils/auth.js';
import { listUsers, USERS_KEY } from '../utils/users.js';
import { getSession, SESSION_KEY } from '../utils/session.js';
import { writeJson, readJson } from '../utils/storage.js';
const input = { displayName: 'Avery Lane', username: ' Avery ', password: ' demo ', confirmation: ' demo ' };
const user = { id: 'u1', displayName: 'Avery Lane', username: 'avery', password: ' demo ', role: 'user', createdAt: '2026-01-01T00:00:00.000Z' };
const admin = { userId: 'admin', username: 'admin', displayName: 'Admin', role: 'admin' };
/** Deny writes to one key while leaving the other browser operations real. @param {string} key @returns {void} */
function denyWrite(key) {
  const original = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (name, value) {
    if (name === key) throw new Error('quota');
    return original.call(this, name, value);
  });
}
describe('public registration', () => {
  it('writes exact user and session records with native UUID/time and user-only role', () => {
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('native-id');
    const result = register({ ...input, role: 'admin', extra: true });
    expect(result).toEqual({ ok: true, value: { userId: 'native-id', username: 'Avery', displayName: input.displayName, role: 'user' } });
    const accounts = listUsers().value;
    expect(accounts).toEqual([{ id: 'native-id', displayName: input.displayName, username: 'Avery', password: ' demo ', role: 'user', createdAt: expect.any(String) }]);
    expect(new Date(accounts[0].createdAt).toISOString()).toBe(accounts[0].createdAt);
    expect(getSession().value).toEqual(result.value);
  });
  it.each(Object.keys(input))('rejects each missing/empty/invalid required field: %s without writes', (key) => {
    for (const value of ['', ' ', null, 1, undefined]) {
      expect(register({ ...input, [key]: value }).error.code).toBe('VALIDATION');
      expect(listUsers().value).toEqual([]); expect(getSession().value).toBeNull();
    }
  });
  it('rejects missing input and mismatch without writes', () => {
    expect(register().error.code).toBe('VALIDATION');
    expect(register({ ...input, confirmation: 'demo' }).error.code).toBe('PASSWORD_MISMATCH');
    expect(listUsers().value).toEqual([]); expect(getSession().value).toBeNull();
  });
  it.each(['admin', 'ADMIN', ' Admin '])('reserves admin case-insensitively: %s', (username) => {
    expect(register({ ...input, username }).error.code).toBe('RESERVED_USERNAME');
    expect(listUsers().value).toEqual([]); expect(getSession().value).toBeNull();
  });
  it('rereads usernames and rejects duplicates instead of using stale state', () => {
    expect(listUsers().value).toEqual([]);
    writeJson(USERS_KEY, [user]);
    expect(register(input)).toEqual({ ok: false, error: { code: 'USERNAME_TAKEN', message: 'That username is already in use.' } });
    expect(listUsers().value).toEqual([user]); expect(getSession().value).toBeNull();
    expect(register({ ...input, username: 'next' }).ok).toBe(true);
    expect(listUsers().value.map((value) => value.username)).toEqual(['avery', 'next']);
  });
  it.each(['throw', 'missing', 'empty'])('contains UUID failure %s without incomplete records', (mode) => {
    if (mode === 'missing') vi.stubGlobal('crypto', {});
    else vi.spyOn(globalThis.crypto, 'randomUUID').mockImplementation(() => { if (mode === 'throw') throw new Error('no'); return ''; });
    expect(register(input).error.code).toBe('ID_GENERATION_FAILED');
    expect(listUsers().value).toEqual([]); expect(getSession().value).toBeNull();
  });
  it.each(['!', '{}', '[{"id":"bad"}]'])('refuses corrupt account storage %s and preserves bytes', (bytes) => {
    window.localStorage.setItem(USERS_KEY, bytes);
    expect(register(input).error.code).toBe('CORRUPT_DATA');
    expect(window.localStorage.getItem(USERS_KEY)).toBe(bytes); expect(getSession().value).toBeNull();
  });
  it('fails closed on denied reads', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    expect(register(input).error.code).toBe('STORAGE_UNAVAILABLE');
    vi.restoreAllMocks(); expect(listUsers().value).toEqual([]); expect(getSession().value).toBeNull();
  });
  it('does not establish session after failed account write', () => {
    denyWrite(USERS_KEY);
    expect(register(input).error.code).toBe('STORAGE_WRITE_FAILED');
    expect(listUsers().value).toEqual([]); expect(getSession().value).toBeNull();
  });
  it('retains account on session failure, then permits normal sign-in recovery', () => {
    denyWrite(SESSION_KEY);
    expect(register(input).error.code).toBe('SESSION_WRITE_FAILED');
    expect(listUsers().value).toHaveLength(1); expect(getSession().value).toBeNull();
    vi.restoreAllMocks();
    expect(login({ username: 'AVERY', password: input.password }).ok).toBe(true);
    expect(getSession().value.userId).toBe(listUsers().value[0].id);
  });
});
describe('login and logout', () => {
  it('checks fixed admin before corrupt or shadowing user records', () => {
    window.localStorage.setItem(USERS_KEY, '!');
    expect(login({ username: ' Admin ', password: 'admin' })).toEqual({ ok: true, value: admin });
    expect(getSession().value).toEqual(admin);
    writeJson(USERS_KEY, [{ ...user, username: 'admin' }]);
    expect(login({ username: 'ADMIN', password: 'admin' }).value).toEqual(admin);
    expect(readJson(USERS_KEY, []).value).toHaveLength(1);
  });
  it('rereads normal credentials, matches case-insensitively and compares password exactly', () => {
    expect(login({ username: 'avery', password: input.password }).error.code).toBe('INVALID_CREDENTIALS');
    writeJson(USERS_KEY, [user]);
    const result = login({ username: ' AVERY ', password: input.password });
    expect(result.value).toEqual({ userId: 'u1', displayName: user.displayName, username: 'avery', role: 'user' });
    expect(getSession().value).toEqual(result.value);
    writeJson(USERS_KEY, [{ ...user, role: 'admin' }]);
    expect(login({ username: 'avery', password: input.password }).value.role).toBe('admin');
    expect(getSession().value.role).toBe('admin');
  });
  it.each([{ username: 'avery', password: 'demo' }, { username: 'unknown', password: ' demo ' }, { username: 'admin', password: 'wrong' }])('rejects invalid credentials %j without session creation', (credentials) => {
    writeJson(USERS_KEY, [user]);
    expect(login(credentials)).toEqual({ ok: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid username or password.' } });
    expect(getSession().value).toBeNull(); expect(listUsers().value).toEqual([user]);
  });
  it.each(['username', 'password'])('rejects missing and nontext login field %s', (key) => {
    for (const value of ['', ' ', null, 1, undefined]) expect(login({ username: 'admin', password: 'admin', [key]: value }).error.code).toBe('VALIDATION');
    expect(login().error.code).toBe('VALIDATION'); expect(getSession().value).toBeNull();
  });
  it('propagates corrupt account reads and denied reads', () => {
    window.localStorage.setItem(USERS_KEY, '!');
    expect(login({ username: 'avery', password: 'demo' }).error.code).toBe('CORRUPT_DATA');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    expect(login({ username: 'avery', password: 'demo' }).error.code).toBe('STORAGE_UNAVAILABLE');
    vi.restoreAllMocks(); expect(getSession().value).toBeNull();
  });
  it.each(['admin', 'avery'])('reports session write failure for %s without success', (username) => {
    writeJson(USERS_KEY, [user]); denyWrite(SESSION_KEY);
    expect(login({ username, password: username === 'admin' ? 'admin' : input.password }).error.code).toBe('STORAGE_WRITE_FAILED');
    expect(getSession().value).toBeNull(); expect(listUsers().value).toEqual([user]);
  });
  it('contains corrupt sessions and allows a successful login to replace them', () => {
    window.localStorage.setItem(SESSION_KEY, '{bad');
    expect(getSession().error.code).toBe('CORRUPT_DATA');
    expect(login({ username: 'admin', password: 'admin' }).ok).toBe(true);
    expect(getSession().value).toEqual(admin);
  });
  it('clears only session and supports repeated logout', () => {
    writeJson(USERS_KEY, [user]); writeJson('writespace_posts', [{ text: 'keep' }]);
    login({ username: 'admin', password: 'admin' });
    expect(logout()).toEqual({ ok: true, value: undefined });
    expect(getSession().value).toBeNull(); expect(listUsers().value).toEqual([user]);
    expect(readJson('writespace_posts', []).value).toEqual([{ text: 'keep' }]); expect(logout().ok).toBe(true);
  });
  it('retains session after denied logout', () => {
    login({ username: 'admin', password: 'admin' });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('denied'); });
    expect(logout().error.code).toBe('STORAGE_UNAVAILABLE'); expect(getSession().value).toEqual(admin);
  });
  it('resolves all role homes', () => {
    expect(roleHome(null)).toBe('/'); expect(roleHome({ role: 'user' })).toBe('/blogs'); expect(roleHome(admin)).toBe('/admin');
  });
});
