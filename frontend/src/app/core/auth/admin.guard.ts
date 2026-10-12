import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AdminSessionService } from './admin-session.service';
export const adminGuard: CanActivateFn = async (_route, state) => {
  const session = inject(AdminSessionService),
    router = inject(Router);
  session.returnUrl = state.url;
  return (await session.ensure()) || router.createUrlTree(['/admin/login']);
};
