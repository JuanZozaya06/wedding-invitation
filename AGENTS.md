# Wedding Invitation Project Notes

Call the user Zozi.

## Project Goal

Build a private, animated wedding invitation for Gabriela and Juan as an Angular web app. The experience should feel like a cute, elegant storybook invitation: playful but not childish, with lila as the main accent color and a soft fantasy/wedding aesthetic.

The project is also the first deployment of a commercial system for multiple weddings. Each wedding has its own administrator, invitations, events, configuration and private album. Zozi will adapt the Angular design for each client. The SQL structure supports multiple weddings; automated onboarding and complete theme customization are still pending.

The invitation is private and is loaded directly from a tokenized URL at `/:token` in local dev and production custom domain. Angular Router also supports the legacy GitHub Pages project URL `/wedding-invitation/:token`.

## Critical Data Boundaries

- **Never modify the existing Firestore database**, including documents, `admin/config`, rules, indexes, seed data or Firebase configuration. Zozi explicitly required the migration to happen in parallel without changing Firestore.
- The commercial Angular now replaces the previous invitation on the existing production domain. Zozi chose one production environment; do not assume a separate staging deployment is required.
- MySQL is now the live data source. Zozi permits SQL changes and tests, but use the local SQL database, rollback transactions and disposable test records to avoid changing real guests' attendance accidentally.
- The local Angular configuration talks to the production Railway API by default. Starting Angular locally does **not** isolate its data.
- Legacy Firestore scripts such as reset, seed and invitation/Drive imports must not be run. The explicitly named read-only export scripts are migration tools, not normal application operations.
- The active commercial backend now lives in `backend/`. The legacy photo backend was archived outside this workspace at `%LOCALAPPDATA%/WeddingComercial/archives/backend-legacy-2026-10-12/`; preserve that archive. The commercial backend uses the existing Drive folders; do not delete, move, recreate or overwrite existing photos while testing.
- Do not print credentials, raw Railway variable/configuration dumps, tokens, session cookies or private invitation datasets in tool output. Capture sensitive responses privately and output only required non-secret fields.

## Production and Repositories

- Frontend repository: `https://github.com/JuanZozaya06/wedding-invitation`.
- Commercial backend repository: `https://github.com/JuanZozaya06/wedding-backend-comercial`.
- `backend/` is a separate Git repository, ignored by the frontend repository. Commit and inspect each repository separately; do not add it as frontend source or a submodule.
- Current working branch in both repositories: `feature/refactor-for-comercial`. Work there unless Zozi requests otherwise.
- **Do not merge into, commit on, or push to `main` in either repository without Zozi's explicit authorization for that publication.** Previous publication approvals do not authorize future releases. Implement and validate changes on the working branch, then wait for authorization before updating `main`.
- Frontend production: `https://labodadelsiglo.app/`; admin: `https://labodadelsiglo.app/admin`.
- API production: `https://api.labodadelsiglo.app`; health: `/health`; fallback service domain: `https://wedding-api-production-3e17.up.railway.app`.
- Railway project `wedding`, environment `production`, services `wedding-api` and `MySQL`. Zozi explicitly retired the separate `boda-fotos` project's `fotos-api` service on October 11, 2026 (Caracas): its deployment was removed and its repository source disconnected to prevent automatic redeployment. The service configuration, legacy code, Firestore and Drive files were preserved. Do not restart it unless requested.
- Pushes to frontend `main` run the Angular build and headless tests before GitHub Pages deployment. Pushes to backend `main` trigger Railway deployment and `python -m alembic upgrade head` before server startup.
- Backend deployment uses `Dockerfile`, `requirements-lock.txt` and Railway service settings. `backend/railway-service.json` is a non-secret settings snapshot; there is no active `railway.toml`.
- DNS is managed by Cloudflare. The apex and `www` retain GitHub Pages records. `api` points to the Railway-provided CNAME with a `_railway-verify.api` TXT record. Use current Railway domain status for authoritative DNS targets, not guessed values.
- Frontend and API use HTTPS on the same site. Keep Secure/HttpOnly/SameSite=Strict cookies and explicit CORS origins; do not weaken cookie security to work around deployment problems.

## Current Workspace

