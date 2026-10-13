/** Show the source-defined role avatar with an accessible role name. */
import PropTypes from 'prop-types';
import { ui } from './ui.js';
const postColors = [
  'bg-indigo-100 text-indigo-800',
  'bg-violet-100 text-violet-800',
  'bg-pink-100 text-pink-800',
  'bg-teal-100 text-teal-800'
];
/** Keep role symbols independent of optional post-list color. @param {{role:'user'|'admin',index?:number}} props @returns {JSX.Element} */
export function Avatar({ role, index }) {
  const color = index === undefined ? ui.avatars[role]
    : postColors[((index % postColors.length) + postColors.length) % postColors.length];
  return (
    <span role="img" aria-label={role === 'admin' ? 'Administrator avatar' : 'User avatar'}
      className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl ${color}`}>
      {role === 'admin' ? '👑' : '📚'}
    </span>
  );
}
Avatar.propTypes = { role: PropTypes.oneOf(['user', 'admin']).isRequired, index: PropTypes.number };
