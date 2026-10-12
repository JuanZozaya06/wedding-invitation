import { CommercialApiService } from './core/http/commercial-api.service';
import {
  APP_INITIALIZER,
  ApplicationConfig,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter, UrlSerializer } from '@angular/router';
import { DomainUrlSerializer } from './core/routing/domain-url-serializer';
import { routes } from './app.routes';
export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    { provide: UrlSerializer, useClass: DomainUrlSerializer },
    {
      provide: APP_INITIALIZER,
      multi: true,
      deps: [CommercialApiService],
      useFactory: (api: CommercialApiService) => () => api.initialize(),
    },
  ],
};
