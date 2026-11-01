-- peptalk · archivos y accesos.
-- "docs": privado (papers, resoluciones, certificados). "media": público (imágenes de fichas,
-- banners y fotos del newsletter); los nombres llevan un UUID, así que no se pueden adivinar.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('docs', 'docs', false, 26214400, null),
  ('media', 'media', true, 8388608, array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'])
on conflict (id) do nothing;

create policy "equipo lee documentos" on storage.objects for select using (bucket_id = 'docs' and pt_is('admin', 'editor', 'agente'));
create policy "editores suben documentos" on storage.objects for insert with check (bucket_id = 'docs' and pt_is('admin', 'editor'));
create policy "editores borran documentos" on storage.objects for delete using (bucket_id = 'docs' and pt_is('admin', 'editor'));
create policy "editores suben imágenes" on storage.objects for insert with check (bucket_id = 'media' and pt_is('admin', 'editor'));
create policy "editores reemplazan imágenes" on storage.objects for update using (bucket_id = 'media' and pt_is('admin', 'editor'));
create policy "editores borran imágenes" on storage.objects for delete using (bucket_id = 'media' and pt_is('admin', 'editor'));

-- Accesos explícitos (no depender de los permisos por defecto del proyecto):
-- el visitante anónimo no toca ninguna tabla; sólo puede llamar a pt_submit_lead.
revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from anon, public;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
grant execute on function pt_submit_lead(jsonb) to anon;
grant execute on all functions in schema public to service_role;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke execute on functions from anon, public;

-- columnas que cada rol puede escribir (RLS decide las filas; esto, los campos)
revoke update on leads from authenticated;
grant update (state, internal_note, doctor) on leads to authenticated;
revoke update on profiles from authenticated;
grant update (name, role, active, license, provinces) on profiles to authenticated;
revoke update on audit from authenticated;
revoke insert, delete on audit from authenticated;
revoke insert, delete on site_settings from authenticated;
grant update (value) on site_settings to authenticated;
