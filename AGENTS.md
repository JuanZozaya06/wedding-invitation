# Wedding Invitation Project Notes

Call the user Zozi.

## Project Goal

Build a private, animated wedding invitation for Gabriela and Juan as an Angular web app. The experience should feel like a cute, elegant storybook invitation: playful but not childish, with lila as the main accent color and a soft fantasy/wedding aesthetic.

The invitation is private and should eventually be loaded from a URL token directly at `/:token`. For now this is a visual prototype with fake data.

## Current Workspace

- Frontend app: `C:\Users\Juan\Documents\Projects\Wedding\frontend`
- Framework: Angular 18 standalone app
- Styling: SCSS
- Animation: GSAP + ScrollTrigger
- Current dev URL: `http://127.0.0.1:4200/demo-cuento`
- Main files:
  - `frontend/src/app/app.component.ts`
  - `frontend/src/app/app.component.html`
  - `frontend/src/app/app.component.scss`
  - `frontend/src/styles.scss`

## Commands

Run commands from `C:\Users\Juan\Documents\Projects\Wedding\frontend`.

- Start dev server: `npm start -- --host 127.0.0.1 --port 4200`
- Build: `npm run build`

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

The horizontal scene is scroll-driven with GSAP ScrollTrigger.

Important current behavior in `app.component.ts`:

- `distance()` is calculated from the `.ballroom` landmark, not total track width, so the horizontal scroll ends at celebration.
- `travelEnd = 0.84` means the track completes movement at 84% of the timeline.
- The remaining 16% of the pinned timeline is a hold on the celebration scene before releasing sticky scroll.
- Do not make the track movement duration `1` unless intentionally removing the final hold.
- The bride and vintage car are viewport overlays, not children of the horizontal track. This keeps the focal character centered while the world moves behind it.
- Ceremony and celebration cards are also viewport overlays, not track children. This keeps information centered and prevents it from being clipped at the viewport edge.
- Event timings should be derived from landmark positions, not guessed by fixed percentages when possible.

Current timing model:

- `churchProgress = progressFor('.church')`
- `ballroomProgress = progressFor('.ballroom', 7)`
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

## RSVP Model

The RSVP should be based on guests preloaded from the database. Guests should not be able to add arbitrary people.

Current fake model:

- `Invitation` has `token`, `displayName`, and `guests`.
- Each `Guest` has `id`, `name`, and `attending`.
- The RSVP form shows a checkbox per guest.
- It calculates confirmed count from checked guests.
- Notes field remains available for restrictions or comments.
- There is a separate optional section after RSVP where guests can leave a message for Juan and Gabriela and recommend a song. Keep this separate from RSVP so attendance confirmation stays quick.

Eventually, backend should return invitation data by token:

- display family/group name
- guest list
- current attending state
- notes/restrictions
- RSVP status
- optional message
- optional song recommendation

## Future Backend Direction

Preferred backend direction: Supabase or Firebase for a lightweight wedding invitation backend. Supabase is a good fit if relational guest data and SQL querying matter.

URL target: direct `/:token`, not `/inv/:token`.

Security expectations:

- Tokens should be long and unguessable.
- Frontend must only read/update the invitation tied to that token.
- Do not expose all invitations to the client.
- If using Supabase directly, configure RLS carefully; otherwise use serverless/edge functions like `getInvitation(token)` and `submitRsvp(token, payload)`.

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
