import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { InvitationService } from './services/invitation.service';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should start with a token-based demo invitation', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;

    expect(app.invitation.token).toBeTruthy();
    expect(app.invitation.guests.length).toBeGreaterThan(0);
  });

  it('sorts messages and songs newest first, keeps missing dates last and preserves searching', () => {
    const app = TestBed.createComponent(AppComponent).componentInstance;
    const entries = [
      { token: 'OLD001', displayName: 'Rocha', value: 'Texto', rsvpStatus: 'pending' as const, updatedAt: '2026-06-01T10:00:00Z' },
      { token: 'NONE01', displayName: 'Rocha', value: 'Texto', rsvpStatus: 'pending' as const, updatedAt: null },
      { token: 'NEW001', displayName: 'Rocha', value: 'Texto', rsvpStatus: 'pending' as const, updatedAt: '2026-09-01T10:00:00Z' },
      { token: 'BAD001', displayName: 'Otro grupo', value: 'Texto', rsvpStatus: 'pending' as const, updatedAt: 'invalid' },
    ];
    app.adminMessages = entries;
    app.adminSongs = entries;
    expect(app.filteredAdminMessages.map((entry) => entry.token)).toEqual(['NEW001', 'OLD001', 'BAD001', 'NONE01']);
    expect(app.filteredAdminSongs.map((entry) => entry.token)).toEqual(['NEW001', 'OLD001', 'BAD001', 'NONE01']);
    app.adminSearchTerm = 'rocha';
    expect(app.filteredAdminMessages.map((entry) => entry.token)).toEqual(['NEW001', 'OLD001', 'NONE01']);
    expect(entries[0].token).toBe('OLD001');
  });

  it('copies the full invitation URL and reports success', async () => {
    const app = TestBed.createComponent(AppComponent).componentInstance;
    const write = spyOn(navigator.clipboard, 'writeText').and.resolveTo();
    await app.copyInvitationLink('O3A0W6');
    expect(write).toHaveBeenCalledWith(new URL('O3A0W6', document.baseURI).href);
    expect(app.invitationShareMessage).toBe('Enlace copiado');
  });

  it('reports clipboard failure without claiming the link was copied', async () => {
    const app = TestBed.createComponent(AppComponent).componentInstance;
    spyOn(navigator.clipboard, 'writeText').and.rejectWith(new Error('Denied'));
    await app.copyInvitationLink('O3A0W6');
    expect(app.invitationShareMessage).toContain('No se pudo copiar');
  });

  it('edits a copy and keeps exactly one primary guest when removing the primary', () => {
    const app = TestBed.createComponent(AppComponent).componentInstance;
    app.adminAccessGranted = true;
    const original = JSON.stringify(app.invitation);
    app.openInvitationEditor(app.invitation);
    app.invitationEditor!.guests[0].name = 'Nombre editado';
    app.addEditorGuest();
    const primary = app.invitationEditor!.guests.find((guest) => guest.role === 'primary')!;
    app.removeEditorGuest(primary.id);
    expect(app.invitationEditor!.guests.filter((guest) => guest.role === 'primary').length).toBe(1);
    expect(JSON.stringify(app.invitation)).toBe(original);
  });

  it('creates a private token and does not allow removing the last guest', () => {
    const app = TestBed.createComponent(AppComponent).componentInstance;
    app.adminAccessGranted = true;
    app.openInvitationEditor();
    expect(app.invitationEditor!.token).toMatch(/^[A-Z0-9]{6}$/);
    app.removeEditorGuest(app.invitationEditor!.guests[0].id);
    expect(app.invitationEditor!.guests.length).toBe(1);
  });

  it('keeps the draft after a failed save and closes it after retry succeeds', async () => {
    const service = TestBed.inject(InvitationService);
    const save = spyOn(service, 'saveInvitationDetails').and.rejectWith(new Error('Sin conexión'));
    const app = TestBed.createComponent(AppComponent).componentInstance;
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
    spyOn(TestBed.inject(InvitationService), 'saveInvitationDetails')
      .and.rejectWith(Object.assign(new Error('Missing permissions'), { code: 'permission-denied' }));
    const app = TestBed.createComponent(AppComponent).componentInstance;
    app.adminAccessGranted = true;
    app.openInvitationEditor();
    app.invitationEditor!.displayName = 'Nathalia';
    await app.saveInvitationEditor();
    expect(app.invitationEditorError).toContain('Firestore denegó el acceso para crear');
    expect(app.invitationEditor!.displayName).toBe('Nathalia');
    expect(app.invitationSaving).toBeFalse();
  });
});
