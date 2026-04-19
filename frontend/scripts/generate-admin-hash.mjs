import { createHash } from 'node:crypto';

const value = process.argv[2] ?? '';

if (!value) {
  console.error('Uso: npm run admin:hash -- tu-clave');
  process.exit(1);
}

const digest = createHash('sha256').update(value).digest('hex');
console.log(digest);
