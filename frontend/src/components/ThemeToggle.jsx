/** Offer explicit native keyboard and pointer activation without render side effects. */
import PropTypes from 'prop-types';

/**
 * Render the next appearance action with a visible focus ring and mobile-sized target.
 * Args:
 *   props: Current theme and the root-owned toggle event callback.
 * Returns:
 *   A native button; rendering never calls the callback.
 * @param {{theme: 'light'|'dark', onToggle: function}} props
 * @returns {JSX.Element}
 */
export function ThemeToggle({ theme = 'light', onToggle }) {
  const action = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  return (
    <button
      type="button"
      onClick={onToggle}
      className="min-h-11 min-w-11 rounded-control border border-border bg-surface px-3 py-2 text-sm font-semibold text-foreground hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 dark:focus-visible:ring-primary-400 dark:focus-visible:ring-offset-slate-900"
    >
      {action}
    </button>
  );
}

ThemeToggle.propTypes = {
  theme: PropTypes.oneOf(['light', 'dark']),
  onToggle: PropTypes.func
};
