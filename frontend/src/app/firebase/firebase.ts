import { initializeApp } from 'firebase/app';
import { Firestore, getFirestore } from 'firebase/firestore/lite';
import { firebaseConfig, isFirebaseConfigured } from './firebase.config';

let firestoreInstance: Firestore | null = null;

export function getInvitationFirestore(): Firestore | null {
  if (!isFirebaseConfigured()) {
    return null;
  }

  if (!firestoreInstance) {
    const app = initializeApp(firebaseConfig);
    firestoreInstance = getFirestore(app);
  }

  return firestoreInstance;
}
