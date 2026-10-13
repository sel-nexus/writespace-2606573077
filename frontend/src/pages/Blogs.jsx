/** Browse all browser-local posts without changing stored records. */
import { useState } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { Alert } from '../components/Alert.jsx';
import { PostCard } from '../components/PostCard.jsx';
import { sessionType, ui } from '../components/ui.js';
import { listPosts } from '../utils/posts.js';

/** Render newest-first cards or a safe empty fallback with storage feedback.
 * @param {object} props
 * @param {import('../utils/validation.js').Session} props.session Signed-in reader.
 * @param {boolean} [props.writingAvailable=false] Enable the action only when writing is routed.
 * @returns {JSX.Element}
 */
export default function Blogs({ session, writingAvailable = false }) {
  const [result] = useState(() => listPosts());
  const posts = result.ok ? result.value : [];
  return (
    <section aria-labelledby="blogs-title" className="mx-auto max-w-6xl space-y-8 px-5 py-16">
      <div>
        <p className="mb-3 text-xs font-bold uppercase tracking-[.2em] text-primary-700">From this browser</p>
        <h1 id="blogs-title" className="font-display text-hero font-bold tracking-tight">All Blogs</h1>
      </div>
      {!result.ok && <Alert variant="warning" message={result.error.message} />}
      {posts.length ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((post, index) => (
            <PostCard key={post.id} post={post} session={session} index={index} />
          ))}
        </div>
      ) : (
        <div className={`${ui.card} space-y-6`}>
          <p className="text-lg leading-relaxed text-foreground-muted">No posts yet. Be the first to write one!</p>
          {writingAvailable ? (
            <Link to="/write" className={ui.button}>Write a Blog</Link>
          ) : (
            <button type="button" className={ui.button} disabled>Write a Blog</button>
          )}
        </div>
      )}
    </section>
  );
}
Blogs.propTypes = { session: sessionType.isRequired, writingAvailable: PropTypes.bool };
