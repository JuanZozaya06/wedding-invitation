import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InvitationState } from '../../services/invitation.state';
import { PolaroidComponent } from '../../../../shared/components/polaroid/polaroid.component';
@Component({
  selector: 'app-rsvp-form',
  standalone: true,
  imports: [CommonModule, FormsModule, PolaroidComponent],
  templateUrl: './rsvp-form.component.html',
  styles: ':host { display: contents; }',
})
export class RsvpFormComponent {
  readonly vm = inject(InvitationState);
}
