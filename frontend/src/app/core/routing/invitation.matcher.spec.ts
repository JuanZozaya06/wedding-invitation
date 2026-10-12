import { UrlSegment } from '@angular/router';
import { invitationMatcher } from './invitation.matcher';
import { DomainUrlSerializer } from './domain-url-serializer';

describe('Invitation URL matching', () => {
  const match = (paths: string[]) =>
    invitationMatcher(
      paths.map((path) => new UrlSegment(path, {})),
      {} as never,
      {},
    );
  it('accepts current codes and preserves older invitation tokens', () => {
    expect(match(['ABC123'])?.posParams?.['token'].path).toBe('ABC123');
    expect(match(['legacy-token_123'])?.posParams?.['token'].path).toBe(
      'legacy-token_123',
    );
  });
  it('rejects nested paths, encoded separators and HTML', () => {
    for (const paths of [
      [],
      ['one', 'two'],
      ['a/b'],
      ['<script>'],
      ['a%2Fb'],
      ['x'.repeat(129)],
    ]) {
      expect(match(paths)).toBeNull();
    }
  });
  it('normalizes trailing slashes without discarding query parameters or fragments', () => {
    const serializer = new DomainUrlSerializer();
    expect(
      serializer.serialize(serializer.parse('/civil/?fotos=1#inicio')),
    ).toBe('/civil?fotos=1#inicio');
    expect(
      serializer.serialize(serializer.parse('/wedding-invitation/ABC123/')),
    ).toBe('/wedding-invitation/ABC123');
  });
});
