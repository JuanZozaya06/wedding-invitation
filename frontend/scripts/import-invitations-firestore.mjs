import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { initializeApp } from 'firebase/app';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  setDoc,
} from 'firebase/firestore/lite';

const args = parseArgs(process.argv.slice(2));
const inputPath = resolve(args.input ?? '../outputs/invitados_con_tokens_6_mayusculas_v2.csv');
const collectionName = args.collection ?? 'invitations';
const shouldReset = args.reset === true;
const confirmed = args.yes === true;
const dryRun = args.dryRun !== false && !confirmed;
const onlySi = args.onlySi === true;
const authMode = args.auth ?? 'web';
const execFileAsync = promisify(execFile);

async function main() {
  const csv = await readFile(inputPath, 'utf8');
  const rows = parseCsv(csv.replace(/^\uFEFF/, ''));
  const invitations = buildInvitations(rows, { onlySi });
  const validation = validateInvitations(invitations);

  printSummary({ invitations, validation, dryRun });

  if (validation.errors.length > 0) {
    console.error('\nImportacion detenida por errores de validacion.');
    process.exit(1);
  }

  if (dryRun) {
    console.log(
      '\nDry run: no se escribio Firestore. Para resetear y subir usa --reset --yes.',
    );
    return;
  }

  if (shouldReset && !confirmed) {
    console.error('Para resetear Firestore debes pasar --reset --yes.');
    process.exit(1);
  }

  const firebaseConfig = await loadFirebaseConfig();

  if (authMode === 'gcloud') {
    await writeWithGcloudRest(firebaseConfig, invitations);
    return;
  }

  const app = initializeApp(firebaseConfig);
  const firestore = getFirestore(app);

  if (shouldReset) {
    const snapshot = await getDocs(collection(firestore, collectionName));

    for (const invitationDoc of snapshot.docs) {
      await deleteDoc(doc(firestore, collectionName, invitationDoc.id));
    }

    console.log(`Coleccion ${collectionName} reseteada: ${snapshot.docs.length} documentos borrados.`);
  }

  for (const invitation of invitations) {
    await setDoc(doc(firestore, collectionName, invitation.token), invitation);
  }

  console.log(`Coleccion ${collectionName} cargada con ${invitations.length} invitaciones.`);
}

async function writeWithGcloudRest(firebaseConfig, invitations) {
  const accessToken = await getGcloudAccessToken();
  const databaseRoot = `projects/${firebaseConfig.projectId}/databases/(default)/documents`;

  if (shouldReset) {
    const documents = await listCollectionDocuments({
      accessToken,
      projectId: firebaseConfig.projectId,
      collectionName,
    });

    await commitWrites({
      accessToken,
      projectId: firebaseConfig.projectId,
      writes: documents.map((documentName) => ({ delete: documentName })),
    });

    console.log(`Coleccion ${collectionName} reseteada: ${documents.length} documentos borrados.`);
  }

  const writes = invitations.map((invitation) => ({
    update: {
      name: `${databaseRoot}/${collectionName}/${invitation.token}`,
      fields: encodeFirestoreFields(invitation),
    },
  }));

  await commitWrites({
    accessToken,
    projectId: firebaseConfig.projectId,
    writes,
  });

  console.log(`Coleccion ${collectionName} cargada con ${invitations.length} invitaciones.`);
}

async function getGcloudAccessToken() {
  const candidates = [
    'gcloud',
    'gcloud.cmd',
    'C:\\Program Files (x86)\\Google\\Cloud SDK\\google-cloud-sdk\\bin\\gcloud.cmd',
  ];
  let stdout = '';
  let lastError = null;

  for (const command of candidates) {
    try {
      const result = await execFileAsync(command, ['auth', 'print-access-token'], {
        windowsHide: true,
      });
      stdout = result.stdout;
      lastError = null;
      break;
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) {
    throw lastError;
  }

  const accessToken = stdout.trim();

  if (!accessToken) {
    throw new Error('gcloud no devolvio access token. Ejecuta gcloud auth login.');
  }

  return accessToken;
}

async function listCollectionDocuments({ accessToken, projectId, collectionName }) {
  const documents = [];
  let pageToken = '';

  do {
    const url = new URL(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collectionName}`,
    );
    url.searchParams.set('pageSize', '300');

    if (pageToken) {
      url.searchParams.set('pageToken', pageToken);
    }

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new Error(`No se pudo listar ${collectionName}: ${response.status} ${await response.text()}`);
    }

    const payload = await response.json();
    documents.push(...(payload.documents ?? []).map((document) => document.name));
    pageToken = payload.nextPageToken ?? '';
  } while (pageToken);

  return documents;
}

async function commitWrites({ accessToken, projectId, writes }) {
  const chunks = chunk(writes, 450);

  for (const writesChunk of chunks) {
    if (writesChunk.length === 0) {
      continue;
    }

    const response = await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:commit`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ writes: writesChunk }),
      },
    );

    if (!response.ok) {
      throw new Error(`Commit Firestore fallo: ${response.status} ${await response.text()}`);
    }
  }
}

