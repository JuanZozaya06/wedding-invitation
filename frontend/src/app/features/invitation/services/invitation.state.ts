import { inject, Injectable } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import {
  CommercialApiService,
  WeddingDetails,
} from '../../../core/http/commercial-api.service';
import {
  InvitationService,
  InvitationNotFoundError,
} from './invitation.service';
import {
  Invitation,
  Guest,
  GuestWish,
  RsvpDraft,
} from '../models/invitation.model';
import { DomSanitizer } from '@angular/platform-browser';
import {
  buildRsvpDraft,
  createEmptyInvitation,
} from '../models/invitation-draft';
@Injectable()
export class InvitationState {
  private readonly document = inject(DOCUMENT);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly invitationService = inject(InvitationService);
  private loadVersion = 0;
  reset() {
    this.isLoadingInvitation = true;
    this.isOpen = false;
    this.missingInvitation = false;
    this.wedding = null;
    this.invitation = createEmptyInvitation();
    this.rsvp = buildRsvpDraft(this.invitation);
    this.guestWish = { message: '', song: '' };
    this.submitted = false;
    this.wishSubmitted = false;
    this.rsvpError = '';
    this.wishError = '';
  }
  destroy() {
    ++this.loadVersion;
  }
  readonly commercialApi = inject(CommercialApiService);

  readonly commercial = this.commercialApi.enabled;

  wedding: WeddingDetails | null = null;

  get coupleNames(): string {
    return this.wedding
      ? `${this.wedding.partnerOne} & ${this.wedding.partnerTwo}`
      : this.commercial
        ? 'Nuestra boda'
        : 'Gabriela & Juan';
  }

  get monogram(): string {
    return this.wedding
      ? `${this.wedding.partnerOne[0]}&${this.wedding.partnerTwo[0]}`
      : this.commercial
        ? '♡'
        : 'G&J';
  }

