import { randomInt } from 'node:crypto';

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const rawLength = Number.parseInt(process.argv[2] ?? '6', 10);
const length = Number.isFinite(rawLength) ? rawLength : 6;

if (length < 6 || length > 32) {
  console.error('La longitud debe estar entre 6 y 32 caracteres.');
  process.exit(1);
}

let token = '';

for (let index = 0; index < length; index += 1) {
  token += alphabet[randomInt(0, alphabet.length)];
}

console.log(token);
