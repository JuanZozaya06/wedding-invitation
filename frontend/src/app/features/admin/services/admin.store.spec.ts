import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AdminStore } from './admin.store';
import { InvitationService } from '../../invitation/services/invitation.service';
import { createDemoInvitation } from '../../../testing/invitation.fixture';
describe('AdminStore', () => {
  const sample = createDemoInvitation('ABC123');
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AdminStore, provideRouter([])],
    });
    spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
  });
  it('sorts messages and songs newest first, keeps missing dates last and preserves searching', () => {
    const app = TestBed.inject(AdminStore);
    const entries = [
      {
        token: 'OLD001',
        displayName: 'Rocha',
        value: 'Texto',
        rsvpStatus: 'pending' as const,
        updatedAt: '2026-06-01T10:00:00Z',
      },
      {
        token: 'NONE01',
        displayName: 'Rocha',
        value: 'Texto',
        rsvpStatus: 'pending' as const,
        updatedAt: null,
      },
      {
        token: 'NEW001',
        displayName: 'Rocha',
        value: 'Texto',
        rsvpStatus: 'pending' as const,
        updatedAt: '2026-09-01T10:00:00Z',
      },
      {
        token: 'BAD001',
        displayName: 'Otro grupo',
        value: 'Texto',
        rsvpStatus: 'pending' as const,
        updatedAt: 'invalid',
      },
    ];
    app.adminMessages = entries;
    app.adminSongs = entries;
    app.adminNotes = entries;
    expect(app.filteredAdminMessages.map((entry) => entry.token)).toEqual([
      'NEW001',
      'OLD001',
      'BAD001',
      'NONE01',
    ]);
    expect(app.filteredAdminSongs.map((entry) => entry.token)).toEqual([
      'NEW001',
      'OLD001',
      'BAD001',
      'NONE01',
    ]);
    expect(app.filteredAdminNotes.map((entry) => entry.token)).toEqual([
      'NEW001',
      'OLD001',
      'BAD001',
      'NONE01',
    ]);
    app.adminSearchTerm = 'rocha';
    expect(app.filteredAdminMessages.map((entry) => entry.token)).toEqual([
      'NEW001',
      'OLD001',
      'NONE01',
    ]);
    expect(entries[0].token).toBe('OLD001');
  });
  it('sorts invitation and confirmed lists and returns ten recent openings and responses', () => {
    const app = TestBed.inject(AdminStore);
    app.adminInvitations = Array.from({ length: 12 }, (_, index) => {
      const date = new Date(Date.UTC(2026, 8, index + 1)).toISOString();
      return {
        ...sample,
        token: `TEST${index.toString().padStart(2, '0')}`,
        updatedAt: date,
        lastOpenedAt: date,
        respondedAt: date,
      };
    });
    app.adminConfirmedGuests = app.adminInvitations.map((invitation) => ({
      token: invitation.token,
      updatedAt: invitation.updatedAt,
      displayName: invitation.displayName,
      guestName: 'Invitado',
      role: 'primary',
      isChild: false,
      isAbroad: false,
      openedInvitation: true,
      rsvpStatus: 'accepted',
    }));
    expect(app.filteredAdminInvitations[0].token).toBe('TEST11');
    expect(app.filteredAdminConfirmedGuests[0].token).toBe('TEST11');
    expect(app.recentOpenedInvitations.length).toBe(10);
    expect(app.recentRespondedInvitations.length).toBe(10);
    expect(app.recentOpenedInvitations[9].token).toBe('TEST02');
    expect(app.recentRespondedInvitations[0].token).toBe('TEST11');
  });
  it('copies the full invitation URL and reports success', async () => {
    const app = TestBed.inject(AdminStore);
    const write = spyOn(navigator.clipboard, 'writeText').and.resolveTo();
    await app.copyInvitationLink('O3A0W6');
    expect(write).toHaveBeenCalledWith(
      new URL('O3A0W6', document.baseURI).href,
    );
    expect(app.invitationShareMessage).toBe('Enlace copiado');
  });
  it('reports clipboard failure without claiming the link was copied', async () => {
    const app = TestBed.inject(AdminStore);
    spyOn(navigator.clipboard, 'writeText').and.rejectWith(new Error('Denied'));
    await app.copyInvitationLink('O3A0W6');
    expect(app.invitationShareMessage).toContain('No se pudo copiar');
  });
  it('edits a copy and keeps exactly one primary guest when removing the primary', () => {
    const app = TestBed.inject(AdminStore);
    app.adminAccessGranted = true;
    const original = JSON.stringify(sample);
    app.openInvitationEditor(sample);
    app.invitationEditor!.guests[0].name = 'Nombre editado';
    app.addEditorGuest();
    const primary = app.invitationEditor!.guests.find(
      (guest) => guest.role === 'primary',
    )!;
    app.removeEditorGuest(primary.id);
    expect(
      app.invitationEditor!.guests.filter((guest) => guest.role === 'primary')
        .length,
    ).toBe(1);
    expect(JSON.stringify(sample)).toBe(original);
  });
  it('creates a private token and does not allow removing the last guest', () => {
    const app = TestBed.inject(AdminStore);
    app.adminAccessGranted = true;
    app.openInvitationEditor();
    expect(app.invitationEditor!.token).toMatch(/^[A-Z0-9]{6}$/);
    app.removeEditorGuest(app.invitationEditor!.guests[0].id);
    expect(app.invitationEditor!.guests.length).toBe(1);
  });
  it('keeps the draft after a failed save and closes it after retry succeeds', async () => {
    const service = TestBed.inject(InvitationService);
    const save = spyOn(service, 'saveInvitationDetails').and.rejectWith(
      new Error('Sin conexión'),
    );
    const app = TestBed.inject(AdminStore);
    spyOn(app, 'refreshAdminDashboard').and.resolveTo();
    app.adminAccessGranted = true;
    app.openInvitationEditor();
    const draft = app.invitationEditor;
    await app.saveInvitationEditor();
    expect(app.invitationEditor).toBe(draft);
    expect(app.invitationEditorError).toBe('Sin conexión');
    expect(app.invitationSaving).toBeFalse();
    save.and.resolveTo();
    await app.saveInvitationEditor();
    expect(app.invitationEditor).toBeNull();
    expect(app.refreshAdminDashboard).toHaveBeenCalled();
  });
  it('identifies permission errors and preserves the invitation draft', async () => {
    spyOn(
      TestBed.inject(InvitationService),
      'saveInvitationDetails',
    ).and.rejectWith(
      Object.assign(new Error('Missing permissions'), {
        code: 'permission-denied',
      }),
    );
    const app = TestBed.inject(AdminStore);
    app.adminAccessGranted = true;
    app.openInvitationEditor();
    app.invitationEditor!.displayName = 'Nathalia';
    await app.saveInvitationEditor();
    expect(app.invitationEditorError).toContain('Missing permissions');
    expect(app.invitationEditor!.displayName).toBe('Nathalia');
    expect(app.invitationSaving).toBeFalse();
  });
});
