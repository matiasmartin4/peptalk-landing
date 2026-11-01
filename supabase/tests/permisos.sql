-- Pruebas de permisos por rol. Correr con ./scripts/test_db.sh (Postgres local, sin Docker).
\set ON_ERROR_STOP 0
\set QUIET 1
insert into auth.users (id, email) values
 ('00000000-0000-0000-0000-00000000000a','admin@x'),('00000000-0000-0000-0000-00000000000e','editor@x'),
 ('00000000-0000-0000-0000-0000000000a9','grok@x'),('00000000-0000-0000-0000-00000000000d','medico@x'),
 ('00000000-0000-0000-0000-00000000000f','medico2@x'),('00000000-0000-0000-0000-000000000099','nuevo@x');
update profiles set active = true, role = case email when 'admin@x' then 'admin' when 'editor@x' then 'editor' when 'grok@x' then 'agente' else 'medico' end::pt_role where email <> 'nuevo@x';

create function t(label text, ok boolean) returns void language plpgsql as $$ begin raise notice '% %', case when coalesce(ok, false) then 'PASA' else 'FALLA' end, label; end $$;
create function falla(label text, q text) returns void language plpgsql as $$
begin execute q; perform t(label, false); exception when others then perform t(label, true); end $$;
grant execute on function t(text, boolean), falla(text, text) to anon, authenticated;

\echo '— visitante'
set role anon;
select falla('visitante no lee el catálogo', 'select 1 from peptides');
select falla('visitante no lee contactos', 'select 1 from leads');
select falla('visitante no llama funciones internas', $$select pt_approve_draft(gen_random_uuid())$$);
select pt_submit_lead('{"kind":"newsletter","email":"Ana@Mail.com"}');
select pt_submit_lead('{"kind":"newsletter","email":"ana@mail.com"}');
select pt_submit_lead('{"kind":"derivacion","name":"Ana","email":"ana@mail.com","prov":"Córdoba","consent":{"adult":true,"c1":true,"c2":true}}');
select pt_submit_lead('{"kind":"derivacion","name":"Beto","phone":"1155554444","prov":"Salta","consent":{"adult":true,"c1":true,"c2":true}}');
select falla('derivación sin consentimiento rechazada', $$select pt_submit_lead('{"kind":"derivacion","name":"X","email":"b@b.com","consent":{}}')$$);
select falla('email inválido rechazado', $$select pt_submit_lead('{"kind":"newsletter","email":"no-es-mail"}')$$);
reset role;
select t('newsletter sin duplicar por mayúsculas', (select count(*) from leads where kind='newsletter') = 1);
select t('derivaciones guardadas', (select count(*) from leads where kind='derivacion') = 2);

\echo '— usuario sin activar'
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000099';
select t('usuario sin activar no ve nada', (select count(*) from peptides) = 0 and (select count(*) from site_settings) = 0);

