import { Routes, Router, ActivatedRouteSnapshot } from '@angular/router';
import { inject } from '@angular/core';
import { invitationMatcher } from './core/routing/invitation.matcher';
function domainRoutes(): Routes {
  return [
    {
      path: 'civil',
      loadComponent: () =>
        import('./features/civil/civil-invitation.component').then(
          (m) => m.CivilInvitationComponent,
        ),
    },
    {
      path: 'upload',
      loadComponent: () =>
        import('./features/photos/upload/upload.component').then(
          (m) => m.UploadComponent,
        ),
      canDeactivate: [(page: { busy: boolean }) => !page.busy],
    },
    {
      path: 'admin',
      loadChildren: () =>
        import('./features/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
    },
    {
      path: '',
      pathMatch: 'full',
      loadComponent: () =>
        import('./features/not-found/not-found.component').then(
          (m) => m.NotFoundComponent,
        ),
    },
    {
      matcher: invitationMatcher,
      canActivate: [
        (route: ActivatedRouteSnapshot) =>
          route.queryParamMap.get('fotos') === '1'
            ? inject(Router).createUrlTree(['/upload'])
            : true,
      ],
      loadComponent: () =>
        import('./features/invitation/invitation-page.component').then(
          (m) => m.InvitationPageComponent,
        ),
      canDeactivate: [
        (page: { vm: { rsvpSaving: boolean; wishSaving: boolean } }) =>
          !page.vm.rsvpSaving && !page.vm.wishSaving,
      ],
    },
    {
      path: '**',
      loadComponent: () =>
        import('./features/not-found/not-found.component').then(
          (m) => m.NotFoundComponent,
        ),
    },
  ];
}
export const routes: Routes = [
  { path: 'wedding-invitation', children: domainRoutes() },
  ...domainRoutes(),
];
