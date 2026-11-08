import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminStore } from '../../services/admin.store';
import { AttendanceStatusComponent } from '../../../../shared/components/attendance-status/attendance-status.component';
import { ViewChild, ElementRef } from '@angular/core';
@Component({
  selector: 'app-invitation-detail',
  standalone: true,
  imports: [CommonModule, AttendanceStatusComponent],
  templateUrl: './invitation-detail.component.html',
  styles: ':host { display: contents; }',
})
export class InvitationDetailComponent {
  readonly vm = inject(AdminStore);
  private confirmationDialog?: HTMLDialogElement;
  @ViewChild('deleteTrigger') private deleteTrigger?: ElementRef<HTMLButtonElement>;

  @ViewChild('deleteDialog') set deleteDialog(dialog: ElementRef<HTMLDialogElement> | undefined) {
    this.confirmationDialog = dialog?.nativeElement;
    if (dialog) queueMicrotask(() => {
      if (dialog.nativeElement.isConnected && this.vm.invitationDeleteConfirming && !dialog.nativeElement.open)
        dialog.nativeElement.showModal();
    });
  }

  cancelDeletion(): void {
    if (this.vm.invitationDeleting) return;
    this.confirmationDialog?.close();
    this.vm.cancelInvitationDeletion();
    this.deleteTrigger?.nativeElement.focus();
  }
  @ViewChild('detailDialog') set detailDialog(
    dialog: ElementRef<HTMLDialogElement> | undefined,
  ) {
    if (dialog)
      queueMicrotask(() => {
        if (
          dialog.nativeElement.isConnected &&
          this.vm.invitationDetail &&
          !dialog.nativeElement.open
        )
          dialog.nativeElement.showModal();
      });
  }
}
