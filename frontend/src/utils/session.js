/** Persist only the password-free session schema. */
import { readJson, writeJson, removeKey } from './storage.js';
import { failure, isSession } from './validation.js';
export const SESSION_KEY = 'writespace_session';
/** Read a fresh session, treating absent storage as guest. @returns {import('./validation.js').Result<import('./validation.js').Session|null>} */
export function getSession() {
  const result = readJson(SESSION_KEY, null);
  if (!result.ok) return result;
  return result.value === null || isSession(result.value) ? result
    : failure('CORRUPT_DATA', 'Stored session has an invalid format.');
}
/** Reject malformed sessions before writing. @param {import('./validation.js').Session} value @returns {import('./validation.js').Result<void>} */
export function setSession(value) {
  return isSession(value) ? writeJson(SESSION_KEY, value) : failure('VALIDATION', 'Session has an invalid format.');
}
/** Clear only the session key. @returns {import('./validation.js').Result<void>} */
export function clearSession() { return removeKey(SESSION_KEY); }
