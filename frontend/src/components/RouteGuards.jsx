/** Resolve local-demo navigation policy before rendering protected children. */
import PropTypes from 'prop-types';
import { Navigate } from 'react-router-dom';
import { roleHome } from '../utils/auth.js';
import { isSession } from '../utils/validation.js';
import { sessionType } from './ui.js';
/** Evaluate every source route without reading storage or changing history. @param {string} path @param {import('../utils/validation.js').Session|null} session @returns {boolean} */
export function canAccessRoute(path, session) {
  const signedIn = isSession(session);
  if (path === '/') return true;
  if (path === '/login' || path === '/register') return !signedIn;
  if (path === '/admin' || path === '/users') return signedIn && session.role === 'admin';
  if (['/blogs', '/write'].includes(path) || /^\/(blog|edit)\/[^/]+$/.test(path)) return signedIn;
  return false;
}
/** Redirect a signed-in visitor to role home. @param {object} props @returns {JSX.Element} */
export function GuestOnly({ session, children }) {
  return isSession(session) ? <Navigate to={roleHome(session)} replace /> : children;
}
/** Send guests to sign-in without rendering protected children. @param {object} props @returns {JSX.Element} */
export function RequireAuth({ session, children }) {
  return isSession(session) ? children : <Navigate to="/login" replace />;
}
/** Send non-admins to their role home and guests to sign-in. @param {object} props @returns {JSX.Element} */
export function RequireAdmin({ session, children }) {
  if (!isSession(session)) return <Navigate to="/login" replace />;
  return session.role === 'admin' ? children : <Navigate to="/blogs" replace />;
}
const guardTypes = { session: sessionType, children: PropTypes.node };
GuestOnly.propTypes = guardTypes;
RequireAuth.propTypes = guardTypes;
RequireAdmin.propTypes = guardTypes;
