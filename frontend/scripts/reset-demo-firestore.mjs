import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { initializeApp } from 'firebase/app';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  setDoc,
} from 'firebase/firestore/lite';

const invitations = [
  createInvitation({
    token: 'demo-cuento',
    displayName: 'Valentina y Alfonso',
    openedInvitation: true,
    openedAt: '2026-04-18T18:20:00.000Z',
    lastOpenedAt: '2026-04-18T18:20:00.000Z',
    openCount: 1,
    rsvpStatus: 'pending',
    guests: [
      guest('guest-valentina', 'Valentina', 'female', 'primary', false, false, false),
      guest('guest-alfonso', 'Alfonso', 'male', 'partner', false, false, false),
    ],
  }),
  createInvitation({
    token: 'm8q2x7na',
    displayName: 'Camila Rivas',
    guests: [guest('guest-camila', 'Camila Rivas', 'female', 'primary', false, false, false)],
  }),
  createInvitation({
    token: 'r4t8k1zp',
    displayName: 'Sebastian Herrera',
    openedInvitation: true,
    openedAt: '2026-04-10T13:00:00.000Z',
    lastOpenedAt: '2026-04-17T19:45:00.000Z',
    openCount: 4,
    guests: [guest('guest-sebastian', 'Sebastian Herrera', 'male', 'primary', false, true, false)],
  }),
  createInvitation({
    token: 'p3w6n9fd',
    displayName: 'Familia Perez',
    openedInvitation: true,
    openedAt: '2026-04-11T17:00:00.000Z',
    lastOpenedAt: '2026-04-18T21:12:00.000Z',
    openCount: 6,
    rsvpStatus: 'partial',
    respondedAt: '2026-04-18T21:10:00.000Z',
    responseEditCount: 2,
    notes: 'Sofia es alergica al mani. Luis no toma alcohol.',
    guests: [
      guest('guest-ana', 'Ana Perez', 'female', 'primary', true, false, false),
      guest('guest-luis', 'Luis Perez', 'male', 'partner', false, false, true),
      guest('guest-sofia', 'Sofia Perez', 'female', 'child', true, false, true),
    ],
  }),
  createInvitation({
    token: 't7v2m4qc',
    displayName: 'Marcela y Diego',
    openedInvitation: true,
    openedAt: '2026-04-12T15:00:00.000Z',
    lastOpenedAt: '2026-04-18T20:00:00.000Z',
    openCount: 3,
    rsvpStatus: 'accepted',
    respondedAt: '2026-04-17T22:00:00.000Z',
    responseEditCount: 3,
    message: 'Que alegria celebrar este dia con ustedes. Los queremos muchisimo.',
    song: 'Bailando - Enrique Iglesias',
    guests: [
      guest('guest-marcela', 'Marcela Urdaneta de Fernandez', 'female', 'primary', false, false, true),
      guest('guest-diego', 'Diego Fernandez', 'male', 'partner', false, false, true),
    ],
  }),
  createInvitation({
    token: 'k5n1s8yb',
    displayName: 'Familia Ortega Salcedo',
    openedInvitation: true,
    openedAt: '2026-04-13T14:00:00.000Z',
    lastOpenedAt: '2026-04-18T22:00:00.000Z',
    openCount: 8,
    rsvpStatus: 'accepted',
    respondedAt: '2026-04-18T21:50:00.000Z',
    responseEditCount: 4,
    notes: 'Mesa cerca de la salida por el bebe.',
    message: 'Gracias por incluir a toda la familia en este momento tan bonito.',
    song: 'Vivir Mi Vida - Marc Anthony',
    guests: [
      guest('guest-lucia', 'Lucia Ortega Salcedo', 'female', 'primary', false, false, true),
      guest('guest-javier', 'Javier Ortega', 'male', 'partner', false, false, true),
      guest('guest-mateo', 'Mateo Ortega', 'male', 'child', false, false, true),
      guest('guest-emma', 'Emma Ortega', 'female', 'child', false, false, true),
    ],
  }),
  createInvitation({
    token: 'x2d7h4le',
    displayName: 'Alex Romero',
    openedInvitation: true,
    openedAt: '2026-04-14T10:00:00.000Z',
    lastOpenedAt: '2026-04-15T09:30:00.000Z',
    openCount: 2,
    rsvpStatus: 'declined',
    respondedAt: '2026-04-15T09:25:00.000Z',
    responseEditCount: 1,
    notes: 'Estare fuera del pais en esa fecha.',
    guests: [guest('guest-alex', 'Alex Romero', 'other', 'primary', false, true, false)],
  }),
  createInvitation({
    token: 'q9c4u6mw',
    displayName: 'Gabriela Fernanda del Valle Mendoza de Rojas',
    guests: [
      guest(
        'guest-gabriela-rojas',
        'Gabriela Fernanda del Valle Mendoza de Rojas',
        'female',
        'primary',
        false,
        false,
        false,
      ),
    ],
  }),
];

async function main() {
  const firebaseConfig = await loadFirebaseConfig();
  const app = initializeApp(firebaseConfig);
  const firestore = getFirestore(app);
  const invitationsCollection = collection(firestore, 'invitations');
  const snapshot = await getDocs(invitationsCollection);

  for (const invitationDoc of snapshot.docs) {
    await deleteDoc(doc(firestore, 'invitations', invitationDoc.id));
  }

  for (const invitation of invitations) {
    await setDoc(doc(firestore, 'invitations', invitation.token), invitation);
  }

  console.log(`Coleccion invitations reiniciada con ${invitations.length} invitaciones demo.`);
}

function guest(id, name, gender, role, isChild, isAbroad, attending) {
  return {
    id,
    name,
    gender,
    role,
    attending,
    isChild,
    isAbroad,
  };
}

function createInvitation({
  token,
  displayName,
  guests,
  openedInvitation = false,
  openedAt = null,
  lastOpenedAt = null,
  openCount = 0,
  notes = '',
  message = '',
  song = '',
  rsvpStatus = 'pending',
  respondedAt = null,
  responseEditCount = 0,
}) {
  const timestamp = respondedAt ?? lastOpenedAt ?? openedAt ?? null;

  return {
    token,
    displayName,
    guestCount: guests.length,
    openedInvitation,
    openedAt,
    lastOpenedAt,
    openCount,
    hasChildren: guests.some((guest) => guest.isChild),
    hasAbroadGuests: guests.some((guest) => guest.isAbroad),
    guests,
    notes,
    message,
    song,
    rsvpStatus,
    respondedAt,
    responseEditCount,
    updatedAt: timestamp,
    confirmedCount: guests.filter((guest) => guest.attending).length,
  };
}

async function loadFirebaseConfig() {
  const configPath = resolve('src/app/firebase/firebase.config.ts');
  const source = await readFile(configPath, 'utf8');
  const matches = [...source.matchAll(/(\w+):\s*'([^']*)'/g)];
  const config = Object.fromEntries(matches.map((match) => [match[1], match[2]]));

  if (!config.apiKey || !config.projectId || !config.appId) {
    throw new Error('No se pudo leer la configuracion de Firebase desde firebase.config.ts');
  }

  return config;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
