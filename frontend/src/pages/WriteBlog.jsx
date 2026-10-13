/** Create posts attributed to the active browser-local session. */
import { useNavigate } from 'react-router-dom';
import { PostForm } from '../components/PostForm.jsx';
import { sessionType } from '../components/ui.js';
import { createPost } from '../utils/posts.js';

/** Navigate to the reader only after persistence succeeds. @param {object} props @returns {JSX.Element} */
export default function WriteBlog({ session }) {
  const navigate = useNavigate();
  /** Save entered text unchanged and return failures to the form.
   * @param {object} input
   * @returns {import('../utils/validation.js').Result<import('../utils/posts.js').Post>}
   */
  function save(input) {
    const result = createPost(input, session);
    if (result.ok) navigate(`/blog/${encodeURIComponent(result.value.id)}`);
    return result;
  }
  return (
    <section className="mx-auto max-w-3xl space-y-8 px-5 py-16">
      <h1 className="font-display text-4xl font-bold tracking-tight">Write a Blog</h1>
      <PostForm onSave={save} cancelTo="/blogs" />
    </section>
  );
}
WriteBlog.propTypes = { session: sessionType.isRequired };
