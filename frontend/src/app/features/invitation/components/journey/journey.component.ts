import { supportsAnimatedWebm } from '../../../../shared/animated-media';
import {
  Component,
  Input,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  inject,
} from '@angular/core';
import { DOCUMENT, CommonModule } from '@angular/common';
import { InvitationState } from '../../services/invitation.state';
type JourneySceneElements = {
  section: HTMLElement;
  track: HTMLElement;
  backdrop: HTMLElement | null;
  hillsFar: HTMLElement | null;
  hillsNear: HTMLElement | null;
  cloudOne: HTMLElement | null;
  cloudTwo: HTMLElement | null;
  cloudThree: HTMLElement | null;
  cloudFour: HTMLElement | null;
  trees: HTMLElement | null;
  road: HTMLElement | null;
  bride: HTMLElement | null;
  car: HTMLElement | null;
  dancing: HTMLElement | null;
};

@Component({
  selector: 'app-journey',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './journey.component.html',
  styleUrl: './journey.component.scss',
})
export class JourneyComponent implements AfterViewInit, OnDestroy {
  private readonly document = inject(DOCUMENT);
  @Input({ required: true }) ceremony!: InvitationState['ceremony'];
  @Input({ required: true }) party!: InvitationState['party'];
  @ViewChild('journeySection') private journeySection?: ElementRef<HTMLElement>;

  @ViewChild('journeyTrack') private journeyTrack?: ElementRef<HTMLElement>;

  get journeyBrideVideoSrc(): string {
    return 'assets/characters/gaby-walking.webm';
  }

  get journeyBrideFallbackSrc(): string {
    return 'assets/characters/gaby-walking.gif';
  }

  get journeyCarVideoSrc(): string {
    return 'assets/characters/car.webm';
  }

  get journeyCarFallbackSrc(): string {
    return 'assets/characters/car.gif';
  }

  get journeyDancingVideoSrc(): string {
    return 'assets/characters/dancing.webm';
  }

  get journeyDancingFallbackSrc(): string {
    return 'assets/characters/dancing.gif';
  }

  get showJourneyCar(): boolean {
    return true;
  }

  get showJourneyDancing(): boolean {
    return true;
  }

  get useVideoAnimations(): boolean {
    return this.videoAnimationsEnabled;
  }
  private destroyed = false;
  private deferredFrames = new Set<number>();
  private deferredTimers = new Set<number>();
  private assets?: AbortController;
  ngAfterViewInit() {
    this.syncViewportPreferences();
    this.afterLayoutSettles(() => this.setupJourneyAnimation());
  }
  ngOnDestroy() {
    this.destroyed = true;
    this.assets?.abort();
    window.removeEventListener('scroll', this.updateJourneyFromScroll);
    window.removeEventListener('resize', this.resizeJourney);
    window.cancelAnimationFrame(this.journeyAnimationFrame);
    this.deferredFrames.forEach((id) => cancelAnimationFrame(id));
    this.deferredTimers.forEach((id) => clearTimeout(id));
  }
  private readonly characterTransitionWindow = 0.02;

  private readonly celebrationTransitionWindow = 0.03;

  private reduceMotion = false;

  private mobilePerformanceMode = false;

  private videoAnimationsEnabled = true;

  private journeyReady = false;

  private journeyScrollLength = 0;

  private journeyAnimationFrame = 0;

  private journeySectionTop = 0;

  private journeyDistance = 0;

  private churchTime = 0;

  private ballroomTime = 0;

  private journeyElements?: JourneySceneElements;

  private lastTrackX = Number.NaN;

  private lastBackdropX = Number.NaN;

  private lastHillsFarX = Number.NaN;

  private lastHillsNearX = Number.NaN;

  private lastCloudOneX = Number.NaN;

  private lastCloudTwoX = Number.NaN;

  private lastCloudThreeX = Number.NaN;

  private lastCloudFourX = Number.NaN;

  private lastTreesX = Number.NaN;

  private lastRoadX = Number.NaN;

  private lastBrideOpacity = Number.NaN;

  private lastCarOpacity = Number.NaN;

  private lastDancingOpacity = Number.NaN;

  private readonly journeyTravelEnd = 0.84;

  private readonly updateJourneyFromScroll = () => this.requestJourneyUpdate();

  private readonly resizeJourney = () => {
    this.syncViewportPreferences();
    this.layoutJourney();
    this.requestJourneyUpdate();
  };

  setupJourneyAnimation(): void {
    if (
      this.reduceMotion ||
      !this.journeySection ||
      !this.journeyTrack ||
      this.journeyReady
    ) {
      return;
    }

    this.journeyElements = this.collectJourneyElements();
    this.journeyReady = true;
    this.layoutJourney();
    this.requestJourneyUpdate();
    window.addEventListener('scroll', this.updateJourneyFromScroll, {
      passive: true,
    });
    window.addEventListener('resize', this.resizeJourney, { passive: true });
    this.refreshAfterEmbeddedAssets(this.journeySection.nativeElement);
  }

