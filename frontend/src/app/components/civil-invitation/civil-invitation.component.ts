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
  | 'loading'
  | 'loading-out'
  | 'intro'
  | 'transitioning'
  | 'paper'
  | 'revealing'
  | 'signing'
  | 'ready';

const CIVIL_TIMINGS = {
  loadingMinimumMs: 2_000,
  loadingFadeMs: 550,
  loadingHelpMs: 8_000,
  musicStartSeconds: 1,
  videoStartupCheckMs: 2_500,
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
  private musicPlayAttempt = 0;
  private destroyed = false;
  private videoAutoplayRetries = 0;

  readonly timings = CIVIL_TIMINGS;
  state: CivilExperienceState = 'loading';
  loadingMinimumElapsed = false;
  reduceMotion = false;
  musicPlaying = false;
  musicAvailable = true;
  videoNeedsInteraction = false;
  videoLoadFailed = false;

  private readonly resumeVideoAutoplay = () => {
    if (this.state === 'intro' && !this.document.hidden) {
      this.ensureVideoAutoplay();
    }
  };

  private readonly onPageShow = (event: PageTransitionEvent) => {
    this.resumeVideoAutoplay();
    if (event.persisted) {
      // Safari puede restaurar la misma instancia al volver con Atrás.
      // Cada visita empieza con música habilitada, sin conservar la pausa.
      this.startMusicForVisit();
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
    window.addEventListener('pageshow', this.onPageShow);
  }

  ngAfterViewInit(): void {
    this.startMusicForVisit();
    this.schedule('loading-minimum', () => {
      this.loadingMinimumElapsed = true;
      this.finishLoadingWhenReady();
    }, this.timings.loadingMinimumMs);
    this.schedule('loading-help', () => {
      if (this.state === 'loading') {
        this.videoNeedsInteraction = true;
      }
    }, this.timings.loadingHelpMs);
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.clearTimers();
    this.document.removeEventListener(
      'visibilitychange',
      this.resumeVideoAutoplay,
    );
    window.removeEventListener('pageshow', this.onPageShow);
    this.introVideo?.nativeElement.pause();
    this.backgroundAudio?.nativeElement.pause();
    this.unlockScroll();
    this.document.title = this.previousTitle;
  }

  onVideoLoadedMetadata(): void {
    this.onVideoCanPlay();
  }

  onVideoCanPlay(): void {
    this.finishLoadingWhenReady();
    this.ensureVideoAutoplay();
  }

  private finishLoadingWhenReady(): void {
    const video = this.introVideo?.nativeElement;
    if (
      this.destroyed || this.state !== 'loading' ||
      !this.loadingMinimumElapsed || !video ||
      video.readyState < HTMLMediaElement.HAVE_FUTURE_DATA || video.error
    ) {
      return;
    }

    this.clearTimer('loading-help');
    this.videoNeedsInteraction = false;
    this.videoLoadFailed = false;
    this.state = 'loading-out';
    this.schedule('loading-fade', () => {
      this.state = 'intro';
      this.ensureVideoAutoplay();
      this.schedule('video-startup-check', () => {
        if (!this.document.hidden && this.state === 'intro' && video.paused) {
          this.videoNeedsInteraction = true;
        }
      }, this.timings.videoStartupCheckMs);
    }, this.reduceMotion ? 0 : this.timings.loadingFadeMs);
  }

  onVideoPlay(): void {
    if (this.destroyed) {
      return;
    }
    this.videoAutoplayRetries = 0;
    this.videoNeedsInteraction = false;
    this.videoLoadFailed = false;
    this.clearTimer('video-startup-check');
    this.clearTimer('video-autoplay-retry');
  }

  onVideoPause(): void {
    if (!this.destroyed && this.state === 'intro' && !this.videoHasEnded) {
      this.videoNeedsInteraction = true;
    }
  }

  onVideoEnded(): void {
    if (this.destroyed || !this.introVideo?.nativeElement.ended) {
      return;
    }
    this.videoHasEnded = true;
    this.startTransition();
  }

  onVideoError(): void {
    if (!this.destroyed) {
      this.videoLoadFailed = true;
      this.videoNeedsInteraction = true;
    }
  }

  onInvitationInteraction(event: Event): void {
    if (
      event.target instanceof Element &&
      event.target.closest('button')
    ) {
      return;
    }
    this.startMediaFromGesture();
  }

  startMediaFromGesture(): void {
    const video = this.introVideo?.nativeElement;
    if (video && (this.state === 'intro' || this.state === 'loading') && this.videoLoadFailed) {
      this.videoLoadFailed = false;
      video.load();
    }
    // Ambas llamadas a play() ocurren dentro del mismo clic, sin await previo.
    this.ensureVideoAutoplay(true);
    const audio = this.backgroundAudio?.nativeElement;
    if (audio && !this.musicStarted && !this.musicPausedByUser && this.musicAvailable) {
      void this.playAudio(audio, true);
    }
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
    if (this.destroyed) {
      return;
    }
    this.musicPlaying = true;
    this.musicStarted = true;
  }

  onMusicPause(): void {
    this.musicPlaying = false;
  }

  onMusicError(): void {
    this.musicAvailable = false;
    this.musicPlaying = false;
  }

  async toggleMusicPlayback(): Promise<void> {
    // El botón de música también desbloquea el video si Safari lo detuvo.
    this.ensureVideoAutoplay();
    const audio = this.backgroundAudio?.nativeElement;
    if (!audio || !this.musicAvailable) {
      return;
    }

    if (audio.paused) {
      this.musicPausedByUser = false;
      await this.playAudio(audio, true);
      return;
    }

    this.musicPausedByUser = true;
    audio.pause();
  }

  private ensureVideoAutoplay(fromGesture = false): void {
    const video = this.introVideo?.nativeElement;
    // Si Safari no precarga, un toque real puede desbloquear la carga, pero
    // nunca acorta los dos segundos mínimos de la pantalla inicial.
    const canUnlockLoading = fromGesture && this.state === 'loading' &&
      this.loadingMinimumElapsed && this.videoNeedsInteraction;
    if (this.destroyed || !video || (this.state !== 'intro' && !canUnlockLoading) || video.ended) {
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

    void video.play().then(() => {
      if (this.destroyed) {
        video.pause();
      }
    }).catch((error: unknown) => {
      if (this.destroyed || (this.state !== 'intro' && this.state !== 'loading') || !video.paused) {
        return;
      }
      this.videoNeedsInteraction = true;
      // Repetir con timers no concede el permiso que requiere un clic real.
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        return;
      }
      if (this.videoAutoplayRetries >= 3) {
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

  private startMusicForVisit(): void {
    if (this.destroyed) {
      return;
    }
    this.musicPausedByUser = false;
    this.musicStarted = false;
    this.musicPositioned = false;
    this.musicPlayPending = false;
    // Invalida resultados de intentos anteriores a la restauración.
    this.musicPlayAttempt += 1;
    void this.tryStartBackgroundMusic();
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
    if (!audio) {
      return;
    }

    await this.playAudio(audio);
  }

  private prepareAudio(audio: HTMLAudioElement): void {
    audio.defaultMuted = false;
    audio.muted = false;
    audio.volume = 0.3;
    if (!this.musicPositioned && audio.readyState >= HTMLMediaElement.HAVE_METADATA) {
      try {
        audio.currentTime = this.timings.musicStartSeconds;
        this.musicPositioned = true;
      } catch {
        // Safari puede rechazar el seek hasta cargar datos; no impedir play().
      }
    }
  }

  private async playAudio(audio: HTMLAudioElement, fromGesture = false): Promise<void> {
    if (this.destroyed || (this.musicPlayPending && !fromGesture)) {
      return;
    }

    this.musicPlayPending = true;
    const attempt = ++this.musicPlayAttempt;
    try {
      this.prepareAudio(audio);
      await audio.play();
      if (this.destroyed) {
        audio.pause();
      }
    } catch {
      if (!this.destroyed && attempt === this.musicPlayAttempt) {
        this.musicPlaying = !audio.paused;
      }
    } finally {
      if (attempt === this.musicPlayAttempt) {
        this.musicPlayPending = false;
      }
    }
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