- Workspace root: `C:\Users\Zozi\Documents\Projects\wedding-invitation`
- Frontend app: `C:\Users\Zozi\Documents\Projects\wedding-invitation\frontend`
- Commercial backend: `C:\Users\Zozi\Documents\Projects\wedding-invitation\backend`
- Framework: Angular 18 standalone app
- Styling: SCSS
- Data layer: Python FastAPI + SQLAlchemy + MySQL 8.4; schema migrations use Alembic.
- Current dev URL: `http://127.0.0.1:4200/{existing-invitation-token}`. Do not assume `demo-cuento` exists or seed it.
- Admin URL: `http://127.0.0.1:4200/admin`
- Main files:
  - `frontend/src/app/app.component.ts`
  - `frontend/src/app/app.component.html`
  - `frontend/src/app/app.component.scss`
  - `frontend/src/app/app.routes.ts`
  - `frontend/src/app/core/auth/`
  - `frontend/src/app/core/http/commercial-api.service.ts`
  - `frontend/src/app/core/routing/`
  - `frontend/src/app/features/invitation/`
  - `frontend/src/app/features/admin/`
  - `frontend/src/app/features/photos/`
  - `frontend/src/app/features/civil/`
  - `frontend/src/app/features/not-found/`
  - `frontend/src/app/shared/`
  - `frontend/public/commercial-config.json`
  - `frontend/proxy.conf.json`
  - `frontend/src/styles.scss`
  - `backend/app/main.py`
  - `backend/app/core/`
  - `backend/app/modules/`
  - `backend/migrations/versions/`

## Commands

Run commands from `C:\Users\Zozi\Documents\Projects\wedding-invitation\frontend`.

- Start dev server: `npm start -- --host 127.0.0.1 --port 4200`
- Build: `npm run build`
- Headless tests: `npm test -- --watch=false --browsers=ChromeHeadless`
- Generate token (utility only): `npm run token`

`admin:hash`, `report`, `reset:demo`, `import:invitations`, `import:drive` and `import:drive:reset` are legacy Firebase utilities, not commercial backend commands. Do not run them to operate this system.

Run Python commands from `backend` so its Windows `sitecustomize.py` workaround is loaded:

- Install pinned dependencies: `.venv/Scripts/python -m pip install -r requirements-lock.txt`
- Local schema migrations: `.venv/Scripts/python -m alembic upgrade head`
- Check model/schema consistency: `.venv/Scripts/python -m alembic check`
- Backend tests: `.venv/Scripts/python -m unittest discover -s tests -v`
- Optional local API: `.venv/Scripts/python -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --no-access-log`
- Local MySQL start/stop scripts: `backend/scripts/start-mysql.ps1` and `stop-mysql.ps1`, invoked from the workspace root.

Angular normally needs no local Python server. `commercial-config.json` selects `gabriela-y-juan` internally, uses the custom API domain for public requests and production admin calls, and selects `localAdminApiBaseUrl=/api` only on loopback. The Angular dev proxy forwards `/api` to the same Railway service. For deliberately local backend development, explicitly redirect the relevant endpoints before interacting with forms.

Node currently reports an Angular support warning because the local Node version is `21.5.0`. The app still builds, but for production use Node 20 LTS or 22+.

## Product Decisions

- Couple names: Gabriela and Juan.
- Couple monogram/nomenclature: `G&J`.
- Initial experience: a sealed envelope/carta, not a book.
- User must click `Abrir invitacion` before the content appears.
- The letter inside the envelope must not be visible before opening.
- Main scene narrative:
  1. Bride walks toward the church.
  2. Ceremony information appears before the bride reaches the church.
  3. After crossing/leaving the church, switch from bride to vintage car with bride and groom.
  4. Car drives toward celebration.
  5. Celebration information appears shortly before the celebration venue enters view.
  6. Scene holds on celebration before releasing the sticky scroll.
- After RSVP and optional message/song, include a final visual closing section thanking guests for being part of the story.
- Ceremony and celebration are separate locations.
- Optional background music is implemented with a floating play/pause control. Preserve user interaction requirements for autoplay.
- Spanish only.
- Must work well on mid-range mobile phones.
- `/civil` opens the separate civil invitation directly, including `/civil/` and the legacy `/wedding-invitation/civil` path. Reserve this route before invitation-token resolution; do not load SQL invitation or album data for it.
- Do not place a photo-sharing button or link inside the invitation. Zozi explicitly removed the unsolicited "Comparte tus fotos" CTA; the uploader remains accessible separately at `/upload`.

## Animation Architecture

The horizontal scene is scroll-driven with a lightweight custom scroll/timeline system. GSAP is installed, but the current implementation is not relying on ScrollTrigger.