  private afterLayoutSettles(callback: () => void): void {
    const frame = (next: () => void) => {
      const id = requestAnimationFrame(() => {
        this.deferredFrames.delete(id);
        if (!this.destroyed) next();
      });
      this.deferredFrames.add(id);
    };
    frame(() =>
      frame(() => {
        const id = window.setTimeout(() => {
          this.deferredTimers.delete(id);
          if (!this.destroyed) callback();
        }, 80);
        this.deferredTimers.add(id);
      }),
    );
  }

  private refreshAfterEmbeddedAssets(section: HTMLElement): void {
    this.assets = new AbortController();
    section.querySelectorAll('img, iframe, video').forEach((asset) => {
      asset.addEventListener('load', this.resizeJourney, {
        once: true,
        signal: this.assets!.signal,
      });
      asset.addEventListener('loadedmetadata', this.resizeJourney, {
        once: true,
        signal: this.assets!.signal,
      });
    });
  }

  private layoutJourney(): void {
    if (!this.journeyElements) {
      return;
    }

    this.journeySectionTop =
      this.journeyElements.section.getBoundingClientRect().top + window.scrollY;
    this.journeyDistance = this.getJourneyDistance();
    this.churchTime =
      this.progressForLandmark('.church') * this.journeyTravelEnd;
    this.ballroomTime =
      this.progressForLandmark('.ballroom') * this.journeyTravelEnd;

    const scrollMultiplier = this.mobilePerformanceMode ? 1.95 : 2.55;
    const minimumScrollLength = this.mobilePerformanceMode ? 2600 : 4200;

    this.journeyScrollLength = Math.max(
      this.journeyDistance * scrollMultiplier,
      minimumScrollLength,
    );
    this.journeyElements.section.style.height = `${this.journeyScrollLength + window.innerHeight}px`;
  }

  private requestJourneyUpdate(): void {
    if (this.destroyed || this.journeyAnimationFrame) {
      return;
    }

    this.journeyAnimationFrame = window.requestAnimationFrame(() => {
      this.journeyAnimationFrame = 0;
      if (!this.destroyed) this.updateJourney();
    });
  }

  private updateJourney(): void {
    if (!this.journeyElements || !this.journeyReady) {
      return;
    }

    const { track } = this.journeyElements;
    const rawProgress =
      (window.scrollY - this.journeySectionTop) / this.journeyScrollLength;
    const progress = this.clampProgress(rawProgress);
    const travelProgress = this.clampProgress(progress / this.journeyTravelEnd);
    const trackX = -this.journeyDistance * travelProgress;

    this.setTransformX(track, trackX, 'lastTrackX');
    this.setParallaxTransform(
      this.journeyElements.backdrop,
      trackX,
      0.012,
      'lastBackdropX',
    );
    this.setParallaxTransform(
      this.journeyElements.hillsFar,
      trackX,
      0.28,
      'lastHillsFarX',
    );
    this.setParallaxTransform(
      this.journeyElements.hillsNear,
      trackX,
      0.46,
      'lastHillsNearX',
    );
    this.setViewportParallaxTransform(
      this.journeyElements.cloudOne,
      trackX,
      0.006,
      'lastCloudOneX',
    );
    this.setViewportParallaxTransform(
      this.journeyElements.cloudTwo,
      trackX,
      0.018,
      'lastCloudTwoX',
    );
    this.setViewportParallaxTransform(
      this.journeyElements.cloudThree,
      trackX,
      0.032,
      'lastCloudThreeX',
    );
    this.setViewportParallaxTransform(
      this.journeyElements.cloudFour,
      trackX,
      0.025,
      'lastCloudFourX',
    );

    if (!this.mobilePerformanceMode) {
      this.setParallaxTransform(
        this.journeyElements.trees,
        trackX,
        0.7,
        'lastTreesX',
      );
      this.setParallaxTransform(
        this.journeyElements.road,
        trackX,
        0.9,
        'lastRoadX',
      );
    }

    const carIn = Math.min(
      this.journeyTravelEnd - 0.14,
      this.churchTime + 0.02,
    );
    const transitionStart = Math.max(0, carIn - this.characterTransitionWindow);
    const transitionEnd = Math.min(
      this.journeyTravelEnd,
      carIn + this.characterTransitionWindow,
    );
    const carVisibility = this.getTransitionProgress(
      progress,
      transitionStart,
      transitionEnd,
    );
    const danceIn = Math.max(this.ballroomTime, this.journeyTravelEnd);
    const danceStart = Math.max(
      carIn,
      danceIn - this.celebrationTransitionWindow,
    );
    const danceEnd = Math.min(1, danceIn + this.celebrationTransitionWindow);
    const danceVisibility = this.getTransitionProgress(
      progress,
      danceStart,
      danceEnd,
    );

    this.setAlpha(
      this.journeyElements.bride,
      1 - carVisibility,
      'lastBrideOpacity',
    );
    this.setAlpha(
      this.journeyElements.car,
      carVisibility * (1 - danceVisibility),
      'lastCarOpacity',
    );
    this.setAlpha(
      this.journeyElements.dancing,
      danceVisibility,
      'lastDancingOpacity',
    );
  }

