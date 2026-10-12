import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminStore } from '../../services/admin.store';

@Component({
  selector: 'app-admin-stats',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './stats.component.html',
  styles: ':host { display: contents; }',
})
export class AdminStatsComponent {
  readonly vm = inject(AdminStore);
}
