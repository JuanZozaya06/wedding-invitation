import { Invitation, RsvpDraft } from '../models/invitation.model';

export function createDemoInvitation(token: string): Invitation {
  return {
    token,
    displayName: 'Valentina Hernández',
    guestCount: 2,
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
    guests: [
      {
        id: 'guest-valentina',
        name: 'Valentina Hernández',
        gender: 'female',
        role: 'primary',
        attending: true,
        isChild: false,
        isAbroad: false,
      },
      {
        id: 'guest-acompanante',
        name: 'Acompañante',
        gender: null,
        role: 'guest',
        attending: false,
        isChild: false,
        isAbroad: false,
      },
    ],
  };
}

export function buildRsvpDraft(invitation: Invitation): RsvpDraft {
  return {
    status: invitation.rsvpStatus,
    guests: invitation.guests.map((guest) => ({ ...guest })),
    notes: invitation.notes,
  };
}
