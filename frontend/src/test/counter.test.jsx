/** Verify the existing derived counter without changing validation or local post contracts. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App.jsx';
import { createPost, getPost, listPosts, POSTS_KEY } from '../utils/posts.js';

const owner = {
  userId: '11111111-1111-4111-8111-111111111111', username: 'avery',
  displayName: 'Avery', role: 'user'
};
const original = { title: 'Original note', content: 'First line\n😀e\u0301 ' };
const fields = ['authorId', 'authorName', 'content', 'createdAt', 'id', 'title'];

/** Read all persisted bytes to detect incidental counter writes.
 * Returns:
 *   An exact key/value snapshot, including unrelated session and theme data.
 */
function storageBytes() {
  return Object.fromEntries(Object.keys(localStorage).sort().map((key) => [key, localStorage.getItem(key)]));
}

/** Mount a production authoring route with a real saved post for edit prefill.
 * Args:
 *   mode: Create or edit route to exercise.
 *   theme: Existing appearance preference to initialize.
 * Returns:
 *   The mounted form's input, count, submit control and original saved record.
 */
function openForm(mode, theme) {
  localStorage.setItem('writespace_session', JSON.stringify(owner));
  localStorage.setItem('writespace_theme', theme);
  let saved = null;
  if (mode === 'edit') {
    const result = createPost(original, owner);
    expect(result.ok).toBe(true);
    saved = getPost(result.value.id).value;
  }
  window.history.replaceState({}, '', saved ? `/edit/${saved.id}` : '/write');
  render(<App />);
  return {
    saved,
    title: screen.getByRole('textbox', { name: 'Title' }),
    content: screen.getByRole('textbox', { name: 'Content' }),
    count: screen.getByRole('status'),
    submit: screen.getByRole('button', { name: saved ? 'Save Changes' : 'Publish Blog' })
  };
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('dark');
  window.history.replaceState({}, '', '/');
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  document.documentElement.classList.remove('dark');
});

