import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminStore } from '../../services/admin.store';
import { AdminActionsComponent } from '../actions/actions.component';
import { AdminStatsComponent } from '../stats/stats.component';
@Component({
  selector: 'app-admin-sidebar',
  standalone: true,
  imports: [CommonModule, AdminActionsComponent, AdminStatsComponent],
  templateUrl: './sidebar.component.html',
  styles: ':host { display: contents; }',
})
export class AdminSidebarComponent {
  readonly vm = inject(AdminStore);
}