Important current behavior in `features/invitation/components/journey/journey.component.ts`:

- `distance()` is calculated from the `.ballroom` landmark, not total track width, so the horizontal scroll ends at celebration.
- `travelEnd = 0.84` means the track completes movement at 84% of the timeline.
- The remaining 16% of the pinned timeline is a hold on the celebration scene before releasing sticky scroll.
- Do not make the track movement duration `1` unless intentionally removing the final hold.
- The bride and vintage car are viewport overlays, not children of the horizontal track. This keeps the focal character centered while the world moves behind it.
- Ceremony and celebration cards are also viewport overlays, not track children. This keeps information centered and prevents them from being clipped at the viewport edge.
- Event timings should be derived from landmark positions, not guessed by fixed percentages when possible.

Current timing model:

- `churchProgress = progressFor('.church')`
- `ballroomProgress = progressFor('.ballroom')`
- `churchTime = churchProgress * travelEnd`
- `ballroomTime = ballroomProgress * travelEnd`
- Ceremony appears before the church.
- Car appears right after crossing the church.
- Celebration appears shortly before the ballroom/celebration landmark enters focus.

Current mobile-performance approach:

- The timeline now caches scene elements and precalculates landmark timing/distances instead of querying/measuring the DOM on every frame.
- Transform and opacity writes are skipped when the rounded value did not change, to reduce paint churn during scroll.
- A `mobilePerformanceMode` is active on touch/smaller viewports to shorten the pinned scroll workload and simplify some parallax layers.
- Animated character media in the invitation now prefers `.webm` video with `autoplay`, `loop`, `muted`, and `playsinline` instead of large GIFs where replacements exist.

## Visual Direction

- Overall style: cute storybook wedding, simple layered CSS assets for now.
- Primary accent: lila/purple.
- Supporting palette: sky blue, cream/parchment, salvia/green, soft gold/brown.
- Avoid making the whole UI monochrome purple.
- The current scene mixes CSS layers, image landmarks, photos and animated WebM characters. Preserve existing art while keeping replacements modular.
- Source character assets are available in the root `assets` folder and can be copied into the frontend public assets folder when needed. Current standing assets:
  - `assets/gaby standing.png`
  - `assets/gaby walking.gif`
  - `assets/Juan standing.png`
  - `assets/car.gif`
- The frontend currently uses these lighter animation assets from `frontend/public/assets/characters`:
  - `waving.webm`
  - `gaby-walking.webm`
  - `car.webm`
  - `dancing.webm`
- Keep visual assets/styles modular enough to replace colors, sprites, and CSS-built placeholders later without changing RSVP or animation logic.
- Characters should eventually resemble Juan and Gabriela in a simple storybook/chibi way, not realistic portraits.
- Bride: wedding dress with storybook/princess feel.
- Groom: elegant wedding suit or subtle knight/caballero styling.
- Avoid heavy effects for mobile performance.

## Invitation Data Model

The app is data-driven through the commercial API. Angular retains a camelCase invitation DTO; SQL uses normalized tables and snake_case columns.

- `wedding` owns `settings`, `wedding_event`, invitations and a private album.
- An `invitation` represents one group; `invitee` rows represent its guests. `message` and `song` are optional records attached to the invitation.
- `album` owns `photo_batch` and `photo` metadata; image bytes are stored outside MySQL.
- `admin_user`, `wedding_membership`, `admin_session`, `rate_limit`, `security_audit` and `import_run` handle access, security and migration tracking.
- New invitation tokens must be exactly 6 uppercase alphanumeric characters (A-Z, 0-9), per Zozi's preference. Uniqueness is scoped to a wedding. Preserve existing tokens when editing and check for duplicates before creation.
- Each invitation contains a `guests` array.
- The guest DTO `id` corresponds to the preserved SQL `invitee.source_id`; the SQL integer primary key is internal. Do not replace existing guest identifiers during migration or edits.
- Exactly one guest per invitation must use `role = primary`.
- Store dates in UTC with microsecond precision and render using the wedding timezone. Current wedding: `gabriela-y-juan`, timezone `America/Caracas`, ceremony and celebration on November 28, 2026 at 15:00 and 17:00 local time.

Current invitation shape:

