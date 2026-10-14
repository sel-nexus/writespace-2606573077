/** Offer the source-defined entry links and current copyright year. */
import { Link } from 'react-router-dom';
import { ui } from './ui.js';
const links = [['Home', '/'], ['All Blogs', '/blogs'], ['Login', '/login'], ['Register', '/register']];
/** Render a keyboard-accessible public footer. @returns {JSX.Element} */
export function Footer() {
  return (
    <footer className="border-t border-border bg-surface dark:border-slate-700 dark:bg-slate-900">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-8 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-foreground-muted dark:text-slate-300">
          © {new Date().getFullYear()} WriteSpace.
        </p>
        <nav aria-label="Footer" className="flex flex-wrap gap-5">
          {links.map(([label, to]) => (
            <Link
              key={to}
              to={to}
              className={`${ui.link} inline-flex min-h-11 items-center dark:text-primary-300 dark:decoration-primary-700 dark:hover:decoration-primary-300 dark:focus-visible:ring-primary-300`}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
