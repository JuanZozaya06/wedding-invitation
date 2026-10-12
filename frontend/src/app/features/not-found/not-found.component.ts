import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  InvitationService,
  InvitationNotFoundError,
} from '../invitation/services/invitation.service';
@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './not-found.component.html',
  styleUrl: './not-found.component.scss',
})
export class NotFoundComponent {
  @Input() title = 'Bienvenidos a nuestra boda';
  @Input() message =
    'Para ver la invitación necesitamos el código que les enviamos.';
  @Input() code = '';
  busy = false;
  error = '';
  private readonly invitations = inject(InvitationService);
  private readonly router = inject(Router);
  async openInvitationByCode() {
    if (this.busy) return;
    let code = this.code.trim();
    try {
      code = new URL(code).pathname;
    } catch {
      /* A bare code is also accepted. */
    }
    try {
      code = decodeURIComponent(
        code.split(/[?#]/)[0].split('/').filter(Boolean).pop() ?? '',
      );
    } catch {
      code = '';
    }
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(code)) {
      this.error = 'Escribe un código de invitación válido para continuar.';
      return;
    }
    this.busy = true;
    this.error = '';
    try {
      await this.invitations.getInvitationByToken(code);
      await this.router.navigate(['/', code]);
    } catch (error) {
      this.error =
        error instanceof InvitationNotFoundError
          ? 'No encontramos una invitación con ese código. Revísalo e intenta de nuevo.'
          : error instanceof Error
            ? error.message
            : 'No pudimos validar el código ahora.';
    } finally {
      this.busy = false;
    }
  }
}