function buildInvitations(rows, { onlySi }) {
  const [headers, ...dataRows] = rows;
  const indexes = indexHeaders(headers);
  const groups = new Map();

  for (const row of dataRows) {
    const displayName = cell(row, indexes.display_name).trim();
    const token = cell(row, indexes.token).trim().toUpperCase();
    const guestName = cell(row, indexes.guest_name).trim();
    const sendFlag = cell(row, indexes['SI/No']).trim().toLowerCase();

    if (!displayName || !token || !guestName) {
      continue;
    }

    if (onlySi && sendFlag !== 'si') {
      continue;
    }

    if (!groups.has(token)) {
      groups.set(token, {
        token,
        displayName,
        rows: [],
      });
    }

    groups.get(token).rows.push(row);
  }

  return [...groups.values()].map((group) => createInvitation(group, indexes));
}

function createInvitation(group, indexes) {
  const usedGuestIds = new Map();
  const guests = group.rows.map((row, index) => {
    const role = normalizeRole(cell(row, indexes.role), index);
    const guestName = cell(row, indexes.guest_name).trim();
    const rawGuestId = cell(row, indexes.guest_id).trim() || createGuestId(guestName, index);
    const guestId = uniquifyGuestId(rawGuestId, usedGuestIds);

    return {
      id: guestId,
      name: guestName,
      gender: normalizeGender(cell(row, indexes.gender)),
      role,
      attending: parseBoolean(cell(row, indexes.attending)),
      isChild: parseBoolean(cell(row, indexes.is_child)) || role === 'child',
      isAbroad: parseBoolean(cell(row, indexes.is_abroad)),
    };
  });

  return {
    token: group.token,
    displayName: group.displayName,
    guestCount: guests.length,
    openedInvitation: false,
    openedAt: null,
    lastOpenedAt: null,
    openCount: 0,
    hasChildren: guests.some((guest) => guest.isChild),
    hasAbroadGuests: guests.some((guest) => guest.isAbroad),
    guests,
    notes: '',
    message: '',
    song: '',
    rsvpStatus: 'pending',
    respondedAt: null,
    responseEditCount: 0,
    updatedAt: null,
    confirmedCount: 0,
  };
}

function uniquifyGuestId(rawGuestId, usedGuestIds) {
  const count = usedGuestIds.get(rawGuestId) ?? 0;
  usedGuestIds.set(rawGuestId, count + 1);

  return count === 0 ? rawGuestId : `${rawGuestId}-${count + 1}`;
}

function validateInvitations(invitations) {
  const errors = [];
  const warnings = [];
  const tokenPattern = /^[A-Z0-9]{6}$/;
  const seenTokens = new Map();

  for (const invitation of invitations) {
    if (!tokenPattern.test(invitation.token)) {
      errors.push(`${invitation.displayName}: token invalido "${invitation.token}".`);
    }

    if (seenTokens.has(invitation.token)) {
      errors.push(
        `${invitation.displayName}: token duplicado con ${seenTokens.get(invitation.token)}.`,
      );
    }

    seenTokens.set(invitation.token, invitation.displayName);

    const primaryGuests = invitation.guests.filter((guest) => guest.role === 'primary');
    if (primaryGuests.length !== 1) {
      errors.push(
        `${invitation.displayName}: debe tener exactamente un primary, tiene ${primaryGuests.length}.`,
      );
    }

    const guestIds = new Set();
    for (const guest of invitation.guests) {
      if (guestIds.has(guest.id)) {
        warnings.push(`${invitation.displayName}: guest_id duplicado "${guest.id}".`);
      }
      guestIds.add(guest.id);
    }
  }

  return { errors, warnings };
}

