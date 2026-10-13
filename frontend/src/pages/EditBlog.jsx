/** Prefill authorized edits while retaining authoritative mutation checks. */
import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { PostForm } from '../components/PostForm.jsx';
import { Alert } from '../components/Alert.jsx';
import { sessionType, ui } from '../components/ui.js';
import { getPost, canMutatePost, updatePost } from '../utils/posts.js';

/** Reject unauthorized initial access and keep read failures visible. @param {object} props @returns {JSX.Element} */
export default function EditBlog({ session }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [snapshot, setSnapshot] = useState(() => ({ id, result: getPost(id) }));
  useEffect(() => { setSnapshot({ id, result: getPost(id) }); }, [id]);
  // Never authorize or prefill a new URL using the preceding target's record.
  const result = snapshot.id === id ? snapshot.result : getPost(id);
  const post = result.ok ? result.value : null;
  /** Reread ownership in the domain helper before saving.
   * @param {object} input
   * @returns {import('../utils/validation.js').Result<import('../utils/posts.js').Post>}
   */
  function save(input) {
    const saved = updatePost(id, input, session);
    if (saved.ok) navigate(`/blog/${encodeURIComponent(saved.value.id)}`);
    return saved;
  }
  if (post && !canMutatePost(post, session)) return <Navigate to="/blogs" replace />;
  return (
    <section className="mx-auto max-w-3xl space-y-8 px-5 py-16">
      {!result.ok && <Alert variant="warning" message={result.error.message} />}
      {post ? (
        <>
          <h1 className="font-display text-4xl font-bold tracking-tight">Edit Blog</h1>
          <PostForm key={post.id} initialValues={post} onSave={save}
            cancelTo={`/blog/${encodeURIComponent(post.id)}`} submitLabel="Save Changes" />
        </>
      ) : (
        <>
          <h1 className="font-display text-4xl font-bold">Post not found</h1>
          <Link to="/blogs" className={ui.link}>Back to All Blogs</Link>
        </>
      )}
    </section>
  );
}
EditBlog.propTypes = { session: sessionType.isRequired };
