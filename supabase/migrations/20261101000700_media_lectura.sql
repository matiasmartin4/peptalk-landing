-- peptalk · el almacenamiento de Supabase pide permiso de lectura para borrar o reemplazar
-- un archivo. El bucket "media" es público para el sitio, pero esa lectura pública no cuenta
-- para la API: el equipo necesita su propia política.
create policy "equipo lee imágenes" on storage.objects for select using (bucket_id = 'media' and pt_is('admin', 'editor', 'agente'));
