/** Share plain-text authoring with required fields and no length cap. */
import { useState } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { Field } from './Field.jsx';
import { Alert } from './Alert.jsx';
import { ui } from './ui.js';
import { requiredErrors } from '../utils/validation.js';

/** Keep unsaved text usable after failures and focus the first invalid field.
 * @param {object} props @returns {JSX.Element}
 */
export function PostForm({ initialValues = { title: '', content: '' }, onSave, cancelTo, submitLabel = 'Publish Blog' }) {
  const [values, setValues] = useState({ title: initialValues.title, content: initialValues.content });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  /** Validate before invoking persistence; never navigate on failure. @param {Event} event @returns {void} */
  function submit(event) {
    event.preventDefault();
    const invalid = requiredErrors(values, { title: 'Title', content: 'Content' });
    setErrors(invalid);
    setMessage('');
    if (Object.keys(invalid).length) {
      event.currentTarget.elements.namedItem(Object.keys(invalid)[0]).focus();
      return;
    }
    const result = onSave(values);
    if (!result.ok) setMessage(`Not saved. ${result.error.message}`);
  }
  return (
    <form noValidate onSubmit={submit} className={`${ui.card} space-y-6`}>
      <Field id="title" label="Title" value={values.title} error={errors.title}
        onChange={(event) => setValues({ ...values, title: event.target.value })} />
      <div className="space-y-2">
        <label htmlFor="content" className="block text-sm font-semibold">Content</label>
        <textarea id="content" name="content" required aria-required="true"
          aria-invalid={Boolean(errors.content)}
          aria-describedby={errors.content ? 'content-error content-count' : 'content-count'}
          value={values.content} className={`${ui.input} min-h-64 resize-y`}
          onChange={(event) => setValues({ ...values, content: event.target.value })} />
        {errors.content && (
          <p id="content-error" role="alert" className="text-sm text-error">{errors.content}</p>
        )}
        <p id="content-count" aria-live="polite" className="text-sm tabular-nums text-foreground-muted">
          {values.content.length} characters
        </p>
      </div>
      <Alert message={message} />
      <div className="flex flex-wrap items-center gap-6">
        <button type="submit" className={ui.button}>{submitLabel}</button>
        <Link to={cancelTo} className={ui.link}>Cancel</Link>
      </div>
    </form>
  );
}
PostForm.propTypes = {
  initialValues: PropTypes.shape({ title: PropTypes.string.isRequired, content: PropTypes.string.isRequired }),
  onSave: PropTypes.func.isRequired, cancelTo: PropTypes.string.isRequired, submitLabel: PropTypes.string
};
