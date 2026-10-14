/** Keep appearance normalization, preference storage, and root styling independent. */
import { readString, writeString } from './storage.js';

/** @typedef {'light'|'dark'} Theme */
export const THEME_KEY = 'writespace_theme';

/**
 * Restrict appearance to the two supported modes; default invalid input to light.
 * Args:
 *   raw: Untrusted preference bytes or another input.
 * Returns:
 *   The supported mode, never an arbitrary CSS class.
 * @param {unknown} raw
 * @returns {Theme}
 */
export function normalizeTheme(raw) {
  return raw === 'dark' ? 'dark' : 'light';
}

/**
 * Read the preference safely without saving a fallback.
 * Returns:
 *   Light for missing, invalid, or unavailable storage; otherwise the saved mode.
 * @returns {Theme}
 */
export function readTheme() {
  const result = readString(THEME_KEY);
  return normalizeTheme(result.ok ? result.value : null);
}

/**
 * Attempt to save only the independent appearance preference.
 * Args:
 *   theme: The selected mode, normalized defensively before persistence.
 * Returns:
 *   A storage result; failure must not roll back the caller's in-memory mode.
 * @param {Theme} theme
 * @returns {import('./validation.js').Result<void>}
 */
export function setThemePreference(theme) {
  return writeString(THEME_KEY, normalizeTheme(theme));
}

/**
 * Synchronize only the root dark class without accessing storage.
 * Args:
 *   theme: The selected appearance; invalid input removes the dark class.
 * Returns:
 *   Nothing; unrelated root classes remain unchanged.
 * @param {Theme} theme
 * @returns {void}
 */
export function applyRootTheme(theme) {
  document.documentElement.classList.toggle('dark', normalizeTheme(theme) === 'dark');
}
