/** Maintain eligible browser-local accounts without cascading to posts or sessions. */
import { useState } from 'react';
import PropTypes from 'prop-types';
import { Field } from '../components/Field.jsx';
import { Avatar } from '../components/Avatar.jsx';
import { Alert } from '../components/Alert.jsx';
import { sessionType, ui } from '../components/ui.js';
import { listUsers } from '../utils/users.js';
import { createAdminUser, deleteUser, canDeleteUser, ADMIN_LABELS, PROTECTED_MESSAGE, SELF_MESSAGE } from '../utils/admin.js';
import { requiredErrors } from '../utils/validation.js';
import { formatPostDate } from '../utils/posts.js';

const emptyForm = { displayName: '', username: '', password: '', role: '' };
// Display-only identity: no fabricated password, UUID or timestamp is persisted.
const fixedAdmin = { id: 'admin', displayName: 'Admin', username: 'admin', role: 'admin', createdAt: null };
const badge = { admin: 'bg-secondary-100 text-secondary-800', user: 'bg-primary-100 text-primary-800' };

/** Expose protected-control explanations to mouse and keyboard users. @param {object} props @returns {JSX.Element} */
function DeleteControl({ account, session, onDelete }) {
  const reason = account.id === 'admin' ? PROTECTED_MESSAGE : account.id === session.userId ? SELF_MESSAGE : '';
  return (
    <span
      title={reason || undefined}
      tabIndex={reason ? 0 : undefined}
      aria-label={reason || undefined}
      className={`inline-flex rounded-control ${ui.focus}`}
    >
      <button type="button" disabled={!canDeleteUser(account.id, session)} title={reason || undefined}
        aria-label={`Delete account: ${account.username}`} onClick={() => onDelete(account.id)}
        className={`${ui.focus} min-h-11 rounded-control px-3 font-semibold text-error disabled:cursor-not-allowed disabled:opacity-50`}>Delete</button>
    </span>
  );
}
const accountType = PropTypes.shape({ id: PropTypes.string.isRequired, username: PropTypes.string.isRequired });
DeleteControl.propTypes = { account: accountType.isRequired, session: sessionType.isRequired, onDelete: PropTypes.func.isRequired };

