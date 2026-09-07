import { ComponentFixture, TestBed, fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import { CivilInvitationComponent } from './civil-invitation.component';

describe('CivilInvitationComponent media loading', () => {
  let fixture: ComponentFixture<CivilInvitationComponent>;
  let component: CivilInvitationComponent;
  let video: HTMLVideoElement;
  let audio: HTMLAudioElement;
  let videoReadyState: number;
  let videoEnded: boolean;
  let videoPaused: boolean;
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
    videoPaused = true;
    audioPaused = true;
    audioReadyState = HTMLMediaElement.HAVE_METADATA;
    spyOnProperty(video, 'readyState').and.callFake(() => videoReadyState);
    spyOnProperty(video, 'ended').and.callFake(() => videoEnded);
    spyOnProperty(video, 'paused').and.callFake(() => videoPaused);
    spyOnProperty(audio, 'readyState').and.callFake(() => audioReadyState);
    spyOnProperty(audio, 'paused').and.callFake(() => audioPaused);
    videoPlay = spyOn(video, 'play').and.callFake(() => {
      beginPlayback();
      return Promise.resolve();
    });
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

  function beginPlayback(): void {
    videoPaused = false;
    videoReadyState = HTMLMediaElement.HAVE_ENOUGH_DATA;
    component.onVideoPlay();
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
    expect(videoPlay).toHaveBeenCalledTimes(1);
    tick(component.timings.loadingFadeMs - 1);
    expect(component.state).toBe('loading-out');
    tick(1);
    expect(component.state).toBe('intro');
    expect(videoPlay).toHaveBeenCalledTimes(1);
    expect(video.muted && video.defaultMuted && video.playsInline).toBeTrue();
    fixture.destroy();
  }));

  it('calls play after the minimum even if Safari preloaded only metadata', fakeAsync(() => {
    videoPlay.and.returnValue(new Promise<void>(() => {}));
    start();
    videoReadyState = HTMLMediaElement.HAVE_METADATA;
    component.onVideoLoadedMetadata();
    tick(component.timings.loadingMinimumMs + 1000);
    expect(component.state).toBe('loading');
    expect(videoPlay).toHaveBeenCalledTimes(1);
    videoReadyState = HTMLMediaElement.HAVE_FUTURE_DATA;
    component.onVideoCanPlay();
    expect(component.state).toBe('loading');
    expect(videoPlay).toHaveBeenCalledTimes(1);
    beginPlayback();
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

  it('does not require a tap just because a slow video takes more than 8 seconds', fakeAsync(() => {
    videoPlay.and.returnValue(new Promise<void>(() => {}));
    start();
    tick(component.timings.loadingMinimumMs + 8000);
    expect(component.state).toBe('loading');
    expect(component.videoNeedsInteraction).toBeFalse();
    expect(videoPlay).toHaveBeenCalledTimes(1);
    beginPlayback();
    expect(component.state).toBe('loading-out');
    fixture.destroy();
  }));

  it('shows the start button when autoplay is denied, without opening the paper', fakeAsync(() => {
    videoPlay.and.callFake(() => Promise.reject(new DOMException('Blocked', 'NotAllowedError')));
    videoReadyState = HTMLMediaElement.HAVE_ENOUGH_DATA;
    start();
    tick(component.timings.loadingMinimumMs + component.timings.loadingFadeMs);
    expect(component.videoNeedsInteraction).toBeTrue();
    expect(component.state).toBe('loading');
    expect(videoPlay).toHaveBeenCalledTimes(1);
    component.onVideoCanPlay();
    tick(10000);
    expect(videoPlay).toHaveBeenCalledTimes(1);
    component.onVideoEnded();
    expect(component.state).toBe('loading');
    videoPlay.and.callFake(() => {
      beginPlayback();
      return Promise.resolve();
    });
    component.startMediaFromGesture();
    expect(component.videoNeedsInteraction).toBeFalse();
    expect(component.state).toBe('loading-out');
    tick(component.timings.loadingFadeMs);
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

  it('preserves the ended transition if the video finishes during the loading fade', fakeAsync(() => {
    start();
    tick(component.timings.loadingMinimumMs);
    expect(component.state).toBe('loading-out');
    videoEnded = true;
    component.onVideoEnded();
    tick(component.timings.loadingFadeMs);
    expect(component.state).toBe('transitioning');
    fixture.destroy();
  }));

  it('lets a real gesture retry a pending automatic play without waiting for it', fakeAsync(() => {
    videoPlay.and.returnValue(new Promise<void>(() => {}));
    start();
    tick(component.timings.loadingMinimumMs);
    videoPaused = false;
    component.startMediaFromGesture();
    expect(videoPlay).toHaveBeenCalledTimes(2);
    fixture.destroy();
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
