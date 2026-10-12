import { inject, Injectable } from '@angular/core';
import {
  CommercialApiService,
  ApiError,
  WeddingDetails,
} from '../../../core/http/commercial-api.service';
import { InvitationService } from '../../invitation/services/invitation.service';
import { Invitation, Guest } from '../../invitation/models/invitation.model';
import { Router } from '@angular/router';
import { AdminSessionService } from '../../../core/auth/admin-session.service';
import {
  AdminStats,
  AdminConfirmedGuest,
  AdminTab,
  InvitationFilter,
  AdminTextEntry,
} from '../models/admin.model';
@Injectable()
export class AdminStore {
  private requestVersion = 0;
  private readonly invitationService = inject(InvitationService);
  readonly commercialApi = inject(CommercialApiService);
  private readonly router = inject(Router);
  readonly session = inject(AdminSessionService);
  readonly commercial = true;
  wedding: WeddingDetails | null = null;
  get coupleNames() {
    return this.wedding
      ? this.wedding.partnerOne + ' & ' + this.wedding.partnerTwo
      : 'Nuestra boda';
  }
  get monogram() {
    return this.wedding
      ? this.wedding.partnerOne[0] + '&' + this.wedding.partnerTwo[0]
      : '♡';
  }
  async initialize() {
    this.wedding = this.session.wedding;
    this.adminAccessGranted = !!this.wedding;
    if (this.adminAccessGranted) await this.refreshAdminDashboard();
  }
  clear() {
    ++this.requestVersion;
    this.authLoading = false;
    this.dataLoading = false;
    this.adminDataLoaded = false;
    this.invitationSaving = false;
    this.wedding = null;
    this.adminMenuOpen = false;
    this.adminStats = {
      invitations: 0,
      opened: 0,
      responded: 0,
      pending: 0,
      guests: 0,
      confirmed: 0,
    };
    this.adminAccessGranted = false;
    this.adminInvitations = [];
    this.adminConfirmedGuests = [];
    this.adminMessages = [];
    this.adminSongs = [];
    this.adminNotes = [];
    this.invitationDetail = null;
    this.invitationEditor = null;
    this.adminSearchTerm = '';
  }
  adminKey = '';

  invitationEditor: Invitation | null = null;

  invitationDetail: Invitation | null = null;

  openInvitationDetail(invitation: Invitation): void {
    this.invitationDetail = invitation;
  }

  closeInvitationDetail(): void {
    this.invitationDetail = null;
  }

  creatingInvitation = false;

  invitationSaving = false;

  invitationEditorError = '';

  invitationEditorSuccess = '';

  invitationShareToken = '';

  invitationShareMessage = '';

  async copyInvitationLink(token: string): Promise<void> {
    this.invitationShareToken = token;
    this.invitationShareMessage = '';
    try {
      await navigator.clipboard.writeText(this.adminInvitationUrl(token));
      this.invitationShareMessage = 'Enlace copiado';
    } catch {
      this.invitationShareMessage =
        'No se pudo copiar. Abre la invitación y copia el enlace de la barra de direcciones.';
    }
  }

  openInvitationEditor(invitation?: Invitation): void {
    if (this.invitationSaving || !this.adminAccessGranted) return;
    this.creatingInvitation = !invitation;
    this.invitationEditorError = '';
    this.invitationEditorSuccess = '';
    this.invitationEditor = invitation
      ? {
          ...invitation,
          guests: invitation.guests.map((guest) => ({ ...guest })),
        }
      : {
          token: this.generateInvitationCode(),
          displayName: '',
          guests: [],
          guestCount: 0,
          hasChildren: false,
          hasAbroadGuests: false,
          openedInvitation: false,
          openedAt: null,
          lastOpenedAt: null,
          openCount: 0,
          notes: '',
          message: '',
          song: '',
          rsvpStatus: 'pending',
          respondedAt: null,
          responseEditCount: 0,
          updatedAt: null,
        };
    if (!invitation) this.addEditorGuest();
  }

