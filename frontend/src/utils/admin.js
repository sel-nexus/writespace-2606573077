/** Manage browser-local accounts without changing posts or the active session. */
import { listUsers, USERS_KEY } from './users.js';
import { writeJson } from './storage.js';
import { failure, success, isUuid, isSession, isNonEmptyString, isRole, isUser, isIsoTimestamp, normalizeUsername, requiredErrors } from './validation.js';

export const ADMIN_LABELS = { displayName: 'Display name', username: 'Username', password: 'Password', role: 'Role' };
export const PROTECTED_MESSAGE = 'Default admin cannot be deleted';
export const SELF_MESSAGE = 'You cannot delete your own account.';

/** Require a complete administrator identity before any collection access.
 * @param {unknown} actor @returns {import('./validation.js').Result<void>}
 */
function validateAdmin(actor) {
  if (actor?.role !== 'admin') return failure('FORBIDDEN_ROLE', 'An admin session is required.');
  return isSession(actor) ? success(null) : failure('VALIDATION', 'A valid session is required.');
}

/** Evaluate deletion eligibility without reading storage or invoking confirmation.
 * @param {string} id @param {import('./validation.js').Session} actor @returns {boolean}
 */
export function canDeleteUser(id, actor) {
  return isNonEmptyString(id) && isSession(actor) && actor.role === 'admin'
    && id !== 'admin' && id !== actor.userId;
}

/** Create either permitted role after a fresh typed read; report success only after saving.
 * @param {{displayName:string,username:string,password:string,role:'user'|'admin'}} input
 * @param {import('./validation.js').Session} actor
 * @returns {import('./validation.js').Result<import('./validation.js').User>}
 */
export function createAdminUser(input, actor) {
  const access = validateAdmin(actor);
  if (!access.ok) return access;
  if (Object.keys(requiredErrors(input, ADMIN_LABELS)).length || !isRole(input.role)) {
    return failure('VALIDATION', 'Complete all required fields and select user or admin.');
  }
  const normalized = normalizeUsername(input.username);
  if (normalized === 'admin') return failure('RESERVED_USERNAME', 'The admin username is reserved.');
  const users = listUsers();
  if (!users.ok) return users;
  if (users.value.some((user) => normalizeUsername(user.username) === normalized)) {
    return failure('USERNAME_TAKEN', 'That username is already in use.');
  }
  let id;
  try {
    id = globalThis.crypto.randomUUID();
    if (!isUuid(id) || users.value.some((user) => user.id === id)) throw new Error('Invalid account ID');
  } catch {
    return failure('ID_GENERATION_FAILED', 'This browser could not create an account ID. Please retry in a supported browser.');
  }
  const user = { id, displayName: input.displayName, username: input.username.trim(), password: input.password,
    role: input.role, createdAt: new Date().toISOString() };
  const saved = writeJson(USERS_KEY, [...users.value, user]);
  return saved.ok ? success(user) : saved;
}

/** Protect fixed/self identities before confirmation or reads; delete no related data.
 * @param {string} id @param {import('./validation.js').Session} actor
 * @param {() => boolean} confirm @returns {import('./validation.js').Result<void>}
 */
export function deleteUser(id, actor, confirm) {
  const access = validateAdmin(actor);
  if (!access.ok) return access;
  if (!isNonEmptyString(id)) return failure('VALIDATION', 'An account ID is required.');
  if (id === 'admin') return failure('PROTECTED_ACCOUNT', PROTECTED_MESSAGE);
  if (id === actor.userId) return failure('SELF_DELETE', SELF_MESSAGE);
  if (typeof confirm !== 'function') return failure('VALIDATION', 'A confirmation callback is required.');
  const users = listUsers();
  if (!users.ok) return users;
  if (!users.value.some((user) => user.id === id)) return failure('NOT_FOUND', 'Account not found.');
  if (!confirm()) return failure('CANCELLED', 'Deletion cancelled.');
  const saved = writeJson(USERS_KEY, users.value.filter((user) => user.id !== id));
  return saved.ok ? success(null) : saved;
}

/** Count display-safe local collections, including the logical built-in administrator once.
 * Invalid user collections count as empty; callers retain their typed-reader warnings.
 * @param {import('./posts.js').Post[]} posts @param {import('./validation.js').User[]} users
 * @returns {{totalPosts:number,totalUsers:number,totalAdmins:number,regularUsers:number}}
 */
export function dashboardMetrics(posts, users) {
  const registered = Array.isArray(users) && users.every(isUser)
    ? users.filter((user) => user.id !== 'admin' && normalizeUsername(user.username) !== 'admin') : [];
  return {
    totalPosts: Array.isArray(posts) && posts.every((post) => post && typeof post === 'object'
      && !Array.isArray(post) && Object.keys(post).length === 6
      && ['id', 'title', 'content', 'authorId', 'authorName'].every((key) => isNonEmptyString(post[key]))
      && isUuid(post.id) && isIsoTimestamp(post.createdAt)) ? posts.length : 0,
    totalUsers: registered.length + 1,
    totalAdmins: registered.filter((user) => user.role === 'admin').length + 1,
    regularUsers: registered.filter((user) => user.role === 'user').length
  };
}
