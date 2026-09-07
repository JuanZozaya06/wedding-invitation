import { ComponentFixture, TestBed, fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import { CivilInvitationComponent } from './civil-invitation.component';

describe('CivilInvitationComponent media loading', () => {
  let fixture: ComponentFixture<CivilInvitationComponent>;
  let component: CivilInvitationComponent;
  let video: HTMLVideoElement;
  let audio: HTMLAudioElement;
  let videoReadyState: number;
  let videoEnded: boolean;
  let audioPaused: boolean;
  let audioReadyState: number;
  let videoPlay: jasmine.Spy;
  let audioPlay: jasmine.Spy;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [CivilInvitationComponent] });
    // No network media in timing tests; the actual template is checked in the browser.
    TestBed.overrideComponent(CivilInvitationComponent, {
      set: { template: '<video #introVideo></video><audio #backgroundAudio></audio>' },
    });
    fixture = TestBed.createComponent(CivilInvitationComponent);
    component = fixture.componentInstance;
    video = fixture.nativeElement.querySelector('video');
    audio = fixture.nativeElement.querySelector('audio');
    videoReadyState = HTMLMediaElement.HAVE_NOTHING;
    videoEnded = false;
    audioPaused = true;
    audioReadyState = HTMLMediaElement.HAVE_METADATA;
    spyOnProperty(video, 'readyState').and.callFake(() => videoReadyState);
    spyOnProperty(video, 'ended').and.callFake(() => videoEnded);
    spyOnProperty(audio, 'readyState').and.callFake(() => audioReadyState);
    spyOnProperty(audio, 'paused').and.callFake(() => audioPaused);
    videoPlay = spyOn(video, 'play').and.returnValue(Promise.resolve());
    audioPlay = spyOn(audio, 'play').and.returnValue(Promise.resolve());
    spyOn(video, 'pause');
    spyOn(audio, 'pause').and.callFake(() => { audioPaused = true; });
    spyOn(video, 'load');
  });

  afterEach(() => fixture.destroy());

  function start(): void {
    fixture.detectChanges();
    component.reduceMotion = false;
  }

  it('holds the first frame for the configured minimum even if the video is already ready', fakeAsync(() => {
    videoReadyState = HTMLMediaElement.HAVE_ENOUGH_DATA;
    start();
    component.onVideoCanPlay();
    tick(component.timings.loadingMinimumMs - 1);
    expect(component.state).toBe('loading');
    expect(videoPlay).not.toHaveBeenCalled();
    expect(video.autoplay).toBeFalse();
    tick(1);
    expect(component.state).toBe('loading-out');
    tick(component.timings.loadingFadeMs - 1);
    expect(videoPlay).not.toHaveBeenCalled();
    tick(1);
    expect(component.state).toBe('intro');
    expect(videoPlay).toHaveBeenCalledTimes(1);
    expect(video.muted && video.defaultMuted && video.playsInline).toBeTrue();
    fixture.destroy();
  }));

  it('waits beyond the minimum when only metadata has loaded', fakeAsync(() => {
    start();
    videoReadyState = HTMLMediaElement.HAVE_METADATA;
    component.onVideoLoadedMetadata();
    tick(component.timings.loadingMinimumMs + 1000);
    expect(component.state).toBe('loading');
    expect(videoPlay).not.toHaveBeenCalled();
    videoReadyState = HTMLMediaElement.HAVE_FUTURE_DATA;
    component.onVideoCanPlay();
    expect(component.state).toBe('loading-out');
    tick(component.timings.loadingFadeMs);
    expect(component.state).toBe('intro');
    fixture.destroy();
  }));

  it('does not let a tap bypass the minimum loading time', fakeAsync(() => {
    start();
    component.onVideoError();
    tick(1000);
    component.startMediaFromGesture();
    expect(videoPlay).not.toHaveBeenCalled();
    expect(component.state).toBe('loading');
    fixture.destroy();
  }));

  it('offers a real gesture to unlock loading when Safari does not preload', fakeAsync(() => {
    start();
    tick(Math.max(component.timings.loadingMinimumMs, component.timings.loadingHelpMs));
    expect(component.state).toBe('loading');
    expect(component.videoNeedsInteraction).toBeTrue();
    component.startMediaFromGesture();
    expect(videoPlay).toHaveBeenCalledTimes(1);
    videoReadyState = HTMLMediaElement.HAVE_FUTURE_DATA;
    component.onVideoCanPlay();
    expect(component.state).toBe('loading-out');
    fixture.destroy();
  }));

  it('shows the start button when autoplay is denied, without opening the paper', fakeAsync(() => {
    videoPlay.and.callFake(() => Promise.reject(new DOMException('Blocked', 'NotAllowedError')));
    videoReadyState = HTMLMediaElement.HAVE_ENOUGH_DATA;
    start();
    tick(component.timings.loadingMinimumMs + component.timings.loadingFadeMs);
    expect(component.videoNeedsInteraction).toBeTrue();
    expect(component.state).toBe('intro');
    expect(videoPlay).toHaveBeenCalledTimes(1);
    component.onVideoEnded();
    expect(component.state).toBe('intro');
    videoEnded = true;
    component.onVideoEnded();
    expect(component.state).toBe('transitioning');
    fixture.destroy();
  }));

  it('allows a gesture to retry audio even while automatic play is pending', fakeAsync(() => {
    audioPlay.and.returnValue(new Promise<void>(() => {}));
    start();
    expect(audioPlay).toHaveBeenCalledTimes(1);
    component.startMediaFromGesture();
    expect(audioPlay).toHaveBeenCalledTimes(2);
    expect(audio.currentTime).toBe(1);
    fixture.destroy();
  }));

  it('keeps the configured minimum with reduced motion but skips the fade', fakeAsync(() => {
    videoReadyState = HTMLMediaElement.HAVE_ENOUGH_DATA;
    start();
    component.reduceMotion = true;
    tick(component.timings.loadingMinimumMs - 1);
    expect(component.state).toBe('loading');
    tick(1);
    expect(component.state).toBe('intro');
    expect(videoPlay).toHaveBeenCalledTimes(1);
    fixture.destroy();
  }));

  it('cancels loading timers and pending playback on destruction', fakeAsync(() => {
    let resolveVideo!: () => void;
    videoPlay.and.returnValue(new Promise<void>((resolve) => { resolveVideo = resolve; }));
    videoReadyState = HTMLMediaElement.HAVE_ENOUGH_DATA;
    start();
    tick(component.timings.loadingMinimumMs + component.timings.loadingFadeMs);
    fixture.destroy();
    resolveVideo();
    flushMicrotasks();
    tick(10000);
    expect(video.pause).toHaveBeenCalled();
    expect(audio.pause).toHaveBeenCalled();
    expect(component.videoNeedsInteraction).toBeFalse();
  }));

  it('requests music immediately, even before metadata is available', fakeAsync(() => {
    audioReadyState = HTMLMediaElement.HAVE_NOTHING;
    audio.muted = true;
    start();
    expect(audioPlay).toHaveBeenCalledTimes(1);
    expect(audio.muted).toBeFalse();
    audioReadyState = HTMLMediaElement.HAVE_METADATA;
    component.onMusicLoadedMetadata();
    expect(audio.currentTime).toBe(1);
    fixture.destroy();
  }));

  it('respects pause during this visit but resets it when returning from the page cache', fakeAsync(() => {
    start();
    flushMicrotasks();
    audioPaused = false;
    component.onMusicPlay();
    void component.toggleMusicPlayback();
    flushMicrotasks();
    component.onMusicCanPlay();
    component.startMediaFromGesture();
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: false }));
    expect(audioPlay).toHaveBeenCalledTimes(1);
    expect(audioPaused).toBeTrue();

    audio.currentTime = 9;
    audio.muted = true;
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    expect(audioPlay).toHaveBeenCalledTimes(2);
    expect(audio.currentTime).toBe(1);
    expect(audio.muted).toBeFalse();
    fixture.destroy();
  }));
});
