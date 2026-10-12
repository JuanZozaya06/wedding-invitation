import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminStore } from '../../services/admin.store';
import { ViewChild, ElementRef } from '@angular/core';
@Component({
  selector: 'app-invitation-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './invitation-editor.component.html',
  styles: ':host { display: contents; }',
})
export class InvitationEditorComponent {
  readonly vm = inject(AdminStore);
  @ViewChild('invitationEditorDialog')
  set invitationEditorDialog(
    dialog: ElementRef<HTMLDialogElement> | undefined,
  ) {
    if (!dialog) return;
    queueMicrotask(() => {
      const element = dialog.nativeElement;
      if (!element.isConnected || !this.vm.invitationEditor) return;
      if (!element.open) element.showModal();
      element
        .querySelector<HTMLInputElement>('#invitation-display-name')
        ?.focus();
    });
  }
}
