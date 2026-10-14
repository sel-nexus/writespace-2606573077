# WriteSpace revision changelog

## 2026-10-14 — Luna + Sol brownfield revision

### New behavior
- Added a single browser-local `writespace_theme` preference containing plain `light` or `dark`. Missing, invalid, or inaccessible reads select light without writing a default.
- Added root-owned React state/effect synchronization of the HTML `dark` class and a shared accessible next-action theme button on public and authenticated navigation. Only explicit user selection writes the preference; failed writes retain the current in-memory appearance.
- Added paired Tailwind dark slate styling across landing, login/register, post list/reader/authoring, admin metrics, user tables/mobile cards, fields, alerts, cards, and footer. Existing light layout, brand accents, typography, routes and business behavior are preserved.
- Fixed Escape closure from focused public/account-menu descendants to restore focus to the disclosure trigger before hiding/removing content.

### Retained and clarified behavior
- The content counter already existed in the predecessor's shared PostForm. Retained its derived JavaScript string.length logic, required-field validation, unlimited input and no persisted count. Added status/atomic semantics and explicit create/edit coverage for prefill, typing/deleting/paste, newlines, Unicode and large saves.
- Logout still removes only `writespace_session`; theme, users and posts remain unchanged. Existing ownership/action checks, fixed-admin/current-account deletion protections, exact data fields and no-cascade behavior remain.
- No backend, API, database, Context/state library, custom CSS, dependency or hosting configuration change. index.css remains the three Tailwind directives; Vercel retains its exact SPA rewrite. Existing empty-blog copy is retained where upstream revisions disagree.

### Modified source files
- `frontend/src/utils/storage.js` — isolated guarded plain-string reads/writes alongside existing JSON functions.
- `frontend/src/utils/theme.js` (new) — normalization, preference storage and root-class helpers.
- `frontend/src/App.jsx` — theme lifecycle/navigation props and root appearance; readable JSX.
- `frontend/src/components/ThemeToggle.jsx` (new), `PublicNavbar.jsx`, `AuthenticatedNavbar.jsx` — accessible control, paired colors, Escape-focus recovery.
- `frontend/tailwind.config.js` — class-based dark mode.
- `frontend/src/pages/Landing.jsx`, `Login.jsx`, `Register.jsx`, `Blogs.jsx`, `BlogDetail.jsx`, `AdminDashboard.jsx`, `Users.jsx` — additive paired presentation, not changed business handlers.
- `frontend/src/components/Field.jsx`, `Alert.jsx`, `Footer.jsx`, `PostCard.jsx`, `PostForm.jsx` — shared paired presentation and count status semantics.
- Avatar, WriteBlog/EditBlog wrappers, route guards, domain policy helpers and deployment files retained unchanged.

### Tests and evidence
- Added `theme.test.jsx`, `theme-entry.test.jsx`, `theme-community.test.jsx`, `counter.test.jsx` under `frontend/src/test`; all existing tests retained.
- Added `theme.spec.js`, `theme-entry.spec.js`, `theme-community.spec.js`, `counter.spec.js`, `storage-faults.spec.js` under `frontend/e2e`.
- Baseline: 685 tests passed. Final: 906 unit/component tests and 152 Chromium desktop/mobile browser cases passed, zero failures or skips. Independent critic PASS in round 2, score 1.00, zero high failures. Explicit NODE_ENV=production Vite build and browser run passed; container build/start and nginx root/deep-route fallback verified. Current audit confirms 19 inherited findings (4 moderate, 12 high, 3 critical), retained without out-of-scope breaking upgrades.
- Browser evidence includes real localStorage reload/logout/CRUD checks, targeted theme and business storage faults, focus/keyboard/validation/role/ownership behavior, screenshots, accessibility trees, computed styles and HTML attachments. See `test_report.yaml` for exact commands and verification scope.
- Refreshed the repository code graph after each feature commit; updated README and handoff records.

### Breaking changes, migration and rollback
No breaking API/schema changes and no database migration. Existing users/posts/session bytes are not migrated. The new preference is optional. Roll back the feature commits/static bundle; the unused theme key may remain safely in browser storage or be manually removed without touching other records. Static rollback does not restore cleared browser data.

### Security and deployment boundaries
Demo only: fixed admin/admin and plaintext passwords remain intentionally insecure; do not use real credentials or sensitive content. No encryption, backup or synchronization is claimed. AWS/Vercel rollout remains downstream DevOps work. Pinned dependency risks are reported separately, not silently upgraded outside this revision.
