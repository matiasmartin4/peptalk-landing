\set ON_ERROR_STOP 0
\set QUIET 1
insert into auth.users (id, email) values
 ('00000000-0000-0000-0000-00000000000a','admin@x'),('00000000-0000-0000-0000-00000000000e','editor@x'),
 ('00000000-0000-0000-0000-0000000000a9','grok@x'),('00000000-0000-0000-0000-00000000000d','medico@x'),
 ('00000000-0000-0000-0000-000000000099','nuevo@x');
update profiles set active = true, role = case email when 'admin@x' then 'admin' when 'editor@x' then 'editor' when 'grok@x' then 'agente' when 'medico@x' then 'medico' end::pt_role where email <> 'nuevo@x';

create function t(label text, ok boolean) returns void language plpgsql as $$ begin raise notice '% %', case when ok then 'PASA' else 'FALLA' end, label; end $$;
grant execute on function t(text, boolean) to anon, authenticated;

-- visitante
set role anon;
select t('visitante no lee el catálogo', (select count(*) from peptides) = 0);
select pt_submit_lead('{"kind":"newsletter","email":"Ana@Mail.com"}');
select pt_submit_lead('{"kind":"newsletter","email":"ana@mail.com"}');
select pt_submit_lead('{"kind":"derivacion","name":"Ana","email":"ana@mail.com","prov":"Córdoba","consent":{"adult":true,"c1":true,"c2":true}}');
do $$ begin perform pt_submit_lead('{"kind":"derivacion","name":"Sin consentimiento","email":"b@b.com","consent":{}}'); perform t('derivación sin consentimiento rechazada', false);
exception when others then perform t('derivación sin consentimiento rechazada', true); end $$;
select t('visitante no lee contactos', (select count(*) from leads) = 0);
reset role;
select t('newsletter sin duplicar por mayúsculas', (select count(*) from leads where kind='newsletter') = 1);

-- usuario sin activar
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000099';
select t('usuario sin activar no ve nada', (select count(*) from peptides) = 0);

-- Grok (agente)
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a9';
select t('agente lee el catálogo', (select count(*) from peptides) = 40);
update peptides set summary = 'hackeado' where slug = 'bpc-157';
reset role; select t('agente no edita directo', (select summary from peptides where slug='bpc-157') <> 'hackeado'); set role authenticated;
insert into drafts (slug, kind, payload, source_url, reason) values ('bpc-157', 'nota', '{"body":"Nuevo paper en Cureus 2026"}', 'https://example.org/paper', 'novedad');
insert into drafts (slug, kind, payload, reason) values ('bpc-157', 'cambio', '{"set":{"ev":"B"},"status":{"FDA":{"v":"Aprobado","url":"https://fda.gov/x","note":"prueba"}}}', 'test');
do $$ begin insert into drafts (slug, kind, payload, state) values ('bpc-157', 'nota', '{"body":"x"}', 'aprobado'); perform t('agente no se autoaprueba', false);
exception when others then perform t('agente no se autoaprueba', true); end $$;
do $$ begin perform pt_approve_draft((select id from drafts limit 1)); perform t('agente no aprueba', false);
exception when others then perform t('agente no aprueba', true); end $$;
select t('agente no ve contactos', (select count(*) from leads) = 0);

-- editor revisa
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';
select pt_approve_draft(id) from drafts where kind = 'nota';
select pt_approve_draft(id, 'chequeado') from drafts where kind = 'cambio';
select t('nota aprobada queda con autor Grok', (select author from peptide_notes limit 1) = '00000000-0000-0000-0000-0000000000a9');
select t('cambio aplicado (evidencia y FDA)', (select ev = 'B' and status->'FDA'->>'v' = 'Aprobado' and status->'ANMAT'->>'v' = 'No aprobado' from peptides where slug='bpc-157'));
do $$ begin update peptides set status = status || '{"WADA":{"v":"Aprobado","url":"https://x"}}' where slug='bpc-157'; perform t('estado inválido rechazado', false);
exception when check_violation then perform t('estado inválido rechazado', true); end $$;
do $$ begin update peptides set status = status || '{"EMA":{"v":"Aprobado"}}' where slug='bpc-157'; perform t('estado sin fuente rechazado', false);
exception when check_violation then perform t('estado sin fuente rechazado', true); end $$;
select t('editor no ve contactos', (select count(*) from leads) = 0);

-- admin asigna médico
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
update leads set doctor = '00000000-0000-0000-0000-00000000000d', state = 'derivado' where kind = 'derivacion';
select t('admin ve contactos', (select count(*) from leads) = 2);
do $$ begin update profiles set role = 'editor' where email = 'admin@x'; perform t('admin no se baja a sí mismo', false);
exception when others then perform t('admin no se baja a sí mismo', true); end $$;
update profiles set active = true where email = 'nuevo@x';
reset role; select t('admin activa usuarios', (select active from profiles where email='nuevo@x')); set role authenticated;

-- médico
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
select t('médico ve sólo sus contactos', (select count(*) from leads) = 1);
select t('médico no ve el catálogo', (select count(*) from peptides) = 0);
update leads set state = 'contactado', internal_note = 'llamé' where kind = 'derivacion';
do $$ begin update leads set doctor = null where kind = 'derivacion'; perform t('médico no se desasigna', false);
exception when others then perform t('médico no se desasigna', true); end $$;
reset role;
select t('médico actualizó estado', (select state from leads where kind='derivacion') = 'contactado');
select t('historial registra autor', (select count(*) from audit where tbl='peptides' and actor='00000000-0000-0000-0000-00000000000e') >= 1);
