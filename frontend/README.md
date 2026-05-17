# Wedding Invitation Frontend

Angular 18 frontend for the private wedding invitation of Gabriela and Juan.

## Local dev

Run everything from `C:\Users\Zozi\Documents\Projects\wedding-invitation\frontend`.

- Start dev server: `npm start -- --host 127.0.0.1 --port 4200`
- Open demo invite: `http://127.0.0.1:4200/demo-cuento`
- Open admin: `http://127.0.0.1:4200/admin`
- Build: `npm run build`

Node `21.5.0` currently shows an Angular support warning locally. The app still builds, but production should use Node 20 LTS or 22+.

## App shape

- Public route: `/:token`
- Legacy fallback route: `/wedding-invitation/:token`
- Admin route: `/admin`
- Standalone Angular app with SCSS
- Firestore-backed invitation data with demo fallback

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

## Firebase helpers

- Generate admin key hash: `npm run admin:hash -- mi-clave`
- Generate token: `npm run token`
- Reset demo invitations: `npm run reset:demo`
- Report stats: `npm run report -- stats`
- Report confirmed guests: `npm run report -- attending`

If Firebase is missing or a token is not found, the frontend can fall back to demo invitation data.
