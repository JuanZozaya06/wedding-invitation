import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminStore } from '../../services/admin.store';

@Component({
  selector: 'app-admin-actions',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './actions.component.html',
  styles: ':host { display: contents; }',
})
export class AdminActionsComponent {
  readonly vm = inject(AdminStore);
}