  get weddingDate(): string {
    const date = this.wedding?.events.find(
      (e) => e.kind === 'ceremony',
    )?.startsAt;
    return date
      ? new Intl.DateTimeFormat('es', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          timeZone: this.wedding!.timezone,
        }).format(new Date(date))
      : this.commercial
        ? ''
        : '28 de noviembre de 2026';
  }

  missingInvitation = false;

  notFoundTitle = 'Bienvenidos a nuestra boda';

  notFoundMessage =
    'Para ver la invitaci\u00f3n necesitamos el c\u00f3digo que les enviamos.';

  invitationAccessCode = '';

  invitation: Invitation = createEmptyInvitation('');

  readonly ceremony = {
    name: 'Iglesia Colegio María Auxiliadora - (Capilla del colegio)',
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

  rsvp: RsvpDraft = buildRsvpDraft(this.invitation);

  guestWish: GuestWish = {
    message: '',
    song: '',
  };

  rsvpSaving = false;

  wishSaving = false;

  rsvpError = '';

  wishError = '';

  get confirmedGuests(): Guest[] {
    return this.rsvp.guests.filter((guest) => guest.attending);
  }

  get primaryGuest(): Guest | undefined {
    return (
      this.invitation.guests.find((guest) => guest.role === 'primary') ??
      this.invitation.guests[0]
    );
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
    const childCount = this.invitation.guests.filter(
      (guest) => guest.isChild,
    ).length;

    if (childCount > 0) {
      return childCount;
    }

    return this.invitation.hasChildren ? 1 : 0;
  }

  get abroadGuestCount(): number {
    const abroadCount = this.invitation.guests.filter(
      (guest) => guest.isAbroad,
    ).length;

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

  get invitationIntroCopy(): string {
    return this.isSingleInvitation
      ? 'Nos encantar\u00eda que nos acompa\u00f1es en el inicio de esta nueva aventura.'
      : 'Nos encantar\u00eda que nos acompa\u00f1en en el inicio de esta nueva aventura.';
  }

  get invitationBodyCopy(): string {
    return `${this.invitationSeatsCopy}${this.invitationChildrenCopy}${this.invitationAbroadCopy}`;
  }

  get storyBridgeTitle(): string {
    return 'Érase una vez...';
  }

  get wishTitle(): string {
    return this.isSingleInvitation
      ? 'D\u00e9janos un recuerdo'
      : 'D\u00e9jennos un recuerdo';
  }

  get wishBodyCopy(): string {
    return this.isSingleInvitation
      ? 'Si quieres, puedes enviarnos un mensaje o recomendar una canci\u00f3n para celebrar juntos.'
      : 'Si quieren, pueden enviarnos un mensaje o recomendar una canci\u00f3n para celebrar juntos.';
  }

  get rsvpTitle(): string {
    return this.isSingleInvitation
      ? 'Confirma tu asistencia'
      : 'Confirmen su asistencia';
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

  get dressCodeCopy(): string {
    return 'Formal elegante. Hombres: corbata. Mujeres: vestidos largos o midi. Si van a usar tacones, les recomendamos traer un par m\u00e1s c\u00f3modo para despu\u00e9s, ya que parte del evento ser\u00e1 sobre grama y queremos que disfruten la noche al m\u00e1ximo. Los colores blanco, beige y dorado est\u00e1n reservados para la novia. Lila y azul marino est\u00e1n reservados para el cortejo.';
  }

  get arrivalCopy(): string {
    return this.isSingleInvitation
      ? 'Te recomendamos llegar con tiempo y ser muy puntual para no perderte ni un momento de la ceremonia. En la recepci\u00f3n contaremos con valet parking para que tu llegada sea mucho m\u00e1s c\u00f3moda.'
      : 'Les recomendamos llegar con tiempo y ser muy puntuales para no perderse ni un momento de la ceremonia. En la recepci\u00f3n contaremos con valet parking para que su llegada sea mucho m\u00e1s c\u00f3moda.';
  }

  get giftsCopy(): string {
    return this.isSingleInvitation
      ? 'Tu compa\u00f1\u00eda es lo m\u00e1s importante para nosotros, pero si deseas regalarnos algo, con mucho cari\u00f1o lo recibiremos por Zelle a banking.vanguard@gmail.com (principal) o ayesapalaciosr@hotmail.com. Tambi\u00e9n recibiremos efectivo con mucho agradecimiento.'
      : 'Su compa\u00f1\u00eda es lo m\u00e1s importante para nosotros, pero si desean regalarnos algo, con mucho cari\u00f1o lo recibiremos por Zelle a banking.vanguard@gmail.com (principal) o ayesapalaciosr@hotmail.com. Tambi\u00e9n recibiremos efectivo con mucho agradecimiento.';
  }

  get scheduleSummaryCopy(): string {
    return this.isSingleInvitation
      ? 'Estos son los lugares donde viviremos cada momento de la boda, para que puedas organizarte con calma y acompa\u00f1arnos en cada cap\u00edtulo. Tu presencia es muy importante para nosotros.'
      : 'Estos son los lugares donde viviremos cada momento de la boda, para que puedan organizarse con calma y acompa\u00f1arnos en cada cap\u00edtulo. Tu presencia es muy importante para nosotros.';
  }

  async submitRsvp(): Promise<void> {
    if (this.rsvpSaving) return;
    this.rsvpSaving = true;
    this.rsvpError = '';
    this.submitted = false;
    try {
      await this.invitationService.saveRsvp(this.invitation.token, this.rsvp);
      this.submitted = true;
    } catch (error) {
      this.rsvpError =
        error instanceof Error
          ? error.message
          : 'No pudimos guardar la respuesta.';
    } finally {
      this.rsvpSaving = false;
    }
  }

  async submitWish(): Promise<void> {
    if (this.wishSaving) return;
    this.wishSaving = true;
    this.wishError = '';
    this.wishSubmitted = false;
    try {
      await this.invitationService.saveGuestWish(
        this.invitation.token,
        this.guestWish,
      );
      this.wishSubmitted = true;
    } catch (error) {
      this.wishError =
        error instanceof Error
          ? error.message
          : 'No pudimos guardar el detalle.';
    } finally {
      this.wishSaving = false;
    }
  }

  private applyWedding(wedding: WeddingDetails): void {
    this.wedding = wedding;
    this.document.title = wedding.partnerOne + ' y ' + wedding.partnerTwo;
    for (const [kind, card] of [
      ['ceremony', this.ceremony],
      ['celebration', this.party],
    ] as const) {
      const event = wedding.events.find((e) => e.kind === kind);
      if (!event) {
        card.name = '';
        card.address = '';
        card.time = '';
        continue;
      }
      card.name = event.venue || event.name;
      card.address = event.address;
      card.time = event.startsAt
        ? new Intl.DateTimeFormat('es', {
            hour: 'numeric',
            minute: '2-digit',
            timeZone: wedding.timezone,
          }).format(new Date(event.startsAt))
        : '';
      card.embedUrl = this.trustedMap(event.venue + ' ' + event.address);
    }
  }

  private trustedMap(query: string) {
    return this.sanitizer.bypassSecurityTrustResourceUrl(
      `https://maps.google.com/maps?q=${encodeURIComponent(query)}&output=embed`,
    );
  }

  private applyInvitationNotFoundState(token: string): void {
    this.missingInvitation = true;
    this.notFoundTitle = 'No encontramos ese c\u00f3digo';
    this.notFoundMessage = `Revisa el c\u00f3digo que les enviamos o pídenos ayuda.`;
    this.invitationAccessCode = token;
  }
  async loadInvitation(token: string): Promise<void> {
    const version = ++this.loadVersion;
    this.reset();

    try {
      const invitation =
        await this.invitationService.getInvitationByToken(token);
      const wedding = await this.commercialApi.publicWedding(token);
      if (version !== this.loadVersion) return;
      this.invitation = invitation;
      this.applyWedding(wedding);
      this.rsvp = buildRsvpDraft(this.invitation);
      this.guestWish = {
        message: this.invitation.message,
        song: this.invitation.song,
      };
    } catch (error) {
      if (version !== this.loadVersion) return;
      if (error instanceof InvitationNotFoundError) {
        this.applyInvitationNotFoundState(token);
        return;
      }

      this.missingInvitation = true;
      this.notFoundTitle = 'No pudimos cargar la invitación';
      this.notFoundMessage =
        error instanceof Error
          ? error.message
          : 'Intenta nuevamente en unos segundos.';
      this.invitationAccessCode = token;
    } finally {
      if (version === this.loadVersion) this.isLoadingInvitation = false;
    }
  }
}
