import { Component, Input } from '@angular/core';
import { RsvpStatus } from '../../models/invitation.model';

@Component({
  selector: 'app-attendance-status',
  standalone: true,
  template: `<span class="status" [attr.data-status]="status"><span aria-hidden="true">{{ symbols[status] }}</span>{{ labels[status] }}</span>`,
  styles: [`
    :host { display: inline-flex; }
    .status { display: inline-flex; align-items: center; gap: .35rem; padding: .3rem .65rem;
      border: 1px solid; border-radius: 999px; font-size: .78rem; font-weight: 800; line-height: 1.4; white-space: nowrap; }
    [data-status='accepted'] { color: #315e42; background: #edf5ef; border-color: #c6dece; }
    [data-status='pending'] { color: #795820; background: #faf3e4; border-color: #ead7ad; }
    [data-status='declined'] { color: #923f50; background: #fbeef0; border-color: #edcbd2; }
    [data-status='partial'] { color: #694791; background: #f2edf8; border-color: #d9caeb; }
  `],
})
export class AttendanceStatusComponent {
  @Input() status: RsvpStatus = 'pending';
  readonly labels: Record<RsvpStatus, string> = {
    accepted: 'Asistirá', pending: 'Sin confirmar', declined: 'No asistirá', partial: 'Confirmación parcial',
  };
  readonly symbols: Record<RsvpStatus, string> = {
    accepted: '✓', pending: '◷', declined: '×', partial: '◐',
  };
}
