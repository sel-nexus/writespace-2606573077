/** Verify accessible shared controls and their alternate states. */
import { it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Field } from '../components/Field.jsx';
import { Alert } from '../components/Alert.jsx';
import { Avatar } from '../components/Avatar.jsx';
it('labels required fields, accepts input and associates errors', async () => {
  const onChange = vi.fn();
  const { rerender } = render(
    <Field id="name" label="Name" value="" onChange={onChange} />
  );
  const input = screen.getByRole('textbox', { name: 'Name' });
  expect(input).toBeRequired(); expect(input).toHaveAttribute('aria-required', 'true');
  expect(input).toHaveAttribute('aria-invalid', 'false'); expect(input).not.toHaveAttribute('aria-describedby');
  await userEvent.setup().type(input, 'A'); expect(onChange).toHaveBeenCalled();
  rerender(
    <Field id="name" label="Name" value="A" error="Name is invalid." required={false} onChange={onChange} autoComplete="nickname" />
  );
  expect(input).not.toBeRequired(); expect(input).toHaveAttribute('aria-invalid', 'true');
  expect(input).toHaveAccessibleDescription('Name is invalid.'); expect(input).toHaveAttribute('autocomplete', 'nickname');
  expect(screen.getByRole('alert')).toHaveTextContent('Name is invalid.');
});
it('renders password fields and preserves explicit input type', () => {
  render(
    <Field id="pass" label="Password" type="password" value="demo" onChange={() => {}} />
  );
  expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
});
it('omits empty alerts and announces error and all status variants', () => {
  const { rerender, container } = render(
    <Alert message="" />
  );
  expect(container).toBeEmptyDOMElement();
  rerender(
    <Alert message="Not saved" />
  );
  expect(screen.getByRole('alert')).toHaveTextContent('Not saved');
  expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'assertive');
  for (const variant of ['warning', 'info', 'success']) {
    rerender(
      <Alert variant={variant} message={variant} />
    );
    expect(screen.getByRole('status')).toHaveTextContent(variant);
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  }
});
it('distinguishes user and admin avatars by role and accessible name', () => {
  const { rerender } = render(
    <Avatar role="user" />
  );
  expect(screen.getByRole('img', { name: 'User avatar' })).toHaveTextContent('📚');
  rerender(
    <Avatar role="admin" />
  );
  expect(screen.getByRole('img', { name: 'Administrator avatar' })).toHaveTextContent('👑');
});