function printSummary({ invitations, validation, dryRun }) {
  const guestCount = invitations.reduce((sum, invitation) => sum + invitation.guests.length, 0);
  const childrenCount = invitations.reduce(
    (sum, invitation) => sum + invitation.guests.filter((guest) => guest.isChild).length,
    0,
  );
  const abroadCount = invitations.reduce(
    (sum, invitation) => sum + invitation.guests.filter((guest) => guest.isAbroad).length,
    0,
  );

  console.log('Resumen importacion');
  console.log('-------------------');
  console.log(`Modo: ${dryRun ? 'dry-run' : 'escritura'}`);
  console.log(`Coleccion: ${collectionName}`);
  console.log(`Archivo: ${inputPath}`);
  console.log(`Filtro SI/No = Si: ${onlySi ? 'activo' : 'inactivo'}`);
  console.log(`Invitaciones: ${invitations.length}`);
  console.log(`Invitados: ${guestCount}`);
  console.log(`Ninos: ${childrenCount}`);
  console.log(`Invitados fuera del pais: ${abroadCount}`);
  console.log(`Errores: ${validation.errors.length}`);
  console.log(`Warnings: ${validation.warnings.length}`);

  for (const warning of validation.warnings.slice(0, 10)) {
    console.warn(`Warning: ${warning}`);
  }

  for (const error of validation.errors.slice(0, 20)) {
    console.error(`Error: ${error}`);
  }
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

function parseArgs(rawArgs) {
  const parsed = {};

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];

    if (!arg.startsWith('--')) {
      continue;
    }

    const key = toCamelCase(arg.slice(2));
    const next = rawArgs[index + 1];

    if (!next || next.startsWith('--')) {
      parsed[key] = true;
      continue;
    }

    parsed[key] = next;
    index += 1;
  }

  if (parsed.write === true) {
    parsed.dryRun = false;
  }

  return parsed;
}

function parseCsv(source) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];

    if (inQuotes) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function indexHeaders(headers) {
  const indexes = Object.fromEntries(headers.map((header, index) => [header, index]));
  const requiredHeaders = [
    'token',
    'display_name',
    'guest_id',
    'guest_name',
    'gender',
    'role',
    'is_child',
    'is_abroad',
    'attending',
    'SI/No',
  ];

  for (const header of requiredHeaders) {
    if (indexes[header] === undefined) {
      throw new Error(`Falta la columna requerida "${header}".`);
    }
  }

  return indexes;
}

function cell(row, index) {
  return `${row[index] ?? ''}`;
}

function normalizeGender(value) {
  const normalized = value.trim().toLowerCase();
  return ['male', 'female', 'other'].includes(normalized) ? normalized : null;
}

function normalizeRole(value, index) {
  const normalized = value.trim().toLowerCase();
  return ['primary', 'partner', 'child', 'guest'].includes(normalized)
    ? normalized
    : index === 0
      ? 'primary'
      : 'guest';
}

function parseBoolean(value) {
  return ['true', '1', 'yes', 'si', 'sí'].includes(value.trim().toLowerCase());
}

function createGuestId(name, index) {
  const slug = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `guest-${slug || index + 1}`;
}

function encodeFirestoreFields(value) {
  return Object.fromEntries(
    Object.entries(value).map(([key, fieldValue]) => [key, encodeFirestoreValue(fieldValue)]),
  );
}

function encodeFirestoreValue(value) {
  if (value === null || value === undefined) {
    return { nullValue: null };
  }

  if (typeof value === 'string') {
    return { stringValue: value };
  }

  if (typeof value === 'boolean') {
    return { booleanValue: value };
  }

  if (Number.isInteger(value)) {
    return { integerValue: `${value}` };
  }

  if (typeof value === 'number') {
    return { doubleValue: value };
  }

  if (Array.isArray(value)) {
    return {
      arrayValue: {
        values: value.map((item) => encodeFirestoreValue(item)),
      },
    };
  }

  if (typeof value === 'object') {
    return {
      mapValue: {
        fields: encodeFirestoreFields(value),
      },
    };
  }

  return { stringValue: `${value}` };
}

function chunk(values, size) {
  const chunks = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}

function toCamelCase(value) {
  return value.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
