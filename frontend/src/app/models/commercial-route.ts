export type CommercialContext = { weddingCode: string; segment: string };

export function commercialContext(pathname: string, configuredWedding: string | null = 'gabriela-y-juan'): CommercialContext | null {
  let segments: string[];
  try {
    segments = pathname.split('/').filter(Boolean).map(decodeURIComponent);
  } catch { return null; }
  if (segments[0] === 'wedding-invitation') segments = segments.slice(1);
  const valid = (value: string) => /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(value);
  if (configuredWedding && /^[a-z0-9][a-z0-9-]{0,119}$/.test(configuredWedding)) {
    return segments.length <= 1 && (!segments[0] || valid(segments[0]))
      ? { weddingCode: configuredWedding, segment: segments[0] ?? '' } : null;
  }
  return null;
}
