import { isSupabaseConfigured, supabase } from './supabase';

/** Carga tienda y devuelve errores de Supabase en texto (antes se tragaban y veías todo vacío). */
export async function loadStorefrontData(): Promise<{
  config: Record<string, string>;
  products: any[];
  fetchErrors: string[];
}> {
  const fetchErrors: string[] = [];

  if (!isSupabaseConfigured) {
    fetchErrors.push('Configuración de Supabase incompleta.');
    return { config: {}, products: [], fetchErrors };
  }

  // 1. Config
  const cfgRes = await supabase.from('store_config').select('key, value');
  const config = (cfgRes.data ?? []).reduce((acc: any, item: any) => {
    acc[item.key] = item.value;
    return acc;
  }, {});

  // 2. Products con Modo de Resiliencia
  let products: any[] = [];
  const prodRes = await supabase
    .from('products')
    .select('*')
    .or('is_deleted.eq.false,is_deleted.is.null')
    .order('created_at', { ascending: false });

  if (prodRes.error) {
    if (prodRes.error.message.includes('is_deleted')) {
      // Intento de emergencia sin la columna problemática
      const retryRes = await supabase.from('products').select('*').order('created_at', { ascending: false });
      products = retryRes.data || [];
    } else {
      fetchErrors.push(`products: ${prodRes.error.message}`);
    }
  } else {
    products = prodRes.data || [];
  }

  return { config, products, fetchErrors };
}

export const getStoreConfig = async () => {
  const { data } = await supabase.from('store_config').select('key, value');
  return (data ?? []).reduce((acc: any, item: any) => ({ ...acc, [item.key]: item.value }), {});
};

export const setStoreConfig = async (key: string, value: string) => {
  const { error } = await supabase.from('store_config').upsert({ key, value }, { onConflict: 'key' });
  return !error;
};

export const getProducts = async () => {
  // Primer intento con filtro de borrado
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .or('is_deleted.eq.false,is_deleted.is.null')
    .order('created_at', { ascending: false });

  if (error && error.message.includes('is_deleted')) {
    // Modo de emergencia: La columna no existe en la DB, traemos todo
    const { data: retryData } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });
    return retryData || [];
  }
  return data || [];
};

export const getArchivedProducts = async () => {
  const { data, error } = await supabase.from('products').select('*').eq('is_deleted', true).order('updated_at', { ascending: false });
  if (error) return [];
  return data || [];
};

/** Genera un código SKU único corto tipo TC-A7X2 */
const generateSKU = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'TC-';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
};

export const addProduct = async (product: any) => {
  const sku = product.sku || generateSKU();
  const { data, error } = await supabase
    .from('products')
    .insert([{ ...product, sku, is_deleted: false }])
    .select();
  if (error) return null;
  return data ? data[0] : null;
};

export const updateProduct = async (id: string, updates: any) => {
  const { data, error } = await supabase.from('products').update(updates).eq('id', id).select();
  if (error) return null;
  return data ? data[0] : null;
};

export const softDeleteProduct = async (id: string) => {
  const { error } = await supabase.from('products').update({ is_deleted: true, updated_at: new Date() }).eq('id', id);
  return !error;
};

export const restoreProduct = async (id: string) => {
  const { error } = await supabase.from('products').update({ is_deleted: false }).eq('id', id);
  return !error;
};

export const getCollections = async () => {
  const { data, error } = await supabase.from('collections').select('*');
  if (error) return [];
  return data || [];
};
