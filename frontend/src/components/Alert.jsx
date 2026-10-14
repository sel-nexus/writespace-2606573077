/** Announce recoverable action and storage feedback without exposing sensitive data. */
import PropTypes from 'prop-types';
import { ui } from './ui.js';
const darkAlerts = {
  error: 'dark:border-red-800 dark:bg-red-950 dark:text-red-200',
  warning: 'dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200',
  info: 'dark:border-primary-800 dark:bg-slate-900 dark:text-primary-200',
  success: 'dark:border-green-800 dark:bg-green-950 dark:text-green-200'
};
/** Render nothing for empty feedback. @param {object} props @returns {JSX.Element|null} */
export function Alert({ message, variant = 'error' }) {
  if (!message) return null;
  return (
    <p
      role={variant === 'error' ? 'alert' : 'status'}
      aria-live={variant === 'error' ? 'assertive' : 'polite'}
      className={`rounded-control border p-4 text-sm leading-relaxed ${ui.alerts[variant]} ${darkAlerts[variant]}`}
    >
      {message}
    </p>
  );
}
Alert.propTypes = { message: PropTypes.string, variant: PropTypes.oneOf(['error', 'warning', 'info', 'success']) };
