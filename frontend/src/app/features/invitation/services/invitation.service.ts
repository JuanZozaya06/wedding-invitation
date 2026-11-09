import { inject, Injectable } from '@angular/core';
import { GuestWish, Invitation, RsvpDraft } from '../models/invitation.model';
import {
  ApiError,
  CommercialApiService,
} from '../../../core/http/commercial-api.service';
export class InvitationNotFoundError extends Error {
  constructor(token: string) {
    super(`No se encontró la invitación ${token}.`);
  }
}

@Injectable({ providedIn: 'root' })
export class InvitationService {
  private readonly api = inject(CommercialApiService);
  isRemoteEnabled(): boolean {
    return true;
  }
  async getInvitationByToken(token: string): Promise<Invitation> {
    try {
      return await this.api.request<Invitation>(this.api.publicPath(token));
    } catch (error) {
      if (error instanceof ApiError && error.status === 404)
        throw new InvitationNotFoundError(token);
      throw error;
    }
  }
  listInvitations(): Promise<Invitation[]> {
    return this.api.invitations();
  }
  async deleteInvitation(token: string): Promise<void> {
    await this.api.request(
      this.api.adminPath() + '/invitations/' + encodeURIComponent(token),
      'DELETE',
      { confirmationToken: token },
      true,
    );
  }
  async saveRsvp(token: string, rsvp: RsvpDraft): Promise<void> {
    await this.api.request(this.api.publicPath(token) + '/rsvp', 'PUT', {
      attending_guest_ids: rsvp.guests
        .filter((g) => g.attending)
        .map((g) => g.id),
      notes: rsvp.notes,
    });
  }
  async saveGuestWish(token: string, wish: GuestWish): Promise<void> {
    await this.api.request(this.api.publicPath(token) + '/wish', 'PUT', wish);
  }
  async markInvitationOpened(token: string): Promise<void> {
    await this.api.request(this.api.publicPath(token) + '/open', 'POST');
  }
  async saveInvitationDetails(
    invitation: Invitation,
    creating: boolean,
    updateRsvp = false,
  ): Promise<void> {
    const path =
      this.api.adminPath() +
      '/invitations' +
      (creating ? '' : '/' + encodeURIComponent(invitation.token));
    await this.api.request(
      path,
      creating ? 'POST' : 'PUT',
      {
        token: invitation.token,
        displayName: invitation.displayName,
        ...(updateRsvp ? { rsvp: {
          status: invitation.rsvpStatus,
          attending_guest_ids: invitation.guests.filter(guest => guest.attending).map(guest => guest.id),
        } } : {}),
        guests: invitation.guests.map(
          ({ id, name, gender, role, isChild, isAbroad }) => ({
            id,
            name,
            gender,
            role,
            isChild,
            isAbroad,
          }),
        ),
      },
      true,
    );
  }
}
