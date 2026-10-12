import { supportsAnimatedWebm } from '../../shared/animated-media';
import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  inject,
  ViewEncapsulation,
  DestroyRef,
} from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { InvitationService } from './services/invitation.service';
import { InvitationState } from './services/invitation.state';
import { NotFoundComponent } from '../not-found/not-found.component';
import { PolaroidComponent } from '../../shared/components/polaroid/polaroid.component';
import { JourneyComponent } from './components/journey/journey.component';
import { RsvpFormComponent } from './components/rsvp-form/rsvp-form.component';
import { WishFormComponent } from './components/wish-form/wish-form.component';
@Component({
  selector: 'app-invitation-page',
  standalone: true,
  imports: [
    CommonModule,
    NotFoundComponent,
    PolaroidComponent,
    JourneyComponent,
    RsvpFormComponent,
    WishFormComponent,
  ],
  providers: [InvitationState],
  templateUrl: './invitation-page.component.html',
  styleUrl: './styles/invitation.scss',
  encapsulation: ViewEncapsulation.None,
})
export class InvitationPageComponent implements OnInit, OnDestroy {
  readonly vm = inject(InvitationState);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  private readonly invitationService = inject(InvitationService);
  private readonly previousTitle = this.document.title;
  readonly useVideoAnimations = supportsAnimatedWebm(this.document);
  ngOnInit() {
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        this.backgroundAudio?.nativeElement.pause();
        this.musicPlaying = false;
        void this.vm.loadInvitation(params.get('token') ?? '');
      });
  }
  ngOnDestroy() {
    this.vm.destroy();
    this.backgroundAudio?.nativeElement.pause();
    this.document.title = this.previousTitle;
  }
  openInvitation() {
    if (this.vm.isOpen) return;
    this.vm.isOpen = true;
    void this.invitationService
      .markInvitationOpened(this.vm.invitation.token)
      .catch(() => {});
    void this.tryStartBackgroundMusic();
  }
  private readonly backgroundAudioSrc = 'assets/audio/invitacion.mp3';

  @ViewChild('backgroundAudio')
  private backgroundAudio?: ElementRef<HTMLAudioElement>;

  musicPlaying = false;

  musicAvailable = true;

  get backgroundMusicSrc(): string {
    return this.backgroundAudioSrc;
  }

  get musicToggleLabel(): string {
    return this.musicPlaying ? 'Pausar m\u00fasica' : 'Reproducir m\u00fasica';
  }

  get introSceneVideoSrc(): string {
    return 'assets/characters/waving.webm';
  }

  get introSceneFallbackSrc(): string {
    return 'assets/characters/waving.gif';
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
}
