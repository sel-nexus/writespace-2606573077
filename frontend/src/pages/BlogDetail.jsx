/** Read one browser-local post as plain text, never HTML or a mutation. */
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Alert } from '../components/Alert.jsx';
import { ui } from '../components/ui.js';
import { getPost, formatPostDate } from '../utils/posts.js';

/** Refresh the read when the URL id changes and keep failed reads renderable.
 * @returns {JSX.Element}
 * @notes React text interpolation preserves literal markup without executing it.
 */
export default function BlogDetail() {
  const { id } = useParams();
  const [result, setResult] = useState(() => getPost(id));
  useEffect(() => { setResult(getPost(id)); }, [id]);
  const post = result.ok ? result.value : null;
  return (
    <section className="mx-auto max-w-3xl space-y-8 px-5 py-16">
      <Link to="/blogs" className={`${ui.link} inline-flex py-2`}>Back to All Blogs</Link>
      {!result.ok && <Alert variant="warning" message={result.error.message} />}
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
        </article>
      ) : (
        <h1 className="font-display text-4xl font-bold">Post not found</h1>
      )}
    </section>
  );
}
