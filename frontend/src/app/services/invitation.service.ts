import { Injectable } from '@angular/core';
import { collection, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore/lite';
import { createDemoInvitation } from '../data/demo-invitation';
import { getCurrentAppInstance } from '../firebase/app-instance';
import { getInvitationFirestore } from '../firebase/firebase';
import { GuestWish, Invitation, RsvpDraft, RsvpStatus } from '../models/invitation.model';

type FirestoreInvitation = Partial<Invitation> & {
  guests?: Array<Partial<Invitation['guests'][number]>>;
};

export class InvitationNotFoundError extends Error {
  constructor(token: string) {
    super(`Invitation "${token}" was not found.`);
    this.name = 'InvitationNotFoundError';
  }
}

@Injectable({
  providedIn: 'root',
})
export class InvitationService {
  private readonly appInstance = getCurrentAppInstance();

  async saveInvitationDetails(draft: Invitation, creating: boolean): Promise<void> {
    const firestore = getInvitationFirestore();
    if (!firestore) throw new Error('Firebase no está configurado.');
    if (!draft.displayName.trim() || !draft.guests.length ||
        draft.guests.some((guest) => !guest.name.trim()) ||
        draft.guests.filter((guest) => guest.role === 'primary').length !== 1 ||
        new Set(draft.guests.map((guest) => guest.id)).size !== draft.guests.length) {
      throw new Error('Completa los nombres y selecciona exactamente un invitado principal.');
    }
    if (creating && !/^[A-Z0-9]{6}$/.test(draft.token)) {
      throw new Error('El código de la nueva invitación no es válido.');
    }
    const reference = doc(firestore, this.appInstance.invitationsCollection, draft.token);
    const snapshot = await getDoc(reference);
    if (creating && snapshot.exists()) throw new Error('El código ya existe. Crea otra invitación para generar uno nuevo.');
    if (!creating && !snapshot.exists()) throw new Error('Esta invitación ya no existe. Actualiza el panel.');
    const current = snapshot.exists()
      ? this.normalizeInvitation(draft.token, snapshot.data() as FirestoreInvitation) : null;
    const guests = draft.guests.map((guest) => ({
      ...guest, name: guest.name.trim(),
      attending: current?.guests.find((existing) => existing.id === guest.id)?.attending ?? false,
    }));
    const confirmedCount = guests.filter((guest) => guest.attending).length;
    const details = {
      displayName: draft.displayName.trim(), guests, guestCount: guests.length,
      hasChildren: guests.some((guest) => guest.isChild),
      hasAbroadGuests: guests.some((guest) => guest.isAbroad), confirmedCount,
      rsvpStatus: current && current.rsvpStatus !== 'pending'
        ? this.resolveRsvpStatus(confirmedCount, guests.length - confirmedCount, current.rsvpStatus)
        : 'pending' as RsvpStatus,
      updatedAt: new Date().toISOString(),
    };
    if (creating) {
      await setDoc(reference, {
        ...details, token: draft.token, openedInvitation: false, openedAt: null,
        lastOpenedAt: null, openCount: 0, notes: '', message: '', song: '',
        respondedAt: null, responseEditCount: 0,
      });
    } else {
      await updateDoc(reference, details);
    }
  }

  isRemoteEnabled(): boolean {
    return getInvitationFirestore() !== null;
  }

  async upsertInvitation(invitation: Invitation): Promise<void> {
    const firestore = getInvitationFirestore();

    if (!firestore) {
      return;
    }

    const invitationRef = doc(firestore, this.appInstance.invitationsCollection, invitation.token);

    await setDoc(invitationRef, invitation, { merge: true });
  }

  async getInvitationByToken(token: string): Promise<Invitation> {
    const firestore = getInvitationFirestore();

    if (!firestore) {
      return createDemoInvitation(token);
    }

    const invitationRef = doc(firestore, this.appInstance.invitationsCollection, token);
    const invitationSnapshot = await getDoc(invitationRef);

    if (!invitationSnapshot.exists()) {
      throw new InvitationNotFoundError(token);
    }

    return this.normalizeInvitation(token, invitationSnapshot.data() as FirestoreInvitation);
  }

  async listInvitations(): Promise<Invitation[]> {
    const firestore = getInvitationFirestore();

    if (!firestore) {
      return [];
    }

    const invitationsSnapshot = await getDocs(
      collection(firestore, this.appInstance.invitationsCollection),
    );

    return invitationsSnapshot.docs.map((documentSnapshot) =>
      this.normalizeInvitation(documentSnapshot.id, documentSnapshot.data() as FirestoreInvitation),
    );
  }

  async getAdminMasterKeyHash(): Promise<string> {
    const firestore = getInvitationFirestore();

    if (!firestore) {
      return '';
    }

    const adminConfigRef = doc(firestore, this.appInstance.adminCollection, 'config');
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

    const invitationRef = doc(firestore, this.appInstance.invitationsCollection, token);
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

    const invitationRef = doc(firestore, this.appInstance.invitationsCollection, token);
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

    const invitationRef = doc(firestore, this.appInstance.invitationsCollection, token);
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
