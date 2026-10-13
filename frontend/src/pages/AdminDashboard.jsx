/** Review local community counts and the five newest posts. */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert } from '../components/Alert.jsx';
import { sessionType, ui } from '../components/ui.js';
import { dashboardMetrics } from '../utils/admin.js';
import { listUsers } from '../utils/users.js';
import { listPosts, deletePost, formatPostDate } from '../utils/posts.js';

/** Render typed-reader fallbacks without using them for mutations. @param {object} props @returns {JSX.Element} */
export default function AdminDashboard({ session }) {
  const [posts, setPosts] = useState(() => listPosts());
  const [users] = useState(() => listUsers());
  const [feedback, setFeedback] = useState({ message: '', variant: 'info' });
  const items = posts.ok ? posts.value : [];
  const metrics = dashboardMetrics(items, users.ok ? users.value : []);
  const stats = [
    ['Total Posts', metrics.totalPosts, 'Posts saved in this browser'],
    ['Total Users', metrics.totalUsers, 'Registered accounts + built-in admin'],
    ['Total Admins', metrics.totalAdmins, 'Registered admins + built-in admin'],
    ['Total users', metrics.regularUsers, 'Registered regular users only']
  ];
  /** Confirm cross-author deletion and refresh only after successful persistence. @param {string} id @returns {void} */
  function remove(id) {
    const result = deletePost(id, session, () => window.confirm('Delete this post?'));
    if (!result.ok) {
      setFeedback({ message: result.error.message, variant: result.error.code === 'CANCELLED' ? 'info' : 'error' });
      return;
    }
    setPosts(listPosts());
    setFeedback({ message: 'Post deleted.', variant: 'success' });
  }
  return (
    <section className="mx-auto max-w-6xl space-y-8 px-5 py-12">
      <header className="space-y-4 rounded-card bg-gradient-to-br from-secondary-800 to-primary-800 p-6 text-white shadow-focal sm:p-10">
        <p className="text-xs font-bold uppercase tracking-[.2em]">Community administration</p>
        <h1 className="font-display text-4xl font-bold tracking-tight">Admin Dashboard</h1>
        <p>Welcome, {session.displayName}. Review your browser-local community.</p>
      </header>
      <p className="text-sm leading-relaxed text-foreground-muted">
        Local demo only. These counts describe this browser, not a server or synchronized community.
        The built-in admin is a logical account, not a registered record. Other tabs may overwrite simultaneous changes.
      </p>
      {!posts.ok && <Alert variant="warning" message={posts.error.message} />}
      {!users.ok && <Alert variant="warning" message={users.error.message} />}
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(([label, count, source]) => (
          <div key={label} className="space-y-3 rounded-card border border-border bg-surface p-6">
            <dt className="font-semibold">{label}</dt>
            <dd className="text-4xl font-bold tabular-nums text-primary-800">{count}</dd>
            <dd className="text-sm text-foreground-muted">{source}</dd>
          </div>
        ))}
      </dl>
      <nav aria-label="Quick actions" className="flex flex-wrap gap-4">
        <Link to="/write" className={ui.button}>Write New Post</Link>
        <Link to="/users" className={ui.button}>Manage Users</Link>
      </nav>
      <section aria-labelledby="latest-posts" className={`${ui.card} space-y-6`}>
        <h2 id="latest-posts" className="font-display text-2xl font-bold">Latest Posts</h2>
        <Alert message={feedback.message} variant={feedback.variant} />
        {items.length === 0 && <p className="text-foreground-muted">No posts yet. Be the first to write one!</p>}
        <ol className="divide-y divide-border">
          {items.slice(0, 5).map((post) => (
            <li key={post.id} className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1 space-y-2">
                <h3 className="break-words font-display text-xl font-bold">
                  <Link to={`/blog/${encodeURIComponent(post.id)}`} className={ui.link}>{post.title}</Link>
                </h3>
                <p className="text-sm text-foreground-muted">{post.authorName} · {formatPostDate(post.createdAt)}</p>
              </div>
              <div className="flex gap-4">
                <Link
                  to={`/edit/${encodeURIComponent(post.id)}`}
                  aria-label={`Edit post: ${post.title}`}
                  className={`${ui.link} inline-flex min-h-11 items-center`}
                >
                  Edit
                </Link>
                <button type="button" aria-label={`Delete post: ${post.title}`} onClick={() => remove(post.id)}
                  className={`${ui.focus} min-h-11 rounded-control px-3 font-semibold text-error`}>Delete</button>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </section>
  );
}
AdminDashboard.propTypes = { session: sessionType.isRequired };
