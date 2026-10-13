/** Read canonical accounts and refuse malformed collections instead of overwriting them. */
import { readJson } from './storage.js';
import { failure, isUser, normalizeUsername } from './validation.js';
export const USERS_KEY = 'writespace_users';
/** Read fresh accounts with exact record and unique username checks. @returns {import('./validation.js').Result<import('./validation.js').User[]>} */
export function listUsers() {
  const result = readJson(USERS_KEY, []);
  if (!result.ok) return result;
  if (!Array.isArray(result.value) || !result.value.every(isUser)) {
    return failure('CORRUPT_DATA', 'Stored accounts have an invalid format.');
  }
  const names = result.value.map((user) => normalizeUsername(user.username));
  if (new Set(names).size !== names.length) return failure('CORRUPT_DATA', 'Stored accounts contain duplicate usernames.');
  return result;
}