/** Render creation and responsive account lists with accessible failure feedback. @param {object} props @returns {JSX.Element} */
export default function Users({ session }) {
  const [snapshot, setSnapshot] = useState(() => listUsers());
  const [values, setValues] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [feedback, setFeedback] = useState({ message: '', variant: 'info' });
  const accounts = [fixedAdmin, ...(snapshot.ok ? snapshot.value.filter((account) => account.id !== 'admin' && account.username.trim().toLowerCase() !== 'admin') : [])];
  /** Validate in field order and preserve input on every failed save. @param {Event} event @returns {void} */
  function submit(event) {
    event.preventDefault();
    const invalid = requiredErrors(values, ADMIN_LABELS);
    setFeedback({ message: '', variant: 'info' });
    if (Object.keys(invalid).length) {
      setErrors(invalid);
      event.currentTarget.elements.namedItem(Object.keys(invalid)[0]).focus();
      return;
    }
    const result = createAdminUser(values, session);
    if (!result.ok) {
      if (['USERNAME_TAKEN', 'RESERVED_USERNAME'].includes(result.error.code)) {
        setErrors({ username: result.error.message });
        event.currentTarget.elements.namedItem('username').focus();
      } else {
        setErrors({});
        setFeedback({ message: result.error.message, variant: 'error' });
      }
      return;
    }
    setSnapshot(listUsers());
    setValues(emptyForm);
    setErrors({});
    setFeedback({ message: 'Account created.', variant: 'success' });
    event.currentTarget.elements.namedItem('displayName').focus();
  }
  /** Confirm eligible deletion; never announce failure as success. @param {string} id @returns {void} */
  function remove(id) {
    const result = deleteUser(id, session, () => window.confirm('Delete this account? Its posts will remain.'));
    if (!result.ok) {
      setFeedback({ message: result.error.message, variant: result.error.code === 'CANCELLED' ? 'info' : 'error' });
      return;
    }
    setSnapshot(listUsers());
    setFeedback({ message: 'Account deleted.', variant: 'success' });
  }
  return (
    <section className="mx-auto max-w-6xl space-y-8 px-5 py-12">
      <header className="space-y-4">
        <p className="text-xs font-bold uppercase tracking-[.2em] text-secondary-800">Community administration</p>
        <h1 className="font-display text-4xl font-bold tracking-tight">Manage Users</h1>
        <p className="max-w-3xl text-sm leading-relaxed text-foreground-muted">
          Local demo only. Accounts and plaintext passwords stay in this browser. Use demo credentials only.
          Deleting an account does not change its posts or any session. The built-in admin is display-only.
        </p>
      </header>
      {!snapshot.ok && <Alert variant="warning" message={snapshot.error.message} />}
      <Alert message={feedback.message} variant={feedback.variant} />
      <section aria-labelledby="create-user" className={`${ui.card} space-y-6`}>
        <h2 id="create-user" className="font-display text-2xl font-bold">Create an account</h2>
        <form noValidate onSubmit={submit} className="grid gap-5 sm:grid-cols-2">
          {Object.entries(ADMIN_LABELS).filter(([key]) => key !== 'role').map(([key, label]) => (
            <Field key={key} id={key} label={label} type={key === 'password' ? 'password' : 'text'}
              value={values[key]} error={errors[key]} autoComplete={key === 'password' ? 'new-password' : 'off'}
              onChange={(event) => setValues({ ...values, [key]: event.target.value })} />
          ))}
          <div className="space-y-2">
            <label htmlFor="role" className="block text-sm font-semibold">Role</label>
            <select id="role" name="role" required aria-required="true" aria-invalid={Boolean(errors.role)}
              aria-describedby={errors.role ? 'role-error' : undefined} className={ui.input} value={values.role}
              onChange={(event) => setValues({ ...values, role: event.target.value })}>
              <option value="">Select a role</option>
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
            {errors.role && <p id="role-error" role="alert" className="text-sm text-error">{errors.role}</p>}
          </div>
          <button type="submit" className={`${ui.button} sm:col-span-2 sm:justify-self-start`}>Create account</button>
        </form>
      </section>
      <section aria-label="Accounts" className="space-y-4">
        <h2 className="font-display text-2xl font-bold">Accounts</h2>
        <div className="hidden overflow-x-auto rounded-card border border-border bg-surface sm:block">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Local accounts including the built-in administrator</caption>
            <thead className="bg-surface-raised">
              <tr>
                {['Account', 'Username', 'Role', 'Created date', 'Action'].map((label) => <th key={label} scope="col" className="p-4">{label}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {accounts.map((account) => (
                <tr key={account.id}>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <Avatar role={account.role} />
                      <span className="break-words font-semibold">{account.displayName}</span>
                    </div>
                  </td>
                  <td className="break-all p-4">{account.username}</td>
                  <td className="p-4">
                    <span className={`rounded-full px-3 py-1 font-semibold ${badge[account.role]}`}>{account.role}</span>
                  </td>
                  <td className="p-4">{account.createdAt ? formatPostDate(account.createdAt) : 'Built-in account'}</td>
                  <td className="p-4">
                    <DeleteControl account={account} session={session} onDelete={remove} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="space-y-4 sm:hidden" aria-label="Account cards">
          {accounts.map((account) => (
            <article key={account.id} aria-label={`Account: ${account.username}`} className="space-y-4 rounded-card border border-border bg-surface p-5">
              <div className="flex items-center gap-3">
                <Avatar role={account.role} />
                <h3 className="break-words font-display text-xl font-bold">{account.displayName}</h3>
              </div>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-foreground-muted">Username</dt>
                  <dd className="break-all">{account.username}</dd>
                </div>
                <div>
                  <dt className="text-foreground-muted">Role</dt>
                  <dd>
                    <span className={`rounded-full px-3 py-1 font-semibold ${badge[account.role]}`}>{account.role}</span>
                  </dd>
                </div>
                <div>
                  <dt className="text-foreground-muted">Created date</dt>
                  <dd>{account.createdAt ? formatPostDate(account.createdAt) : 'Built-in account'}</dd>
                </div>
              </dl>
              <DeleteControl account={account} session={session} onDelete={remove} />
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
Users.propTypes = { session: sessionType.isRequired };
