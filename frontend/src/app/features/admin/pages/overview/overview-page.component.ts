import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminStore } from '../../services/admin.store';
import { AttendanceStatusComponent } from '../../../../shared/components/attendance-status/attendance-status.component';
@Component({
  selector: 'app-admin-overview',
  standalone: true,
  imports: [CommonModule, AttendanceStatusComponent],
  templateUrl: './overview-page.component.html',
  styles: ':host { display: contents; }',
})
export class OverviewPageComponent {
  readonly vm = inject(AdminStore);
  activeActivity: 'responded' | 'opened' = 'responded';

  onActivityKeydown(event: KeyboardEvent) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    this.activeActivity =
      event.key === 'Home'
        ? 'responded'
        : event.key === 'End'
          ? 'opened'
          : this.activeActivity === 'responded'
            ? 'opened'
            : 'responded';
    (event.currentTarget as HTMLElement)
      .querySelector<HTMLButtonElement>(`#activity-tab-${this.activeActivity}`)
      ?.focus();
  }
}
