-- Bucket ID: tecnocasa-assets (nombre visible en Supabase puede ser "Tecnocasa Assets"; el ID no lleva espacios).
-- Público + escritura anon. Sin SELECT amplio sobre objects.

UPDATE storage.buckets
SET public = true
WHERE id = 'tecnocasa-assets';

-- Quitar políticas del bucket anterior (divina) si las tenías
DROP POLICY IF EXISTS "storage_insert_divina" ON storage.objects;
DROP POLICY IF EXISTS "storage_update_divina" ON storage.objects;
DROP POLICY IF EXISTS "storage_delete_divina" ON storage.objects;

-- Por si quedaron nombres viejos
DROP POLICY IF EXISTS "storage_select_tecnocasa" ON storage.objects;
DROP POLICY IF EXISTS "storage_insert_tecnocasa" ON storage.objects;
DROP POLICY IF EXISTS "storage_update_tecnocasa" ON storage.objects;
DROP POLICY IF EXISTS "storage_delete_tecnocasa" ON storage.objects;

CREATE POLICY "storage_insert_tecnocasa"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'tecnocasa-assets');

CREATE POLICY "storage_update_tecnocasa"
ON storage.objects FOR UPDATE
USING (bucket_id = 'tecnocasa-assets');

CREATE POLICY "storage_delete_tecnocasa"
ON storage.objects FOR DELETE
USING (bucket_id = 'tecnocasa-assets');
