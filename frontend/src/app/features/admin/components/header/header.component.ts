import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminStore } from '../../services/admin.store';
import { AdminActionsComponent } from '../actions/actions.component';
@Component({
  selector: 'app-admin-header',
  standalone: true,
  imports: [CommonModule, AdminActionsComponent],
  templateUrl: './header.component.html',
  styles: ':host { display: contents; }',
})
export class AdminHeaderComponent {
  readonly vm = inject(AdminStore);
}
