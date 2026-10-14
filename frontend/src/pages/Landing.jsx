/** Introduce the local writing demo and up to three newest saved previews. */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert } from '../components/Alert.jsx';
import { PostCard } from '../components/PostCard.jsx';
import { sessionType, ui } from '../components/ui.js';
import { listPosts } from '../utils/posts.js';
import { roleHome } from '../utils/auth.js';
const features = [
  ['Write Freely', 'A title, your words, and room to think. Plain text, without a post length limit.'],
  ['Private & Local', 'Posts stay in this browser, not on a server. Local does not mean encrypted or secure.'],
  ['Instant & Fast', 'Read saved writing directly from your browser. No remote service or synchronization.']
];
/** Keep empty and failed reads renderable without altering stored bytes. @param {object} props @returns {JSX.Element} */
export default function Landing({ session = null }) {
  const [result] = useState(() => listPosts());
  const posts = result.ok ? result.value.slice(0, 3) : [];
  return (
    <div className="mx-auto max-w-6xl px-5 dark:text-slate-100">
      <section
        aria-labelledby="landing-title"
        className="grid items-center gap-12 py-16 lg:grid-cols-[1.2fr_1fr] lg:py-24"
      >
        <div className="space-y-7">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-primary-700 dark:text-primary-300">
            A little room for your words
          </p>
          <h1 id="landing-title" className="font-display text-hero font-bold tracking-tight">
            Your thoughts. Your space. Beautifully simple.
          </h1>
          <p className="max-w-lg text-lg leading-relaxed text-foreground-muted dark:text-slate-300">
            Turn a passing thought into a page worth keeping. A quiet, browser-local place to write and read.
          </p>
          <div className="flex flex-wrap items-center gap-5">
            <Link
              to="/register"
              className={`${ui.button} dark:focus-visible:ring-primary-300 dark:focus-visible:ring-offset-slate-950`}
            >
              Get Started Free
            </Link>
            <Link
              to={session ? '/blogs' : '/login'}
              className={`${ui.link} py-3 dark:text-primary-300 dark:decoration-primary-700 dark:hover:decoration-primary-300 dark:focus-visible:ring-primary-300`}
            >
              Start Reading
            </Link>
          </div>
          <Link
            to={session ? roleHome(session) : '/login'}
            className={`${ui.link} inline-flex py-2 dark:text-primary-300 dark:decoration-primary-700 dark:hover:decoration-primary-300 dark:focus-visible:ring-primary-300`}
          >
            Go to Dashboard
          </Link>
        </div>
        <div
          aria-hidden="true"
          className="relative isolate flex min-h-80 items-center justify-center rounded-card bg-primary-50 p-8 sm:p-12 dark:bg-slate-900"
        >
          <div
            className="absolute inset-6 -z-10 rounded-full bg-gradient-to-br from-primary-200 to-secondary-100 opacity-60 blur-2xl dark:from-primary-900 dark:to-secondary-900"
          />
          <div
            className="w-full max-w-xs rotate-[-4deg] rounded-card border border-primary-100 bg-surface p-8 shadow-focal motion-safe:animate-float dark:border-slate-700 dark:bg-slate-800"
          >
            <p className="mb-6 text-xs font-bold uppercase tracking-widest text-primary-700 dark:text-primary-300">
              A page of your own
            </p>
            <p className="font-display text-3xl leading-snug">
              Every story starts with a little space.
            </p>
            <div className="mt-8 space-y-3">
              <div className="h-2 w-full rounded bg-primary-100 dark:bg-slate-600" />
              <div className="h-2 w-4/5 rounded bg-primary-100 dark:bg-slate-600" />
              <div className="h-2 w-3/5 rounded bg-primary-100 dark:bg-slate-600" />
            </div>
          </div>
        </div>
      </section>
      <section
        aria-label="Features"
        className="grid gap-6 border-y border-border py-10 sm:grid-cols-3 dark:border-slate-700"
      >
        {features.map(([title, description], index) => (
          <article key={title} className="rounded-card bg-surface p-6 dark:bg-slate-800">
            <p aria-hidden="true" className="mb-5 text-sm font-bold text-primary-700 dark:text-primary-300">
              0{index + 1}
            </p>
            <h2 className="mb-3 font-display text-2xl font-bold">
              {title}
            </h2>
            <p className="leading-relaxed text-foreground-muted dark:text-slate-300">
              {description}
            </p>
          </article>
        ))}
      </section>
      <section aria-labelledby="recent-title" className="space-y-8 py-16">
        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-[.2em] text-primary-700 dark:text-primary-300">
            From this browser
          </p>
          <h2 id="recent-title" className="font-display text-4xl font-bold">
            Recent writing
          </h2>
        </div>
        {!result.ok && (
          <Alert variant="warning" message={result.error.message} />
        )}
        {posts.length ? (
          <div
            className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 dark:[&>article]:bg-slate-800 dark:[&>article]:border-x-slate-700 dark:[&>article]:border-b-slate-700 dark:[&_time]:text-slate-300 dark:[&>article>p]:text-slate-300 dark:[&_a]:text-primary-300 dark:[&_a]:decoration-primary-700 dark:[&_a:hover]:decoration-primary-300 dark:[&_a:focus-visible]:ring-primary-300"
          >
            {posts.map((post, index) => (
              <PostCard
                key={post.id}
                post={post}
                session={session}
                index={index}
              />
            ))}
          </div>
        ) : (
          <p
            className="rounded-card border border-dashed border-border bg-surface p-8 text-foreground-muted dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            No posts yet — check back soon!
          </p>
        )}
      </section>
      <aside
        aria-label="Local demo disclosure"
        className="mb-16 rounded-card bg-surface-raised p-6 text-sm leading-relaxed text-primary-900 dark:bg-slate-800 dark:text-slate-300"
      >
        <strong>Demo only.</strong>
        {' '}
        Posts, accounts, and session are stored only in this browser’s localStorage.
        Passwords are stored in plaintext. Do not use real credentials or sensitive content.
        Data is not encrypted, backed up, or synchronized, and clearing browser storage removes it.
      </aside>
    </div>
  );
}
Landing.propTypes = { session: sessionType };
