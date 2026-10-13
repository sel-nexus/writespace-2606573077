# WriteSpace

A responsive React 18 / Vite 5 / JavaScript JSX / Tailwind 3 browser-local writing demo. Includes public discovery, signup/sign-in, all-post reading, owner-controlled plain-text authoring, and an administrator dashboard/account manager.

## Important limitations
**Demo only. Never enter real passwords or sensitive information.** Fixed administrator credentials are `admin` / `admin`. Registered passwords are plaintext in localStorage; roles and ownership checks run in the browser and are bypassable by the device owner. There is no backend, database, API, encryption, backup or synchronization. Different browsers and origins have independent records. Clearing browser storage removes data. Concurrent tabs can race and lose updates; no locking is promised.

## Run locally
Requires Node 20 and npm.

```sh
cd frontend
npm ci --no-bin-links
npm run dev -- --host 0.0.0.0 --port 5173
npm run build
npm run preview -- --host 0.0.0.0 --port 4173
```

The SPA has no runtime secrets or API configuration. `frontend/.env.example` documents the local tooling contract. Ports can be overridden on the CLI; browser tests use `PLAYWRIGHT_PORT` (default 4173).

## Verify
```sh
cd frontend
npm test
node node_modules/@playwright/test/cli.js install chromium
npm run test:e2e
```
Playwright owns its production-preview server, uses one worker and desktop/mobile Chromium projects. Do not run a separate preview on the same port. Tests cover real browser-local records, reload persistence, all nine routes, role/ownership rejection, validation, confirmations, storage faults, and exact grid/table breakpoint edges. Unit tests use deterministic storage/UUID faults; browser journeys use real localStorage. Screenshots are generated in `frontend/test-results/`; `public.spec.js` captures accessibility, rendered HTML and computed-style attachments (use `--reporter=html` to retain them in a browsable report). No API/backend integration layer applies; cross-feature flows are exercised by browser journeys.

Verified in this development run: 685 unit/component tests; 80 desktop/mobile journey cases across the full run and the accounts/admin source-fix rerun. The initial full browser run exposed mobile admin logout positioning; the source was corrected, not the tests. Independent test critic passed score 1.0 with zero high failures. Build and nginx container root/deep-route checks succeeded.

## Routes and storage
Public `/`; guest `/login`, `/register`; signed-in `/blogs`, `/blog/:id`, `/write`, `/edit/:id`; admin `/admin`, `/users`. Login/signup routes redirect signed-in sessions to role home. Post mutations recheck owner/admin policy and reread data before saving. Corrupt reads display warnings, preserve original bytes and refuse destructive writes. Session writes may fail after account creation; the account remains and the UI explains sign-in is needed.

Exact keys: `writespace_posts`, `writespace_users`, `writespace_session`. User and Post IDs are UUIDs; logical built-in admin uses fixed `admin`. Stored timestamps are ISO; visible dates use `MMM DD, YYYY`. Post content is plain text with preserved newlines and no length maximum. Account deletion never cascades to posts/session. The fixed admin and current account cannot be deleted. Dashboard includes the fixed admin in total/admin counts and preserves both source labels `Total Users` and `Total users` (the latter counts standard users).

## Static hosting
### Vercel
Set **Root Directory = frontend**, framework Vite, build `npm run build`, output `dist` using Vercel project settings. `frontend/vercel.json` and the identical root `vercel.json` contain only the required SPA rewrite. Do not introduce forbidden build/output keys into these files. Provider deployment has not been performed by Development; verify direct routes after DevOps publishes.

### AWS/container
```sh
docker build -t writespace frontend
docker run --rm -p 8080:80 writespace
```
The two-stage pinned Node/nginx image serves `dist` on `0.0.0.0:80`, with `/` returning 200 and unknown SPA paths returning `index.html`. No proxy/API/database is included. DevOps owns ECR/ECS/ALB/CloudFront/CloudFormation rollout; cloud availability is not claimed by local tests.

## Known dependency warning
The pinned source-compatible dependency tree reports **19 npm audit findings: 4 moderate, 12 high, 3 critical** during container installation. This release is not a secure production account system; the final nginx image contains only static assets, not build/test tools. Review and upgrade affected dependencies before public/production use. A blind `npm audit fix --force` is intentionally not applied because it may break the mandated Vite 5 / React 18 stack.

## Layout
`frontend/src/utils` isolates storage and local policies; `components` holds shared controls/navigation; `pages` holds feature screens; `src/test` unit/component coverage; `e2e` browser journeys. One BrowserRouter in App; component state uses useState/useEffect only. `index.css` contains exactly the three Tailwind directives. Human-approved presentation uses contained brand gradients, not full-page gradient wallpaper, and the LLD empty list copy `No posts yet. Be the first to write one!`.