  closeInvitationEditor(): void {
    if (this.invitationSaving) return;

    this.invitationEditor = null;
  }

  addEditorGuest(): void {
    this.invitationEditor?.guests.push({
      id: `guest-${Array.from(
        crypto.getRandomValues(new Uint8Array(16)),
        (value) => value.toString(16).padStart(2, '0'),
      ).join('')}`,
      name: '',
      gender: null,
      role: this.invitationEditor.guests.length ? 'guest' : 'primary',
      attending: false,
      isChild: false,
      isAbroad: false,
    });
  }

  private generateInvitationCode(): string {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    while (code.length < 6) {
      for (const value of crypto.getRandomValues(new Uint8Array(6))) {
        // Reject the incomplete range so every character has equal probability.
        if (value < 252) code += alphabet[value % alphabet.length];
        if (code.length === 6) break;
      }
    }
    return code;
  }

  adminInvitationUrl(token: string): string {
    return this.commercialApi.invitationUrl(token);
  }

  removeEditorGuest(id: string): void {
    if (!this.invitationEditor || this.invitationEditor.guests.length <= 1)
      return;
    this.invitationEditor.guests = this.invitationEditor.guests.filter(
      (guest) => guest.id !== id,
    );
    if (
      !this.invitationEditor.guests.some((guest) => guest.role === 'primary')
    ) {
      this.invitationEditor.guests[0].role = 'primary';
    }
  }

  selectEditorPrimary(id: string): void {
    this.invitationEditor?.guests.forEach((guest) => {
      if (guest.id === id) guest.role = 'primary';
      else if (guest.role === 'primary') guest.role = 'guest';
    });
  }

  async saveInvitationEditor(): Promise<void> {
    if (
      !this.invitationEditor ||
      this.invitationSaving ||
      !this.adminAccessGranted
    )
      return;
    this.invitationSaving = true;
    this.invitationEditorError = '';
    try {
      await this.invitationService.saveInvitationDetails(
        this.invitationEditor,
        this.creatingInvitation,
      );
      this.invitationEditorSuccess = this.creatingInvitation
        ? 'Invitación creada.'
        : 'Cambios guardados.';

      this.invitationEditor = null;
      void this.router.navigate(['/admin/invitations']);
      await this.refreshAdminDashboard();
    } catch (error) {
      this.invitationEditorError =
        error instanceof Error
          ? error.message
          : 'No pudimos guardar. Tus datos siguen aquí; intenta nuevamente.';
      if (error instanceof ApiError && error.status === 401)
        this.adminAccessGranted = false;
    } finally {
      this.invitationSaving = false;
    }
  }

  adminKeyError = '';

  adminAccessGranted = false;

  private authLoading = false;
  private dataLoading = false;
  get adminLoading() {
    return this.authLoading || this.dataLoading;
  }
  adminDataLoaded = false;

  adminInvitations: Invitation[] = [];

  adminConfirmedGuests: AdminConfirmedGuest[] = [];

  adminMessages: AdminTextEntry[] = [];

  adminSongs: AdminTextEntry[] = [];

  adminNotes: AdminTextEntry[] = [];

  activeAdminTab: AdminTab = 'overview';

  adminMenuOpen = false;

  closeAdminMenu(): void {
    this.adminMenuOpen = false;
  }

  activeInvitationFilter: InvitationFilter = 'all';

  adminSearchTerm = '';

  adminStats: AdminStats = {
    invitations: 0,
    opened: 0,
    responded: 0,
    pending: 0,
    guests: 0,
    confirmed: 0,
  };

  get filteredAdminInvitations(): Invitation[] {
    return this.sortTextEntriesByDate(this.adminInvitations)
      .filter((invitation) => this.matchesInvitationSearch(invitation))
      .filter((invitation) => this.matchesInvitationFilter(invitation));
  }

