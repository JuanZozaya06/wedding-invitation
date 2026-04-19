export const firebaseConfig = {
  apiKey: 'AIzaSyCRoIK1PYyab2kr0hal851jEXW8tq0ZR5E',
  authDomain: 'wedding-invitation-df2db.firebaseapp.com',
  projectId: 'wedding-invitation-df2db',
  storageBucket: 'wedding-invitation-df2db.firebasestorage.app',
  messagingSenderId: '664368687301',
  appId: '1:664368687301:web:e4cfe33a896503eff0a8ac',
  measurementId: 'G-14V8Z7T075',
};

export function isFirebaseConfigured(): boolean {
  return Object.values(firebaseConfig).every((value) => value.trim().length > 0);
}
