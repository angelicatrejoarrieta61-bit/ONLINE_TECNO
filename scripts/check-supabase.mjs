import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(root, '.env');
if (!fs.existsSync(envPath)) {
  console.error('No existe .env en la raíz del proyecto.');
  process.exit(1);
}

const raw = fs.readFileSync(envPath, 'utf8');
function getEnv(k) {
  const m = raw.match(new RegExp(`^${k}=(.+)$`, 'm'));
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
}

let base = getEnv('VITE_SUPABASE_URL')
  .replace(/\/rest\/v1\/?$/i, '')
  .replace(/\/+$/, '');
const key = getEnv('VITE_SUPABASE_ANON_KEY');

if (!base.startsWith('http') || !key) {
  console.error('Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en .env');
  process.exit(1);
}

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  Accept: 'application/json',
};

async function main() {
  const pUrl = `${base}/rest/v1/products?select=id&or=(is_deleted.eq.false,is_deleted.is.null)`;
  const cUrl = `${base}/rest/v1/store_config?select=key`;

  const [pr, cr] = await Promise.all([
    fetch(pUrl, { headers }),
    fetch(cUrl, { headers }),
  ]);

  const pBody = await pr.text();
  const cBody = await cr.text();

  if (!pr.ok) {
    console.error('products:', pr.status, pBody.slice(0, 200));
    process.exit(1);
  }
  if (!cr.ok) {
    console.error('store_config:', cr.status, cBody.slice(0, 200));
    process.exit(1);
  }

  const products = JSON.parse(pBody);
  const configs = JSON.parse(cBody);

  console.log('OK — Supabase responde con tu .env');
  console.log('  Productos activos:', products.length);
  console.log('  Filas store_config:', configs.length);
  console.log('Si en el navegador no ves nada: mismo .env en el hosting + npm run build + Ctrl+F5.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
