import { CommercialApiService } from './services/commercial-api.service';
import { APP_INITIALIZER, ApplicationConfig, provideZoneChangeDetection } from '@angular/core';

export const appConfig: ApplicationConfig = {
  providers: [provideZoneChangeDetection({ eventCoalescing: true }),
    { provide: APP_INITIALIZER, multi: true, deps: [CommercialApiService], useFactory: (api: CommercialApiService) => () => api.initialize() }]
};
