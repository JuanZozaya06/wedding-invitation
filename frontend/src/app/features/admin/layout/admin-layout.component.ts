import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  ViewEncapsulation,
  DestroyRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  RouterOutlet,
  Router,
  ActivatedRoute,
  NavigationEnd,
} from '@angular/router';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AdminStore } from '../services/admin.store';
import { AdminHeaderComponent } from '../components/header/header.component';
import { AdminSidebarComponent } from '../components/sidebar/sidebar.component';
import { AdminStatsComponent } from '../components/stats/stats.component';
import { InvitationDetailComponent } from '../components/invitation-detail/invitation-detail.component';
import { InvitationEditorComponent } from '../components/invitation-editor/invitation-editor.component';
@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterOutlet,
    AdminHeaderComponent,
    AdminSidebarComponent,
    AdminStatsComponent,
    InvitationDetailComponent,
    InvitationEditorComponent,
  ],
  templateUrl: './admin-layout.component.html',
  styleUrl: '../styles/admin.scss',
  encapsulation: ViewEncapsulation.None,
})
export class AdminLayoutComponent implements OnInit, OnDestroy {
  readonly vm = inject(AdminStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  ngOnInit() {
    this.vm.commercialApi.sessionExpired
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.vm.session.returnUrl = this.router.url;
        this.vm.clear();
        void this.router.navigate(['/admin/login']);
      });
    this.syncTab();
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.syncTab());
    void this.vm.initialize();
  }
  private syncTab() {
    let route = this.route.snapshot;
    while (route.firstChild) route = route.firstChild;
    this.vm.activeAdminTab = route.data['tab'] ?? 'overview';
    this.vm.adminMenuOpen = false;
  }
  ngOnDestroy() {
    this.vm.clear();
  }
  canLeave() {
    if (this.vm.invitationSaving) return false;
    if (!this.vm.invitationEditor) return true;
    if (
      !window.confirm(
        'Tienes una invitación sin guardar. ¿Quieres salir y descartar los cambios?',
      )
    )
      return false;
    this.vm.closeInvitationEditor();
    return true;
  }
}
