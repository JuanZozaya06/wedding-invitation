export const MEDIA_ACCEPT =
  'image/jpeg,image/png,image/webp,.heic,.heif,video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm';
export const MAX_PHOTO_BYTES = 20 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 2 * 1024 ** 3;

export function isVideo(file: Pick<File, 'type' | 'name'>): boolean {
  return file.type.startsWith('video/') || /\.(mp4|mov|webm)$/i.test(file.name);
}

export function mediaCount(items: readonly { file: File }[]): string {
  const videos = items.filter((item) => isVideo(item.file)).length;
  const photos = items.length - videos;
  const parts: string[] = [];
  if (photos) parts.push(`${photos} ${photos === 1 ? 'foto' : 'fotos'}`);
  if (videos) parts.push(`${videos} ${videos === 1 ? 'video' : 'videos'}`);
  return parts.join(' y ') || '0 fotos y videos';
}
