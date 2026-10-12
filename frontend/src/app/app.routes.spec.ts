import { TestBed } from '@angular/core/testing';
import { Router, provideRouter, UrlSerializer } from '@angular/router';
import { DomainUrlSerializer } from './core/routing/domain-url-serializer';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from './app.routes';
import {
  CommercialApiService,
  WeddingDetails,
} from './core/http/commercial-api.service';
import { AdminSessionService } from './core/auth/admin-session.service';
import {
  InvitationService,
  InvitationNotFoundError,
} from './features/invitation/services/invitation.service';
import { createDemoInvitation } from './testing/invitation.fixture';
import { CivilInvitationComponent } from './features/civil/civil-invitation.component';
import { UploadComponent } from './features/photos/upload/upload.component';
import { InvitationPageComponent } from './features/invitation/invitation-page.component';
import { AdminLayoutComponent } from './features/admin/layout/admin-layout.component';
import { AdminStore } from './features/admin/services/admin.store';
import { PhotoApiService } from './features/photos/services/photo-api.service';

describe('Navegación por funcionalidad', () => {
  const wedding: WeddingDetails = {
    slug: 'gabriela-y-juan',
    partnerOne: 'Gabriela',
    partnerTwo: 'Juan',
    timezone: 'America/Caracas',
    settings: null,
    events: [
      {
        kind: 'ceremony',
        name: 'Ceremonia',
        venue: 'Capilla',
        address: 'Altamira',
        startsAt: '2026-11-28T19:00:00Z',
        mapUrl: '',
      },
    ],
  };
  let invitations: InvitationService;
  let api: CommercialApiService;
  let photos: PhotoApiService;
  let harness: RouterTestingHarness;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        { provide: UrlSerializer, useClass: DomainUrlSerializer },
      ],
    });
    invitations = TestBed.inject(InvitationService);
    api = TestBed.inject(CommercialApiService);
    photos = TestBed.inject(PhotoApiService);
    spyOn(api, 'restore').and.resolveTo(wedding);
    spyOn(api, 'login').and.resolveTo(wedding);
    spyOn(api, 'logout').and.resolveTo();
    TestBed.inject(AdminSessionService).wedding = wedding;
    spyOn(api, 'publicWedding').and.resolveTo(wedding);
    spyOn(api, 'request').and.callFake(async () => {
      throw new Error('Unexpected real API request in a routing test');
    });
    spyOn(invitations, 'getInvitationByToken').and.callFake(async (token) => ({
      ...createDemoInvitation(token),
      displayName: token,
    }));
    spyOn(invitations, 'listInvitations').and.resolveTo(
      Array.from({ length: 20 }, (_, i) =>
        createDemoInvitation(`TEST${i.toString().padStart(2, '0')}`),
      ),
    );
    spyOn(invitations, 'markInvitationOpened').and.resolveTo();
    spyOn(invitations, 'saveRsvp').and.resolveTo();
    spyOn(invitations, 'saveGuestWish').and.resolveTo();
    spyOn(invitations, 'saveInvitationDetails').and.resolveTo();
    spyOn(HTMLMediaElement.prototype, 'play').and.resolveTo();
    spyOn(photos, 'initialize').and.resolveTo(true);
    spyOn(photos, 'list').and.resolveTo({ photos: [], nextCursor: null });
    spyOn(CivilInvitationComponent.prototype, 'ngAfterViewInit');
    harness = await RouterTestingHarness.create();
  });

  async function go(url: string) {
    await harness.navigateByUrl(url);
    await harness.fixture.whenStable();
    harness.detectChanges();
    return harness.routeNativeElement!;
  }

  for (const url of [
    '/admin',
    '/admin/invitations',
    '/admin/confirmed',
    '/admin/messages',
    '/admin/songs',
    '/admin/notes',
  ]) {
    it(`espera la respuesta de la API antes de mostrar vacíos en ${url}`, async () => {
      let resolve!: (value: ReturnType<typeof createDemoInvitation>[]) => void;
      (invitations.listInvitations as jasmine.Spy).and.returnValue(
        new Promise((done) => (resolve = done)),
      );
      const root = await go(url);
      expect(
        root.querySelector('.admin-panel .admin-loading')?.textContent,
      ).toContain('Cargando');
      expect(
        root.querySelector('.admin-panel .admin-empty:not(.admin-loading)'),
      ).toBeNull();
      expect(root.querySelector('.admin-stats-grid')).toBeNull();
      resolve([]);
      await harness.fixture.whenStable();
      harness.detectChanges();
      expect(root.querySelector('.admin-loading')).toBeNull();
      expect(
        root.querySelector('.admin-panel .admin-empty:not(.admin-loading)'),
      ).not.toBeNull();
      expect(root.querySelector('.admin-stats-grid')).not.toBeNull();
    });
  }

  it('muestra la carga al actualizar y vuelve a mostrar los datos confirmados por la API', async () => {
    const root = await go('/admin/invitations');
    const layout = harness.routeDebugElement!
      .componentInstance as AdminLayoutComponent;
    let resolve!: (value: ReturnType<typeof createDemoInvitation>[]) => void;
    (invitations.listInvitations as jasmine.Spy).and.returnValue(
      new Promise((done) => (resolve = done)),
    );
    const refresh = layout.vm.refreshAdminDashboard();
    harness.detectChanges();
    expect(root.querySelector('.admin-panel .admin-loading')).not.toBeNull();
    expect(root.querySelector('.admin-group-card')).toBeNull();
    resolve([createDemoInvitation('NEW123')]);
    await refresh;
    harness.detectChanges();
    expect(root.querySelector('.admin-loading')).toBeNull();
    expect(root.querySelectorAll('.admin-group-card').length).toBe(1);
  });

  it('no presenta un error de conexión como un resultado vacío o estadísticas en cero', async () => {
    (invitations.listInvitations as jasmine.Spy).and.rejectWith(
      new Error('Sin conexión'),
    );
    const root = await go('/admin/messages');
    expect(root.querySelector('.admin-error')?.textContent).toContain(
      'Sin conexión',
    );
    expect(root.querySelector('.admin-panel .admin-empty')).toBeNull();
    expect(root.querySelector('.admin-stats-grid')).toBeNull();
  });

  it('mantiene el estado de carga después del login hasta que termina la consulta del panel', async () => {
    TestBed.inject(AdminSessionService).clear();
    await go('/admin/login');
    const login = harness.routeDebugElement!.componentInstance as {
      vm: AdminStore;
    };
    let resolve!: (value: ReturnType<typeof createDemoInvitation>[]) => void;
    (invitations.listInvitations as jasmine.Spy).and.returnValue(
      new Promise((done) => (resolve = done)),
    );
    login.vm.adminKey = 'test-only';
    await login.vm.unlockAdmin();
    harness.detectChanges();
    expect(login.vm.adminLoading).toBeTrue();
    expect(
      harness.routeNativeElement!.querySelector('.admin-panel .admin-loading'),
    ).not.toBeNull();
    resolve([]);
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(login.vm.adminLoading).toBeFalse();
    expect(
      harness.routeNativeElement!.querySelector('.admin-panel .admin-loading'),
    ).toBeNull();
  });

  it('retires /fotos without treating it as an invitation token or opening uploads', async () => {
    const root = await go('/fotos');
    expect(root.querySelector('.not-found-shell')).not.toBeNull();
    expect(root.querySelector('app-photo-upload')).toBeNull();
    expect(invitations.getInvitationByToken).not.toHaveBeenCalled();
    expect(photos.initialize).not.toHaveBeenCalled();
  });

  it('removes private data and opens login when an admin request reports an expired session', async () => {
    await go('/admin/media');
    const layout = harness.routeDebugElement!
      .componentInstance as AdminLayoutComponent;
    expect(layout.vm.adminInvitations.length).toBeGreaterThan(0);
    api.sessionExpired.next();
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(TestBed.inject(Router).url).toBe('/admin/login');
    expect(layout.vm.adminInvitations).toEqual([]);
    expect(layout.vm.invitationEditor).toBeNull();
    expect(TestBed.inject(AdminSessionService).wedding).toBeNull();
  });

  it('keeps an unsaved editor when leaving is cancelled and discards it only after confirmation', async () => {
    await go('/admin/media');
    const layout = harness.routeDebugElement!
      .componentInstance as AdminLayoutComponent;
    layout.vm.openInvitationEditor();
    harness.detectChanges();
    const confirm = spyOn(window, 'confirm').and.returnValue(false);
    await go('/civil');
    expect(TestBed.inject(Router).url).toBe('/admin/media');
    expect(layout.vm.invitationEditor).not.toBeNull();
    confirm.and.returnValue(true);
    await go('/civil');
    expect(TestBed.inject(Router).url).toBe('/civil');
    expect(layout.vm.invitationEditor).toBeNull();
    expect(invitations.saveInvitationDetails).not.toHaveBeenCalled();
  });

  for (const url of [
    '/civil',
    '/civil/',
    '/wedding-invitation/civil',
    '/civil?fotos=1',
  ]) {
    it(`abre ${url} sin buscar un token ni cargar el álbum`, async () => {
      const root = await go(url);
      expect(root.querySelector('.civil-shell')).not.toBeNull();
      expect(invitations.getInvitationByToken).not.toHaveBeenCalled();
      expect(photos.initialize).not.toHaveBeenCalled();
    });
  }

  for (const url of [
    '/upload',
    '/wedding-invitation/upload',
    '/ABC123?fotos=1',
  ]) {
    it(`abre los tres pasos en ${url} sin pedir código`, async () => {
      const root = await go(url);
      expect(root.querySelectorAll('.photo-steps li').length).toBe(3);
      expect(
        root.querySelector<HTMLInputElement>('input[type=file]')?.disabled,
      ).toBeFalse();
      expect(invitations.getInvitationByToken).not.toHaveBeenCalled();
      expect(api.restore).not.toHaveBeenCalled();
      expect(photos.initialize).toHaveBeenCalledWith(false);
    });
  }

  it('protege /admin/media y vuelve a la galería después del login con solo contraseña', async () => {
    TestBed.inject(AdminSessionService).clear();
    const root = await go('/admin/media');
    expect(TestBed.inject(Router).url).toBe('/admin/login');
    expect(root.querySelector('input[type=password]')).not.toBeNull();
    expect(root.querySelector('input[name=username]')).toBeNull();
    expect(photos.list).not.toHaveBeenCalled();
    const login = harness.routeDebugElement!.componentInstance;
    login.vm.adminKey = 'test-only';
    await login.vm.unlockAdmin();
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(TestBed.inject(Router).url).toBe('/admin/media');
    expect(
      harness.routeNativeElement!.querySelector('app-photo-gallery'),
    ).not.toBeNull();
    expect(api.login).toHaveBeenCalledOnceWith('test-only');
  });

  it('conserva layout, sesión, header y búsqueda al navegar del admin a /admin/media y regresar', async () => {
    const root = await go('/admin/invitations');
    const layout = harness.routeDebugElement!
      .componentInstance as AdminLayoutComponent;
    const header = root.querySelector('app-admin-header');
    layout.vm.adminSearchTerm = 'María';
    await go('/admin/media');
    expect(harness.routeDebugElement!.componentInstance).toBe(layout);
    expect(root.querySelector('app-admin-header')).toBe(header);
    expect(layout.vm.adminSearchTerm).toBe('María');
    expect(root.querySelector('.admin-toolbar h1')?.textContent?.trim()).toBe(
      'Fotos de la boda',
    );
    expect(root.querySelector('app-admin-actions')?.textContent).not.toContain(
      'Cerrar sesión',
    );
    expect(root.querySelector('.admin-desktop-actions')?.textContent).toContain(
      'Nueva invitación',
    );
    expect(photos.initialize).toHaveBeenCalledWith(true);
    expect(photos.list).toHaveBeenCalledWith(null, 'María');
    await go('/admin/messages');
    expect(layout.vm.activeAdminTab).toBe('messages');
    expect(api.restore).not.toHaveBeenCalled();
    expect(invitations.listInvitations).toHaveBeenCalledTimes(1);
  });

  it('abre el editor desde Fotos y no escribe al cancelar', async () => {
    const root = await go('/admin/media');
    root
      .querySelector<HTMLButtonElement>(
        '.admin-desktop-actions .primary-button',
      )!
      .click();
    harness.detectChanges();
    await harness.fixture.whenStable();
    expect(
      root.querySelector<HTMLDialogElement>('#invitation-editor-dialog')?.open,
    ).toBeTrue();
    const layout = harness.routeDebugElement!
      .componentInstance as AdminLayoutComponent;
    layout.vm.closeInvitationEditor();
    harness.detectChanges();
    expect(root.querySelector('#invitation-editor-dialog')).toBeNull();
    expect(invitations.saveInvitationDetails).not.toHaveBeenCalled();
  });

  it('actualiza una invitación cuando cambia :token y cierra el sobre anterior', async () => {
    const root = await go('/ABC123');
    const page = harness.routeDebugElement!
      .componentInstance as InvitationPageComponent;
    page.openInvitation();
    harness.detectChanges();
    expect(page.vm.isOpen).toBeTrue();
    await go('/XYZ789');
    expect(harness.routeDebugElement!.componentInstance).toBe(page);
    expect(page.vm.invitation.token).toBe('XYZ789');
    expect(page.vm.isOpen).toBeFalse();
    expect(root.querySelector('app-journey')).toBeNull();
    expect(invitations.getInvitationByToken).toHaveBeenCalledWith('XYZ789');
  });

  it('mantiene los enlaces antiguos de invitación', async () => {
    await go('/wedding-invitation/ABC123');
    expect(invitations.getInvitationByToken).toHaveBeenCalledOnceWith('ABC123');
  });

  it('muestra el error de invitación inexistente y permite reintentar otro código', async () => {
    (invitations.getInvitationByToken as jasmine.Spy).and.rejectWith(
      new InvitationNotFoundError('BAD123'),
    );
    const root = await go('/BAD123');
    expect(root.querySelector('h1')?.textContent).toContain(
      'No encontramos ese código',
    );
    expect(root.querySelector('.not-found-form')).not.toBeNull();
    expect(root.querySelector('.storybook-shell')).toBeNull();
  });

  for (const url of ['/', '/abc/def', '/abc.html', '/admin/desconocido']) {
    it(`muestra not-found en ${url} sin tratarlo como invitación`, async () => {
      const root = await go(url);
      expect(root.querySelector('.not-found-shell')).not.toBeNull();
      expect(invitations.getInvitationByToken).not.toHaveBeenCalled();
    });
  }

  it('impide abandonar el uploader mientras una subida está en curso', async () => {
    await go('/upload');
    const uploader = harness.routeDebugElement!
      .componentInstance as UploadComponent;
    uploader.busy = true;
    await go('/civil');
    expect(TestBed.inject(Router).url).toBe('/upload');
    uploader.busy = false;
    await go('/civil');
    expect(TestBed.inject(Router).url).toBe('/civil');
  });

  it('limpia la sesión y la vista administrativa al cerrar sesión', async () => {
    await go('/admin/media');
    const layout = harness.routeDebugElement!
      .componentInstance as AdminLayoutComponent;
    await layout.vm.logoutAdmin();
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(TestBed.inject(AdminSessionService).wedding).toBeNull();
    expect(TestBed.inject(Router).url).toBe('/admin/login');
    expect(
      harness.routeNativeElement!.querySelector('app-photo-gallery'),
    ).toBeNull();
  });

  for (const [width, height] of [
    [390, 844],
    [844, 390],
    [1440, 900],
  ]) {
    it(`muestra la actividad del resumen sin buscador a ${width}x${height}`, async () => {
      const root = await go('/admin');
      expect(root.querySelector('input[name="adminSearchTerm"]')).toBeNull();
      const frame = document.createElement('iframe');
      frame.style.cssText = `width:${width}px;height:${height}px;border:0`;
      document.body.appendChild(frame);
      try {
        const doc = frame.contentDocument!;
        document
          .querySelectorAll('style')
          .forEach((style) => doc.head.appendChild(style.cloneNode(true)));
        const base = doc.createElement('style');
        base.textContent = '*{box-sizing:border-box}body{margin:0}';
        doc.head.appendChild(base);
        doc.body.appendChild(root);
        const display = (selector: string) =>
          frame.contentWindow!.getComputedStyle(root.querySelector(selector)!)
            .display;
        const mobile = width <= 760 || (width <= 1000 && height <= 500);
        expect(display('.admin-activity-tabs') === 'none').toBe(!mobile);
        expect(display('#activity-responded')).not.toBe('none');
        expect(display('#activity-opened') === 'none').toBe(mobile);
        if (mobile) {
          const visits = root.querySelector<HTMLButtonElement>(
            '#activity-tab-opened',
          )!;
          visits.click();
          harness.detectChanges();
          expect(visits.getAttribute('aria-selected')).toBe('true');
          expect(display('#activity-opened')).not.toBe('none');
          expect(display('#activity-responded')).toBe('none');
          visits.focus();
          visits.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }),
          );
          harness.detectChanges();
          expect(doc.activeElement?.id).toBe('activity-tab-responded');
          expect(display('#activity-responded')).not.toBe('none');
          expect(display('#activity-opened')).toBe('none');
        }
        expect(doc.documentElement.scrollWidth).toBeLessThanOrEqual(width);
        expect(doc.documentElement.scrollHeight).toBeLessThanOrEqual(height);
      } finally {
        frame.remove();
      }
      await go('/admin/invitations');
      expect(
        harness.routeNativeElement!.querySelector(
          'input[name="adminSearchTerm"]',
        ),
      ).not.toBeNull();
    });
  }

  for (const [width, height] of [
    [320, 640],
    [360, 780],
    [390, 844],
    [430, 932],
    [844, 390],
    [1024, 768],
    [1200, 900],
    [1440, 900],
  ]) {
    it(`conserva scroll, acciones y editor del admin a ${width}x${height}`, async () => {
      const root = await go('/admin/invitations');
      const frame = document.createElement('iframe');
      frame.style.cssText = `width:${width}px;height:${height}px;border:0`;
      document.body.appendChild(frame);
      try {
        const doc = frame.contentDocument!;
        document
          .querySelectorAll('style')
          .forEach((style) => doc.head.appendChild(style.cloneNode(true)));
        const base = doc.createElement('style');
        base.textContent = '*{box-sizing:border-box}body{margin:0}';
        doc.head.appendChild(base);
        doc.body.appendChild(root);
        const style = (selector: string) =>
          frame.contentWindow!.getComputedStyle(root.querySelector(selector)!);
        const mobile = width <= 760 || (width <= 1000 && height <= 500);
        // Administration fills the viewport on desktop and mobile.
        expect(style('.admin-backoffice').padding).toBe('0px');
        const shellRect = root
          .querySelector('.admin-backoffice')!
          .getBoundingClientRect();
        const layoutRect = root
          .querySelector('.backoffice-layout')!
          .getBoundingClientRect();
        expect(layoutRect.left).toBeCloseTo(0, 0);
        expect(layoutRect.top).toBeCloseTo(0, 0);
        expect(layoutRect.width).toBeCloseTo(width, 0);
        expect(layoutRect.height).toBeCloseTo(height, 0);
        if (mobile) {
          expect(style('.backoffice-layout').borderRadius).toBe('0px');
          expect(style('.backoffice-sidebar').borderRadius).toBe('0px');
        }
        expect(shellRect.width).toBeCloseTo(width, 0);
        if (!mobile) {
          expect(
            root.querySelector('.backoffice-sidebar')!.getBoundingClientRect()
              .width,
          ).toBeCloseTo(220, 0);
        }
        expect(
          root.querySelector('app-admin-sidebar')!.textContent,
        ).not.toContain('Cerrar sesión');
        const badge = root.querySelector('app-attendance-status .status')!;
        const badgeStyle = frame.contentWindow!.getComputedStyle(badge);
        const iconStyle = frame.contentWindow!.getComputedStyle(
          badge.querySelector('span')!,
        );
        expect(parseFloat(badgeStyle.fontSize)).toBeCloseTo(12.48, 1);
        expect(badgeStyle.fontWeight).toBe('400');
        expect(badgeStyle.color).toBe('rgb(121, 88, 32)');
        expect(iconStyle.padding).toBe('0px');
        expect(iconStyle.backgroundColor).toBe('rgba(0, 0, 0, 0)');
        expect(style('.admin-desktop-actions').display === 'none').toBe(mobile);
        const list = root.querySelector<HTMLElement>('.admin-groups-grid')!;
        expect(list.scrollHeight).toBeGreaterThan(list.clientHeight);
        expect(doc.documentElement.scrollWidth).toBeLessThanOrEqual(width);
        expect(doc.documentElement.scrollHeight).toBeLessThanOrEqual(height);
        if (mobile) {
          root.querySelector<HTMLButtonElement>('#admin-menu-toggle')!.click();
          harness.detectChanges();
          expect(style('.admin-mobile-tools').display).toBe('block');
        }
        root
          .querySelector<HTMLButtonElement>(
            `${mobile ? '.admin-mobile-tools' : '.admin-desktop-actions'} .primary-button`,
          )!
          .click();
        harness.detectChanges();
        await harness.fixture.whenStable();
        const dialog = root.querySelector<HTMLDialogElement>(
          '#invitation-editor-dialog',
        )!;
        expect(dialog.open).toBeTrue();
        expect(dialog.matches(':modal')).toBeTrue();
        expect(dialog.getBoundingClientRect().width).toBeLessThanOrEqual(width);
        expect(dialog.getBoundingClientRect().height).toBeLessThanOrEqual(
          height,
        );
        const layout = harness.routeDebugElement!
          .componentInstance as AdminLayoutComponent;
        layout.vm.closeInvitationEditor();
        harness.detectChanges();
      } finally {
        frame.remove();
      }
    });
  }
});
