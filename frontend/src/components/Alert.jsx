/** Announce recoverable action and storage feedback without exposing sensitive data. */
import PropTypes from 'prop-types';
import { ui } from './ui.js';
/** Render nothing for empty feedback. @param {object} props @returns {JSX.Element|null} */
export function Alert({ message, variant = 'error' }) {
  if (!message) return null;
  return (
    <p role={variant === 'error' ? 'alert' : 'status'} aria-live={variant === 'error' ? 'assertive' : 'polite'}
      className={`rounded-control border p-4 text-sm leading-relaxed ${ui.alerts[variant]}`}>
      {message}
    </p>
  );
}
Alert.propTypes = { message: PropTypes.string, variant: PropTypes.oneOf(['error', 'warning', 'info', 'success']) };
