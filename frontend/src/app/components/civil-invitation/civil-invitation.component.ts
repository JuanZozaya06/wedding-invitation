import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';

type CivilExperienceState =
  | 'intro'
  | 'transitioning'
  | 'paper'
  | 'revealing'
  | 'signing'
  | 'ready';

const CIVIL_TIMINGS = {
  musicStartSeconds: 1,
  whipDurationMs: 850,
  reducedWhipDurationMs: 350,
  paperSettleMs: 160,
  revealDurationMs: 2_050,
  revealDelaysMs: [0, 170, 410, 680, 910, 1_120, 1_330, 1_550] as const,
  gabrielaSignatureMs: 1_450,
  signaturePreludeMs: 650,
  signatureLabelStaggerMs: 120,
  signatureStaggerMs: 300,
  juanSignatureMs: 1_200,
  signatureSequenceMs: 2_350,
} as const;

@Component({
  selector: 'app-civil-invitation',
  standalone: true,
  templateUrl: './civil-invitation.component.html',
  styleUrl: './civil-invitation.component.scss',
})
export class CivilInvitationComponent
  implements OnInit, AfterViewInit, OnDestroy
{
  @ViewChild('introVideo') private introVideo?: ElementRef<HTMLVideoElement>;
  @ViewChild('backgroundAudio')
  private backgroundAudio?: ElementRef<HTMLAudioElement>;

  private readonly document = inject(DOCUMENT);
  private readonly timers = new Map<string, number>();
  private videoHasEnded = false;
  private scrollLocked = false;
  private previousBodyOverflow = '';
  private previousBodyOverscroll = '';
  private previousHtmlOverflow = '';
  private previousTitle = '';
  private musicPositioned = false;
  private musicStarted = false;
  private musicPausedByUser = false;
  private musicPlayPending = false;
  private destroyed = false;
  private videoAutoplayRetries = 0;

  readonly timings = CIVIL_TIMINGS;
  state: CivilExperienceState = 'intro';
  reduceMotion = false;
  musicPlaying = false;
  musicAvailable = true;

  private readonly resumeVideoAutoplay = () => {
    if (this.state === 'intro' && !this.document.hidden) {
      this.ensureVideoAutoplay();
    }
  };

  private readonly startMusicOnInteraction = (event: Event) => {
    // El toggle gestiona su propio clic: no iniciar y pausar en el mismo toque.
    if (
      event.target instanceof Element &&
      event.target.closest('.civil-audio-button')
    ) {
      return;
    }

    if (!this.musicStarted && !this.musicPausedByUser && this.musicAvailable) {
      const audio = this.backgroundAudio?.nativeElement;
      if (audio) {
        void this.playAudio(audio);
      }
    }
  };

  get musicToggleLabel(): string {
    return this.musicPlaying ? 'Pausar música' : 'Reproducir música';
  }

  ngOnInit(): void {
    this.reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    this.previousTitle = this.document.title;
    this.document.title = 'Boda civil — Gaby & Juan';
    this.lockScroll();
    window.scrollTo({ top: 0, behavior: 'auto' });
    this.document.addEventListener(
      'visibilitychange',
      this.resumeVideoAutoplay,
    );
    window.addEventListener('pageshow', this.resumeVideoAutoplay);
    window.addEventListener('pointerdown', this.resumeVideoAutoplay, {
      passive: true,
    });
    window.addEventListener('click', this.startMusicOnInteraction);
    window.addEventListener('keydown', this.startMusicOnInteraction);
  }

  ngAfterViewInit(): void {
    this.ensureVideoAutoplay();
    void this.tryStartBackgroundMusic();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.clearTimers();
    this.document.removeEventListener(
      'visibilitychange',
      this.resumeVideoAutoplay,
    );
    window.removeEventListener('pageshow', this.resumeVideoAutoplay);
    window.removeEventListener('pointerdown', this.resumeVideoAutoplay);
    this.removeMusicInteractionListeners();
    this.backgroundAudio?.nativeElement.pause();
    this.unlockScroll();
    this.document.title = this.previousTitle;
  }

  onVideoLoadedMetadata(): void {
    this.ensureVideoAutoplay();
  }

  onVideoCanPlay(): void {
    this.ensureVideoAutoplay();
  }

  onVideoPlay(): void {
    this.videoAutoplayRetries = 0;
    window.removeEventListener('pointerdown', this.resumeVideoAutoplay);
  }

  onVideoEnded(): void {
    this.videoHasEnded = true;
    this.startTransition();
  }

  onVideoError(): void {
    // No se revela el papel: la transición depende de que el video termine.
  }

  onMusicLoadedMetadata(): void {
    const audio = this.backgroundAudio?.nativeElement;
    if (audio) {
      this.prepareAudio(audio);
    }
    void this.tryStartBackgroundMusic();
  }

  onMusicCanPlay(): void {
    this.musicAvailable = true;
    void this.tryStartBackgroundMusic();
  }

  onMusicPlay(): void {
    this.musicPlaying = true;
    this.musicStarted = true;
    this.removeMusicInteractionListeners();
  }

  onMusicPause(): void {
    this.musicPlaying = false;
  }

  onMusicError(): void {
    this.musicAvailable = false;
    this.musicPlaying = false;
  }

  async toggleMusicPlayback(): Promise<void> {
    const audio = this.backgroundAudio?.nativeElement;
    if (!audio || !this.musicAvailable) {
      return;
    }

    if (audio.paused) {
      this.musicPausedByUser = false;
      await this.playAudio(audio);
      return;
    }

    this.musicPausedByUser = true;
    audio.pause();
  }

  private ensureVideoAutoplay(): void {
    const video = this.introVideo?.nativeElement;
    if (!video || this.state !== 'intro') {
      return;
    }

    // Safari/iOS necesita que estas propiedades existan antes de play().
    video.autoplay = true;
    video.defaultMuted = true;
    video.muted = true;
    video.playsInline = true;
    video.controls = false;

    if (!video.paused) {
      return;
    }

    void video.play().catch(() => {
      if (this.videoAutoplayRetries >= 3 || this.state !== 'intro') {
        return;
      }

      this.videoAutoplayRetries += 1;
      this.schedule(
        'video-autoplay-retry',
        () => this.ensureVideoAutoplay(),
        180 * this.videoAutoplayRetries,
      );
    });
  }

  private startTransition(): void {
    if (this.state !== 'intro' || !this.videoHasEnded) {
      return;
    }

    this.state = 'transitioning';

    this.schedule(
      'whip-complete',
      () => this.showPaper(),
      this.reduceMotion
        ? this.timings.reducedWhipDurationMs
        : this.timings.whipDurationMs,
    );
  }

  private showPaper(): void {
    this.state = 'paper';
    this.introVideo?.nativeElement.pause();

    this.schedule('paper-settle', () => {
      if (this.reduceMotion) {
        this.finishSequence();
        return;
      }

      this.state = 'revealing';
      this.schedule('reveal-complete', () => {
        this.state = 'signing';
      }, this.timings.revealDurationMs);
      this.schedule(
        'sequence-complete',
        () => this.finishSequence(),
        this.timings.revealDurationMs + this.timings.signatureSequenceMs,
      );
    }, this.timings.paperSettleMs);
  }

  private finishSequence(): void {
    this.state = 'ready';
  }

  private async tryStartBackgroundMusic(): Promise<void> {
    if (
      this.destroyed ||
      this.musicStarted ||
      this.musicPausedByUser ||
      !this.musicAvailable
    ) {
      return;
    }

    const audio = this.backgroundAudio?.nativeElement;
    if (!audio || audio.readyState < HTMLMediaElement.HAVE_METADATA) {
      return;
    }

    await this.playAudio(audio);
  }

  private prepareAudio(audio: HTMLAudioElement): void {
    audio.volume = 0.3;
    if (!this.musicPositioned && audio.readyState >= HTMLMediaElement.HAVE_METADATA) {
      audio.currentTime = this.timings.musicStartSeconds;
      this.musicPositioned = true;
    }
  }

  private async playAudio(audio: HTMLAudioElement): Promise<void> {
    if (this.destroyed || this.musicPlayPending) {
      return;
    }

    this.musicPlayPending = true;
    try {
      this.prepareAudio(audio);
      await audio.play();
      if (this.destroyed) {
        audio.pause();
      }
    } catch {
      if (!this.destroyed) {
        this.musicPlaying = !audio.paused;
      }
    } finally {
      this.musicPlayPending = false;
    }
  }

  private removeMusicInteractionListeners(): void {
    window.removeEventListener('click', this.startMusicOnInteraction);
    window.removeEventListener('keydown', this.startMusicOnInteraction);
  }

  private lockScroll(): void {
    if (this.scrollLocked) {
      return;
    }

    const body = this.document.body;
    const html = this.document.documentElement;
    this.previousBodyOverflow = body.style.overflow;
    this.previousBodyOverscroll = body.style.overscrollBehavior;
    this.previousHtmlOverflow = html.style.overflow;
    body.style.overflow = 'hidden';
    body.style.overscrollBehavior = 'none';
    html.style.overflow = 'hidden';
    this.scrollLocked = true;
  }

  private unlockScroll(): void {
    if (!this.scrollLocked) {
      return;
    }

    const body = this.document.body;
    const html = this.document.documentElement;
    body.style.overflow = this.previousBodyOverflow;
    body.style.overscrollBehavior = this.previousBodyOverscroll;
    html.style.overflow = this.previousHtmlOverflow;
    this.scrollLocked = false;
  }

  private schedule(name: string, callback: () => void, delayMs: number): void {
    this.clearTimer(name);
    const timer = window.setTimeout(() => {
      this.timers.delete(name);
      callback();
    }, delayMs);
    this.timers.set(name, timer);
  }

  private clearTimer(name: string): void {
    const timer = this.timers.get(name);
    if (timer === undefined) {
      return;
    }

    window.clearTimeout(timer);
    this.timers.delete(name);
  }

  private clearTimers(): void {
    this.timers.forEach((timer) => window.clearTimeout(timer));
    this.timers.clear();
  }
}
