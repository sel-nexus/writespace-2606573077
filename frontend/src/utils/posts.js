/** Read and mutate browser-local plain-text posts with fail-closed ownership checks. */
import { readJson, writeJson } from './storage.js';
import { failure, success, isNonEmptyString, isIsoTimestamp, isSession, isRole } from './validation.js';
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
/** Validate a mutation actor without accepting a role-only session. @param {unknown} actor @returns {import('./validation.js').Result<void>} */
function validateActor(actor) {
  if (!isRole(actor?.role)) return failure('FORBIDDEN_ROLE', 'A user or admin session is required.');
  return isSession(actor) ? success(null) : failure('VALIDATION', 'A valid session is required.');
}
/** Check owner/admin policy using valid records and a complete session. @param {Post} post @param {import('./validation.js').Session} actor @returns {boolean} */
export function canMutatePost(post, actor) {
  return isPost(post) && isSession(actor) && (actor.role === 'admin' || post.authorId === actor.userId);
}
/** Reject empty fields without changing their original text. @param {object} input @returns {import('./validation.js').Result<void>} */
function validateInput(input) {
  return isNonEmptyString(input?.title) && isNonEmptyString(input?.content)
    ? success(null) : failure('VALIDATION', 'Title and content are required.');
}
/** Create an attributed post after a fresh valid read; never fabricate IDs. @param {{title:string,content:string}} input @param {import('./validation.js').Session} actor @returns {import('./validation.js').Result<Post>} */
export function createPost(input, actor) {
  const access = validateActor(actor);
  if (!access.ok) return access;
  const valid = validateInput(input);
  if (!valid.ok) return valid;
  const posts = listPosts();
  if (!posts.ok) return posts;
  let id;
  try {
    id = globalThis.crypto.randomUUID();
    if (!isNonEmptyString(id)) throw new Error('Missing ID');
  } catch {
    return failure('ID_GENERATION_FAILED', 'Could not generate a post ID. Please retry in a browser with native UUID support.');
  }
  const post = { id, title: input.title, content: input.content, createdAt: new Date().toISOString(),
    authorId: actor.userId, authorName: actor.displayName };
  const saved = writeJson(POSTS_KEY, [...posts.value, post]);
  return saved.ok ? success(post) : saved;
}
/** Replace only title/content after rereading and rechecking ownership. @param {string} id @param {{title:string,content:string}} input @param {import('./validation.js').Session} actor @returns {import('./validation.js').Result<Post>} */
export function updatePost(id, input, actor) {
  const access = validateActor(actor);
  if (!access.ok) return access;
  if (!isNonEmptyString(id)) return failure('VALIDATION', 'A post ID is required.');
  const valid = validateInput(input);
  if (!valid.ok) return valid;
  const posts = listPosts();
  if (!posts.ok) return posts;
  const post = posts.value.find((item) => item.id === id);
  if (!post) return failure('NOT_FOUND', 'Post not found');
  if (!canMutatePost(post, actor)) return failure('FORBIDDEN_OWNER', 'You can only edit your own posts.');
  const updated = { ...post, title: input.title, content: input.content };
  const saved = writeJson(POSTS_KEY, posts.value.map((item) => item.id === id ? updated : item));
  return saved.ok ? success(updated) : saved;
}
/** Confirm only after fresh target/access checks; cancellation never writes. @param {string} id @param {import('./validation.js').Session} actor @param {() => boolean} confirm @returns {import('./validation.js').Result<void>} */
export function deletePost(id, actor, confirm) {
  const access = validateActor(actor);
  if (!access.ok) return access;
  if (!isNonEmptyString(id) || typeof confirm !== 'function') return failure('VALIDATION', 'A post ID and confirmation callback are required.');
  const posts = listPosts();
  if (!posts.ok) return posts;
  const post = posts.value.find((item) => item.id === id);
  if (!post) return failure('NOT_FOUND', 'Post not found');
  if (!canMutatePost(post, actor)) return failure('FORBIDDEN_OWNER', 'You can only delete your own posts.');
  if (!confirm()) return failure('CANCELLED', 'Deletion cancelled.');
  const saved = writeJson(POSTS_KEY, posts.value.filter((item) => item.id !== id));
  return saved.ok ? success(null) : saved;
}
/** Format in UTC so saved dates do not shift with the viewer's time zone. @param {string} value @returns {string} */
export function formatPostDate(value) {
  if (!isIsoTimestamp(value)) return 'Unknown date';
  const date = new Date(value);
  return `${months[date.getUTCMonth()]} ${String(date.getUTCDate()).padStart(2, '0')} ${date.getUTCFullYear()}`;
}
/** Return only the first 120 plain-text characters, with no markup or added suffix. @param {string} content @returns {string} */
export function excerpt(content) { return typeof content === 'string' ? content.slice(0, 120) : ''; }
