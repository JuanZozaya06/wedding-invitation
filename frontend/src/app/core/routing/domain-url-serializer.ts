import { Injectable } from '@angular/core';
import { DefaultUrlSerializer, UrlTree } from '@angular/router';

/** Preserve the existing equivalence between /civil and /civil/, including query parameters. */
@Injectable()
export class DomainUrlSerializer extends DefaultUrlSerializer {
  override parse(url: string): UrlTree {
    const end = url.search(/[?#]/);
    const pathname = end < 0 ? url : url.slice(0, end);
    const suffix = end < 0 ? '' : url.slice(end);
    return super.parse((pathname.replace(/\/+$/, '') || '/') + suffix);
  }
}
