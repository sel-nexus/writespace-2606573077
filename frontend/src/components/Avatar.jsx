/** Show the source-defined role avatar with an accessible role name. */
import PropTypes from 'prop-types';
import { ui } from './ui.js';
/** Distinguish reader and administrator identities. @param {{role:'user'|'admin'}} props @returns {JSX.Element} */
export function Avatar({ role }) {
  return (
    <span role="img" aria-label={role === 'admin' ? 'Administrator avatar' : 'User avatar'}
      className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl ${ui.avatars[role]}`}>
      {role === 'admin' ? '👑' : '📚'}
    </span>
  );
}
Avatar.propTypes = { role: PropTypes.oneOf(['user', 'admin']).isRequired };