for (const theme of ['light', 'dark']) {
  describe(`${theme} authoring counter`, () => {
    for (const mode of ['create', 'edit']) {
      describe(mode, () => {
        it('starts at zero or real edit prefill and retains accessible informational semantics', () => {
          const { title, content, count, saved } = openForm(mode, theme);
          expect(content).toHaveValue(saved ? original.content : '');
          expect(count.textContent.trim()).toBe(`${saved ? original.content.length : 0} characters`);
          expect(screen.getAllByRole('status')).toHaveLength(1);
          expect(document.documentElement.classList.contains('dark')).toBe(theme === 'dark');
          expect(count).toHaveAttribute('id', 'content-count');
          expect(count).toHaveAttribute('aria-live', 'polite');
          expect(count).toHaveAttribute('aria-atomic', 'true');
          expect(content).toHaveAttribute('aria-describedby', 'content-count');
          expect(content).toHaveAccessibleDescription(`${saved ? original.content.length : 0} characters`);
          expect(content).toBeRequired();
          expect(content).toHaveAttribute('aria-required', 'true');
          expect(content).not.toHaveAttribute('maxlength');
          expect(title).not.toHaveAttribute('maxlength');
          expect(count).toHaveClass('tabular-nums', 'text-foreground-muted', 'dark:text-slate-300');
        });

        it('tracks typing, deleting, actual clipboard paste and clearing without persisting drafts', async () => {
          const actor = userEvent.setup();
          const { title, content, count } = openForm(mode, theme);
          const before = storageBytes();
          await actor.clear(content);
          expect(count.textContent.trim()).toBe('0 characters');
          await actor.type(content, 'abc');
          expect(count.textContent.trim()).toBe('3 characters');
          await actor.keyboard('{Backspace}');
          expect(content).toHaveValue('ab');
          expect(count.textContent.trim()).toBe('2 characters');
          await actor.paste(' \n😀e\u0301');
          expect(content).toHaveValue('ab \n😀e\u0301');
          expect(count.textContent.trim()).toBe('8 characters');
          expect(content).toHaveAccessibleDescription('8 characters');
          await actor.clear(title);
          await actor.type(title, 'Title never contributes to count');
          expect(count.textContent.trim()).toBe('8 characters');
          await actor.clear(content);
          expect(count.textContent.trim()).toBe('0 characters');
          expect(content).toHaveValue('');
          expect(storageBytes()).toEqual(before);
        });

        it.each([
          ['empty', '', 0],
          ['one space', ' ', 1],
          ['whitespace only', ' \t\n ', 4],
          ['multiline with blank line', 'a\n\nb', 4],
          ['surrogate-pair emoji', '😀', 2],
          ['combining text', 'e\u0301', 2],
          ['joined family emoji', '👩‍👩‍👧‍👦', 11],
          ['mixed untrimmed text', ' \n😀e\u0301\n ', 8]
        ])('counts %s (%j) as %i UTF-16 code units rather than graphemes', (_name, value, length) => {
          const { content, count } = openForm(mode, theme);
          const before = storageBytes();
          fireEvent.change(content, { target: { value } });
          expect(content).toHaveValue(value);
          expect(value.length).toBe(length);
          expect(count.textContent.trim()).toBe(`${length} characters`);
          expect(storageBytes()).toEqual(before);
        });

        it.each(['', ' \t\n '])('keeps required validation and error/count associations for blank content %j', async (blank) => {
          const actor = userEvent.setup();
          const { title, content, count, submit } = openForm(mode, theme);
          const before = storageBytes();
          fireEvent.change(title, { target: { value: '' } });
          fireEvent.change(content, { target: { value: blank } });
          await actor.click(submit);
          expect(title).toHaveFocus();
          expect(title).toHaveAttribute('aria-invalid', 'true');
          expect(screen.getByText('Title is required.')).toHaveAttribute('id', 'title-error');
          expect(content).toHaveAttribute('aria-invalid', 'true');
          expect(screen.getByText('Content is required.')).toHaveAttribute('id', 'content-error');
          expect(content).toHaveAttribute('aria-describedby', 'content-error content-count');
          expect(content).toHaveAccessibleDescription(`Content is required. ${blank.length} characters`);
          expect(count.textContent.trim()).toBe(`${blank.length} characters`);
          expect(storageBytes()).toEqual(before);
          fireEvent.change(title, { target: { value: 'Required title' } });
          await actor.click(submit);
          expect(content).toHaveFocus();
          expect(screen.queryByText('Title is required.')).not.toBeInTheDocument();
          expect(storageBytes()).toEqual(before);
          await actor.clear(content);
          await actor.type(content, 'Valid');
          expect(count.textContent.trim()).toBe('5 characters');
          await actor.click(submit);
          expect(screen.queryByText('Content is required.')).not.toBeInTheDocument();
          expect(listPosts().value[0].content).toBe('Valid');
        });

        it('saves huge untrimmed text unrestricted and rereads exactly six fields with unchanged attribution', async () => {
          const { title, content, count, submit, saved } = openForm(mode, theme);
          const before = storageBytes();
          const text = ' \n<script>literal()</script>\n' + 'x'.repeat(100000) + '\n😀e\u0301 ';
          const enteredTitle = '  Long note  ';
          const earliest = Date.now();
          fireEvent.change(title, { target: { value: enteredTitle } });
          fireEvent.change(content, { target: { value: text } });
          expect(content).toHaveValue(text);
          expect(count.textContent.trim()).toBe(`${text.length} characters`);
          expect(storageBytes()).toEqual(before);
          await userEvent.setup().click(submit);
          const result = listPosts();
          expect(result.ok).toBe(true);
          expect(result.value).toHaveLength(1);
          const record = result.value[0];
          expect(Object.keys(record).sort()).toEqual(fields);
          expect(record.id).toMatch(/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i);
          expect(new Date(record.createdAt).toISOString()).toBe(record.createdAt);
          if (!saved) {
            expect(Date.parse(record.createdAt)).toBeGreaterThanOrEqual(earliest);
            expect(Date.parse(record.createdAt)).toBeLessThanOrEqual(Date.now());
          }
          const expected = {
            id: saved ? saved.id : record.id, title: enteredTitle, content: text,
            createdAt: saved ? saved.createdAt : record.createdAt,
            authorId: owner.userId, authorName: owner.displayName
          };
          expect(getPost(record.id)).toEqual({ ok: true, value: expected });
          expect(JSON.parse(localStorage.getItem(POSTS_KEY))).toEqual([expected]);
          expect(storageBytes()).toEqual({ ...before, [POSTS_KEY]: JSON.stringify([expected]) });
          expect(window.location.pathname).toBe(`/blog/${record.id}`);
          expect(screen.getByRole('article').querySelector('p.whitespace-pre-wrap').textContent).toBe(text);
          expect(screen.getByRole('article').querySelector('script')).toBeNull();
          cleanup();
          render(<App />);
          expect(getPost(record.id)).toEqual({ ok: true, value: expected });
          await userEvent.setup().click(screen.getByRole('link', { name: 'Edit', exact: true }));
          expect(screen.getByRole('textbox', { name: 'Content' })).toHaveValue(text);
          expect(screen.getByRole('status').textContent.trim()).toBe(`${text.length} characters`);
          expect(storageBytes()).toEqual({ ...before, [POSTS_KEY]: JSON.stringify([expected]) });
        });

        it('discards a counted draft on cancel and restores saved prefill or an empty create form', async () => {
          const actor = userEvent.setup();
          const { content, count, saved } = openForm(mode, theme);
          const before = storageBytes();
          await actor.clear(content);
          await actor.paste('Unsaved 😀\n');
          expect(count.textContent.trim()).toBe('11 characters');
          await actor.click(screen.getByRole('link', { name: 'Cancel' }));
          expect(window.location.pathname).toBe(saved ? `/blog/${saved.id}` : '/blogs');
          expect(storageBytes()).toEqual(before);
          expect(listPosts().value).toEqual(saved ? [saved] : []);
          const link = saved
            ? screen.getByRole('link', { name: 'Edit', exact: true })
            : screen.getAllByRole('link', { name: 'Write a Blog', exact: true })[0];
          await actor.click(link);
          expect(screen.getByRole('textbox', { name: 'Content' })).toHaveValue(saved ? original.content : '');
          expect(screen.getByRole('status').textContent.trim()).toBe(`${saved ? original.content.length : 0} characters`);
          expect(storageBytes()).toEqual(before);
        });

        it('retains text and live count after a real storage write failure without claiming a save', async () => {
          const actor = userEvent.setup();
          const { title, content, count, submit, saved } = openForm(mode, theme);
          const before = storageBytes();
          fireEvent.change(title, { target: { value: 'Unsaved title' } });
          await actor.clear(content);
          await actor.paste('Draft 😀\n');
          const route = window.location.pathname;
          const setItem = Storage.prototype.setItem;
          const failure = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
            if (key === POSTS_KEY) throw new DOMException('Quota exceeded', 'QuotaExceededError');
            return setItem.call(this, key, value);
          });
          await actor.click(submit);
          expect(screen.getByRole('alert')).toHaveTextContent('Not saved.');
          expect(screen.getByRole('alert')).toHaveTextContent('could not be saved');
          expect(window.location.pathname).toBe(route);
          expect(title).toHaveValue('Unsaved title');
          expect(content).toHaveValue('Draft 😀\n');
          expect(count.textContent.trim()).toBe('9 characters');
          await actor.type(content, 'x');
          expect(count.textContent.trim()).toBe('10 characters');
          expect(storageBytes()).toEqual(before);
          expect(listPosts().value).toEqual(saved ? [saved] : []);
          failure.mockRestore();
          await actor.click(screen.getByRole('link', { name: 'Cancel' }));
          expect(storageBytes()).toEqual(before);
        });
      });
    }
  });
}