- `token`
- `displayName`
- `guestCount`
- `openedInvitation`
- `openedAt`
- `lastOpenedAt`
- `openCount`
- `hasChildren`
- `hasAbroadGuests`
- `notes`
- `message`
- `song`
- `rsvpStatus`
- `respondedAt`
- `responseEditCount`
- `updatedAt`
- `guests`

Each guest currently contains:

- `id`
- `name`
- `gender`
- `role`
- `attending`
- `isChild`
- `isAbroad`

## Frontend Personalization

### Angular architecture

- `AppComponent` contains only `router-outlet`; declare navigation in `app.routes.ts` and lazy feature routes. Do not reintroduce pathname parsing or page conditionals in the root component.
- Features encapsulate pages/components, models, services/state and styles. `core/` owns HTTP, session handling and routing infrastructure; `shared/` owns reusable UI and media helpers. This follows Angular's component/service model rather than adding artificial server-style controllers.
- `InvitationState` is scoped to the invitation page; RSVP and optional wishes remain separate forms. `JourneyComponent` owns scroll listeners, layout measurements and animation cleanup. Changing a token must reset the envelope and ignore older asynchronous loads.
- `AdminStore` is scoped to the admin routes. A persistent `AdminLayoutComponent` shares header, actions, sidebar, stats and invitation dialogs across child pages, including `/admin/media`. Visit-only authentication lives in `AdminSessionService`; route guards supplement server authorization.
- Admin sections have real routes: `/admin`, `/admin/invitations`, `/admin/confirmed`, `/admin/messages`, `/admin/songs`, `/admin/notes`; `/admin/login` accepts only the password. `/admin/media` is the authenticated private gallery. `/fotos` and `/admin/fotos` are retired and must not resolve to an uploader or invitation.
- `/upload` is a separate public component, with no invitation code or admin session requirement. Gallery and uploader explicitly select their API mode; do not infer permissions from the current URL inside the photo service.
- Keep feature styles scoped. Shared form styles are a Sass mixin, included inside each feature's scope. The invitation's legacy cross-component styles and admin layout styles use explicit host selectors.
- Test fixtures live in `src/app/testing/`; production starts with an empty invitation and never falls back to sample guests. Routing/state tests mock every API call.
- Videos are deferred at Zozi's request: this refactor preserves the photo uploader's current image-only validation.

The public invitation already personalizes parts of the copy from invitation data.

Current derived behaviors:

- singular vs plural based on guest count
- greeting based on the primary guest gender
- extra copy when the invitation includes children
- extra copy when guests are traveling from abroad

Keep deriving invitation-specific copy from structured guest data. Couple names, monogram, date and venues now load from SQL. `settings` has template/colors/copy/sections fields, but complete theme wiring and removal of wedding-specific text/art are pending. Do not claim that every part of the frontend is already configurable.

## RSVP Model

The RSVP is based on guests preloaded from the database. Guests must not be able to add arbitrary people.

Current behavior:

- The RSVP form shows a checkbox per guest.
- It calculates confirmed count from checked guests.
- Notes remain available for restrictions or comments.
- The optional message and song section remains separate from RSVP so attendance confirmation stays quick.
- API calls persist RSVP, notes and telemetry on the invitation and guests; messages and songs use their related SQL records.
- Guests need no account. Their invitation token authorizes the public endpoints; the backend validates submitted guest IDs against that invitation.
- Keep RSVP and optional message/song writes separate, with loading/error states. Never show success before the API confirms persistence.

Current activity telemetry:

- `openedInvitation`
- `openedAt`
- `lastOpenedAt`
- `openCount`
- `respondedAt`
- `responseEditCount`
- `updatedAt`

## Admin Dashboard

The dashboard at `/admin` uses backend authentication and SQL permissions per wedding.

Current behavior:

- Login shows only a password. `POST /auth/login` sends `{ wedding_code, password }`; the backend resolves the assigned administrator in MySQL. Do not add a username field or expose SQL users to clients.
- Administrator passwords use Argon2id. SQL sessions have an absolute 8-hour limit; session secrets are hashed in SQL. The browser receives an HttpOnly/Secure/SameSite=Strict session cookie with no Max-Age or Expires.
- Zozi does not want remembered admin access. Keep authenticated frontend state only in memory for the current SPA visit. Reloading, reopening the site or opening a new tab must ask for the password again, even if the browser retained its session cookie. Do not automatically restore access through `/auth/me` or browser storage. Navigating between admin sections within the same visit keeps access.
- Admin requests send cookies and `X-CSRF-Token` for mutations. Public requests omit cookies. Keep origin checks, rate limits, audit records and wedding authorization on the backend.
- Exactly one administrator is assigned per wedding. Use `app.commands.create_admin` to provision/reset access; the API supports `/auth/password` and revokes sessions after password changes. A customer-facing password/reset UI is still pending.
- It shows:
  - top-line stats
  - recent openings
  - recent RSVP responses
  - invitation-level detail per group
  - confirmed guests
  - messages, songs, and notes
  - private photo gallery with search, thumbnail previews and original downloads
