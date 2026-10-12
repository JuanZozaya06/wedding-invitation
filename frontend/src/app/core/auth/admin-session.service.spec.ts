import { TestBed } from '@angular/core/testing';
import { AdminSessionService } from './admin-session.service';
import {
  CommercialApiService,
  WeddingDetails,
} from '../http/commercial-api.service';

describe('Admin session during a single visit', () => {
  const wedding: WeddingDetails = {
    slug: 'fixture',
    partnerOne: 'Uno',
    partnerTwo: 'Dos',
    timezone: 'America/Caracas',
    settings: null,
    events: [],
  };
  let api: CommercialApiService;
  let session: AdminSessionService;
  beforeEach(() => {
    TestBed.configureTestingModule({});
    api = TestBed.inject(CommercialApiService);
    session = TestBed.inject(AdminSessionService);
    spyOn(api, 'restore').and.resolveTo(wedding);
    spyOn(api, 'login').and.resolveTo(wedding);
    spyOn(api, 'logout').and.resolveTo();
  });

  it('requires the password on a fresh page even if a server cookie could restore access', async () => {
    expect(await session.ensure()).toBeFalse();
    expect(api.restore).not.toHaveBeenCalled();
  });

  it('keeps access during SPA navigation and requires login again after logout', async () => {
    await session.login('fixture-password');
    expect(await session.ensure()).toBeTrue();
    expect(await session.ensure()).toBeTrue();
    expect(api.login).toHaveBeenCalledTimes(1);
    await session.logout();
    expect(await session.ensure()).toBeFalse();
    expect(api.restore).not.toHaveBeenCalled();
  });

  it('cannot restore access automatically after the server expires the session', async () => {
    await session.login('fixture-password');
    api.sessionExpired.next();
    expect(await session.ensure()).toBeFalse();
    expect(api.restore).not.toHaveBeenCalled();
  });
});