\echo '— Grok (agente)'
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a9';
select t('agente lee el catálogo', (select count(*) from peptides) = 40);
update peptides set summary = 'hackeado' where slug = 'bpc-157';
reset role; select t('agente no edita fichas directo', (select summary from peptides where slug='bpc-157') <> 'hackeado'); set role authenticated;
insert into drafts (slug, kind, payload, source_url, reason) values ('bpc-157', 'nota', '{"body":"Paper nuevo"}', 'https://example.org/paper', 'novedad');
insert into drafts (slug, kind, payload, reason) values ('bpc-157', 'cambio', '{"set":{"ev":"B","tags":["destacado"],"summary_plain":"En pocas palabras"},"status":{"FDA":{"v":"Aprobado","url":"https://fda.gov/x","note":"prueba"}}}', 'test');
insert into drafts (slug, kind, payload, reason) values ('tb-500', 'cambio', '{"set":{"dosing":"10 mg"}}', 'intenta dosis');
insert into drafts (kind, payload, source_url, reason) values ('nuevo', '{"slug":"peptido-x","name":"Péptido X","sys":"piel","type":"Péptido","status":{"ANMAT":{"v":"Pendiente"},"FDA":{"v":"Pendiente"},"EMA":{"v":"Pendiente"},"WADA":{"v":"Pendiente"}}}', 'https://example.org/x', 'nuevo');
select falla('agente no se autoaprueba', $$insert into drafts (slug, kind, payload, state) values ('bpc-157', 'nota', '{"body":"x"}', 'aprobado')$$);
select falla('agente no aprueba', $$select pt_approve_draft((select id from drafts limit 1))$$);
insert into news (title, summary, kind, source_url, happened_on) values ('ANMAT emite alerta', 'Resumen', 'alerta', 'https://anmat.gob.ar/x', current_date);
insert into news_peptides select id, 'bpc-157' from news where title = 'ANMAT emite alerta';
select falla('agente no publica novedades', $$insert into news (title, kind, source_url, state, published) values ('x', 'estudio', 'https://x.org', 'aprobada', true)$$);
update news set state = 'aprobada';
reset role; select t('agente no aprueba novedades', (select state from news limit 1) = 'propuesta'); set role authenticated;
select t('agente no ve contactos', (select count(*) from leads) = 0);
select t('agente no ve la tienda', (select count(*) from products) = 0);
select t('agente no ve el newsletter', (select count(*) from newsletter_issues) = 0);
update site_settings set value = '[]' where key = 'agencias_visibles';
reset role; select t('agente no cambia la configuración', (select jsonb_array_length(value) from site_settings where key='agencias_visibles') = 4); set role authenticated;

\echo '— editor'
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';
select pt_approve_draft(id) from drafts where kind = 'nota';
select pt_approve_draft(id, 'chequeado') from drafts where kind = 'cambio' and slug = 'bpc-157';
select t('nota aprobada queda con autor Grok', (select author from peptide_notes limit 1) = '00000000-0000-0000-0000-0000000000a9');
select t('cambio aplicado (evidencia, etiquetas, resumen simple, FDA)', (select ev = 'B' and tags = '{destacado}' and summary_plain = 'En pocas palabras'
  and status->'FDA'->>'v' = 'Aprobado' and status->'ANMAT'->>'v' = 'No aprobado' from peptides where slug='bpc-157'));
select falla('borrador no puede tocar la dosis', $$select pt_approve_draft((select id from drafts where slug = 'tb-500'))$$);
select pt_approve_draft(id) from drafts where kind = 'nuevo';
select t('ficha nueva entra sin publicar y con etiqueta nuevo', (select not published and tags = '{nuevo}' from peptides where slug = 'peptido-x'));
select falla('estado WADA inválido rechazado', $$update peptides set status = status || '{"WADA":{"v":"Aprobado","url":"https://x"}}' where slug='bpc-157'$$);
select falla('estado sin fuente rechazado', $$update peptides set status = status || '{"EMA":{"v":"Aprobado"}}' where slug='bpc-157'$$);
update peptides set dosing = 'Dosis de prueba', usage_process = 'Proceso' where slug = 'bpc-157';
select falla('editor no firma la dosis en nombre de un médico', $$update peptides set dosing_reviewed_by = '00000000-0000-0000-0000-00000000000d', dosing_reviewed_at = now() where slug = 'bpc-157'$$);
select falla('editor no usa la función de revisión médica', $$select pt_review_dosing('bpc-157')$$);
insert into peptide_media (slug, kind, path, alt, is_cover, created_by) values ('bpc-157', 'imagen', 'bpc-157/a.webp', 'Vial', true, auth.uid());
insert into peptide_media (slug, kind, url, created_by) values ('bpc-157', 'video', 'https://youtube.com/watch?v=x', auth.uid());
select falla('una sola portada por ficha', $$insert into peptide_media (slug, kind, path, is_cover, created_by) values ('bpc-157', 'imagen', 'bpc-157/b.webp', true, auth.uid())$$);
select falla('video sin link rechazado', $$insert into peptide_media (slug, kind, created_by) values ('bpc-157', 'video', auth.uid())$$);
update news set state = 'aprobada', published = true;
select t('editor aprueba novedad y queda registrado', (select reviewed_by = '00000000-0000-0000-0000-00000000000e' and published from news limit 1));
select falla('novedad sin fuente no se aprueba', $$insert into news (title, kind, state) values ('sin fuente', 'estudio', 'aprobada')$$);
insert into newsletter_issues (title, subject, week_of, banner_path, body) values ('Semana 1', 'Lo nuevo', current_date, 'newsletter/banner.webp', '{"type":"doc","content":[{"type":"paragraph"}]}');
insert into newsletter_items (issue_id, sort, kind, news_id) select i.id, 1, 'novedad', n.id from newsletter_issues i, news n;
insert into newsletter_items (issue_id, sort, kind, slug) select id, 2, 'peptido', 'peptido-x' from newsletter_issues;
update newsletter_issues set state = 'enviada', sent_at = now(), sent_count = 1;
select falla('edición enviada no se edita', $$update newsletter_issues set subject = 'otro'$$);
select falla('edición enviada no suma secciones', $$insert into newsletter_items (issue_id, kind, slug) select id, 'peptido', 'bpc-157' from newsletter_issues$$);
insert into products (slug, sku, name, strength_mg, price, compare_at_price, currency) values ('bpc-157', 'PT-BPC-10', 'BPC-157 10 mg', 10, 100, 120, 'ARS');
insert into product_price_tiers select id, 3, 10 from products;
select falla('precio tachado menor al precio rechazado', $$insert into products (slug, sku, name, price, compare_at_price) values ('bpc-157', 'PT-BPC-5', 'x', 100, 80)$$);
select t('tienda cargada pero apagada', (select not (value->>'activa')::boolean from site_settings where key = 'tienda') and (select count(*) from products) = 1);
select t('editor no ve contactos', (select count(*) from leads) = 0);
update site_settings set value = '[]' where key = 'agencias_visibles';
reset role; select t('editor no cambia la configuración', (select jsonb_array_length(value) from site_settings where key='agencias_visibles') = 4); set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';