  private getJourneyDistance(): number {
    if (!this.journeyElements) {
      return 0;
    }

    return this.getSceneDistance(this.journeyElements.track, '.ballroom');
  }

  private setParallaxTransform(
    element: HTMLElement | null,
    trackX: number,
    ratio: number,
    cacheKey:
      | 'lastBackdropX'
      | 'lastHillsFarX'
      | 'lastHillsNearX'
      | 'lastTreesX'
      | 'lastRoadX',
  ): void {
    if (!element) {
      return;
    }

    const normalizedRatio = Math.min(1, Math.max(0, ratio));
    const offsetX = trackX * (normalizedRatio - 1);
    this.setTransformX(element, offsetX, cacheKey);
  }

  private setViewportParallaxTransform(
    element: HTMLElement | null,
    trackX: number,
    ratio: number,
    cacheKey:
      | 'lastCloudOneX'
      | 'lastCloudTwoX'
      | 'lastCloudThreeX'
      | 'lastCloudFourX',
  ): void {
    if (!element) {
      return;
    }

    const normalizedRatio = Math.min(0.05, Math.max(0, ratio));
    this.setTransformX(element, trackX * normalizedRatio, cacheKey);
  }

  private setAlpha(
    element: HTMLElement | null,
    opacity: number,
    cacheKey: 'lastBrideOpacity' | 'lastCarOpacity' | 'lastDancingOpacity',
  ): void {
    if (!element) {
      return;
    }

    const normalizedOpacity =
      Math.round(this.clampProgress(opacity) * 1000) / 1000;

    if (this[cacheKey] === normalizedOpacity) {
      return;
    }

    this[cacheKey] = normalizedOpacity;
    element.style.opacity = `${normalizedOpacity}`;
    element.style.visibility = normalizedOpacity > 0.001 ? 'visible' : 'hidden';
  }

  private setTransformX(
    element: HTMLElement,
    offsetX: number,
    cacheKey:
      | 'lastTrackX'
      | 'lastBackdropX'
      | 'lastHillsFarX'
      | 'lastHillsNearX'
      | 'lastCloudOneX'
      | 'lastCloudTwoX'
      | 'lastCloudThreeX'
      | 'lastCloudFourX'
      | 'lastTreesX'
      | 'lastRoadX',
  ): void {
    const roundedOffset = Math.round(offsetX * 10) / 10;

    if (this[cacheKey] === roundedOffset) {
      return;
    }

    this[cacheKey] = roundedOffset;
    element.style.transform = `translate3d(${roundedOffset}px, 0, 0)`;
  }

  private progressForLandmark(selector: string): number {
    if (!this.journeyElements) {
      return 0;
    }

    return this.clampProgress(
      this.getSceneDistance(this.journeyElements.track, selector) /
        Math.max(this.journeyDistance, 1),
    );
  }

  private collectJourneyElements(): JourneySceneElements {
    const section = this.journeySection!.nativeElement;
    const track = this.journeyTrack!.nativeElement;

    return {
      section,
      track,
      backdrop: section.querySelector<HTMLElement>('.avila-backdrop'),
      hillsFar: section.querySelector<HTMLElement>('.hills.far'),
      hillsNear: section.querySelector<HTMLElement>('.hills.near'),
      cloudOne: section.querySelector<HTMLElement>('.journey-cloud-one'),
      cloudTwo: section.querySelector<HTMLElement>('.journey-cloud-two'),
      cloudThree: section.querySelector<HTMLElement>('.journey-cloud-three'),
      cloudFour: section.querySelector<HTMLElement>('.journey-cloud-four'),
      trees: section.querySelector<HTMLElement>('.trees'),
      road: section.querySelector<HTMLElement>('.road'),
      bride: section.querySelector<HTMLElement>('.journey-bride'),
      car: section.querySelector<HTMLElement>('.vintage-car'),
      dancing: section.querySelector<HTMLElement>('.journey-dancing'),
    };
  }

  private syncViewportPreferences(): void {
    this.reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    this.mobilePerformanceMode = window.matchMedia(
      '(max-width: 860px), (pointer: coarse)',
    ).matches;
    this.videoAnimationsEnabled = supportsAnimatedWebm(this.document);
  }

  private getSceneDistance(
    track: HTMLElement,
    selector: string,
    focusOffsetRem = 0,
  ): number {
    const target = track.querySelector<HTMLElement>(selector);
    const rem =
      Number.parseFloat(
        getComputedStyle(this.document.documentElement).fontSize,
      ) || 16;

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

  private getTransitionProgress(
    value: number,
    start: number,
    end: number,
  ): number {
    if (end <= start) {
      return value >= end ? 1 : 0;
    }

    return this.clampProgress((value - start) / (end - start));
  }
}