- It supports search by group, token, or guest.
- Invitation-level filters live only in the `Invitaciones` tab so the UX stays focused.
- The overview has no search field. On mobile, recent responses and openings use two activity tabs, with responses selected initially; desktop keeps both activity panels.
- Admin data views must show a loading status while requests are pending. Only show empty-state messages and counts after a successful load; errors must not appear as empty results. This includes statistics, recent activity, lists and the photo gallery.
- Keep the desktop sidebar fixed at 220px across desktop breakpoints. The mobile admin fills the viewport without outer padding or rounded layout/sidebar corners; preserve internal spacing for controls.
- Zozi removed the "Cerrar sesión" button from both desktop and mobile admin actions. Do not reintroduce it without a request.

## Excel / Import Direction

The preferred operational flow is:

- maintain a source Excel or Google Sheet
- one row per guest
- same `token` repeated for everyone in the same invitation
- validate and import grouped data into the commercial SQL model; a reusable Excel-to-SQL onboarding flow is still pending

Reference templates live in:

- `templates/invitados_base.xlsx`
- `templates/invitados_base_v2.xlsx`

Recommended row-level columns include:

- `token`
- `display_name`
- `guest_id`
- `guest_name`
- `gender`
- `role`
- `is_child`
- `is_abroad`
- RSVP and optional note/message/song fields as needed

## SQL, Credentials and Migration History

- Local MySQL: `127.0.0.1:3306`, schema `wedding_comercial`. Railway schema: `railway`, private connection `mysql.railway.internal:3306`.
- API account: `wedding_app`, restricted table permissions without DDL. Migration account: `wedding_migrator`. Workbench account: `wedding_maintainer`, schema-level maintenance without global grants. These are technical accounts, separate from wedding administrators.
- Workbench public endpoint: `centerbeam.proxy.rlwy.net:49759`. Use **Require and Verify CA**, schema `railway`, and the maintainer credentials; never use root for routine work.
- All remote SQL accounts require TLS. The API and migrations verify the database's own CA using `MYSQL_SSL_CA_PEM`. The generated MySQL certificate does not match the proxy hostname, so validation pins the CA without DNS-name verification; do not disable CA verification.
- Railway's database viewer uses `railway_viewer@127.0.0.1` with SELECT/SHOW VIEW through its SSH tunnel. It cannot connect from the Internet. MySQL-service `MYSQLUSER`/`MYSQLPASSWORD` belong to that viewer; the API's `MYSQL_USER`/`MYSQL_PASSWORD` are separate.
- Easy local access: `.credenciales/CREDENCIALES.md`, `.credenciales/workbench.cnf`, `.credenciales/mysql-ca.pem`. The folder is ignored by Git and restricted to Zozi and SYSTEM. These are manual backups; update them when credentials change. Do not put secret values in documentation or source.
- `.credenciales/PUBLICACION.json` records the production cutover and the full pre-publication SQL backup. Backend `.env`, `.local/`, `exports/`, `.venv/` and local `output/` screenshots must also remain untracked.
- Cutover completed October 11, 2026 (Caracas): 119 invitations and 222 guests were verified field-by-field against a fresh read-only Firestore snapshot; one invitation's activity delta was reconciled. These are historical verification counts, not fixed future totals.
- The legacy photo catalog was empty at cutover. Do not confuse an empty SQL gallery with a disconnected Drive account.
- SQL is the live source after cutover. There is no ongoing Firestore synchronization; old cached clients may still write to the old system. Future reconciliation must preserve newer SQL responses and start with a backup and comparison.
- Firestore read-only exporters live in `backend/scripts/`. The photo exporter needs the archived legacy backend's Python environment with Firebase Admin installed, and its `--from-backend` argument must point to `%LOCALAPPDATA%/WeddingComercial/archives/backend-legacy-2026-10-12/`, never the active `backend/`. The commercial API does not depend on Firebase Admin.
- `app.modules.imports.service` validates a Firestore snapshot, applies only with `--apply`, and refuses overwriting a populated wedding. `app.commands.sql_snapshot` copies durable SQL data to an empty destination and excludes sessions, rate limits and audits. Neither command is a safe automatic replacement for reconciliation or a full production restore.
- Missing/invalid invitations display an error or not-found screen. Do not restore silent demo fallbacks or `window.seedDemoInvitation()`.

