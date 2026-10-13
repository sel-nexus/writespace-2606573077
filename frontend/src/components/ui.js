/** Share visual and prop contracts across account screens and later feature slices. */
import PropTypes from 'prop-types';
export const sessionType = PropTypes.shape({
  userId: PropTypes.string.isRequired, username: PropTypes.string.isRequired,
  displayName: PropTypes.string.isRequired, role: PropTypes.oneOf(['user', 'admin']).isRequired
});
export const ui = {
  focus: 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
  button: 'inline-flex min-h-11 items-center justify-center rounded-full bg-primary-600 px-6 py-3 font-semibold text-white shadow-sm hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50',
  link: 'rounded text-primary-700 underline decoration-primary-200 underline-offset-4 hover:decoration-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
  card: 'rounded-card border border-border bg-surface p-6 shadow-focal sm:p-10',
  input: 'min-h-11 w-full rounded-control border border-border bg-surface px-3 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-ring',
  alerts: { error: 'border-red-200 bg-error-light text-error', warning: 'border-amber-200 bg-warning-light text-warning', info: 'border-primary-200 bg-info-light text-info', success: 'border-green-200 bg-success-light text-success' },
  avatars: { user: 'bg-primary-100 text-primary-800', admin: 'bg-secondary-100 text-secondary-800' }
};
