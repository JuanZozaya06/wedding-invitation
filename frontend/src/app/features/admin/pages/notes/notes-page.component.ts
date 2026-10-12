import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminStore } from '../../services/admin.store';
import { AttendanceStatusComponent } from '../../../../shared/components/attendance-status/attendance-status.component';
@Component({
  selector: 'app-admin-notes',
  standalone: true,
  imports: [CommonModule, AttendanceStatusComponent],
  templateUrl: './notes-page.component.html',
  styles: ':host { display: contents; }',
})
export class NotesPageComponent {
  readonly vm = inject(AdminStore);
}