  get filteredAdminConfirmedGuests(): AdminConfirmedGuest[] {
    const normalizedSearch = this.adminSearchTerm.trim().toLowerCase();
    return this.sortTextEntriesByDate(this.adminConfirmedGuests).filter(
      (guest) =>
        normalizedSearch.length === 0 ||
        guest.displayName.toLowerCase().includes(normalizedSearch) ||
        guest.token.toLowerCase().includes(normalizedSearch) ||
        guest.guestName.toLowerCase().includes(normalizedSearch),
    );
  }

  get filteredAdminMessages(): AdminTextEntry[] {
    return this.sortTextEntriesByDate(
      this.filterTextEntries(this.adminMessages),
    );
  }

  get filteredAdminSongs(): AdminTextEntry[] {
    return this.sortTextEntriesByDate(this.filterTextEntries(this.adminSongs));
  }

  get filteredAdminNotes(): AdminTextEntry[] {
    return this.sortTextEntriesByDate(this.filterTextEntries(this.adminNotes));
  }

  get recentOpenedInvitations(): Invitation[] {
    return [...this.adminInvitations]
      .filter((invitation) => invitation.lastOpenedAt)
      .sort((left, right) =>
        (right.lastOpenedAt ?? '').localeCompare(left.lastOpenedAt ?? ''),
      )
      .slice(0, 10);
  }

  get recentRespondedInvitations(): Invitation[] {
    return [...this.adminInvitations]
      .filter((invitation) => invitation.respondedAt)
      .sort((left, right) =>
        (right.respondedAt ?? '').localeCompare(left.respondedAt ?? ''),
      )
      .slice(0, 10);
  }

  async logoutAdmin(): Promise<void> {
    this.authLoading = true;
    try {
      await this.session.logout();
      this.adminAccessGranted = false;
      this.adminInvitations = [];
      this.adminConfirmedGuests = [];
      this.adminMessages = [];
      this.adminSongs = [];
      this.adminNotes = [];
      this.closeInvitationDetail();
      this.closeInvitationEditor();
      await this.router.navigate(['/admin/login']);
    } catch (error) {
      this.adminKeyError =
        error instanceof Error ? error.message : 'No pudimos cerrar sesión.';
    } finally {
      this.authLoading = false;
    }
  }

  async unlockAdmin(): Promise<void> {
    this.adminKeyError = '';
    this.authLoading = true;

    try {
      if (this.commercial) {
        this.wedding = await this.session.login(this.adminKey);
        this.adminKey = '';
        this.adminAccessGranted = true;
        await this.router.navigateByUrl(this.session.returnUrl);
        return;
      }
    } catch (error) {
      this.adminKeyError =
        error instanceof Error ? error.message : 'No pudimos iniciar sesión.';
      if (this.commercial) this.adminKey = '';
    } finally {
      this.authLoading = false;
    }
  }

