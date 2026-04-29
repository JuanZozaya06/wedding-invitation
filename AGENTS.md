# Wedding Invitation Project Notes

Call the user Zozi.

## Project Goal

Build a private, animated wedding invitation for Gabriela and Juan as an Angular web app. The experience should feel like a cute, elegant storybook invitation: playful but not childish, with lila as the main accent color and a soft fantasy/wedding aesthetic.

The invitation is private and is loaded directly from a tokenized URL at `/:token` in local dev and production custom domain. The legacy GitHub Pages project URL remains `/wedding-invitation/:token` only as a fallback while the route parser still supports it.

## Current Workspace

- Workspace root: `C:\Users\Zozi\Documents\Projects\wedding-invitation`
- Frontend app: `C:\Users\Zozi\Documents\Projects\wedding-invitation\frontend`
- Framework: Angular 18 standalone app
- Styling: SCSS
- Data layer: Firebase + Cloud Firestore (frontend-driven for now)
- Current dev URL: `http://127.0.0.1:4200/demo-cuento`
- Admin URL: `http://127.0.0.1:4200/admin`
- Main files:
  - `frontend/src/app/app.component.ts`
  - `frontend/src/app/app.component.html`
  - `frontend/src/app/app.component.scss`
  - `frontend/src/app/services/invitation.service.ts`
  - `frontend/src/app/models/invitation.model.ts`
  - `frontend/src/app/data/demo-invitation.ts`
  - `frontend/src/app/firebase/firebase.config.ts`
  - `frontend/src/styles.scss`

## Commands

Run commands from `C:\Users\Zozi\Documents\Projects\wedding-invitation\frontend`.

- Start dev server: `npm start -- --host 127.0.0.1 --port 4200`
- Build: `npm run build`
- Generate admin key hash: `npm run admin:hash -- mi-clave`
- Generate token (utility only): `npm run token`
- Report stats: `npm run report -- stats`
- Report confirmed guests: `npm run report -- attending`
- Reset demo invitations: `npm run reset:demo`

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
- Music is deferred for later.
- Spanish only.
- Must work well on mid-range mobile phones.

## Animation Architecture

The horizontal scene is scroll-driven with a lightweight custom scroll/timeline system. GSAP is installed, but the current implementation is not relying on ScrollTrigger.

Important current behavior in `app.component.ts`:

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

## Visual Direction

- Overall style: cute storybook wedding, simple layered CSS assets for now.
- Primary accent: lila/purple.
- Supporting palette: sky blue, cream/parchment, salvia/green, soft gold/brown.
- Avoid making the whole UI monochrome purple.
- Current assets are CSS-built placeholders. Later they can be replaced with layered SVG/PNG/WebP art.
- Source character assets are available in the root `assets` folder and can be copied into the frontend public assets folder when needed. Current standing assets:
  - `assets/gaby standing.png`
  - `assets/gaby walking.gif`
  - `assets/Juan standing.png`
  - `assets/car.gif`
- Keep visual assets/styles modular enough to replace colors, sprites, and CSS-built placeholders later without changing RSVP or animation logic.
- Characters should eventually resemble Juan and Gabriela in a simple storybook/chibi way, not realistic portraits.
- Bride: wedding dress with storybook/princess feel.
- Groom: elegant wedding suit or subtle knight/caballero styling.
- Avoid heavy effects for mobile performance.

## Invitation Data Model

The app is now data-driven from Firestore.

- One Firestore document represents one invitation group.
- The Firestore document ID is the invitation token.
- Tokens should be random alphanumeric strings of 8 characters minimum.
- Each invitation contains a `guests` array.
- Exactly one guest per invitation must use `role = primary`.

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

The public invitation already personalizes parts of the copy from invitation data.

Current derived behaviors:

- singular vs plural based on guest count
- greeting based on the primary guest gender
- extra copy when the invitation includes children
- extra copy when guests are traveling from abroad

The frontend should keep deriving copy from structured data instead of storing final copy strings in Firestore.

## RSVP Model

The RSVP is based on guests preloaded from the database. Guests must not be able to add arbitrary people.

Current behavior:

- The RSVP form shows a checkbox per guest.
- It calculates confirmed count from checked guests.
- Notes remain available for restrictions or comments.
- The optional message and song section remains separate from RSVP so attendance confirmation stays quick.
- The same document stores RSVP state, message, song, note fields, and invitation activity telemetry.

Current activity telemetry:

- `openedInvitation`
- `openedAt`
- `lastOpenedAt`
- `openCount`
- `respondedAt`
- `responseEditCount`
- `updatedAt`

## Admin Dashboard

There is now a lightweight admin dashboard at `/admin`.

Current behavior:

- It unlocks using a master key checked against `admin/config.masterKeyHash` in Firestore.
- It is intentionally lightweight and frontend-driven, not security-hard.
- It shows:
  - top-line stats
  - recent openings
  - recent RSVP responses
  - invitation-level detail per group
  - confirmed guests
  - messages, songs, and notes
- It supports search by group, token, or guest.
- Invitation-level filters live only in the `Invitaciones` tab so the UX stays focused.

## Excel / Import Direction

The preferred operational flow is:

- maintain a source Excel or Google Sheet
- one row per guest
- same `token` repeated for everyone in the same invitation
- import grouped data into Firestore

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

## Firebase Direction

Firebase is the active backend direction for this project.

Current setup expectations:

- Firestore stores `invitations/{token}` documents.
- Firestore stores `admin/config` with `masterKeyHash`.
- The frontend can fall back to demo data if Firebase is not configured or the document is missing.
- `window.seedDemoInvitation()` is available in dev to create/update a demo invitation.

Security expectations for this stage:

- Tokens must be long and unguessable enough for a private event.
- Frontend should only read/update the invitation tied to that token.
- The admin is acceptable as a convenience layer for now, but it is not strong security.
- If stronger protection is needed later, move admin/reporting logic to Cloud Functions or proper auth.

## GitHub Pages

The project is deployed to GitHub Pages through `.github/workflows/pages.yml`.

Important behavior:

- Primary production domain: `https://labodadelsiglo.app/`
- Build command uses `--base-href=/` for the custom domain.
- Configure `labodadelsiglo.app` in GitHub `Settings -> Pages -> Custom domain`. `frontend/public/CNAME` can mirror that decision inside the repo, but the GitHub Pages setting is the source of truth when deploying via Actions.
- A `404.html` fallback is copied so token/admin deep links work on reload.
- Route parsing in the app must support both direct custom-domain paths and the legacy `/wedding-invitation` base segment.

## Performance And Accessibility

- Animate `transform` and `opacity`; avoid animating layout properties.
- Keep the horizontal scene lightweight on mobile.
- Use `prefers-reduced-motion` support.
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
