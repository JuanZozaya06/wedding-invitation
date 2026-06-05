import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';

const driveCsvUrl =
  'https://docs.google.com/spreadsheets/d/1d1k5vycGuwfEgzYvz8ZhH6YG41Fo7Pte_b38e1XqQW4/gviz/tq?tqx=out:csv&gid=1221480032';
const outputPath = resolve('../outputs/invitados_drive_actualizado.csv');

async function main() {
  await downloadDriveCsv();

  const passthroughArgs = process.argv.slice(2);
  await runImporter(['./scripts/import-invitations-firestore.mjs', '--input', outputPath, ...passthroughArgs]);
}

async function downloadDriveCsv() {
  const response = await fetch(driveCsvUrl);

  if (!response.ok) {
    throw new Error(`No se pudo descargar la hoja de Drive: ${response.status} ${response.statusText}`);
  }

  const csv = await response.text();

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, csv, 'utf8');

  console.log(`Hoja descargada desde Drive: ${outputPath}`);
}

function runImporter(args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, args, {
      stdio: 'inherit',
      windowsHide: true,
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      reject(new Error(`Importador termino con codigo ${code}.`));
    });
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
