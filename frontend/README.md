# Wedding Invitation Frontend

Angular 18 frontend for the private wedding invitation of Gabriela and Juan.

## Local dev

Run everything from `C:\Users\Zozi\Documents\Projects\wedding-invitation\frontend`.

- Start dev server: `npm start -- --host 127.0.0.1 --port 4200`
- Open an existing invite: `http://127.0.0.1:4200/{token}`
- Open admin: `http://127.0.0.1:4200/admin`
- Build: `npm run build`
- Headless tests: `npm test -- --watch=false --browsers=ChromeHeadless`
- Generate a candidate token: `npm run token` (6 uppercase letters/digits; the API must check uniqueness within the wedding).

Node `21.5.0` currently shows an Angular support warning locally. The app still builds, but production should use Node 20 LTS or 22+.

## App shape

- Public route: `/:token`
- Legacy fallback route: `/wedding-invitation/:token`
- Admin route: `/admin`
- Private admin gallery: `/admin/media`, protected by the same session and sharing the admin header/sidebar. `/fotos` is retired.
- Photo uploader: `/upload`, directly opens the three steps without an invitation code. Uploads belong to the wedding album. `/{token}?fotos=1` remains a compatible alias. Video uploads are pending.
- Civil invitation: `/civil`, including the legacy prefix and trailing slash.
- Standalone Angular app with SCSS
- Invitation data, RSVP and admin authentication use the commercial Python API and MySQL on Railway.

## Source structure

`AppComponent` is the router outlet. `app.routes.ts` declares lazy routes, keeping invitation, civil, admin, uploader and not-found pages independent.

```text
src/app/
  core/                  # HTTP client, admin session/guards, URL matching
  features/
    invitation/          # Page, models/state, journey, RSVP and wishes
    admin/               # Routes, persistent layout, pages, shared admin UI/store
    photos/              # Public uploader, private gallery, photo API/models
    civil/               # Separate civil experience
    not-found/           # Missing/invalid invitation and access form
  shared/                # Reusable components, styles and media helpers
  testing/               # Sample invitation fixtures used only by tests
```

Admin child routes are `/admin/invitations`, `/admin/confirmed`, `/admin/messages`, `/admin/songs` and `/admin/notes`. `/admin` shows the overview; `/admin/login` asks only for the password and returns to the requested page after successful authentication.

Admin access is kept only in memory during the current SPA visit. Reloading the page, reopening the site or opening another tab requires the password again; the app does not restore a previous cookie session automatically. The backend issues a browser-session cookie and retains an absolute 8-hour server limit.

Components own their view and interaction lifecycle; feature services/state own data and business rules; models define DTOs. The invitation state resets between tokens. The journey removes listeners and scheduled animation work on exit, and the uploader blocks navigation while uploading.

Routing tests use `RouterTestingHarness` and mocked APIs. They cover deep links, legacy paths, login/logout, expired sessions, shared layout, responsive admin/gallery views and navigation guards. State tests verify stale requests and persistence failures without touching production.

## Production

- Invitation and admin: `https://labodadelsiglo.app/{token}` and `/admin`.
- API: `https://api.labodadelsiglo.app` (Railway, HTTPS).
- `public/commercial-config.json` selects the wedding and API. It contains no passwords.
- GitHub Pages deploys pushes to `main` after the Angular build and tests pass.
- Do not update `main` without Zozi's explicit approval for that release. Refactors stay on `feature/refactor-for-comercial` until authorized.
- Local admin requests use `/api` through `proxy.conf.json`; the local Python server is unnecessary.
- The local frontend uses the live Railway API by default. Use mocked tests or explicitly switch both API endpoints before testing local database changes through the UI.
- Production uses credentialed CORS to the API subdomain on the same HTTPS site, preserving Secure/HttpOnly/SameSite=Strict cookies.
- Private credentials and the Workbench connection are in `../.credenciales/`, excluded from Git.
- Firestore, legacy backend source and Drive files remain intact. The old Railway `fotos-api` deployment was removed at Zozi's request, and its repository source disconnected to prevent automatic redeployment. The current application uses the commercial API.

## Animation notes

- The main journey is a custom scroll-driven horizontal timeline, not ScrollTrigger.
- Horizontal travel ends at the `.ballroom` landmark and completes at `travelEnd = 0.84`.
- The remaining timeline hold keeps the reception scene pinned briefly before sticky release.
- Ceremony and celebration cards stay as viewport overlays, not track children.

## Mobile performance notes

- The journey caches DOM references and precalculates key landmark timing instead of measuring every frame.
- Repeated transform and opacity writes are skipped when values do not materially change.
- Touch/smaller viewports use a lighter `mobilePerformanceMode`.
- Animated character media now uses lightweight `.webm` loops where available.

Current animation media in `frontend/public/assets/characters`:

- `waving.webm`
- `gaby-walking.webm`
- `car.webm`
- `dancing.webm`

## Legacy Firebase helpers — do not use for the commercial application

- Generate admin key hash: `npm run admin:hash -- mi-clave`
- Reset demo invitations: `npm run reset:demo`
- Report stats: `npm run report -- stats`
- Report confirmed guests: `npm run report -- attending`

These scripts belong to the previous deployment. Do not use them to operate the commercial application or modify the existing Firestore data. An unknown invitation now displays the not-found screen.
