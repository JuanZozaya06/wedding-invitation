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
- Photo uploader: `/upload`, directly opens the three steps without an invitation code. Uploads belong to the wedding album. `/fotos` and `/{token}?fotos=1` remain compatible aliases.
- Standalone Angular app with SCSS
- Invitation data, RSVP and admin authentication use the commercial Python API and MySQL on Railway.

## Production

- Invitation and admin: `https://labodadelsiglo.app/{token}` and `/admin`.
- API: `https://api.labodadelsiglo.app` (Railway, HTTPS).
- `public/commercial-config.json` selects the wedding and API. It contains no passwords.
- GitHub Pages deploys pushes to `main` after the Angular build and tests pass.
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
