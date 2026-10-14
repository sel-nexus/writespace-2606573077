/** Register only reader accounts and explain partial account/session persistence honestly. */
import { useState } from 'react';
import PropTypes from 'prop-types';
import { Link, useNavigate } from 'react-router-dom';
import { Field } from '../components/Field.jsx';
import { Alert } from '../components/Alert.jsx';
import { ui } from '../components/ui.js';
import { register, REGISTER_LABELS, roleHome } from '../utils/auth.js';
import { requiredErrors } from '../utils/validation.js';
/** Preserve entered values and focus the first invalid control. @param {object} props @returns {JSX.Element} */
export default function Register({ onSessionChange }) {
  const [values, setValues] = useState({ displayName: '', username: '', password: '', confirmation: '' });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const navigate = useNavigate();
  /** Validate fields, then attempt both writes without pretending they are atomic. @param {Event} event @returns {void} */
  function submit(event) {
    event.preventDefault();
    const invalid = requiredErrors(values, REGISTER_LABELS);
    if (!invalid.confirmation && values.password !== values.confirmation) invalid.confirmation = 'Passwords do not match.';
    setMessage('');
    if (Object.keys(invalid).length) {
      setErrors(invalid);
      event.currentTarget.elements.namedItem(Object.keys(invalid)[0]).focus();
      return;
    }
    const result = register(values);
    if (!result.ok) {
      if (['USERNAME_TAKEN', 'RESERVED_USERNAME'].includes(result.error.code)) {
        setErrors({ username: result.error.message });
        event.currentTarget.elements.namedItem('username').focus();
      } else { setErrors({}); setMessage(result.error.message); }
      return;
    }
    setErrors({});
    onSessionChange(result.value);
    navigate(roleHome(result.value), { replace: true });
  }
  return (
    <section className="mx-auto grid w-full max-w-5xl gap-10 px-5 py-12 sm:grid-cols-[1fr_1.1fr] sm:py-16 dark:text-slate-100">
      <div className="space-y-6 sm:pt-10">
        <p className="text-xs font-bold uppercase tracking-[.2em] text-primary-700 dark:text-primary-300">
          Make room for words
        </p>
        <h1 className="font-display text-hero tracking-tight">
          Start your next chapter.
        </h1>
        <p className="max-w-sm text-lg leading-relaxed text-foreground-muted dark:text-slate-300">
          Create a reader account for this browser. Your display name makes this space yours.
        </p>
        <p className="max-w-sm border-l-2 border-primary-300 pl-4 text-sm leading-relaxed text-foreground-muted dark:border-primary-500 dark:text-slate-300">
          Local demo only. Accounts and plaintext passwords stay in this browser,
          with no server storage or synchronization. Use demo credentials only.
        </p>
      </div>
      <div className={`${ui.card} space-y-6 dark:border-slate-700 dark:bg-slate-800`}>
        <h2 className="font-display text-2xl font-bold">
          Create an account
        </h2>
        <form noValidate onSubmit={submit} className="space-y-5">
          {Object.entries(REGISTER_LABELS).map(([key, label]) => (
            <Field
              key={key}
              id={key}
              label={label}
              type={['password', 'confirmation'].includes(key) ? 'password' : 'text'}
              value={values[key]}
              error={errors[key]}
              autoComplete={key === 'displayName' ? 'nickname' : key === 'username' ? 'username' : 'new-password'}
              onChange={(event) => setValues({ ...values, [key]: event.target.value })}
            />
          ))}
          <Alert message={message} />
          <button
            type="submit"
            className={`${ui.button} w-full dark:focus-visible:ring-primary-300 dark:focus-visible:ring-offset-slate-800`}
          >
            Create account
          </button>
        </form>
        <p className="text-sm text-foreground-muted dark:text-slate-300">
          Already have an account?{' '}
          <Link
            to="/login"
            className={`${ui.link} dark:text-primary-300 dark:decoration-primary-700 dark:hover:decoration-primary-300 dark:focus-visible:ring-primary-300`}
          >
            Sign in
          </Link>
        </p>
      </div>
    </section>
  );
}
Register.propTypes = { onSessionChange: PropTypes.func.isRequired };
