import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';
import { buildRsvpDraft, createDemoInvitation } from './data/demo-invitation';
import { isFirebaseConfigured } from './firebase/firebase.config';
import { Guest, GuestWish, Invitation, RsvpDraft } from './models/invitation.model';
import { InvitationService } from './services/invitation.service';

type SeedWindow = Window & {
  seedDemoInvitation?: () => Promise<void>;
};

type AdminStats = {
  invitations: number;
  opened: number;
  responded: number;
  pending: number;
  guests: number;
  confirmed: number;
};

type AdminConfirmedGuest = {
  token: string;
  displayName: string;
  guestName: string;
  role: string;
  isChild: boolean;
  isAbroad: boolean;
  openedInvitation: boolean;
  rsvpStatus: string;
};

type AdminTab = 'overview' | 'invitations' | 'confirmed' | 'responses';
type InvitationFilter =
  | 'all'
  | 'opened'
  | 'unopened'
  | 'responded'
  | 'pending'
  | 'with-children'
  | 'abroad';

type AdminTextEntry = {
  token: string;
  displayName: string;
  value: string;
  updatedAt: string | null;
};

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly githubPagesBaseSegment = 'wedding-invitation';
  @ViewChild('journeySection') private journeySection?: ElementRef<HTMLElement>;
  @ViewChild('journeyTrack') private journeyTrack?: ElementRef<HTMLElement>;

  private readonly document = inject(DOCUMENT);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly invitationService = inject(InvitationService);
  private reduceMotion = false;
  private journeyReady = false;
  private journeyScrollLength = 0;
  private journeyAnimationFrame = 0;
  private readonly journeyTravelEnd = 0.84;
  private readonly updateJourneyFromScroll = () => this.requestJourneyUpdate();
  private readonly resizeJourney = () => {
    this.layoutJourney();
    this.requestJourneyUpdate();
  };

  readonly routeSegment = this.readRouteSegment();
  readonly isAdminRoute = this.routeSegment === 'admin';

  invitation: Invitation = createDemoInvitation(this.readToken());

  readonly ceremony = {
    name: 'Iglesia María Auxiliadora (Capilla grande)',
    address: 'Altamira, Chacao',
    time: '3:00 PM',
    embedUrl: this.trustedMap('Iglesia Maria Auxiliadora de Altamira Chacao'),
  };

  readonly party = {
    name: 'Quinta Mirador',
    address: 'La Lagunita, El Hatillo',
    time: '5:00 PM',
    embedUrl: this.trustedMap('Quinta Mirador La Lagunita El Hatillo'),
  };

  isOpen = false;
  submitted = false;
  wishSubmitted = false;
  isLoadingInvitation = true;
  invitationError = '';
  readonly firebaseReady = isFirebaseConfigured();

  rsvp: RsvpDraft = buildRsvpDraft(this.invitation);

  guestWish: GuestWish = {
    message: '',
    song: '',
  };

  adminKey = '';
  adminKeyError = '';
  adminAccessGranted = false;
  adminLoading = false;
  adminInvitations: Invitation[] = [];
  adminConfirmedGuests: AdminConfirmedGuest[] = [];
  adminMessages: AdminTextEntry[] = [];
  adminSongs: AdminTextEntry[] = [];
  adminNotes: AdminTextEntry[] = [];
  activeAdminTab: AdminTab = 'overview';
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

  async ngOnInit(): Promise<void> {
    this.registerDevSeed();

    if (this.isAdminRoute) {
      this.isLoadingInvitation = false;
      return;
    }

    await this.loadInvitation();
  }

  ngAfterViewInit(): void {
    this.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  ngOnDestroy(): void {
    window.removeEventListener('scroll', this.updateJourneyFromScroll);
    window.removeEventListener('resize', this.resizeJourney);
    window.cancelAnimationFrame(this.journeyAnimationFrame);
  }

  openInvitation(): void {
    const openingScrollY = window.scrollY;
    this.isOpen = true;
    this.invitation.openedInvitation = true;
    this.invitation.openedAt = this.invitation.openedAt ?? new Date().toISOString();
    window.scrollTo({ top: openingScrollY, behavior: 'auto' });

    void this.invitationService.markInvitationOpened(this.invitation.token);

    this.afterLayoutSettles(() => {
      window.scrollTo({ top: openingScrollY, behavior: 'auto' });
      this.setupJourneyAnimation();
    });
  }

  get confirmedGuests(): Guest[] {
    return this.rsvp.guests.filter((guest) => guest.attending);
  }

  get primaryGuest(): Guest | undefined {
    return this.invitation.guests.find((guest) => guest.role === 'primary') ?? this.invitation.guests[0];
  }

  get isSingleInvitation(): boolean {
    return this.invitation.guests.length === 1;
  }

  get invitationHasChildren(): boolean {
    return this.invitation.guests.some((guest) => guest.isChild);
  }

  get invitationHasAbroadGuests(): boolean {
    return this.invitation.guests.some((guest) => guest.isAbroad);
  }

  get coverEyebrow(): string {
    if (this.isSingleInvitation) {
      return this.primaryGuest?.gender === 'female' ? 'Una invitada especial' : 'Un invitado especial';
    }

    return 'Una invitacion especial';
  }

  get parchmentGreeting(): string {
    if (!this.primaryGuest) {
      return `Queridos ${this.invitation.displayName}`;
    }

    if (!this.isSingleInvitation) {
      return `Queridos ${this.invitation.displayName}`;
    }

    if (this.primaryGuest.gender === 'female') {
      return `Querida ${this.primaryGuest.name}`;
    }

    if (this.primaryGuest.gender === 'male') {
      return `Querido ${this.primaryGuest.name}`;
    }

    return `Hola ${this.primaryGuest.name}`;
  }

  get invitationHeadline(): string {
    if (this.isSingleInvitation) {
      if (this.primaryGuest?.gender === 'female') {
        return 'Estas invitada a nuestra boda';
      }

      if (this.primaryGuest?.gender === 'male') {
        return 'Estas invitado a nuestra boda';
      }

      return 'Tienes una invitacion para nuestra boda';
    }

    return 'Estan invitados a nuestra boda';
  }

  get invitationBodyCopy(): string {
    const base = this.isSingleInvitation
      ? 'Nos encantaria que nos acompanes en el inicio de esta nueva aventura.'
      : 'Nos encantaria que nos acompanen en el inicio de esta nueva aventura.';
    const reservedSeats = `Hemos reservado ${this.invitation.guests.length} cupos para ustedes.`;
    const childrenCopy = this.invitationHasChildren
      ? ' Nos hace mucha ilusion compartir este dia tambien con los pequenos de la familia.'
      : '';
    const abroadCopy = this.invitationHasAbroadGuests
      ? ' Sabemos que algunos vienen desde fuera del pais, asi que iremos compartiendo detalles utiles.'
      : '';

    return `${base} ${reservedSeats}${childrenCopy}${abroadCopy}`;
  }

  get filteredAdminInvitations(): Invitation[] {
    return this.adminInvitations.filter((invitation) => this.matchesInvitationSearch(invitation))
      .filter((invitation) => this.matchesInvitationFilter(invitation));
  }

  get filteredAdminConfirmedGuests(): AdminConfirmedGuest[] {
    const normalizedSearch = this.adminSearchTerm.trim().toLowerCase();
    return this.adminConfirmedGuests.filter((guest) =>
      normalizedSearch.length === 0 ||
      guest.displayName.toLowerCase().includes(normalizedSearch) ||
      guest.token.toLowerCase().includes(normalizedSearch) ||
      guest.guestName.toLowerCase().includes(normalizedSearch),
    );
  }

  get filteredAdminMessages(): AdminTextEntry[] {
    return this.filterTextEntries(this.adminMessages);
  }

  get filteredAdminSongs(): AdminTextEntry[] {
    return this.filterTextEntries(this.adminSongs);
  }

  get filteredAdminNotes(): AdminTextEntry[] {
    return this.filterTextEntries(this.adminNotes);
  }

  get recentOpenedInvitations(): Invitation[] {
    return [...this.adminInvitations]
      .filter((invitation) => invitation.lastOpenedAt)
      .sort((left, right) => (right.lastOpenedAt ?? '').localeCompare(left.lastOpenedAt ?? ''))
      .slice(0, 5);
  }

  get recentRespondedInvitations(): Invitation[] {
    return [...this.adminInvitations]
      .filter((invitation) => invitation.respondedAt)
      .sort((left, right) => (right.respondedAt ?? '').localeCompare(left.respondedAt ?? ''))
      .slice(0, 5);
  }

  async submitRsvp(): Promise<void> {
    await this.invitationService.saveRsvp(this.invitation.token, this.rsvp);
    this.submitted = true;
    console.table({
      token: this.invitation.token,
      status: this.rsvp.status,
      confirmedCount: this.confirmedGuests.length,
      attendeeNames: this.confirmedGuests.map((guest) => guest.name).join(', '),
      notes: this.rsvp.notes,
    });
  }

  async submitWish(): Promise<void> {
    await this.invitationService.saveGuestWish(this.invitation.token, this.guestWish);
    this.wishSubmitted = true;
    console.table({
      token: this.invitation.token,
      message: this.guestWish.message,
      song: this.guestWish.song,
    });
  }

  async unlockAdmin(): Promise<void> {
    this.adminKeyError = '';
    this.adminLoading = true;

    try {
      const masterKeyHash = await this.invitationService.getAdminMasterKeyHash();

      if (!masterKeyHash) {
        this.adminKeyError =
          'No encontramos admin/config en Firestore o no tiene masterKeyHash.';
        return;
      }

      const enteredHash = await this.hashValue(this.adminKey.trim());

      if (enteredHash !== masterKeyHash) {
        this.adminKeyError = 'La clave maestra no coincide.';
        return;
      }

      this.adminAccessGranted = true;
      await this.refreshAdminDashboard();
    } catch (error) {
      this.adminKeyError =
        'No pudimos cargar el panel admin. Revisa la configuracion o las reglas de Firestore.';
      console.error(error);
    } finally {
      this.adminLoading = false;
    }
  }

  async refreshAdminDashboard(): Promise<void> {
    this.adminKeyError = '';
    this.adminLoading = true;

    try {
      this.adminInvitations = await this.invitationService.listInvitations();
      this.adminConfirmedGuests = this.adminInvitations.flatMap((invitation) =>
        invitation.guests
          .filter((guest) => guest.attending)
          .map((guest) => ({
            token: invitation.token,
            displayName: invitation.displayName,
            guestName: guest.name,
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
          updatedAt: invitation.updatedAt,
        }));
      this.adminSongs = this.adminInvitations
        .filter((invitation) => invitation.song.trim().length > 0)
        .map((invitation) => ({
          token: invitation.token,
          displayName: invitation.displayName,
          value: invitation.song,
          updatedAt: invitation.updatedAt,
        }));
      this.adminNotes = this.adminInvitations
        .filter((invitation) => invitation.notes.trim().length > 0)
        .map((invitation) => ({
          token: invitation.token,
          displayName: invitation.displayName,
          value: invitation.notes,
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
    } catch (error) {
      this.adminKeyError =
        'No pudimos leer la coleccion de invitaciones. Si usas frontend web, Firestore debe permitir list.';
      console.error(error);
    } finally {
      this.adminLoading = false;
    }
  }

  private setupJourneyAnimation(): void {
    if (this.reduceMotion || !this.journeySection || !this.journeyTrack || this.journeyReady) {
      return;
    }

    this.journeyReady = true;
    this.layoutJourney();
    this.requestJourneyUpdate();
    window.addEventListener('scroll', this.updateJourneyFromScroll, { passive: true });
    window.addEventListener('resize', this.resizeJourney, { passive: true });
    this.refreshAfterEmbeddedAssets(this.journeySection.nativeElement);
  }

  private afterLayoutSettles(callback: () => void): void {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.setTimeout(callback, 80);
      });
    });
  }

  private refreshAfterEmbeddedAssets(section: HTMLElement): void {
    section.querySelectorAll('img, iframe').forEach((asset) => {
      asset.addEventListener('load', this.resizeJourney, { once: true });
    });
  }

  private layoutJourney(): void {
    if (!this.journeySection || !this.journeyTrack) {
      return;
    }

    const distance = this.getJourneyDistance();
    this.journeyScrollLength = Math.max(distance * 2.55, 4200);
    this.journeySection.nativeElement.style.height = `${this.journeyScrollLength + window.innerHeight}px`;
  }

  private requestJourneyUpdate(): void {
    if (this.journeyAnimationFrame) {
      return;
    }

    this.journeyAnimationFrame = window.requestAnimationFrame(() => {
      this.journeyAnimationFrame = 0;
      this.updateJourney();
    });
  }

  private updateJourney(): void {
    if (!this.journeySection || !this.journeyTrack || !this.journeyReady) {
      return;
    }

    const section = this.journeySection.nativeElement;
    const track = this.journeyTrack.nativeElement;
    const sectionTop = section.getBoundingClientRect().top + window.scrollY;
    const rawProgress = (window.scrollY - sectionTop) / this.journeyScrollLength;
    const progress = this.clampProgress(rawProgress);
    const distance = this.getJourneyDistance();
    const travelProgress = this.clampProgress(progress / this.journeyTravelEnd);
    const trackX = -distance * travelProgress;

    track.style.transform = `translate3d(${trackX}px, 0, 0)`;
    this.setLayerTransform(section, '.trees', -180 * travelProgress);
    this.setLayerTransform(section, '.hills.near', -90 * travelProgress);
    this.setLayerTransform(section, '.hills.far', -40 * travelProgress);

    const progressFor = (selector: string) =>
      this.clampProgress(this.getSceneDistance(track, selector) / Math.max(distance, 1));
    const churchTime = progressFor('.church') * this.journeyTravelEnd;
    const ballroomTime = progressFor('.ballroom') * this.journeyTravelEnd;
    const ceremonyIn = Math.max(0.08, churchTime - 0.14);
    const ceremonyOut = Math.min(this.journeyTravelEnd - 0.16, churchTime + 0.06);
    const carIn = Math.min(this.journeyTravelEnd - 0.14, churchTime + 0.02);
    const partyIn = Math.max(this.journeyTravelEnd - 0.12, ballroomTime - 0.1);

    this.setCardState(
      section,
      '.ceremony-card',
      progress >= ceremonyIn && progress < ceremonyOut,
      progress < ceremonyIn ? 28 : -20,
    );
    this.setCardState(section, '.party-card', progress >= partyIn, 28);
    this.setAlpha(section, '.journey-bride', progress < carIn ? 1 : 0);
    this.setAlpha(section, '.vintage-car', progress >= carIn + 0.01 ? 1 : 0);
  }

  private getJourneyDistance(): number {
    if (!this.journeyTrack) {
      return 0;
    }

    return this.getSceneDistance(this.journeyTrack.nativeElement, '.ballroom');
  }

  private setLayerTransform(section: HTMLElement, selector: string, x: number): void {
    const element = section.querySelector<HTMLElement>(selector);
    if (element) {
      element.style.transform = `translate3d(${x}px, 0, 0)`;
    }
  }

  private setCardState(
    section: HTMLElement,
    selector: string,
    visible: boolean,
    hiddenY: number,
  ): void {
    const element = section.querySelector<HTMLElement>(selector);
    if (!element) {
      return;
    }

    element.style.opacity = visible ? '1' : '0';
    element.style.visibility = visible ? 'visible' : 'hidden';
    element.style.transform = visible
      ? 'translateX(-50%) translateY(0)'
      : `translateX(-50%) translateY(${hiddenY}px)`;
  }

  private setAlpha(section: HTMLElement, selector: string, opacity: number): void {
    const element = section.querySelector<HTMLElement>(selector);
    if (!element) {
      return;
    }

    element.style.opacity = `${opacity}`;
    element.style.visibility = opacity > 0 ? 'visible' : 'hidden';
  }

  private getSceneDistance(track: HTMLElement, selector: string, focusOffsetRem = 0): number {
    const target = track.querySelector<HTMLElement>(selector);
    const rem = Number.parseFloat(getComputedStyle(this.document.documentElement).fontSize) || 16;

    if (!target) {
      return track.scrollWidth - window.innerWidth;
    }

    const targetCenter = target.offsetLeft + target.offsetWidth / 2;
    const focusCenter = window.innerWidth / 2 + focusOffsetRem * rem;
    return Math.max(0, targetCenter - focusCenter);
  }

  private clampProgress(value: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }

    return Math.min(1, Math.max(0, value));
  }

  private trustedMap(query: string) {
    return this.sanitizer.bypassSecurityTrustResourceUrl(
      `https://maps.google.com/maps?q=${encodeURIComponent(query)}&output=embed`,
    );
  }

  private registerDevSeed(): void {
    const seedWindow = window as SeedWindow;

    seedWindow.seedDemoInvitation = async () => {
      if (!this.invitationService.isRemoteEnabled()) {
        console.warn('Firebase no esta configurado todavia.');
        return;
      }

      const demoInvitation = createDemoInvitation('demo-cuento');
      await this.invitationService.upsertInvitation(demoInvitation);
      console.info('Se creo o actualizo invitations/demo-cuento en Firestore.');
    };
  }

  private async loadInvitation(): Promise<void> {
    const token = this.readToken();

    try {
      this.invitation = await this.invitationService.getInvitationByToken(token);
      this.rsvp = buildRsvpDraft(this.invitation);
      this.guestWish = {
        message: this.invitation.message,
        song: this.invitation.song,
      };

      if (!this.invitationService.isRemoteEnabled()) {
        this.invitationError =
          'Firebase todavia no esta configurado. Se esta mostrando la invitacion demo.';
      }
    } catch (error) {
      this.invitation = createDemoInvitation(token);
      this.rsvp = buildRsvpDraft(this.invitation);
      this.guestWish = {
        message: this.invitation.message,
        song: this.invitation.song,
      };
      this.invitationError =
        'No pudimos cargar la invitacion desde Firebase. Se dejo activo el modo demo.';
      console.error(error);
    } finally {
      this.isLoadingInvitation = false;
    }
  }

  private async hashValue(value: string): Promise<string> {
    const encoder = new TextEncoder();
    const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(value));
    return Array.from(new Uint8Array(buffer))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  private readToken(): string {
    return this.isAdminRoute ? 'demo-cuento' : this.routeSegment || 'demo-cuento';
  }

  private readRouteSegment(): string {
    const segments = window.location.pathname
      .split('/')
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 0);

    if (segments[0] === this.githubPagesBaseSegment) {
      return segments[1] ?? '';
    }

    return segments[0] ?? '';
  }

  setAdminTab(tab: AdminTab): void {
    this.activeAdminTab = tab;
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
    return normalizedSearch.length === 0 ||
      invitation.displayName.toLowerCase().includes(normalizedSearch) ||
      invitation.token.toLowerCase().includes(normalizedSearch) ||
      invitation.guests.some((guest) => guest.name.toLowerCase().includes(normalizedSearch));
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

  private filterTextEntries(entries: AdminTextEntry[]): AdminTextEntry[] {
    const normalizedSearch = this.adminSearchTerm.trim().toLowerCase();
    return entries.filter((entry) =>
      normalizedSearch.length === 0 ||
      entry.displayName.toLowerCase().includes(normalizedSearch) ||
      entry.token.toLowerCase().includes(normalizedSearch) ||
      entry.value.toLowerCase().includes(normalizedSearch),
    );
  }
}
