import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { InvitationEditorComponent } from './invitation-editor.component';
import { AdminStore } from '../../services/admin.store';
import { CommercialApiService } from '../../../../core/http/commercial-api.service';
import { createDemoInvitation } from '../../../../testing/invitation.fixture';

describe('Admin RSVP editing', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [InvitationEditorComponent], providers: [AdminStore, provideRouter([])] });
    spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
  });

  it('saves selected attendance through one authenticated admin edit and refreshes the dashboard', async () => {
    const api = TestBed.inject(CommercialApiService);
    const request = spyOn(api, 'request').and.callFake(async (_path, method) => method === 'PUT' ? {} as any : [] as any);
    const store = TestBed.inject(AdminStore);
    store.adminAccessGranted = true;
    const original = createDemoInvitation('ABC123');
    original.guests.forEach(guest => guest.attending = false);
    store.openInvitationEditor(original);
    const fixture = TestBed.createComponent(InvitationEditorComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelectorAll('.editor-rsvp input').length).toBe(0);
    const selector = root.querySelector<HTMLSelectElement>('[name="rsvpStatus"]')!;
    selector.value = 'partial';
    selector.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(store.editingRsvp).toBeTrue();
    expect(root.querySelectorAll('.editor-rsvp input').length).toBe(2);
    (root.querySelectorAll('.editor-rsvp input')[0] as HTMLInputElement).click();
    await fixture.whenStable();
    expect(original.guests[0].attending).toBeFalse();
    await store.saveInvitationEditor();
    const writes = request.calls.allArgs().filter(args => args[1] === 'PUT');
    expect(writes.length).toBe(1);
    expect(writes[0][0]).toBe(api.adminPath() + '/invitations/ABC123');
    expect(writes[0][3]).toBeTrue();
    expect((writes[0][2] as any).rsvp.attending_guest_ids).toEqual(['guest-valentina']);
    expect(store.invitationEditor).toBeNull();
    fixture.destroy();
  });

  it('omits RSVP during ordinary edits and preserves the selected response on failed save', async () => {
    const request = spyOn(TestBed.inject(CommercialApiService), 'request').and.rejectWith(new Error('Sin conexión'));
    const store = TestBed.inject(AdminStore);
    store.adminAccessGranted = true;
    store.openInvitationEditor(createDemoInvitation('ABC123'));
    await store.saveInvitationEditor();
    expect((request.calls.mostRecent().args[2] as any).rsvp).toBeUndefined();
    store.selectEditorRsvp('declined');
    store.invitationEditor!.guests.forEach(guest => guest.attending = false);
    await store.saveInvitationEditor();
    expect((request.calls.mostRecent().args[2] as any).rsvp.attending_guest_ids).toEqual([]);
    expect(store.invitationEditorError).toBe('Sin conexión');
    expect(store.invitationEditor).not.toBeNull();
    expect(store.editingRsvp).toBeTrue();
    expect(store.invitationSaving).toBeFalse();
  });
  it('selects all, none or pending directly and validates partial attendance', async () => {
    const request = spyOn(TestBed.inject(CommercialApiService), 'request').and.resolveTo([] as any);
    const store = TestBed.inject(AdminStore);
    store.adminAccessGranted = true;
    store.openInvitationEditor(createDemoInvitation('ABC123'));
    store.selectEditorRsvp('accepted');
    expect(store.invitationEditor!.guests.every(guest => guest.attending)).toBeTrue();
    store.selectEditorRsvp('partial');
    await store.saveInvitationEditor();
    expect(request).not.toHaveBeenCalled();
    expect(store.invitationEditorError).toContain('Selecciona');
    store.selectEditorRsvp('pending');
    await store.saveInvitationEditor();
    const body = request.calls.allArgs().find(args => args[1] === 'PUT')![2] as any;
    expect(body.rsvp).toEqual({status: 'pending', attending_guest_ids: []});
  });

});
