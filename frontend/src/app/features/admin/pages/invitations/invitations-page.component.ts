import { Component, inject, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AdminStore } from '../../services/admin.store';
import { AttendanceStatusComponent } from '../../../../shared/components/attendance-status/attendance-status.component';
@Component({
  selector: 'app-admin-invitations',
  standalone: true,
  imports: [CommonModule, FormsModule, AttendanceStatusComponent],
  templateUrl: './invitations-page.component.html',
  styleUrl: './invitations-page.component.scss',
})
export class InvitationsPageComponent implements OnDestroy {
  readonly vm = inject(AdminStore);
  filtersExpanded = false;
  private feedbackTimer?: ReturnType<typeof setTimeout>;
  private destroyed = false;

  get activeFilterCount(): number {
    return Number(!!this.vm.adminSearchTerm.trim()) + Number(this.vm.activeInvitationFilter !== 'all');
  }

  clearFilters(): void {
    this.vm.adminSearchTerm = '';
    this.vm.setInvitationFilter('all');
  }

  async copyLink(token: string): Promise<void> {
    clearTimeout(this.feedbackTimer);
    await this.vm.copyInvitationLink(token);
    if (this.destroyed) {
      this.vm.invitationShareMessage = '';
      return;
    }
    this.feedbackTimer = setTimeout(() => this.dismissFeedback(), 8000);
  }

  dismissFeedback(): void {
    clearTimeout(this.feedbackTimer);
    this.vm.invitationShareMessage = '';
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.dismissFeedback();
  }
}
