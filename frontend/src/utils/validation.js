/** Validate browser records without repairing or persisting untrusted data. */
/** @typedef {'user'|'admin'} Role */
/** @typedef {{id:string,displayName:string,username:string,password:string,role:Role,createdAt:string}} User */
/** @typedef {{userId:string,username:string,displayName:string,role:Role}} Session */
/** @typedef {{code:string,message:string}} StorageError */
/** @template T @typedef {{ok:true,value:T}|{ok:false,error:StorageError}} Result */

/** Wrap a successful value. @template T @param {T} value @returns {Result<T>} */
export function success(value) { return { ok: true, value }; }
/** Describe a recoverable failure. @param {string} code @param {string} message @returns {Result<never>} */
export function failure(code, message) { return { ok: false, error: { code, message } }; }
/** Test required text without altering it. @param {unknown} value @returns {boolean} */
export function isNonEmptyString(value) { return typeof value === 'string' && value.trim().length > 0; }
/** Normalize a username for comparisons. @param {string} value @returns {string} */
export function normalizeUsername(value) { return value.trim().toLowerCase(); }
/** Test the two supported roles. @param {unknown} value @returns {boolean} */
export function isRole(value) { return value === 'user' || value === 'admin'; }
/** Check exact keys and nonempty string primitives. @param {unknown} value @param {string[]} keys @returns {boolean} */
function hasExactTextKeys(value, keys) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === keys.length && keys.every((key) => isNonEmptyString(value[key]));
}
/** Validate an ISO timestamp rather than accepting arbitrary date text. @param {unknown} value @returns {boolean} */
export function isIsoTimestamp(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)
    && Number.isFinite(Date.parse(value));
}
/** Validate the exact account schema. @param {unknown} value @returns {boolean} */
export function isUser(value) {
  return hasExactTextKeys(value, ['id', 'displayName', 'username', 'password', 'role', 'createdAt'])
    && isRole(value.role) && isIsoTimestamp(value.createdAt);
}
/** Validate a password-free session. @param {unknown} value @returns {boolean} */
export function isSession(value) {
  return hasExactTextKeys(value, ['userId', 'username', 'displayName', 'role']) && isRole(value.role);
}
/** Return all required-field errors in form order. @param {object} input @param {Object<string,string>} labels @returns {Object<string,string>} */
export function requiredErrors(input, labels) {
  return Object.fromEntries(Object.entries(labels).filter(([key]) => !isNonEmptyString(input?.[key]))
    .map(([key, label]) => [key, `${label} is required.`]));
}
