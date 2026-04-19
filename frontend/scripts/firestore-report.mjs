import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { initializeApp } from 'firebase/app';
import { collection, getDocs, getFirestore } from 'firebase/firestore/lite';

const command = process.argv[2] ?? 'stats';
const outIndex = process.argv.indexOf('--out');
const outPath = outIndex >= 0 ? process.argv[outIndex + 1] : '';

async function main() {
  const firebaseConfig = await loadFirebaseConfig();
  const app = initializeApp(firebaseConfig);
  const firestore = getFirestore(app);
  const invitationsSnapshot = await getDocs(collection(firestore, 'invitations'));
  const invitations = invitationsSnapshot.docs.map((documentSnapshot) => ({
    token: documentSnapshot.id,
    ...documentSnapshot.data(),
  }));

  if (command === 'stats') {
    printStats(invitations);
    return;
  }

  if (command === 'attending') {
    const attendingGuests = buildAttendingGuests(invitations);
    printAttending(attendingGuests);

    if (outPath) {
      await exportAttendingCsv(attendingGuests, outPath);
      console.log(`\nCSV guardado en: ${resolve(outPath)}`);
    }

    return;
  }

  console.error(
    'Comando no reconocido. Usa: "stats" o "attending". Ejemplo: npm run report -- stats',
  );
  process.exit(1);
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

function normalizeGuests(invitation) {
  return Array.isArray(invitation.guests) ? invitation.guests : [];
}

function buildAttendingGuests(invitations) {
  return invitations.flatMap((invitation) => {
    const guests = normalizeGuests(invitation);

    return guests
      .filter((guest) => guest?.attending === true)
      .map((guest) => ({
        token: invitation.token,
        displayName: invitation.displayName ?? '',
        guestId: guest.id ?? '',
        guestName: guest.name ?? '',
        role: guest.role ?? '',
        gender: guest.gender ?? '',
        isChild: guest.isChild === true ? 'true' : 'false',
        isAbroad: guest.isAbroad === true ? 'true' : 'false',
        rsvpStatus: invitation.rsvpStatus ?? '',
      }));
  });
}

function printStats(invitations) {
  const invitationCount = invitations.length;
  const openedCount = invitations.filter((invitation) => invitation.openedInvitation === true).length;
  const respondedCount = invitations.filter(
    (invitation) => invitation.rsvpStatus && invitation.rsvpStatus !== 'pending',
  ).length;
  const totalGuestCount = invitations.reduce(
    (sum, invitation) => sum + normalizeGuests(invitation).length,
    0,
  );
  const derivedAttendingCount = invitations.reduce(
    (sum, invitation) =>
      sum + normalizeGuests(invitation).filter((guest) => guest?.attending === true).length,
    0,
  );
  const storedConfirmedCount = invitations.reduce(
    (sum, invitation) => sum + Number(invitation.confirmedCount ?? 0),
    0,
  );
  const pendingInvitations = invitations.filter(
    (invitation) => !invitation.rsvpStatus || invitation.rsvpStatus === 'pending',
  ).length;

  console.log('Resumen Firestore');
  console.log('-----------------');
  console.log(`Invitaciones: ${invitationCount}`);
  console.log(`Invitaciones abiertas: ${openedCount}`);
  console.log(`Invitaciones respondidas: ${respondedCount}`);
  console.log(`Invitaciones pendientes: ${pendingInvitations}`);
  console.log(`Invitados totales: ${totalGuestCount}`);
  console.log(`Confirmados (desde guests): ${derivedAttendingCount}`);
  console.log(`Confirmados (desde confirmedCount): ${storedConfirmedCount}`);

  if (storedConfirmedCount !== derivedAttendingCount) {
    console.log(
      'Aviso: confirmedCount no coincide con la suma derivada desde guests.attending.',
    );
  }
}

function printAttending(attendingGuests) {
  console.log('Invitados confirmados');
  console.log('---------------------');

  if (attendingGuests.length === 0) {
    console.log('No hay invitados confirmados todavia.');
    return;
  }

  attendingGuests.forEach((guest, index) => {
    console.log(
      `${index + 1}. ${guest.guestName} | ${guest.displayName} | token=${guest.token} | role=${guest.role}`,
    );
  });

  console.log(`\nTotal confirmados: ${attendingGuests.length}`);
}

async function exportAttendingCsv(attendingGuests, targetPath) {
  const header = [
    'token',
    'display_name',
    'guest_id',
    'guest_name',
    'role',
    'gender',
    'is_child',
    'is_abroad',
    'rsvp_status',
  ];
  const rows = attendingGuests.map((guest) => [
    guest.token,
    guest.displayName,
    guest.guestId,
    guest.guestName,
    guest.role,
    guest.gender,
    guest.isChild,
    guest.isAbroad,
    guest.rsvpStatus,
  ]);
  const csv = [header, ...rows]
    .map((row) => row.map(escapeCsvValue).join(','))
    .join('\n');
  const absolutePath = resolve(targetPath);

  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, csv, 'utf8');
}

function escapeCsvValue(value) {
  const normalized = `${value ?? ''}`.replaceAll('"', '""');
  return `"${normalized}"`;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
