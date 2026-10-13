/** Read browser-local plain-text posts without mutations or schema repair. */
import { readJson } from './storage.js';
import { failure, success, isNonEmptyString, isIsoTimestamp } from './validation.js';
/** @typedef {{id:string,title:string,content:string,createdAt:string,authorId:string,authorName:string}} Post */
export const POSTS_KEY = 'writespace_posts';
const fields = ['id', 'title', 'content', 'createdAt', 'authorId', 'authorName'];
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** Validate exact required primitives and a real ISO calendar timestamp. @param {unknown} post @returns {boolean} */
function isPost(post) {
  if (!post || typeof post !== 'object' || Array.isArray(post)) return false;
  if (Object.keys(post).length !== fields.length || !fields.every((key) => isNonEmptyString(post[key]))) return false;
  if (!isIsoTimestamp(post.createdAt)) return false;
  return new Date(post.createdAt).toISOString().slice(0, 19) === post.createdAt.slice(0, 19);
}
/** Read fresh records, newest first, preserving input order on timestamp ties. @returns {import('./validation.js').Result<Post[]>} */
export function listPosts() {
  const result = readJson(POSTS_KEY, []);
  if (!result.ok) return result;
  if (!Array.isArray(result.value) || !result.value.every(isPost)) {
    return failure('CORRUPT_DATA', 'Stored posts have an invalid format.');
  }
  return success([...result.value].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)));
}
/** Find a post or return a successful null; retain storage failures. @param {string} id @returns {import('./validation.js').Result<Post|null>} */
export function getPost(id) {
  const result = listPosts();
  return result.ok ? success(result.value.find((post) => post.id === id) ?? null) : result;
}
/** Format in UTC so saved dates do not shift with the viewer's time zone. @param {string} value @returns {string} */
export function formatPostDate(value) {
  if (!isIsoTimestamp(value)) return 'Unknown date';
  const date = new Date(value);
  return `${months[date.getUTCMonth()]} ${String(date.getUTCDate()).padStart(2, '0')} ${date.getUTCFullYear()}`;
}
/** Return only the first 120 plain-text characters, with no markup or added suffix. @param {string} content @returns {string} */
export function excerpt(content) { return typeof content === 'string' ? content.slice(0, 120) : ''; }
