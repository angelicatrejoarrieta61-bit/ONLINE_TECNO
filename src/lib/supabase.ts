import { createClient } from '@supabase/supabase-js';

// CONEXIÓN PURA Y DIRECTA (Sin interferencias de localStorage)
function normalizeProjectUrl(raw: string | undefined): string {
  if (!raw) return '';
  let u = raw.trim();
  // Si pegaste la URL del API (…/rest/v1), el SDK rompe la ruta; solo debe ser https://xxx.supabase.co
  u = u.replace(/\/rest\/v1\/?$/i, '');
  u = u.replace(/\/+$/, '');
  return u;
}

const supabaseUrl = normalizeProjectUrl(import.meta.env.VITE_SUPABASE_URL);
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('http')
);

if (!isSupabaseConfigured) {
  console.error(
    'ERROR CRÍTICO: Define VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env (local) o en variables del hosting antes de npm run build (producción).'
  );
}

/** Cliente válido solo si hay URL y anon key; si no, sigue existiendo el objeto pero las peticiones fallarán con error claro. */
export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : 'https://invalid-placeholder.supabase.co',
  isSupabaseConfigured ? supabaseAnonKey : 'invalid-anon-key'
);

/** Debe coincidir con el bucket en Supabase Storage y estar configurado como público (lectura). */
export const STORAGE_BUCKET =
  import.meta.env.VITE_SUPABASE_STORAGE_BUCKET?.trim() || 'tecnocasa-assets';

export const getImageUrl = (path: string): string => {
  const raw = path?.trim();
  if (!raw) return '';
  if (raw.startsWith('http') || raw.startsWith('data:')) return raw;

  const storagePath = raw.replace(/^\/+/, '');
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);
  return data?.publicUrl || '';
};

export const uploadAsset = async (file: File, name: string): Promise<string | null> => {
  const ext = file.name.split('.').pop();
  const path = `${name}_${Date.now()}.${ext}`;
  
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, file, { upsert: true });

  if (error) {
    console.error('Error al subir a Supabase:', error);
    throw error;
  }
  
  return data?.path || null;
};
