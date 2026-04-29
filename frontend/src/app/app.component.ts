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
import { InvitationNotFoundError, InvitationService } from './services/invitation.service';

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

type RouteResolution =
  | { kind: 'admin'; segment: 'admin' }
  | { kind: 'invitation'; segment: string }
  | { kind: 'not-found'; segment: ''; reason: 'missing-token' | 'invalid-route' };

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly githubPagesBaseSegment = 'wedding-invitation';
  private readonly backgroundAudioSrc = 'assets/audio/invitacion.mp3';
  @ViewChild('journeySection') private journeySection?: ElementRef<HTMLElement>;
  @ViewChild('journeyTrack') private journeyTrack?: ElementRef<HTMLElement>;
  @ViewChild('backgroundAudio') private backgroundAudio?: ElementRef<HTMLAudioElement>;

  private readonly document = inject(DOCUMENT);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly invitationService = inject(InvitationService);
  private readonly characterTransitionWindow = 0.02;
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

  readonly route = this.resolveRoute();
  readonly routeSegment = this.route.segment;
  readonly isAdminRoute = this.route.kind === 'admin';
  readonly isNotFoundRoute = this.route.kind === 'not-found';
  missingInvitation = false;
  notFoundTitle = 'Invitaci\u00f3n no encontrada';
  notFoundMessage =
    'Este enlace no existe o ya no est\u00e1 disponible. Si crees que es un error, pide nuevamente tu enlace privado.';

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
  musicPlaying = false;
  musicAvailable = true;
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

  get showNotFoundState(): boolean {
    return this.isNotFoundRoute || this.missingInvitation;
  }

  get backgroundMusicSrc(): string {
    return this.backgroundAudioSrc;
  }

  get musicToggleLabel(): string {
    return this.musicPlaying ? 'Pausar m\u00fasica' : 'Reproducir m\u00fasica';
  }

  async ngOnInit(): Promise<void> {
    this.registerDevSeed();

    if (this.isAdminRoute) {
      this.isLoadingInvitation = false;
      return;
    }

    if (this.isNotFoundRoute) {
      this.isLoadingInvitation = false;
      this.applyRouteNotFoundState();
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
    void this.tryStartBackgroundMusic();

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

  get invitationGuestCount(): number {
    if (this.invitation.guests.length > 0) {
      return this.invitation.guests.length;
    }

    const declaredCount = Number(this.invitation.guestCount);
    if (Number.isFinite(declaredCount) && declaredCount > 0) {
      return Math.floor(declaredCount);
    }

    return 0;
  }

  get isSingleInvitation(): boolean {
    return this.invitationGuestCount <= 1;
  }

  get childGuestCount(): number {
    const childCount = this.invitation.guests.filter((guest) => guest.isChild).length;

    if (childCount > 0) {
      return childCount;
    }

    return this.invitation.hasChildren ? 1 : 0;
  }

  get abroadGuestCount(): number {
    const abroadCount = this.invitation.guests.filter((guest) => guest.isAbroad).length;

    if (abroadCount > 0) {
      return abroadCount;
    }

    return this.invitation.hasAbroadGuests ? 1 : 0;
  }

  get invitationHasChildren(): boolean {
    return this.childGuestCount > 0;
  }

  get invitationHasAbroadGuests(): boolean {
    return this.abroadGuestCount > 0;
  }

  get coverEyebrow(): string {
    if (this.isSingleInvitation) {
      if (this.primaryGuest?.gender === 'female') {
        return 'Una invitada especial';
      }

      if (this.primaryGuest?.gender === 'male') {
        return 'Un invitado especial';
      }

      return 'Una persona muy especial';
    }

    return 'Una invitaci\u00f3n especial';
  }

  get parchmentGreeting(): string {
    if (!this.isSingleInvitation) {
      return `Queridos ${this.invitation.displayName}`;
    }

    if (!this.primaryGuest) {
      return `Hola ${this.invitation.displayName}`;
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
        return 'Est\u00e1s invitada a nuestra boda';
      }

      if (this.primaryGuest?.gender === 'male') {
        return 'Est\u00e1s invitado a nuestra boda';
      }

      return 'Tienes una invitaci\u00f3n para nuestra boda';
    }

    return 'Est\u00e1n invitados a nuestra boda';
  }

  get invitationSeatsCopy(): string {
    if (this.invitationGuestCount <= 0) {
      return 'Hemos reservado un lugar especial para ti.';
    }

    if (this.isSingleInvitation) {
      return 'Hemos reservado 1 cupo para ti.';
    }

    return `Hemos reservado ${this.invitationGuestCount} cupos para ustedes.`;
  }

  get invitationChildrenCopy(): string {
    if (this.childGuestCount === 0) {
      return '';
    }

    if (this.childGuestCount === 1) {
      return ' Nos hace mucha ilusi\u00f3n compartir este d\u00eda tambi\u00e9n con uno de los peque\u00f1os de la familia.';
    }

    return ' Nos hace mucha ilusi\u00f3n compartir este d\u00eda tambi\u00e9n con los peque\u00f1os de la familia.';
  }

  get invitationAbroadCopy(): string {
    if (this.abroadGuestCount === 0) {
      return '';
    }

    if (this.isSingleInvitation) {
      return ' Sabemos que vienes desde fuera del pa\u00eds, as\u00ed que iremos compartiendo detalles \u00fatiles para tu viaje.';
    }

    if (this.abroadGuestCount === 1) {
      return ' Sabemos que una de las personas invitadas viene desde fuera del pa\u00eds, as\u00ed que iremos compartiendo detalles \u00fatiles para facilitar el viaje.';
    }

    return ' Sabemos que algunas de las personas invitadas vienen desde fuera del pa\u00eds, as\u00ed que iremos compartiendo detalles \u00fatiles para facilitar el viaje.';
  }

  get invitationBodyCopy(): string {
    const base = this.isSingleInvitation
      ? 'Nos encantar\u00eda que nos acompa\u00f1es en el inicio de esta nueva aventura.'
      : 'Nos encantar\u00eda que nos acompa\u00f1en en el inicio de esta nueva aventura.';

    return `${base} ${this.invitationSeatsCopy}${this.invitationChildrenCopy}${this.invitationAbroadCopy}`;
  }

  get wishTitle(): string {
    return this.isSingleInvitation ? 'D\u00e9janos un recuerdo' : 'D\u00e9jennos un recuerdo';
  }

  get wishBodyCopy(): string {
    return this.isSingleInvitation
      ? 'Si quieres, puedes enviarnos un mensaje o recomendar una canci\u00f3n para celebrar juntos.'
      : 'Si quieren, pueden enviarnos un mensaje o recomendar una canci\u00f3n para celebrar juntos.';
  }

  get rsvpTitle(): string {
    return this.isSingleInvitation ? 'Confirma tu asistencia' : 'Confirmen su asistencia';
  }

  get rsvpBodyCopy(): string {
    return this.isSingleInvitation
      ? 'Puedes modificar esta respuesta luego usando el mismo enlace privado.'
      : 'Pueden modificar esta respuesta luego usando el mismo enlace privado.';
  }

  get guestSummaryCopy(): string {
    if (this.invitationGuestCount <= 0) {
      return 'sin invitados cargados';
    }

    if (this.isSingleInvitation) {
      return 'de 1 persona invitada';
    }

    return `de ${this.invitationGuestCount} personas invitadas`;
  }

  get finalClosingCopy(): string {
    return this.isSingleInvitation
      ? 'Con mucha ilusi\u00f3n, esperamos compartir este d\u00eda contigo.'
      : 'Con mucha ilusi\u00f3n, esperamos compartir este d\u00eda con ustedes.';
  }

  get dressCodeCopy(): string {
    return this.isSingleInvitation
      ? 'Nos encantar\u00e1 que vengas en formal elegante. Si el calzado incluye tacones, te recomendamos elegir unos c\u00f3modos porque parte del evento ser\u00e1 sobre grama y queremos que disfrutes la noche sin preocuparte por nada.'
      : 'Nos encantar\u00e1 que vengan en formal elegante. Si el calzado incluye tacones, les recomendamos elegir unos c\u00f3modos porque parte del evento ser\u00e1 sobre grama y queremos que disfruten la noche sin preocuparse por nada.';
  }

  get arrivalCopy(): string {
    return this.isSingleInvitation
      ? 'Te recomendamos llegar con tiempo y ser muy puntual para no perderte ni un momento de la ceremonia. En la recepci\u00f3n contaremos con valet parking para que tu llegada sea mucho m\u00e1s c\u00f3moda.'
      : 'Les recomendamos llegar con tiempo y ser muy puntuales para no perderse ni un momento de la ceremonia. En la recepci\u00f3n contaremos con valet parking para que su llegada sea mucho m\u00e1s c\u00f3moda.';
  }

  get giftsCopy(): string {
    return this.isSingleInvitation
      ? 'Tu compa\u00f1\u00eda es lo m\u00e1s importante para nosotros, pero si deseas regalarnos algo, con mucho cari\u00f1o recibiremos aportes por Zelle a banking.vanguard@gmail.com (principal) o ayesapalaciosr@hotmail.com. Tambi\u00e9n recibiremos efectivo con mucho agradecimiento.'
      : 'Su compa\u00f1\u00eda es lo m\u00e1s importante para nosotros, pero si desean regalarnos algo, con mucho cari\u00f1o recibiremos aportes por Zelle a banking.vanguard@gmail.com (principal) o ayesapalaciosr@hotmail.com. Tambi\u00e9n recibiremos efectivo con mucho agradecimiento.';
  }

  get scheduleSummaryCopy(): string {
    return this.isSingleInvitation
      ? 'Estos son los lugares donde viviremos cada momento de la boda, para que puedas organizarte con calma y acompa\u00f1arnos en cada cap\u00edtulo.'
      : 'Estos son los lugares donde viviremos cada momento de la boda, para que puedan organizarse con calma y acompa\u00f1arnos en cada cap\u00edtulo.';
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
        'No pudimos leer la colecci\u00f3n de invitaciones. Si usas frontend web, Firestore debe permitir list.';
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
    const carIn = Math.min(this.journeyTravelEnd - 0.14, churchTime + 0.02);
    const transitionStart = Math.max(0, carIn - this.characterTransitionWindow);
    const transitionEnd = Math.min(this.journeyTravelEnd, carIn + this.characterTransitionWindow);
    const carVisibility = this.getTransitionProgress(progress, transitionStart, transitionEnd);
    this.setAlpha(section, '.journey-bride', 1 - carVisibility);
    this.setAlpha(section, '.vintage-car', carVisibility);
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

  private getTransitionProgress(value: number, start: number, end: number): number {
    if (end <= start) {
      return value >= end ? 1 : 0;
    }

    return this.clampProgress((value - start) / (end - start));
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
      console.warn('Firebase no est\u00e1 configurado todav\u00eda.');
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
          'Firebase todav\u00eda no est\u00e1 configurado. Se est\u00e1 mostrando la invitaci\u00f3n demo.';
      }
    } catch (error) {
      if (error instanceof InvitationNotFoundError) {
        this.applyInvitationNotFoundState(token);
        return;
      }

      this.invitation = createDemoInvitation(token);
      this.rsvp = buildRsvpDraft(this.invitation);
      this.guestWish = {
        message: this.invitation.message,
        song: this.invitation.song,
      };
      this.invitationError =
        'No pudimos cargar la invitaci\u00f3n desde Firebase. Se dej\u00f3 activo el modo demo.';
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

  private resolveRoute(): RouteResolution {
    const segments = window.location.pathname
      .split('/')
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 0);

    const normalizedSegments =
      segments[0] === this.githubPagesBaseSegment ? segments.slice(1) : segments;

    if (normalizedSegments.length === 0) {
      return {
        kind: 'not-found',
        segment: '',
        reason: 'missing-token',
      };
    }

    if (normalizedSegments.length > 1) {
      return {
        kind: 'not-found',
        segment: '',
        reason: 'invalid-route',
      };
    }

    if (normalizedSegments[0] === 'admin') {
      return {
        kind: 'admin',
        segment: 'admin',
      };
    }

    return {
      kind: 'invitation',
      segment: normalizedSegments[0] ?? '',
    };
  }

  private applyRouteNotFoundState(): void {
    this.missingInvitation = true;
    const missingToken = this.route.kind === 'not-found' && this.route.reason === 'missing-token';
    this.notFoundTitle = 'Enlace no v\u00e1lido';
    this.notFoundMessage =
      missingToken
        ? 'Aqu\u00ed no hay una invitaci\u00f3n para mostrar. Entra usando tu enlace privado completo.'
        : 'La direcci\u00f3n que abriste no corresponde a una invitaci\u00f3n v\u00e1lida.';
  }

  private applyInvitationNotFoundState(token: string): void {
    this.missingInvitation = true;
    this.notFoundTitle = 'Invitaci\u00f3n no encontrada';
    this.notFoundMessage = `No encontramos una invitaci\u00f3n activa para el c\u00f3digo "${token}". Revisa el enlace o pide uno nuevo a los novios.`;
  }

  private async tryStartBackgroundMusic(): Promise<void> {
    if (!this.musicAvailable) {
      return;
    }

    const audio = this.backgroundAudio?.nativeElement;

    if (!audio) {
      return;
    }

    audio.volume = 0.35;
    await this.playAudio(audio);
  }

  private async playAudio(audio: HTMLAudioElement): Promise<void> {
    try {
      await audio.play();
      this.musicPlaying = true;
    } catch (error) {
      this.musicPlaying = false;
      console.warn('No se pudo iniciar la m\u00fasica de fondo.', error);
    }
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

  async toggleMusicPlayback(): Promise<void> {
    if (!this.musicAvailable) {
      return;
    }

    const audio = this.backgroundAudio?.nativeElement;

    if (!audio) {
      return;
    }

    if (audio.paused) {
      await this.playAudio(audio);
      return;
    }

    audio.pause();
    this.musicPlaying = false;
  }

  onMusicCanPlay(): void {
    const audio = this.backgroundAudio?.nativeElement;

    if (!audio) {
      return;
    }

    this.musicAvailable = true;
    audio.volume = 0.35;
  }

  onMusicPlay(): void {
    this.musicPlaying = true;
  }

  onMusicPause(): void {
    this.musicPlaying = false;
  }

  onMusicError(): void {
    this.musicAvailable = false;
    this.musicPlaying = false;
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
