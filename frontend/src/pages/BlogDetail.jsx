/** Read safe plain text and expose owner/admin edit and confirmed deletion. */
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Alert } from '../components/Alert.jsx';
import { ui, sessionType } from '../components/ui.js';
import { getPost, formatPostDate, canMutatePost, deletePost } from '../utils/posts.js';

/** Refresh the read when the URL id changes and keep failed reads renderable.
 * @returns {JSX.Element}
 * @notes React text interpolation preserves literal markup without executing it.
 */
export default function BlogDetail({ session }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [message, setMessage] = useState('');
  /** Recheck fresh access before opening native confirmation. @returns {void} */
  function remove() {
    const deleted = deletePost(id, session, () => window.confirm('Delete this post?'));
    if (deleted.ok) navigate('/blogs');
    else if (deleted.error.code !== 'CANCELLED') setMessage(`Not deleted. ${deleted.error.message}`);
  }
  const [result, setResult] = useState(() => getPost(id));
  useEffect(() => { setResult(getPost(id)); }, [id]);
  const post = result.ok ? result.value : null;
  return (
    <section className="mx-auto max-w-3xl space-y-8 px-5 py-16">
      <Link to="/blogs" className={`${ui.link} inline-flex py-2`}>Back to All Blogs</Link>
      {!result.ok && <Alert variant="warning" message={result.error.message} />}
      <Alert message={message} />
      {post ? (
        <article aria-labelledby="post-title" className={`${ui.card} space-y-8`}>
          <header className="space-y-5">
            <h1 id="post-title" className="break-words font-display text-4xl font-bold tracking-tight">{post.title}</h1>
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-foreground-muted">
              <p className="break-words">By {post.authorName}</p>
              <time dateTime={post.createdAt}>{formatPostDate(post.createdAt)}</time>
            </div>
          </header>
          <p className="break-words whitespace-pre-wrap text-lg leading-relaxed">{post.content}</p>
          {canMutatePost(post, session) && (
            <div className="flex flex-wrap items-center gap-6">
              <Link to={`/edit/${encodeURIComponent(post.id)}`} className={ui.link}>Edit</Link>
              <button type="button" onClick={remove} className={ui.button}>Delete</button>
            </div>
          )}
        </article>
      ) : (
        <h1 className="font-display text-4xl font-bold">Post not found</h1>
      )}
    </section>
  );
}
BlogDetail.propTypes = { session: sessionType.isRequired };
