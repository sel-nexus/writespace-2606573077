/** Offer browser-local demo sign-in with required-field focus and storage feedback. */
import { useState } from 'react';
import PropTypes from 'prop-types';
import { Link, useNavigate } from 'react-router-dom';
import { Field } from '../components/Field.jsx';
import { Alert } from '../components/Alert.jsx';
import { ui } from '../components/ui.js';
import { login, LOGIN_LABELS, roleHome } from '../utils/auth.js';
import { requiredErrors } from '../utils/validation.js';
/** Commit the session snapshot only after persistence succeeds. @param {object} props @returns {JSX.Element} */
export default function Login({ onSessionChange }) {
  const [values, setValues] = useState({ username: '', password: '' });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const navigate = useNavigate();
  /** Validate and sign in without navigating on failure. @param {Event} event @returns {void} */
  function submit(event) {
    event.preventDefault();
    const invalid = requiredErrors(values, LOGIN_LABELS);
    setErrors(invalid);
    setMessage('');
    if (Object.keys(invalid).length) { event.currentTarget.elements.namedItem(Object.keys(invalid)[0]).focus(); return; }
    const result = login(values);
    if (!result.ok) { setMessage(result.error.message); return; }
    onSessionChange(result.value);
    navigate(roleHome(result.value), { replace: true });
  }
  return (
    <section className="mx-auto grid w-full max-w-5xl gap-10 px-5 py-12 sm:grid-cols-[1fr_1.1fr] sm:py-20">
      <div className="space-y-6 sm:pt-10">
        <p className="text-xs font-bold uppercase tracking-[.2em] text-primary-700">Your writing space</p>
        <h1 className="font-display text-hero tracking-tight">Welcome back.</h1>
        <p className="max-w-sm text-lg leading-relaxed text-foreground-muted">
          A little room for your words. Sign in to your account on this browser.
        </p>
        <p className="max-w-sm border-l-2 border-primary-300 pl-4 text-sm leading-relaxed text-foreground-muted">
          Local demo only. Passwords are stored as plaintext in this browser.
          Do not use real credentials or sensitive information.
        </p>
      </div>
      <div className={`${ui.card} space-y-6`}>
        <h2 className="font-display text-2xl font-bold">Sign in</h2>
        <form noValidate onSubmit={submit} className="space-y-5">
          {Object.entries(LOGIN_LABELS).map(([key, label]) => (
            <Field key={key} id={key} label={label} type={key === 'password' ? 'password' : 'text'} value={values[key]}
              autoComplete={key === 'password' ? 'current-password' : 'username'} error={errors[key]}
              onChange={(event) => setValues({ ...values, [key]: event.target.value })} />
          ))}
          <Alert message={message} />
          <button type="submit" className={`${ui.button} w-full`}>Sign in</button>
        </form>
        <p className="rounded-control bg-surface-raised p-4 text-sm text-primary-900">
          Demo administrator: username{' '}
          <strong>admin</strong>
          , password{' '}
          <strong>admin</strong>
          .
        </p>
        <p className="text-sm text-foreground-muted">
          New here?{' '}
          <Link to="/register" className={ui.link}>Create an account</Link>
        </p>
      </div>
    </section>
  );
}
Login.propTypes = { onSessionChange: PropTypes.func.isRequired };
