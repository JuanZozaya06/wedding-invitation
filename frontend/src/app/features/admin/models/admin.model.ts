import { Invitation } from '../../invitation/models/invitation.model';
export type AdminStats = {
  invitations: number;
  opened: number;
  responded: number;
  pending: number;
  guests: number;
  confirmed: number;
};

export type AdminConfirmedGuest = {
  updatedAt: string | null;
  token: string;
  displayName: string;
  guestName: string;
  role: string;
  isChild: boolean;
  isAbroad: boolean;
  openedInvitation: boolean;
  rsvpStatus: string;
};

export type AdminTab =
  | 'media'
  | 'overview'
  | 'invitations'
  | 'confirmed'
  | 'messages'
  | 'songs'
  | 'notes';
export type InvitationFilter =
  | 'all'
  | 'opened'
  | 'unopened'
  | 'responded'
  | 'pending'
  | 'with-children'
  | 'abroad';

export type AdminTextEntry = {
  token: string;
  displayName: string;
  value: string;
  rsvpStatus: Invitation['rsvpStatus'];
  updatedAt: string | null;
};
