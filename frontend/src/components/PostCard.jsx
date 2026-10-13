/** Render post previews as safe text with stable positional accents. */
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { Avatar } from './Avatar.jsx';
import { sessionType, ui } from './ui.js';
import { excerpt, formatPostDate, canMutatePost } from '../utils/posts.js';
const accents = ['border-t-indigo-500', 'border-t-violet-500', 'border-t-pink-500', 'border-t-teal-500'];
/** Link guests to sign-in and account holders to the reader. @param {object} props @returns {JSX.Element} */
export function PostCard({ post, session = null, index = 0, showEdit = false }) {
  return (
    <article className={`flex min-w-0 flex-col gap-5 rounded-card border border-border border-t-4 bg-surface p-6 ${
      accents[((index % accents.length) + accents.length) % accents.length]}`}>
      <div className="flex items-center gap-3">
        <Avatar role={post.authorId === 'admin' ? 'admin' : 'user'} index={index} />
        <div className="min-w-0 text-sm">
          <p className="break-words font-semibold">{post.authorName}</p>
          <time dateTime={post.createdAt} className="text-foreground-muted">{formatPostDate(post.createdAt)}</time>
        </div>
      </div>
      <h3 className="break-words font-display text-2xl font-bold">{post.title}</h3>
      <p className="break-words whitespace-pre-wrap leading-relaxed text-foreground-muted">{excerpt(post.content)}</p>
      <Link to={session ? `/blog/${encodeURIComponent(post.id)}` : '/login'} aria-label={`Read post: ${post.title}`}
        className={`${ui.link} mt-auto self-start py-2`}>
        Read post<span className="sr-only">: {post.title}</span>
      </Link>
      {showEdit && canMutatePost(post, session) && (
        <Link to={`/edit/${encodeURIComponent(post.id)}`} className={`${ui.link} self-start py-2`}
          aria-label={`Edit post: ${post.title}`}>
          Edit
        </Link>
      )}
    </article>
  );
}
PostCard.propTypes = {
  post: PropTypes.exact({
    id: PropTypes.string.isRequired, title: PropTypes.string.isRequired, content: PropTypes.string.isRequired,
    createdAt: PropTypes.string.isRequired, authorId: PropTypes.string.isRequired, authorName: PropTypes.string.isRequired
  }).isRequired,
  session: sessionType, index: PropTypes.number, showEdit: PropTypes.bool
};
