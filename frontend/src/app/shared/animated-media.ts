export function supportsAnimatedWebm(document: Document): boolean {
  const video = document.createElement('video');
  const canPlayWebm =
    video.canPlayType('video/webm; codecs="vp8, vorbis"') !== '' ||
    video.canPlayType('video/webm; codecs="vp9"') !== '';
  const userAgent = window.navigator.userAgent;
  const isAppleDevice =
    /iPhone|iPad|iPod|Macintosh/i.test(userAgent) ||
    (window.navigator.platform === 'MacIntel' &&
      window.navigator.maxTouchPoints > 1);

  return canPlayWebm && !isAppleDevice;
}
