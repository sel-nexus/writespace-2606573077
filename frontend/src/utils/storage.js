/** Own the sole application localStorage boundary; never throw ordinary storage faults. */
import { failure, success } from './validation.js';

/** Read JSON or the missing-key fallback without modifying bytes. @param {string} key @param {unknown} fallback @returns {import('./validation.js').Result<unknown>} */
export function readJson(key, fallback) {
  let raw;
  try { raw = window.localStorage.getItem(key); }
  catch { return failure('STORAGE_UNAVAILABLE', 'Browser storage is unavailable.'); }
  if (raw === null) return success(fallback);
  try { return success(JSON.parse(raw)); }
  catch { return failure('CORRUPT_DATA', 'Stored browser data is unreadable.'); }
}
/** Serialize before attempting a write; report which boundary failed. @param {string} key @param {unknown} value @returns {import('./validation.js').Result<void>} */
export function writeJson(key, value) {
  let raw;
  try {
    raw = JSON.stringify(value);
    if (raw === undefined) return failure('SERIALIZATION_FAILED', 'This change could not be serialized.');
  } catch { return failure('SERIALIZATION_FAILED', 'This change could not be serialized.'); }
  try { window.localStorage.setItem(key, raw); return success(undefined); }
  catch { return failure('STORAGE_WRITE_FAILED', 'This change could not be saved in this browser.'); }
}
/** Remove only the requested key. @param {string} key @returns {import('./validation.js').Result<void>} */
export function removeKey(key) {
  try { window.localStorage.removeItem(key); return success(undefined); }
  catch { return failure('STORAGE_UNAVAILABLE', 'The session could not be removed in this browser.'); }
}
