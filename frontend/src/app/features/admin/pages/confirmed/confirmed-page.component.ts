import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminStore } from '../../services/admin.store';
import { AttendanceStatusComponent } from '../../../../shared/components/attendance-status/attendance-status.component';
@Component({
  selector: 'app-admin-confirmed',
  standalone: true,
  imports: [CommonModule, AttendanceStatusComponent],
  templateUrl: './confirmed-page.component.html',
  styles: ':host { display: contents; }',
})
export class ConfirmedPageComponent {
  readonly vm = inject(AdminStore);
}
