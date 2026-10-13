/** Offer the source-defined entry links and current copyright year. */
import { Link } from 'react-router-dom';
import { ui } from './ui.js';
const links = [['Home', '/'], ['All Blogs', '/blogs'], ['Login', '/login'], ['Register', '/register']];
/** Render a keyboard-accessible public footer. @returns {JSX.Element} */
export function Footer() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-8 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-foreground-muted">© {new Date().getFullYear()} WriteSpace.</p>
        <nav aria-label="Footer" className="flex flex-wrap gap-5">
          {links.map(([label, to]) => (
            <Link key={to} to={to} className={`${ui.link} inline-flex min-h-11 items-center`}>{label}</Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
