import { ComponentFixture, TestBed, fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import { CivilInvitationComponent } from './civil-invitation.component';

describe('CivilInvitationComponent message opening', () => {
  let fixture: ComponentFixture<CivilInvitationComponent>;
  let component: CivilInvitationComponent;
  let video: HTMLVideoElement;
  let audio: HTMLAudioElement;
  let videoReady: number;
  let audioReady: number;
  let videoPaused: boolean;
  let audioPaused: boolean;
  let videoEnded: boolean;
  let videoPlay: jasmine.Spy;
  let audioPlay: jasmine.Spy;
  let fetchMedia: jasmine.Spy;
  let revokeUrl: jasmine.Spy;

  const response = () => ({ ok: true, blob: () => Promise.resolve(new Blob(['media'])) }) as Response;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [CivilInvitationComponent] });
    TestBed.overrideComponent(CivilInvitationComponent, {
      set: { template: '<video #introVideo></video><audio #backgroundAudio></audio>' },
    });
    fixture = TestBed.createComponent(CivilInvitationComponent);
    component = fixture.componentInstance;
    video = fixture.nativeElement.querySelector('video');
    audio = fixture.nativeElement.querySelector('audio');
    videoReady = audioReady = HTMLMediaElement.HAVE_NOTHING;
    videoPaused = audioPaused = true;
    videoEnded = false;
    spyOnProperty(video, 'readyState').and.callFake(() => videoReady);
    spyOnProperty(audio, 'readyState').and.callFake(() => audioReady);
    spyOnProperty(video, 'paused').and.callFake(() => videoPaused);
    spyOnProperty(audio, 'paused').and.callFake(() => audioPaused);
    spyOnProperty(video, 'ended').and.callFake(() => videoEnded);
    spyOn(video, 'load');
    spyOn(audio, 'load');
    spyOn(video, 'pause').and.callFake(() => { videoPaused = true; });
    spyOn(audio, 'pause').and.callFake(() => { audioPaused = true; });
    videoPlay = spyOn(video, 'play').and.callFake(() => {
      videoPaused = false;
      videoReady = HTMLMediaElement.HAVE_ENOUGH_DATA;
      component.onVideoPlay();
      return Promise.resolve();
    });
    audioPlay = spyOn(audio, 'play').and.callFake(() => {
      audioPaused = false;
      component.onMusicPlay();
      return Promise.resolve();
    });
    fetchMedia = spyOn(window, 'fetch').and.callFake(() => Promise.resolve(response()));
    spyOn(URL, 'createObjectURL').and.returnValues('blob:video-test', 'blob:audio-test');
    revokeUrl = spyOn(URL, 'revokeObjectURL');
  });

  afterEach(() => fixture.destroy());

  function start(): void {
    fixture.detectChanges();
    component.reduceMotion = false;
    flushMicrotasks();
  }

  function ready(): void {
    start();
    videoReady = audioReady = HTMLMediaElement.HAVE_METADATA;
    component.onVideoLoadedMetadata();
    component.onMusicLoadedMetadata();
    tick(component.timings.loadingMinimumMs);
  }

  it('downloads both files without playing them and enforces the minimum', fakeAsync(() => {
    start();
    expect(fetchMedia).toHaveBeenCalledTimes(2);
    videoReady = audioReady = HTMLMediaElement.HAVE_METADATA;
    tick(component.timings.loadingMinimumMs - 1);
    expect(component.messageReady).toBeFalse();
    component.openMessage();
    expect(videoPlay).not.toHaveBeenCalled();
    expect(audioPlay).not.toHaveBeenCalled();
    tick(1);
    expect(component.messageReady).toBeTrue();
    expect(video.autoplay).toBeFalse();
    expect(videoPlay).not.toHaveBeenCalled();
    expect(audioPlay).not.toHaveBeenCalled();
    fixture.destroy();
  }));

  it('does not enable opening until both downloaded files have metadata', fakeAsync(() => {
    start();
    tick(component.timings.loadingMinimumMs);
    videoReady = HTMLMediaElement.HAVE_ENOUGH_DATA;
    component.onVideoCanPlay();
    expect(component.messageReady).toBeFalse();
    component.openMessage();
    expect(videoPlay).not.toHaveBeenCalled();
    audioReady = HTMLMediaElement.HAVE_METADATA;
    component.onMusicLoadedMetadata();
    expect(component.messageReady).toBeTrue();
    expect(audioPlay).not.toHaveBeenCalled();
    fixture.destroy();
  }));

  it('waits for the complete audio download even when video is available', fakeAsync(() => {
    let completeAudio!: (value: Response) => void;
    fetchMedia.and.returnValues(Promise.resolve(response()), new Promise<Response>((resolve) => { completeAudio = resolve; }));
    start();
    videoReady = audioReady = HTMLMediaElement.HAVE_METADATA;
    tick(component.timings.loadingMinimumMs + 8000);
    expect(component.messageReady).toBeFalse();
    completeAudio(response());
    flushMicrotasks();
    expect(component.messageReady).toBeTrue();
    fixture.destroy();
  }));

  it('starts both play calls synchronously from the opening action and seeks music to second 1', fakeAsync(() => {
    ready();
    component.openMessage();
    // No microtask flush: both calls must happen in the original click stack.
    expect(videoPlay).toHaveBeenCalledTimes(1);
    expect(audioPlay).toHaveBeenCalledTimes(1);
    expect(audio.currentTime).toBe(1);
    expect(video.currentTime).toBe(0);
    expect(audio.muted).toBeFalse();
    expect(video.muted && video.playsInline).toBeTrue();
    expect(component.state).toBe('loading-out');
    tick(component.timings.loadingFadeMs);
    expect(component.state).toBe('intro');
    fixture.destroy();
  }));

  it('waits for both playing events before fading the loader', fakeAsync(() => {
    audioPlay.and.returnValue(new Promise<void>(() => {}));
    ready();
    component.openMessage();
    expect(component.state).toBe('loading');
    tick(1000);
    expect(component.state).toBe('loading');
    audioPaused = false;
    component.onMusicPlay();
    expect(component.state).toBe('loading-out');
    fixture.destroy();
  }));

  it('does not allow background taps or the music toggle to bypass the opening button', fakeAsync(() => {
    ready();
    component.startMediaFromGesture();
    void component.toggleMusicPlayback();
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    expect(videoPlay).not.toHaveBeenCalled();
    expect(audioPlay).not.toHaveBeenCalled();
    fixture.destroy();
  }));

  it('stops both and permits retry when audio playback fails', fakeAsync(() => {
    audioPlay.and.callFake(() => Promise.reject(new DOMException('Blocked', 'NotAllowedError')));
    ready();
    component.openMessage();
    flushMicrotasks();
    expect(component.state).toBe('loading');
    expect(component.openingRequested).toBeFalse();
    expect(component.videoNeedsInteraction).toBeTrue();
    expect(videoPaused && audioPaused).toBeTrue();
    expect(component.messageReady).toBeTrue();
    fixture.destroy();
  }));

  it('stops both and permits retry when video playback fails', fakeAsync(() => {
    videoPlay.and.callFake(() => Promise.reject(new DOMException('Blocked', 'NotAllowedError')));
    ready();
    component.openMessage();
    flushMicrotasks();
    expect(component.openingRequested).toBeFalse();
    expect(component.videoNeedsInteraction).toBeTrue();
    expect(videoPaused && audioPaused).toBeTrue();
    fixture.destroy();
  }));

  it('offers a download retry after a failed response', fakeAsync(() => {
    fetchMedia.and.returnValue(Promise.resolve({ ok: false, status: 503 } as Response));
    start();
    tick(component.timings.loadingMinimumMs);
    expect(component.mediaLoadFailed).toBeTrue();
    expect(component.messageReady).toBeFalse();
    fetchMedia.and.callFake(() => Promise.resolve(response()));
    void component.loadMessageMedia();
    flushMicrotasks();
    videoReady = audioReady = HTMLMediaElement.HAVE_METADATA;
    expect(component.mediaLoadFailed).toBeFalse();
    expect(component.messageReady).toBeTrue();
    expect(video.autoplay).toBeFalse();
    fixture.destroy();
  }));

  it('only opens the paper after the actual video end', fakeAsync(() => {
    ready();
    component.openMessage();
    tick(component.timings.loadingFadeMs);
    component.onVideoEnded();
    expect(component.state).toBe('intro');
    videoEnded = true;
    component.onVideoEnded();
    expect(component.state).toBe('transitioning');
    fixture.destroy();
  }));

  it('keeps the end transition if playback ends during the loading fade', fakeAsync(() => {
    ready();
    component.openMessage();
    videoEnded = true;
    component.onVideoEnded();
    tick(component.timings.loadingFadeMs);
    expect(component.state).toBe('transitioning');
    fixture.destroy();
  }));

  it('cleans up object URLs and cancels downloads on destruction', fakeAsync(() => {
    ready();
    const signal = fetchMedia.calls.first().args[1].signal as AbortSignal;
    fixture.destroy();
    expect(signal.aborted).toBeTrue();
    expect(revokeUrl).toHaveBeenCalledWith('blob:video-test');
    expect(revokeUrl).toHaveBeenCalledWith('blob:audio-test');
    tick(50000);
    expect(videoPlay).not.toHaveBeenCalled();
  }));
});