  async refreshAdminDashboard(): Promise<void> {
    const version = ++this.requestVersion;
    this.adminKeyError = '';
    this.dataLoading = true;

    try {
      const invitations = await this.invitationService.listInvitations();
      if (version !== this.requestVersion) return;
      this.adminInvitations = invitations;
      this.adminConfirmedGuests = this.adminInvitations.flatMap((invitation) =>
        invitation.guests
          .filter((guest) => guest.attending)
          .map((guest) => ({
            token: invitation.token,
            displayName: invitation.displayName,
            guestName: guest.name,
            updatedAt: invitation.updatedAt ?? invitation.respondedAt,
            role: guest.role,
            isChild: guest.isChild,
            isAbroad: guest.isAbroad,
            openedInvitation: invitation.openedInvitation,
            rsvpStatus: invitation.rsvpStatus,
          })),
      );
      this.adminMessages = this.adminInvitations
        .filter((invitation) => invitation.message.trim().length > 0)
        .map((invitation) => ({
          token: invitation.token,
          displayName: invitation.displayName,
          value: invitation.message,
          rsvpStatus: invitation.rsvpStatus,
          updatedAt: invitation.updatedAt,
        }));
      this.adminSongs = this.adminInvitations
        .filter((invitation) => invitation.song.trim().length > 0)
        .map((invitation) => ({
          token: invitation.token,
          displayName: invitation.displayName,
          value: invitation.song,
          rsvpStatus: invitation.rsvpStatus,
          updatedAt: invitation.updatedAt,
        }));
      this.adminNotes = this.adminInvitations
        .filter((invitation) => invitation.notes.trim().length > 0)
        .map((invitation) => ({
          token: invitation.token,
          displayName: invitation.displayName,
          value: invitation.notes,
          rsvpStatus: invitation.rsvpStatus,
          updatedAt: invitation.updatedAt,
        }));

      const responded = this.adminInvitations.filter(
        (invitation) => invitation.rsvpStatus !== 'pending',
      ).length;
      const opened = this.adminInvitations.filter(
        (invitation) => invitation.openedInvitation,
      ).length;
      const guestCount = this.adminInvitations.reduce(
        (sum, invitation) => sum + invitation.guests.length,
        0,
      );

      this.adminStats = {
        invitations: this.adminInvitations.length,
        opened,
        responded,
        pending: this.adminInvitations.length - responded,
        guests: guestCount,
        confirmed: this.adminConfirmedGuests.length,
      };
      this.adminDataLoaded = true;
    } catch (error) {
      if (version !== this.requestVersion) return;
      this.adminKeyError =
        error instanceof Error
          ? error.message
          : 'No pudimos cargar las invitaciones.';
      if (error instanceof ApiError && error.status === 401) {
        this.clear();
        void this.router.navigate(['/admin/login']);
      }
    } finally {
      if (version === this.requestVersion) this.dataLoading = false;
    }
  }

  setAdminTab(tab: AdminTab): void {
    void this.router.navigate([
      tab === 'overview' ? '/admin' : '/admin/' + tab,
    ]);
    if (this.adminMenuOpen) this.closeAdminMenu();
  }

  setInvitationFilter(filter: InvitationFilter): void {
    this.activeInvitationFilter = filter;
  }

  formatAdminDate(value: string | null): string {
    if (!value) {
      return 'Sin registro';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat('es-VE', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  }

  private matchesInvitationSearch(invitation: Invitation): boolean {
    const normalizedSearch = this.adminSearchTerm.trim().toLowerCase();
    return (
      normalizedSearch.length === 0 ||
      invitation.displayName.toLowerCase().includes(normalizedSearch) ||
      invitation.token.toLowerCase().includes(normalizedSearch) ||
      invitation.guests.some((guest) =>
        guest.name.toLowerCase().includes(normalizedSearch),
      )
    );
  }

  private matchesInvitationFilter(invitation: Invitation): boolean {
    switch (this.activeInvitationFilter) {
      case 'opened':
        return invitation.openedInvitation;
      case 'unopened':
        return !invitation.openedInvitation;
      case 'responded':
        return invitation.rsvpStatus !== 'pending';
      case 'pending':
        return invitation.rsvpStatus === 'pending';
      case 'with-children':
        return invitation.hasChildren;
      case 'abroad':
        return invitation.hasAbroadGuests;
      default:
        return true;
    }
  }

  private sortTextEntriesByDate<
    T extends { updatedAt: string | null; token: string },
  >(entries: T[]): T[] {
    const timestamp = (value: string | null): number => {
      const parsed = value ? Date.parse(value) : NaN;
      return Number.isFinite(parsed) ? parsed : -Infinity;
    };
    return [...entries].sort(
      (left, right) =>
        timestamp(right.updatedAt) - timestamp(left.updatedAt) ||
        left.token.localeCompare(right.token),
    );
  }

  private filterTextEntries(entries: AdminTextEntry[]): AdminTextEntry[] {
    const normalizedSearch = this.adminSearchTerm.trim().toLowerCase();
    return entries.filter(
      (entry) =>
        normalizedSearch.length === 0 ||
        entry.displayName.toLowerCase().includes(normalizedSearch) ||
        entry.token.toLowerCase().includes(normalizedSearch) ||
        entry.value.toLowerCase().includes(normalizedSearch),
    );
  }
}
