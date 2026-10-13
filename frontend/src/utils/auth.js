/** Implement browser-local demo sign-in; these rules are not server-side security. */
import { listUsers, USERS_KEY } from './users.js';
import { writeJson } from './storage.js';
import { setSession, clearSession } from './session.js';
import { failure, success, isUuid, normalizeUsername, requiredErrors } from './validation.js';
export const REGISTER_LABELS = { displayName: 'Display name', username: 'Username', password: 'Password', confirmation: 'Confirm password' };
export const LOGIN_LABELS = { username: 'Username', password: 'Password' };
/** Extract a password-free identity. @param {import('./validation.js').User} user @returns {import('./validation.js').Session} */
function sessionFor(user) {
  return { userId: user.id, username: user.username, displayName: user.displayName, role: user.role };
}
/** Create a user then a session; a failed second write retains the account. @param {{displayName:string,username:string,password:string,confirmation:string}} input @returns {import('./validation.js').Result<import('./validation.js').Session>} */
export function register(input) {
  if (Object.keys(requiredErrors(input, REGISTER_LABELS)).length) return failure('VALIDATION', 'Complete all required fields.');
  if (input.password !== input.confirmation) return failure('PASSWORD_MISMATCH', 'Passwords do not match.');
  const normalized = normalizeUsername(input.username);
  if (normalized === 'admin') return failure('RESERVED_USERNAME', 'The admin username is reserved.');
  const users = listUsers();
  if (!users.ok) return users;
  if (users.value.some((user) => normalizeUsername(user.username) === normalized)) return failure('USERNAME_TAKEN', 'That username is already in use.');
  let id;
  try {
    id = globalThis.crypto.randomUUID();
    if (!isUuid(id)) throw new Error('Invalid identifier');
  } catch { return failure('ID_GENERATION_FAILED', 'This browser could not create an account ID. Please retry in a supported browser.'); }
  const user = { id, displayName: input.displayName, username: input.username.trim(), password: input.password, role: 'user', createdAt: new Date().toISOString() };
  const saved = writeJson(USERS_KEY, [...users.value, user]);
  if (!saved.ok) return saved;
  const session = sessionFor(user);
  const signedIn = setSession(session);
  if (!signedIn.ok) return failure('SESSION_WRITE_FAILED', 'Your account was saved, but sign-in could not be saved in this browser. Sign in once storage is available.');
  return success(session);
}
/** Check fixed admin first, then freshly read accounts; write before reporting success. @param {{username:string,password:string}} input @returns {import('./validation.js').Result<import('./validation.js').Session>} */
export function login(input) {
  if (Object.keys(requiredErrors(input, LOGIN_LABELS)).length) return failure('VALIDATION', 'Complete all required fields.');
  let session;
  if (normalizeUsername(input.username) === 'admin' && input.password === 'admin') {
    session = { userId: 'admin', username: 'admin', displayName: 'Admin', role: 'admin' };
  } else {
    const users = listUsers();
    if (!users.ok) return users;
    const user = users.value.find((candidate) => normalizeUsername(candidate.username) === normalizeUsername(input.username) && candidate.password === input.password);
    if (!user) return failure('INVALID_CREDENTIALS', 'Invalid username or password.');
    session = sessionFor(user);
  }
  const saved = setSession(session);
  return saved.ok ? success(session) : saved;
}
/** End the session only after removal succeeds. @returns {import('./validation.js').Result<void>} */
export function logout() { return clearSession(); }
/** Resolve the source-defined role destination. @param {import('./validation.js').Session|null} session @returns {'/'|'/blogs'|'/admin'} */
export function roleHome(session) { return !session ? '/' : session.role === 'admin' ? '/admin' : '/blogs'; }
