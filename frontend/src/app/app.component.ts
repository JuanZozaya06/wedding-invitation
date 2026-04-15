import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';

type RsvpStatus = 'accepted' | 'declined';

type Invitation = {
  token: string;
  displayName: string;
  guests: Guest[];
};

type Guest = {
  id: number;
  name: string;
  attending: boolean;
};

type Rsvp = {
  status: RsvpStatus;
  guests: Guest[];
  notes: string;
};

type GuestWish = {
  message: string;
  song: string;
};

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements AfterViewInit, OnDestroy {
  @ViewChild('journeySection') private journeySection?: ElementRef<HTMLElement>;
  @ViewChild('journeyTrack') private journeyTrack?: ElementRef<HTMLElement>;

  private readonly document = inject(DOCUMENT);
  private readonly sanitizer = inject(DomSanitizer);
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

  readonly invitation: Invitation = {
    token: this.readToken(),
    displayName: 'Valentina Hernández',
    guests: [
      { id: 1, name: 'Valentina Hernández', attending: true },
      { id: 2, name: 'Acompañante', attending: false },
    ],
  };

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

  rsvp: Rsvp = {
    status: 'accepted',
    guests: this.invitation.guests.map((guest) => ({ ...guest })),
    notes: '',
  };

  guestWish: GuestWish = {
    message: '',
    song: '',
  };

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
    window.scrollTo({ top: openingScrollY, behavior: 'auto' });

    this.afterLayoutSettles(() => {
      window.scrollTo({ top: openingScrollY, behavior: 'auto' });
      this.setupJourneyAnimation();
    });
  }

  get confirmedGuests(): Guest[] {
    return this.rsvp.guests.filter((guest) => guest.attending);
  }

  submitRsvp(): void {
    this.submitted = true;
    console.table({
      token: this.invitation.token,
      status: this.rsvp.status,
      confirmedCount: this.confirmedGuests.length,
      attendeeNames: this.confirmedGuests.map((guest) => guest.name).join(', '),
      notes: this.rsvp.notes,
    });
  }

  submitWish(): void {
    this.wishSubmitted = true;
    console.table({
      token: this.invitation.token,
      message: this.guestWish.message,
      song: this.guestWish.song,
    });
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

    this.setCardState(section, '.ceremony-card', progress >= ceremonyIn && progress < ceremonyOut, progress < ceremonyIn ? 28 : -20);
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

  private setCardState(section: HTMLElement, selector: string, visible: boolean, hiddenY: number): void {
    const element = section.querySelector<HTMLElement>(selector);
    if (!element) {
      return;
    }

    element.style.opacity = visible ? '1' : '0';
    element.style.visibility = visible ? 'visible' : 'hidden';
    element.style.transform = visible ? 'translateX(-50%) translateY(0)' : `translateX(-50%) translateY(${hiddenY}px)`;
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

  private readToken(): string {
    const pathToken = window.location.pathname.replace(/^\/+/, '').split('/')[0];
    return pathToken || 'demo-cuento';
  }
}