## Commercial Backend Architecture and Photos

- Keep Python MVC organized by functionality under `app/modules/auth`, `weddings`, `invitations`, `albums` and `imports`.
- Controllers handle HTTP contracts; services contain business rules and SQL access; models define persistence; schemas/views define validation and serialization. Shared security/database/HTTP behavior belongs in `app/core/`.
- Invitation/RSVP endpoints are scoped under `/public/weddings/{slug}/invitations/{token}`; admin endpoints under `/admin/weddings/{slug}` require a session and authorized membership. Never trust the frontend wedding setting as an authorization check.
- Photo-sharing URL: `/upload`, opening the existing three-step uploader directly without an invitation-code screen. Uploads belong to the wedding album, independently of invitations. `/{token}?fotos=1` remains a compatible public alias. The authenticated admin gallery lives at `/admin/media`. Zozi retired `/fotos`; do not restore it as an uploader alias or private route. Public album details and batch creation use `/public/weddings/{slug}/album` and `/public/weddings/{slug}/photo-batches`; new batches leave the optional legacy `invitation_id` empty. Do not add a code/login requirement to the uploader.
- Guests receive a 24-hour bearer credential limited to a photo batch and wedding; they can upload without an account and cannot browse the private album.
- Current wedding storage is Google Drive with existing original/thumbnail folders. OAuth uses `drive.file`; encrypted credentials and the encryption key are configured separately in Railway variables. Never log them or expose Drive storage keys to clients.
- New albums default to local storage isolated by wedding. Railway uses `PHOTO_STORAGE_DIR=/data/photos` on a persistent volume. Do not switch storage for a nonempty album.
- Current limits: 20 photos/batch, 20 MB/file, 40 megapixels/image, 2000 photos and 5 GiB/album. SQL reservations and upload identifiers make retries idempotent. Preserve validation, quotas, per-photo progress and the page-exit guard during uploads.
- Backend tests use MySQL transactions, temporary files and a mocked Drive adapter; do not upload probe files into the real wedding folders.
- Last full verification at cutover: 52 Angular tests, 35 backend tests, successful build/CI, production invitation load, admin login/logout and private gallery. Actual Drive upload/download of a new photo was not exercised against the wedding folders. Run checks appropriate to subsequent changes rather than treating these counts as permanent.
- Pending commercial work includes reusable wedding onboarding, Excel-to-SQL import, full theme configuration, customer password-management UI, and confirming automated backups plus restoration. Do not describe these as completed.

## GitHub Pages

The project is deployed to GitHub Pages through `.github/workflows/pages.yml`.

Important behavior:

- Primary production domain: `https://labodadelsiglo.app/`
- Build command uses `--base-href=/` for the custom domain.
- Configure `labodadelsiglo.app` in GitHub `Settings -> Pages -> Custom domain`. `frontend/public/CNAME` can mirror that decision inside the repo, but the GitHub Pages setting is the source of truth when deploying via Actions.
- A `404.html` fallback is copied so token/admin deep links work on reload.
- Angular Router must support both direct custom-domain paths and the legacy `/wedding-invitation` base segment, including trailing slashes.

## Performance And Accessibility

- Animate `transform` and `opacity`; avoid animating layout properties.
- Keep the horizontal scene lightweight on mobile.
- Use `prefers-reduced-motion` support.
- Prefer lightweight `webm` loops over multi-megabyte GIFs for character animation.
- Avoid large videos or heavy filters.
- Use WebP/AVIF or optimized SVG/PNG when real assets are added.
- Keep text readable and centered on mobile.
- Do not let information cards move with the horizontal track.

## Current User Preferences

- Speak to the user in Spanish unless they switch language.
- Be direct and pragmatic.
- The user is comfortable coding and wants guidance, but implementation should be done when requested.
- They prefer iterative visual tuning based on screenshots.
- Before finishing UI copy changes, review Spanish accents, punctuation, and any strange encoding artifacts like `Â`, malformed bullets, or broken symbols.
