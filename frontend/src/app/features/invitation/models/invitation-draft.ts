import { Invitation, RsvpDraft } from './invitation.model';

export function createEmptyInvitation(token = ''): Invitation {
  return {
    token,
    displayName: '',
    guestCount: 0,
    openedInvitation: false,
    openedAt: null,
    lastOpenedAt: null,
    openCount: 0,
    hasChildren: false,
    hasAbroadGuests: false,
    notes: '',
    message: '',
    song: '',
    rsvpStatus: 'pending',
    respondedAt: null,
    responseEditCount: 0,
    updatedAt: null,
    guests: [],
  };
}

export function buildRsvpDraft(invitation: Invitation): RsvpDraft {
  return {
    status: invitation.rsvpStatus,
    guests: invitation.guests.map((guest) => ({ ...guest })),
    notes: invitation.notes,
  };
}