\echo '— admin'
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
update leads set doctor = '00000000-0000-0000-0000-00000000000d', state = 'derivado' where kind = 'derivacion' and name = 'Ana';
update leads set doctor = '00000000-0000-0000-0000-00000000000f' where kind = 'derivacion' and name = 'Beto';
select t('admin ve contactos', (select count(*) from leads) = 3);
select falla('admin no se baja a sí mismo', $$update profiles set role = 'editor' where email = 'admin@x'$$);
update profiles set active = true where email = 'nuevo@x';
update site_settings set value = '["ANMAT", "FDA"]' where key = 'agencias_visibles';
reset role;
select t('admin activa usuarios', (select active from profiles where email='nuevo@x'));
select t('admin cambia agencias visibles', (select value from site_settings where key='agencias_visibles') = '["ANMAT", "FDA"]');
set role authenticated;

\echo '— médico'
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
select t('médico ve sólo sus contactos', (select count(*) from leads) = 1);
select t('médico no ve el catálogo', (select count(*) from peptides) = 0);
update leads set state = 'contactado', internal_note = 'llamé' where kind = 'derivacion';
select falla('médico no se desasigna', $$update leads set doctor = null where kind = 'derivacion'$$);
select falla('médico no cambia datos del paciente', $$update leads set email = 'otro@x.com'$$);
select pt_review_dosing('bpc-157');
reset role;
select t('médico actualizó estado', (select state from leads where name = 'Ana') = 'contactado');
select t('el otro médico no fue tocado', (select state from leads where name = 'Beto') = 'nuevo');
select t('dosis revisada por el médico', (select dosing_reviewed_by = '00000000-0000-0000-0000-00000000000d' from peptides where slug = 'bpc-157'));
update peptides set dosing = 'Dosis cambiada' where slug = 'bpc-157';
select t('cambiar la dosis borra la revisión médica', (select dosing_reviewed_by is null from peptides where slug = 'bpc-157'));

\echo '— historial'
select t('historial registra autor de los cambios', (select count(*) from audit where tbl='peptides' and actor='00000000-0000-0000-0000-00000000000e') >= 1);
select t('historial registra la configuración', (select count(*) from audit where tbl='site_settings') >= 1);

\echo '— revisión médica'
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
select t('médico ve la cola de dosis', (select count(*) from pt_dosing_queue()) = 1);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';
select t('editor no usa la cola médica', (select count(*) from pt_dosing_queue()) = 0);
reset role;
