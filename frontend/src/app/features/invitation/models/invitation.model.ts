export type GuestGender = 'male' | 'female' | 'other';

export type GuestRole = 'primary' | 'partner' | 'child' | 'guest';

export type RsvpStatus = 'pending' | 'accepted' | 'declined' | 'partial';

export type Guest = {
  id: string;
  name: string;
  gender: GuestGender | null;
  role: GuestRole;
  attending: boolean;
  isChild: boolean;
  isAbroad: boolean;
};

export type Invitation = {
  token: string;
  displayName: string;
  guestCount: number;
  openedInvitation: boolean;
  openedAt: string | null;
  lastOpenedAt: string | null;
  openCount: number;
  hasChildren: boolean;
  hasAbroadGuests: boolean;
  guests: Guest[];
  notes: string;
  message: string;
  song: string;
  rsvpStatus: RsvpStatus;
  respondedAt: string | null;
  responseEditCount: number;
  updatedAt: string | null;
};

export type RsvpDraft = {
  status: RsvpStatus;
  guests: Guest[];
  notes: string;
};

export type GuestWish = {
  message: string;
  song: string;
};
