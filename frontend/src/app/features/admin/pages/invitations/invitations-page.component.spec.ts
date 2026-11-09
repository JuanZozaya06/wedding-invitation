import { TestBed, fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { InvitationsPageComponent } from './invitations-page.component';
import { AdminStore } from '../../services/admin.store';
import { createDemoInvitation } from '../../../../testing/invitation.fixture';

describe('Compact invitation list', () => {
  beforeEach(() => TestBed.configureTestingModule({
    imports: [InvitationsPageComponent], providers: [AdminStore, provideRouter([])],
  }));

  it('starts collapsed, preserves active filters while hidden and clears them on request', fakeAsync(() => {
    const store = TestBed.inject(AdminStore);
    store.adminDataLoaded = true;
    store.adminInvitations = [createDemoInvitation('AAA111'), createDemoInvitation('BBB222')];
    const fixture = TestBed.createComponent(InvitationsPageComponent);
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    const toggle = root.querySelector<HTMLButtonElement>('.invitation-filter-toggle')!;
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(root.querySelector('input')).toBeNull();
    toggle.click(); fixture.detectChanges(); flushMicrotasks(); fixture.detectChanges();
    const input = root.querySelector<HTMLInputElement>('input')!;
    input.value = 'AAA111'; input.dispatchEvent(new Event('input'));
    flushMicrotasks(); fixture.detectChanges();
    expect(root.querySelectorAll('.admin-group-card').length).toBe(1);
    toggle.click(); fixture.detectChanges();
    expect(root.querySelector('#invitation-filter-options')).toBeNull();
    expect(toggle.textContent).toContain('(1)');
    expect(root.querySelectorAll('.admin-group-card').length).toBe(1);
    toggle.click(); fixture.detectChanges(); flushMicrotasks(); fixture.detectChanges();
    expect(root.querySelector<HTMLInputElement>('input')!.value).toBe('AAA111');
    store.setInvitationFilter('opened'); fixture.detectChanges();
    expect(toggle.textContent).toContain('(2)');
    root.querySelector<HTMLButtonElement>('.invitation-filter-reset')!.click();
    fixture.detectChanges(); flushMicrotasks(); fixture.detectChanges();
    expect(store.activeInvitationFilter).toBe('all');
    expect(store.adminSearchTerm).toBe('');
    expect(root.querySelectorAll('.admin-group-card').length).toBe(2);
    fixture.destroy();
  }));

  it('shows clipboard feedback only in a dismissible temporary toast', fakeAsync(() => {
    spyOn(navigator.clipboard, 'writeText').and.resolveTo();
    const fixture = TestBed.createComponent(InvitationsPageComponent);
    fixture.detectChanges();
    void fixture.componentInstance.copyLink('AAA111');
    flushMicrotasks(); fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('.admin-copy-toast')?.textContent).toContain('Enlace copiado');
    expect(root.querySelector('.admin-share-status')).toBeNull();
    tick(8000); fixture.detectChanges();
    expect(root.querySelector('.admin-copy-toast')).toBeNull();
    void fixture.componentInstance.copyLink('AAA111');
    flushMicrotasks(); fixture.detectChanges();
    root.querySelector<HTMLButtonElement>('.admin-copy-toast button')!.click();
    fixture.detectChanges();
    expect(root.querySelector('.admin-copy-toast')).toBeNull();
    fixture.destroy();
  }));
});
