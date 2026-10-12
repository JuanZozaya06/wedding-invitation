import { UrlMatcher } from '@angular/router';
export const invitationMatcher: UrlMatcher = (segments) =>
  segments.length === 1 &&
  segments[0].path !== 'fotos' &&
  /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(segments[0].path)
    ? { consumed: segments, posParams: { token: segments[0] } }
    : null;
