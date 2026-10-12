import { Routes } from '@angular/router';
import { adminGuard } from '../../core/auth/admin.guard';
import { AdminStore } from './services/admin.store';
import { AdminLayoutComponent } from './layout/admin-layout.component';
export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    providers: [AdminStore],
    children: [
      {
        path: 'login',
        loadComponent: () =>
          import('./pages/login/login-page.component').then(
            (m) => m.LoginPageComponent,
          ),
      },
      {
        path: '',
        component: AdminLayoutComponent,
        canActivate: [adminGuard],
        canActivateChild: [adminGuard],
        canDeactivate: [(page: AdminLayoutComponent) => page.canLeave()],
        children: [
          {
            path: '',
            pathMatch: 'full',
            data: { tab: 'overview' },
            loadComponent: () =>
              import('./pages/overview/overview-page.component').then(
                (m) => m.OverviewPageComponent,
              ),
          },
          {
            path: 'invitations',
            data: { tab: 'invitations' },
            loadComponent: () =>
              import('./pages/invitations/invitations-page.component').then(
                (m) => m.InvitationsPageComponent,
              ),
          },
          {
            path: 'confirmed',
            data: { tab: 'confirmed' },
            loadComponent: () =>
              import('./pages/confirmed/confirmed-page.component').then(
                (m) => m.ConfirmedPageComponent,
              ),
          },
          {
            path: 'messages',
            data: { tab: 'messages' },
            loadComponent: () =>
              import('./pages/messages/messages-page.component').then(
                (m) => m.MessagesPageComponent,
              ),
          },
          {
            path: 'media',
            data: { tab: 'media' },
            loadComponent: () =>
              import('./pages/media/media-page.component').then(
                (m) => m.MediaPageComponent,
              ),
          },
          {
            path: 'songs',
            data: { tab: 'songs' },
            loadComponent: () =>
              import('./pages/songs/songs-page.component').then(
                (m) => m.SongsPageComponent,
              ),
          },
          {
            path: 'notes',
            data: { tab: 'notes' },
            loadComponent: () =>
              import('./pages/notes/notes-page.component').then(
                (m) => m.NotesPageComponent,
              ),
          },
          {
            path: '**',
            loadComponent: () =>
              import('../not-found/not-found.component').then(
                (m) => m.NotFoundComponent,
              ),
          },
        ],
      },
    ],
  },
];
