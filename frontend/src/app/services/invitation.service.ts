import { Injectable } from '@angular/core';
import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore/lite';
import { createDemoInvitation } from '../data/demo-invitation';
import { getInvitationFirestore } from '../firebase/firebase';
import { GuestWish, Invitation, RsvpDraft, RsvpStatus } from '../models/invitation.model';

type FirestoreInvitation = Partial<Invitation> & {
  guests?: Array<Partial<Invitation['guests'][number]>>;
};

@Injectable({
  providedIn: 'root',
})
export class InvitationService {
  isRemoteEnabled(): boolean {
    return getInvitationFirestore() !== null;
  }

  async upsertInvitation(invitation: Invitation): Promise<void> {
    const firestore = getInvitationFirestore();

    if (!firestore) {
      return;
    }

    const invitationRef = doc(firestore, 'invitations', invitation.token);

    await setDoc(invitationRef, invitation, { merge: true });
  }

  async getInvitationByToken(token: string): Promise<Invitation> {
    const firestore = getInvitationFirestore();

    if (!firestore) {
      return createDemoInvitation(token);
    }

    const invitationRef = doc(firestore, 'invitations', token);
    const invitationSnapshot = await getDoc(invitationRef);

    if (!invitationSnapshot.exists()) {
      return createDemoInvitation(token);
    }

    return this.normalizeInvitation(token, invitationSnapshot.data() as FirestoreInvitation);
  }

  async listInvitations(): Promise<Invitation[]> {
    const firestore = getInvitationFirestore();

    if (!firestore) {
      return [];
    }

    const invitationsSnapshot = await getDocs(collection(firestore, 'invitations'));

    return invitationsSnapshot.docs.map((documentSnapshot) =>
      this.normalizeInvitation(documentSnapshot.id, documentSnapshot.data() as FirestoreInvitation),
    );
  }

  async getAdminMasterKeyHash(): Promise<string> {
    const firestore = getInvitationFirestore();

    if (!firestore) {
      return '';
    }

    const adminConfigRef = doc(firestore, 'admin', 'config');
    const adminConfigSnapshot = await getDoc(adminConfigRef);

    if (!adminConfigSnapshot.exists()) {
      return '';
    }

    const data = adminConfigSnapshot.data() as { masterKeyHash?: string };
    return data.masterKeyHash?.trim() ?? '';
  }

  async saveRsvp(token: string, rsvp: RsvpDraft): Promise<void> {
    const firestore = getInvitationFirestore();

    if (!firestore) {
      return;
    }

    const invitationRef = doc(firestore, 'invitations', token);
    const currentInvitation = await this.getInvitationByToken(token);
    const confirmedCount = rsvp.guests.filter((guest) => guest.attending).length;
    const declinedCount = rsvp.guests.length - confirmedCount;
    const nextStatus = this.resolveRsvpStatus(confirmedCount, declinedCount, rsvp.status);
    const timestamp = new Date().toISOString();

    await setDoc(
      invitationRef,
      {
        guests: rsvp.guests,
        notes: rsvp.notes,
        guestCount: rsvp.guests.length,
        hasChildren: rsvp.guests.some((guest) => guest.isChild),
        hasAbroadGuests: rsvp.guests.some((guest) => guest.isAbroad),
        rsvpStatus: nextStatus,
        confirmedCount,
        respondedAt: timestamp,
        responseEditCount: (currentInvitation.responseEditCount ?? 0) + 1,
        updatedAt: timestamp,
      },
      { merge: true },
    );
  }

  async saveGuestWish(token: string, guestWish: GuestWish): Promise<void> {
    const firestore = getInvitationFirestore();

    if (!firestore) {
      return;
    }

    const invitationRef = doc(firestore, 'invitations', token);
    const currentInvitation = await this.getInvitationByToken(token);
    const timestamp = new Date().toISOString();

    await setDoc(
      invitationRef,
      {
        message: guestWish.message.trim(),
        song: guestWish.song.trim(),
        responseEditCount: (currentInvitation.responseEditCount ?? 0) + 1,
        updatedAt: timestamp,
      },
      { merge: true },
    );
  }

  async markInvitationOpened(token: string): Promise<void> {
    const firestore = getInvitationFirestore();

    if (!firestore) {
      return;
    }

    const invitationRef = doc(firestore, 'invitations', token);
    const currentInvitation = await this.getInvitationByToken(token);
    const timestamp = new Date().toISOString();
    const firstOpenedAt = currentInvitation.openedAt ?? timestamp;

    await setDoc(
      invitationRef,
      {
        openedInvitation: true,
        openedAt: firstOpenedAt,
        lastOpenedAt: timestamp,
        openCount: (currentInvitation.openCount ?? 0) + 1,
        updatedAt: timestamp,
      },
      { merge: true },
    );
  }

  private normalizeInvitation(token: string, data: FirestoreInvitation): Invitation {
    const guests = (data.guests ?? []).map((guest, index) => ({
      id: guest.id?.trim() || `guest-${index + 1}`,
      name: guest.name?.trim() || `Invitado ${index + 1}`,
      gender: guest.gender ?? null,
      role: guest.role ?? (index === 0 ? 'primary' : 'guest'),
      attending: guest.attending ?? false,
      isChild: guest.isChild ?? guest.role === 'child',
      isAbroad: guest.isAbroad ?? false,
    }));

    const primaryGuest = guests.find((guest) => guest.role === 'primary') ?? guests[0] ?? null;

    return {
      token,
      displayName: data.displayName?.trim() || primaryGuest?.name || 'Invitados especiales',
      guestCount: data.guestCount ?? guests.length,
      openedInvitation: data.openedInvitation ?? false,
      openedAt: data.openedAt ?? null,
      lastOpenedAt: data.lastOpenedAt ?? null,
      openCount: data.openCount ?? 0,
      hasChildren: data.hasChildren ?? guests.some((guest) => guest.isChild),
      hasAbroadGuests: data.hasAbroadGuests ?? guests.some((guest) => guest.isAbroad),
      guests,
      notes: data.notes ?? '',
      message: data.message ?? '',
      song: data.song ?? '',
      rsvpStatus: data.rsvpStatus ?? 'pending',
      respondedAt: data.respondedAt ?? null,
      responseEditCount: data.responseEditCount ?? 0,
      updatedAt: data.updatedAt ?? null,
    };
  }

  private resolveRsvpStatus(
    confirmedCount: number,
    declinedCount: number,
    currentStatus: RsvpStatus,
  ): RsvpStatus {
    if (confirmedCount === 0 && declinedCount > 0) {
      return 'declined';
    }

    if (confirmedCount > 0 && declinedCount === 0) {
      return 'accepted';
    }

    if (confirmedCount > 0 && declinedCount > 0) {
      return 'partial';
    }

    return currentStatus;
  }
}
