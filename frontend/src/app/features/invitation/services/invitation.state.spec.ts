import { TestBed } from '@angular/core/testing';
import { InvitationState } from './invitation.state';
import {
  InvitationService,
  InvitationNotFoundError,
} from './invitation.service';
import {
  CommercialApiService,
  WeddingDetails,
} from '../../../core/http/commercial-api.service';
import { createDemoInvitation } from '../../../testing/invitation.fixture';
import { Invitation } from '../models/invitation.model';

describe('InvitationState', () => {
  let state: InvitationState;
  let service: InvitationService;
  const wedding: WeddingDetails = {
    slug: 'test-wedding',
    partnerOne: 'Uno',
    partnerTwo: 'Dos',
    timezone: 'America/Caracas',
    settings: null,
    events: [],
  };
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [InvitationState] });
    state = TestBed.inject(InvitationState);
    service = TestBed.inject(InvitationService);
    spyOn(TestBed.inject(CommercialApiService), 'publicWedding').and.resolveTo(
      wedding,
    );
  });
  afterEach(() => state.destroy());

  it('starts empty and never presents sample guests when loading fails', async () => {
    expect(state.invitation.guests).toEqual([]);
    spyOn(service, 'getInvitationByToken').and.rejectWith(
      new InvitationNotFoundError('ABSENT'),
    );
    await state.loadInvitation('ABSENT');
    expect(state.missingInvitation).toBeTrue();
    expect(state.invitation.guests).toEqual([]);
    expect(state.isLoadingInvitation).toBeFalse();
  });

  it('ignores a slow response from the previously visited invitation', async () => {
    let resolveOld!: (value: Invitation) => void;
    spyOn(service, 'getInvitationByToken').and.callFake((token) =>
      token === 'OLD001'
        ? new Promise((resolve) => (resolveOld = resolve))
        : Promise.resolve(createDemoInvitation(token)),
    );
    const oldLoad = state.loadInvitation('OLD001');
    await state.loadInvitation('NEW001');
    state.isOpen = true;
    resolveOld(createDemoInvitation('OLD001'));
    await oldLoad;
    expect(state.invitation.token).toBe('NEW001');
    expect(state.isOpen).toBeTrue();
  });

  it('does not apply a response after its page was destroyed', async () => {
    let resolve!: (value: Invitation) => void;
    spyOn(service, 'getInvitationByToken').and.returnValue(
      new Promise((done) => (resolve = done)),
    );
    const loading = state.loadInvitation('TEST01');
    state.destroy();
    resolve(createDemoInvitation('TEST01'));
    await loading;
    expect(state.wedding).toBeNull();
    expect(state.invitation.guests).toEqual([]);
  });

  it('waits for RSVP persistence, prevents duplicate submits and preserves a rejected draft', async () => {
    state.invitation = createDemoInvitation('TEST01');
    state.rsvp.guests = state.invitation.guests.map((guest) => ({ ...guest }));
    state.rsvp.notes = 'Mi nota';
    let reject!: (error: Error) => void;
    const save = spyOn(service, 'saveRsvp').and.returnValue(
      new Promise((_done, fail) => (reject = fail)),
    );
    const pending = state.submitRsvp();
    await state.submitRsvp();
    expect(save).toHaveBeenCalledTimes(1);
    expect(state.submitted).toBeFalse();
    expect(state.rsvpSaving).toBeTrue();
    reject(new Error('Sin conexión'));
    await pending;
    expect(state.rsvpError).toBe('Sin conexión');
    expect(state.rsvp.notes).toBe('Mi nota');
    expect(state.rsvpSaving).toBeFalse();
    save.and.resolveTo();
    await state.submitRsvp();
    expect(state.submitted).toBeTrue();
  });

  it('saves a message separately without altering attendance or showing early success', async () => {
    const rsvp = spyOn(service, 'saveRsvp');
    let resolve!: () => void;
    spyOn(service, 'saveGuestWish').and.returnValue(
      new Promise((done) => (resolve = done)),
    );
    state.guestWish = { message: '¡Felicidades!', song: 'Canción' };
    const pending = state.submitWish();
    expect(state.wishSubmitted).toBeFalse();
    expect(state.wishSaving).toBeTrue();
    resolve();
    await pending;
    expect(state.wishSubmitted).toBeTrue();
    expect(rsvp).not.toHaveBeenCalled();
  });
});
