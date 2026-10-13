/** Render a labeled input with explicit required and error associations. */
import PropTypes from 'prop-types';
import { ui } from './ui.js';
/** Keep input identity stable while form state changes. @param {object} props @returns {JSX.Element} */
export function Field({ id, label, type = 'text', value, onChange, error = '', required = true, autoComplete = 'off' }) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-semibold">
        {label}
      </label>
      <input id={id} name={id} type={type} value={value} onChange={onChange} required={required}
        aria-required={required} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined}
        autoComplete={autoComplete} className={ui.input} />
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-error">
          {error}
        </p>
      )}
    </div>
  );
}
Field.propTypes = {
  id: PropTypes.string.isRequired, label: PropTypes.string.isRequired, type: PropTypes.string,
  value: PropTypes.string.isRequired, onChange: PropTypes.func.isRequired, error: PropTypes.string,
  required: PropTypes.bool, autoComplete: PropTypes.string
};
